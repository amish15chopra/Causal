import { Agent, OpenAIProvider, Runner, setTracingDisabled } from '@openai/agents';
import type { AnalysisResponse, CausalAnalysisResult, ResearchBriefing } from '../contracts/analysis';
import type { CausalEdge, CausalGraph, CausalNode, MarketImpact, Opportunity } from '../../domain/models';
import type { Logger } from '../../infrastructure/logging/logger';
import { openRouterClient } from '../../infrastructure/llm/openRouterClient';
import { WebSearch } from '../../infrastructure/search/webSearch';
import { GraphBuilder } from './graphBuilder';
import { ResearchAgent } from '../agents/researchAgent';
import { CausalAnalysisAgent } from '../agents/causalAnalysisAgent';
import { CausalExpansionAgent } from '../agents/causalExpansionAgent';
import { MarketImpactAgent } from '../agents/marketImpactAgent';
import { OpportunityAgent } from '../agents/opportunityAgent';

export interface WorkflowContext {
  correlationId: string;
  logger: Logger;
}

interface WorkflowState {
  event: string;
  graph: CausalGraph;
  errors: string[];
  research: ResearchBriefing;
  firstOrderData?: CausalAnalysisResult;
}

interface WorkflowDependencies {
  search?: (query: string) => Promise<string>;
  invokeAgent?: (agentName: string, prompt: string) => Promise<unknown>;
  sdkModel?: string;
}

const DEFAULT_SDK_MODEL = process.env.OPENAI_AGENTS_MODEL || 'openai/gpt-4o-mini';
const AGENT_RUN_TIMEOUT_MS = 45000;

export class OpenAIAnalysisWorkflow {
  private readonly runner: Runner;
  private readonly graphBuilder = new GraphBuilder();
  private readonly search: (query: string) => Promise<string>;
  private readonly invokeAgentOverride?: (agentName: string, prompt: string) => Promise<unknown>;
  private readonly researchAgent: ResearchAgent;
  private readonly causalAgent: CausalAnalysisAgent;
  private readonly expansionAgent: CausalExpansionAgent;
  private readonly marketImpactAgent: MarketImpactAgent;
  private readonly opportunityAgent: OpportunityAgent;

  public constructor(dependencies: WorkflowDependencies = {}) {
    setTracingDisabled(true);

    const provider = new OpenAIProvider({
      openAIClient: openRouterClient,
      useResponses: false,
    });

    this.runner = new Runner({
      modelProvider: provider,
      model: dependencies.sdkModel || DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      tracingDisabled: true,
      traceIncludeSensitiveData: false,
      workflowName: 'causal2-analysis-workflow',
    });

    this.search = dependencies.search || (async (query: string) => WebSearch.getInstance().search(query));
    this.invokeAgentOverride = dependencies.invokeAgent;

    const model = dependencies.sdkModel || DEFAULT_SDK_MODEL;
    this.researchAgent = new ResearchAgent({ model });
    this.causalAgent = new CausalAnalysisAgent({ model });
    this.expansionAgent = new CausalExpansionAgent({ model });
    this.marketImpactAgent = new MarketImpactAgent({ model });
    this.opportunityAgent = new OpportunityAgent({ model });
  }

  public async analyze(eventText: string, context: WorkflowContext): Promise<AnalysisResponse> {
    const state = this.createInitialState(eventText);

    await this.runResearch(state, context);
    await this.runCausal(state, context);
    await this.runExpansion(state, context);
    await this.runMarketImpact(state, context);
    await this.runOpportunity(state, context);

    return {
      event: state.event,
      graph: state.graph,
      errors: state.errors,
    };
  }

  public async expandNode(
    nodeId: string,
    nodeText: string,
    rootEvent: string,
    context: WorkflowContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    return this.runExpansionAgent(nodeId, nodeText, rootEvent, context);
  }

  private createInitialState(event: string): WorkflowState {
    return {
      event,
      graph: {
        nodes: [],
        edges: [],
        marketImpacts: [],
        opportunities: [],
      },
      errors: [],
      research: {
        content: '### RESEARCH UNAVAILABLE / FALLBACK MODE\nReason: Research has not been run yet.\nUsing internal knowledge models for analysis. Grounded data may be limited or outdated.',
        sourceCount: 0,
        research_unavailable: true,
      },
    };
  }

  private async runResearch(state: WorkflowState, context: WorkflowContext): Promise<void> {
    context.logger.info('Running research step', { correlationId: context.correlationId });

    const result = await this.researchAgent.run({
      event: state.event,
      search: this.search,
      invoke: <T>(agent: Agent<any, any>, prompt: string) => this.runStructuredAgent<T>(agent, prompt, context),
    });

    state.research = result.briefing;
    if (result.errorMessage) {
      state.errors.push(result.errorMessage);
    }
  }

