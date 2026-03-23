import { Agent, OpenAIProvider, Runner, setTracingDisabled } from '@openai/agents';
import { z } from 'zod';
import type { AnalysisResponse, CausalAnalysisResult, CausalEffect, ResearchBriefing } from '../contracts/analysis';
import type { CausalEdge, CausalGraph, CausalNode, MarketImpact, Opportunity } from '../../domain/models';
import type { Logger } from '../../infrastructure/logging/logger';
import { openRouterClient } from '../../infrastructure/llm/openRouterClient';
import { WebSearch } from '../../infrastructure/search/webSearch';
import { GraphBuilder } from './graphBuilder';
import { CAUSAL_SYSTEM_PROMPT, CAUSAL_USER_PROMPT_TEMPLATE, EXPAND_NODE_USER_PROMPT_TEMPLATE } from '../../prompts/causalPrompt';
import {
  MARKET_IMPACT_SYSTEM_PROMPT,
  MARKET_IMPACT_USER_PROMPT_TEMPLATE,
  OPPORTUNITY_SYSTEM_PROMPT,
  OPPORTUNITY_USER_PROMPT_TEMPLATE,
  RESEARCH_SUMMARIZATION_PROMPT,
  RESEARCH_USER_PROMPT_TEMPLATE,
} from '../../prompts/subAgentsPrompt';

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

const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

const causalEffectSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    text: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
    sources: z.array(sourceSchema),
    secondOrder: z.array(causalEffectSchema),
  }),
);

const researchBriefingSchema = z.object({
  content: z.string(),
  sourceCount: z.number(),
  research_unavailable: z.boolean(),
});

const causalAnalysisResultSchema = z.object({
  firstOrder: z.array(causalEffectSchema),
});

const causalExpansionSchema = z.object({
  effects: z.array(causalEffectSchema),
});

const marketImpactSchema = z.object({
  impacts: z.array(
    z.object({
      sector: z.string(),
      direction: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number(),
      explanation: z.string(),
    }),
  ),
});

const opportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      type: z.enum(['investment', 'startup']),
      title: z.string(),
      description: z.string(),
      confidence: z.number(),
      rationale: z.string(),
    }),
  ),
});

export class OpenAIAnalysisWorkflow {
  private readonly runner: Runner;
  private readonly graphBuilder = new GraphBuilder();
  private readonly search: (query: string) => Promise<string>;
  private readonly invokeAgentOverride?: (agentName: string, prompt: string) => Promise<unknown>;
  private readonly researchAgent: Agent<any, any>;
  private readonly causalAgent: Agent<any, any>;
  private readonly expansionAgent: Agent<any, any>;
  private readonly marketImpactAgent: Agent<any, any>;
  private readonly opportunityAgent: Agent<any, any>;

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
    this.researchAgent = this.createAgent('ResearchSummaryAgent', RESEARCH_SUMMARIZATION_PROMPT, researchBriefingSchema, model);
    this.causalAgent = this.createAgent('CausalAnalysisAgent', CAUSAL_SYSTEM_PROMPT, causalAnalysisResultSchema, model);
    this.expansionAgent = this.createAgent('CausalExpansionAgent', CAUSAL_SYSTEM_PROMPT, causalExpansionSchema, model);
    this.marketImpactAgent = this.createAgent('MarketImpactAgent', MARKET_IMPACT_SYSTEM_PROMPT, marketImpactSchema, model);
    this.opportunityAgent = this.createAgent('OpportunityAgent', OPPORTUNITY_SYSTEM_PROMPT, opportunitySchema, model);
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

  private createAgent(name: string, instructions: string, outputSchema: z.ZodTypeAny, model: string): Agent<any, any> {
    return new Agent({
      name,
      instructions,
      handoffDescription: name,
      model,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: outputSchema as any,
    });
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
      research: this.getFallbackResearchBriefing('Research has not been run yet.'),
    };
  }

  private async runResearch(state: WorkflowState, context: WorkflowContext): Promise<void> {
    context.logger.info('Running research step', { correlationId: context.correlationId });

    try {
      const rawResults = await this.search(state.event);

      if (!rawResults || rawResults.trim().length < 50) {
        state.research = this.getFallbackResearchBriefing('No substantial search results found.');
        state.errors.push('Research Unavailable (Proceeding with LLM internal knowledge)');
        return;
      }

      const prompt = RESEARCH_USER_PROMPT_TEMPLATE.replace('{event}', state.event).replace('{rawResults}', rawResults);
      const result = await this.runStructuredAgent<ResearchBriefing>(this.researchAgent, prompt, context);
      const { sourceCount, sourceKey } = this.buildSourceKey(rawResults);

      state.research = {
        content: `${result.content}\n\n### SOURCE KEY (FOR CITATIONS):\n${sourceKey}`,
        sourceCount,
        research_unavailable: false,
      };
    } catch (error) {
      state.research = this.getFallbackResearchBriefing(this.getErrorMessage(error));
      state.errors.push('Research Unavailable (Proceeding with LLM internal knowledge)');
    }
  }

  private async runCausal(state: WorkflowState, context: WorkflowContext): Promise<void> {
    context.logger.info('Running causal step', { correlationId: context.correlationId });

    try {
      const formattedContext = state.research.content
        ? `### RESEARCH CONTEXT (USE THIS TO GROUND YOUR ANALYSIS):\n${state.research.content}\n`
        : '';

      const prompt = CAUSAL_USER_PROMPT_TEMPLATE
        .replace('{event}', state.event)
        .replace('{searchContext}', formattedContext);

      const result = await this.runStructuredAgent<CausalAnalysisResult>(this.causalAgent, prompt, context);
      state.firstOrderData = result;

      const graphSegment = this.graphBuilder.buildCoreGraph(state.event, result);
      state.graph = {
        ...state.graph,
        nodes: graphSegment.nodes,
        edges: graphSegment.edges,
      };
    } catch (error) {
      state.firstOrderData = { firstOrder: [] };
      const graphSegment = this.graphBuilder.buildCoreGraph(state.event, state.firstOrderData);
      state.graph = {
        ...state.graph,
        nodes: graphSegment.nodes,
        edges: graphSegment.edges,
      };
      state.errors.push(`Causal Agent Failed: ${this.getErrorMessage(error)}`);
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

    try {
      const expansions = await Promise.all(
        firstOrderNodes.map((node) => this.runExpansionAgent(node.id, node.text, state.event, context)),
      );

      const nextGraph = {
        ...state.graph,
        nodes: [...state.graph.nodes],
        edges: [...state.graph.edges],
      };

      expansions.forEach((segment) => {
        this.graphBuilder.mergeGraphSegments(nextGraph, segment);
      });

      state.graph = nextGraph;
    } catch (error) {
      state.errors.push(`Causal Expansion Failed (Partial graph preserved): ${this.getErrorMessage(error)}`);
    }
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

    try {
      const prompt = MARKET_IMPACT_USER_PROMPT_TEMPLATE
        .replace(
          '{causalChain}',
          JSON.stringify(
            {
              event: state.event,
              consequences,
            },
            null,
            2,
          ),
        )
        .replace('{researchContext}', state.research.content || 'No additional research available.');

      const result = await this.runStructuredAgent<{ impacts: MarketImpact[] }>(this.marketImpactAgent, prompt, context);
      const impacts = result.impacts.filter(
        (impact) =>
          impact.sector &&
          ['positive', 'negative', 'neutral'].includes(impact.direction) &&
          typeof impact.confidence === 'number' &&
          Boolean(impact.explanation),
      );

      if (impacts.length === 0) {
        throw new Error('All returned impacts failed schema validation.');
      }

      state.graph.marketImpacts = impacts;
    } catch (error) {
      state.graph.marketImpacts = this.getFallbackMarketImpacts();
      state.errors.push(`Market Impact Agent used fallback: ${this.getErrorMessage(error)}`);
    }
  }

  private async runOpportunity(state: WorkflowState, context: WorkflowContext): Promise<void> {
    if (!state.graph.marketImpacts || state.graph.marketImpacts.length === 0) {
      state.graph.opportunities = [];
      return;
    }

    context.logger.info('Running opportunity step', { correlationId: context.correlationId });

    try {
      const prompt = OPPORTUNITY_USER_PROMPT_TEMPLATE
        .replace('{marketImpacts}', JSON.stringify(state.graph.marketImpacts, null, 2))
        .replace('{researchContext}', state.research.content || 'No additional research available.');

      const result = await this.runStructuredAgent<{ opportunities: Opportunity[] }>(this.opportunityAgent, prompt, context);
      const opportunities = result.opportunities.filter(
        (opportunity) =>
          (opportunity.type === 'investment' || opportunity.type === 'startup') &&
          opportunity.title.length > 0 &&
          typeof opportunity.description === 'string' &&
          typeof opportunity.confidence === 'number' &&
          opportunity.rationale.length > 0,
      );

      if (opportunities.length === 0) {
        throw new Error('All returned opportunities failed schema validation.');
      }

      state.graph.opportunities = opportunities;
    } catch (error) {
      state.graph.opportunities = this.getFallbackOpportunities();
      state.errors.push(`Opportunity Agent used fallback: ${this.getErrorMessage(error)}`);
    }
  }

  private async runExpansionAgent(
    nodeId: string,
    nodeText: string,
    rootEvent: string,
    context: WorkflowContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    context.logger.info('Running focused expansion agent', {
      correlationId: context.correlationId,
      nodeId,
    });

    const prompt = EXPAND_NODE_USER_PROMPT_TEMPLATE
      .replace('{nodeText}', nodeText)
      .replace('{rootEvent}', rootEvent);

    const result = await this.runStructuredAgent<{ effects: CausalEffect[] }>(this.expansionAgent, prompt, context);
    return this.graphBuilder.buildExpansionGraph(nodeId, result.effects);
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

  private buildSourceKey(rawResults: string): { sourceCount: number; sourceKey: string } {
    const sourceMatches = [...rawResults.matchAll(/SOURCE:\s*(.*?)\nURL:\s*(.*?)\n/g)];

    return {
      sourceCount: sourceMatches.length,
      sourceKey: sourceMatches.map((match, index) => `[${index + 1}] ${match[1]} (${match[2]})`).join('\n'),
    };
  }

  private getFallbackResearchBriefing(reason: string): ResearchBriefing {
    return {
      content: `### RESEARCH UNAVAILABLE / FALLBACK MODE\nReason: ${reason}\nUsing internal knowledge models for analysis. Grounded data may be limited or outdated.`,
      sourceCount: 0,
      research_unavailable: true,
    };
  }

  private getFallbackMarketImpacts(): MarketImpact[] {
    return [
      {
        sector: 'Broad Market',
        direction: 'neutral',
        confidence: 0.3,
        explanation:
          'Market impact analysis is temporarily unavailable. This is a fallback entry to preserve pipeline continuity.',
      },
    ];
  }

  private getFallbackOpportunities(): Opportunity[] {
    return [
      {
        type: 'investment',
        title: 'Opportunity Analysis Unavailable',
        description:
          'Opportunity surfacing is temporarily unavailable. This is a fallback entry to preserve pipeline continuity.',
        confidence: 0.2,
        rationale: 'Fallback entry - no actionable rationale available at this time.',
      },
    ];
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