  private async runCausal(state: WorkflowState, context: WorkflowContext): Promise<void> {
    context.logger.info('Running causal step', { correlationId: context.correlationId });

    const result = await this.causalAgent.run({
      event: state.event,
      researchContext: state.research.content,
      invoke: <T>(agent: Agent<any, any>, prompt: string) => this.runStructuredAgent<T>(agent, prompt, context),
    });

    state.firstOrderData = result.analysis;
    const graphSegment = this.graphBuilder.buildCoreGraph(state.event, result.analysis);
    state.graph = {
      ...state.graph,
      nodes: graphSegment.nodes,
      edges: graphSegment.edges,
    };

    if (result.errorMessage) {
      state.errors.push(result.errorMessage);
    }
  }

  private async runExpansion(state: WorkflowState, context: WorkflowContext): Promise<void> {
    const firstOrderNodes = state.graph.nodes.filter((node) => node.type === 'first_order_effect');
    if (firstOrderNodes.length === 0) {
      return;
    }

    context.logger.info('Running expansion step', {
      correlationId: context.correlationId,
      nodesToExpand: firstOrderNodes.length,
    });

    const nextGraph = {
      ...state.graph,
      nodes: [...state.graph.nodes],
      edges: [...state.graph.edges],
    };

    for (const node of firstOrderNodes) {
      const segment = await this.runExpansionAgent(node.id, node.text, state.event, context);
      this.graphBuilder.mergeGraphSegments(nextGraph, segment.nodes.length > 0 || segment.edges.length > 0 ? segment : { nodes: [], edges: [] });
      if (segment.errorMessage) {
        state.errors.push(segment.errorMessage);
      }
    }

    state.graph = nextGraph;
  }

  private async runMarketImpact(state: WorkflowState, context: WorkflowContext): Promise<void> {
    const consequences = state.graph.nodes
      .filter((node) => node.type !== 'macro_event')
      .map((node) => ({
        text: node.text,
        type: node.type,
        reasoning: node.reasoning,
      }));

    if (consequences.length === 0) {
      state.graph.marketImpacts = [];
      return;
    }

    context.logger.info('Running market impact step', { correlationId: context.correlationId });

    const result = await this.marketImpactAgent.run({
      event: state.event,
      consequences,
      researchContext: state.research.content,
      invoke: <T>(agent: Agent<any, any>, prompt: string) => this.runStructuredAgent<T>(agent, prompt, context),
    });

    state.graph.marketImpacts = result.impacts;
    if (result.errorMessage) {
      state.errors.push(result.errorMessage);
    }
  }

  private async runOpportunity(state: WorkflowState, context: WorkflowContext): Promise<void> {
    if (!state.graph.marketImpacts || state.graph.marketImpacts.length === 0) {
      state.graph.opportunities = [];
      return;
    }

    context.logger.info('Running opportunity step', { correlationId: context.correlationId });

    const result = await this.opportunityAgent.run({
      marketImpacts: state.graph.marketImpacts,
      researchContext: state.research.content,
      invoke: <T>(agent: Agent<any, any>, prompt: string) => this.runStructuredAgent<T>(agent, prompt, context),
    });

    state.graph.opportunities = result.opportunities;
    if (result.errorMessage) {
      state.errors.push(result.errorMessage);
    }
  }

  private async runExpansionAgent(
    nodeId: string,
    nodeText: string,
    rootEvent: string,
    context: WorkflowContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[]; errorMessage?: string }> {
    context.logger.info('Running focused expansion agent', {
      correlationId: context.correlationId,
      nodeId,
    });

    const result = await this.expansionAgent.run({
      nodeText,
      rootEvent,
      invoke: <T>(agent: Agent<any, any>, prompt: string) => this.runStructuredAgent<T>(agent, prompt, context),
    });

    const segment = this.graphBuilder.buildExpansionGraph(nodeId, result.effects);
    return {
      ...segment,
      errorMessage: result.errorMessage,
    };
  }

  private async runStructuredAgent<T>(agent: Agent<any, any>, prompt: string, context: WorkflowContext): Promise<T> {
    if (this.invokeAgentOverride) {
      return this.invokeAgentOverride(agent.name, prompt) as Promise<T>;
    }

    const result = await this.runWithTimeout(
      this.runner.run(agent, prompt, {
        context,
        maxTurns: 4,
      }),
      AGENT_RUN_TIMEOUT_MS,
      agent.name,
    );

    if (result.finalOutput === undefined) {
      throw new Error(`${agent.name} produced no final output.`);
    }

    return result.finalOutput as T;
  }
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }
}
