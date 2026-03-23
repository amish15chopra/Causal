import { Agent, OpenAIProvider, Runner, setTracingDisabled, tool } from '@openai/agents';
import type { RunContext } from '@openai/agents';
import { z } from 'zod';
import type { CausalAgentResponse, CausalEffect } from '../../agents/causalAgent';
import type { ResearchBriefing } from '../../agents/researchAgent';
import type { AnalysisResponse, AnalysisPipelineState, PipelineContext } from '../pipeline/types';
import type { CausalEdge, CausalGraph, CausalNode, MarketImpact, Opportunity } from '../../domain/models';
import { GraphBuilder } from '../services/graphBuilder';
import { openRouterClient } from '../../infrastructure/llm/openRouterClient';
import { WebSearch } from '../../infrastructure/search/webSearch';
import { CAUSAL_SYSTEM_PROMPT, CAUSAL_USER_PROMPT_TEMPLATE, EXPAND_NODE_USER_PROMPT_TEMPLATE } from '../../prompts/causalPrompt';
import {
  MARKET_IMPACT_SYSTEM_PROMPT,
  MARKET_IMPACT_USER_PROMPT_TEMPLATE,
  OPPORTUNITY_SYSTEM_PROMPT,
  OPPORTUNITY_USER_PROMPT_TEMPLATE,
  RESEARCH_SUMMARIZATION_PROMPT,
  RESEARCH_USER_PROMPT_TEMPLATE,
} from '../../prompts/subAgentsPrompt';
import type { AgentRuntime } from './agentRuntime';

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

const causalAgentResponseSchema = z.object({
  firstOrder: z.array(causalEffectSchema),
});

const researchBriefingSchema = z.object({
  content: z.string(),
  sourceCount: z.number(),
  research_unavailable: z.boolean(),
});

const marketImpactSchema = z.object({
  sector: z.string(),
  direction: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number(),
  explanation: z.string(),
});

const opportunitySchema = z.object({
  type: z.enum(['investment', 'startup']),
  title: z.string(),
  description: z.string(),
  confidence: z.number(),
  rationale: z.string(),
});

const causalExpansionOutputSchema = z.object({
  effects: z.array(causalEffectSchema),
});

const marketImpactOutputSchema = z.object({
  impacts: z.array(marketImpactSchema),
});

const opportunityOutputSchema = z.object({
  opportunities: z.array(opportunitySchema),
});

type AnalysisWorkflowContext = AnalysisPipelineState & {
  correlationId: string;
  logger: PipelineContext['logger'];
  steps: {
    research: boolean;
    causal: boolean;
    expansion: boolean;
    marketImpact: boolean;
    opportunity: boolean;
  };
};

type ExpansionWorkflowContext = {
  correlationId: string;
  logger: PipelineContext['logger'];
  nodeId: string;
  nodeText: string;
  rootEvent: string;
};

const ANALYSIS_MANAGER_INSTRUCTIONS = `You are AnalysisManager for a macro event decision-intelligence workflow.

Your job is to orchestrate tools in sequence until the workflow is complete.

Rules:
1. Always call the currently available tool instead of answering from memory.
2. Never skip a tool when it is enabled.
3. Run only one tool call at a time.
4. Once no tools are enabled, respond with a short completion message.
5. Do not invent market impacts or opportunities yourself; use tools for all analysis steps.
`;

const EXPANSION_MANAGER_INSTRUCTIONS = `You are ExpansionManager for a causal-graph workflow.

Call the expansion tool to derive second-order consequences for the selected node.
If the tool is unavailable or already used, respond with a short completion message.`;

const DEFAULT_SDK_MODEL = process.env.OPENAI_AGENTS_MODEL || 'openai/gpt-4o-mini';

export class OpenAIAgentRuntime implements AgentRuntime {
  private readonly AGENT_RUN_TIMEOUT_MS = 45000;
  private readonly MANAGER_RUN_TIMEOUT_MS = 120000;
  private readonly runner: Runner;
  private readonly graphBuilder: GraphBuilder;
  private readonly webSearch: WebSearch;
  private readonly researchSummaryAgent: Agent<AnalysisWorkflowContext, typeof researchBriefingSchema>;
  private readonly causalAnalysisAgent: Agent<AnalysisWorkflowContext, typeof causalAgentResponseSchema>;
  private readonly causalExpansionAgent: Agent<AnalysisWorkflowContext, typeof causalExpansionOutputSchema>;
  private readonly marketImpactAgent: Agent<AnalysisWorkflowContext, typeof marketImpactOutputSchema>;
  private readonly opportunityAgent: Agent<AnalysisWorkflowContext, typeof opportunityOutputSchema>;
  private readonly analysisManagerAgent: Agent<AnalysisWorkflowContext>;
  private readonly expansionManagerAgent: Agent<ExpansionWorkflowContext>;

  public constructor() {
    setTracingDisabled(true);

    const provider = new OpenAIProvider({
      openAIClient: openRouterClient,
      useResponses: false,
    });

    this.runner = new Runner({
      modelProvider: provider,
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      tracingDisabled: true,
      traceIncludeSensitiveData: false,
      workflowName: 'causal2-agent-workflow',
    });
    this.graphBuilder = new GraphBuilder();
    this.webSearch = WebSearch.getInstance();

    this.researchSummaryAgent = new Agent({
      name: 'ResearchSummaryAgent',
      instructions: RESEARCH_SUMMARIZATION_PROMPT,
      handoffDescription: 'Summarizes raw web-search results into a concise research briefing.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: researchBriefingSchema,
    });

    this.causalAnalysisAgent = new Agent({
      name: 'CausalAnalysisAgent',
      instructions: CAUSAL_SYSTEM_PROMPT,
      handoffDescription: 'Produces first-order causal effects in structured JSON.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: causalAgentResponseSchema,
    });

    this.causalExpansionAgent = new Agent({
      name: 'CausalExpansionAgent',
      instructions: CAUSAL_SYSTEM_PROMPT,
      handoffDescription: 'Expands first-order nodes into second-order effects in structured JSON.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: causalExpansionOutputSchema,
    });

    this.marketImpactAgent = new Agent({
      name: 'MarketImpactAgent',
      instructions: MARKET_IMPACT_SYSTEM_PROMPT,
      handoffDescription: 'Converts causal-chain data into structured market impacts.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: marketImpactOutputSchema,
    });

    this.opportunityAgent = new Agent({
      name: 'OpportunityAgent',
      instructions: OPPORTUNITY_SYSTEM_PROMPT,
      handoffDescription: 'Converts market impacts into structured opportunities.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: opportunityOutputSchema,
    });

    this.analysisManagerAgent = new Agent({
      name: 'AnalysisManager',
      instructions: ANALYSIS_MANAGER_INSTRUCTIONS,
      handoffDescription: 'Coordinates the full macro event analysis workflow by calling specialist tools.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0,
        parallelToolCalls: false,
      },
      tools: [
        this.createResearchAgentTool(),
        this.createCausalAgentTool(),
        this.createCausalExpansionAgentTool(),
        this.createMarketImpactAgentTool(),
        this.createOpportunityAgentTool(),
      ],
    });

    this.expansionManagerAgent = new Agent({
      name: 'ExpansionManager',
      instructions: EXPANSION_MANAGER_INSTRUCTIONS,
      handoffDescription: 'Coordinates focused node expansion by calling the expansion tool.',
      model: DEFAULT_SDK_MODEL,
      modelSettings: {
        temperature: 0,
      },
      tools: [this.createFocusedExpansionTool()],
    });
  }

  public async runAnalysisWorkflow(eventText: string, context: PipelineContext): Promise<AnalysisResponse> {
    const workflow = this.createInitialWorkflowState(eventText, context);

    try {
      await this.runWithTimeout(
        this.runner.run(this.analysisManagerAgent, this.buildAnalysisManagerInput(workflow), {
          context: workflow,
          maxTurns: 12,
        }),
        this.MANAGER_RUN_TIMEOUT_MS,
        'AnalysisManager',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      workflow.logger.error('Analysis manager run failed, using deterministic recovery', {
        correlationId: workflow.correlationId,
        error: message,
      });
      workflow.errors.push(`Analysis Manager Failure: ${message}`);
    }

    await this.recoverIncompleteWorkflow(workflow);

    return {
      event: workflow.event,
      graph: workflow.graph,
      errors: workflow.errors,
    };
  }

  public async runExpansionWorkflow(
    nodeId: string,
    nodeText: string,
    rootEvent: string,
    context: PipelineContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    const workflow: ExpansionWorkflowContext = {
      correlationId: context.correlationId,
      logger: context.logger,
      nodeId,
      nodeText,
      rootEvent,
    };

    try {
      await this.runWithTimeout(
        this.runner.run(this.expansionManagerAgent, this.buildExpansionManagerInput(workflow), {
          context: workflow,
          maxTurns: 4,
        }),
        this.MANAGER_RUN_TIMEOUT_MS,
        'ExpansionManager',
      );
    } catch (error) {
      workflow.logger.warn('Expansion manager run failed, using direct expansion fallback', {
        correlationId: workflow.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.runExpansionStep(workflow);
  }

  private createInitialWorkflowState(eventText: string, context: PipelineContext): AnalysisWorkflowContext {
    const graph: CausalGraph = {
      nodes: [],
      edges: [],
      marketImpacts: [],
      opportunities: [],
    };

    return {
      correlationId: context.correlationId,
      logger: context.logger,
      event: eventText,
      graph,
      errors: [],
      research: {
        content: '',
        sourceCount: 0,
        research_unavailable: true,
      },
      steps: {
        research: false,
        causal: false,
        expansion: false,
        marketImpact: false,
        opportunity: false,
      },
    };
  }

  private buildAnalysisManagerInput(workflow: AnalysisWorkflowContext): string {
    return [
      `Analyze this macro event: ${workflow.event}`,
      'Execute the full workflow using tools until it is complete.',
      'If a tool reports fallback or unavailable data, continue the workflow with the updated state.',
    ].join('\n');
  }

  private buildExpansionManagerInput(workflow: ExpansionWorkflowContext): string {
    return [
      `Expand the selected causal node into second-order consequences.`,
      `Node ID: ${workflow.nodeId}`,
      `Node Text: ${workflow.nodeText}`,
      `Root Event: ${workflow.rootEvent || 'Not provided'}`,
    ].join('\n');
  }

  private createResearchAgentTool() {
    return tool({
      name: 'research_agent_tool',
      description: 'Runs web research for the event and stores a structured research briefing in workflow state.',
      parameters: z.object({}),
      execute: async (_input, runContext?: RunContext<AnalysisWorkflowContext>) => {
        const workflow = this.getAnalysisWorkflow(runContext);
        const research = await this.runResearchStep(workflow);
        return JSON.stringify(research);
      },
      isEnabled: async ({ runContext }) => !runContext.context.steps.research,
    });
  }

  private createCausalAgentTool() {
    return tool({
      name: 'causal_agent_tool',
      description: 'Generates the core first-order causal graph from the event and research context.',
      parameters: z.object({}),
      execute: async (_input, runContext?: RunContext<AnalysisWorkflowContext>) => {
        const workflow = this.getAnalysisWorkflow(runContext);
        const firstOrder = await this.runCausalStep(workflow);
        return JSON.stringify(firstOrder);
      },
      isEnabled: async ({ runContext }) => runContext.context.steps.research && !runContext.context.steps.causal,
    });
  }

  private createCausalExpansionAgentTool() {
    return tool({
      name: 'causal_expansion_agent_tool',
      description: 'Expands first-order graph nodes into second-order effects and merges them into the graph.',
      parameters: z.object({}),
      execute: async (_input, runContext?: RunContext<AnalysisWorkflowContext>) => {
        const workflow = this.getAnalysisWorkflow(runContext);
        const expansion = await this.runBulkExpansionStep(workflow);
        return JSON.stringify(expansion);
      },
      isEnabled: async ({ runContext }) => runContext.context.steps.causal && !runContext.context.steps.expansion,
    });
  }

  private createMarketImpactAgentTool() {
    return tool({
      name: 'market_impact_agent_tool',
      description: 'Analyzes the resolved causal chain and stores structured market impacts.',
      parameters: z.object({}),
      execute: async (_input, runContext?: RunContext<AnalysisWorkflowContext>) => {
        const workflow = this.getAnalysisWorkflow(runContext);
        const impacts = await this.runMarketImpactStep(workflow);
        return JSON.stringify(impacts);
      },
      isEnabled: async ({ runContext }) => runContext.context.steps.expansion && !runContext.context.steps.marketImpact,
    });
  }

  private createOpportunityAgentTool() {
    return tool({
      name: 'opportunity_agent_tool',
      description: 'Analyzes market impacts and stores structured investment and startup opportunities.',
      parameters: z.object({}),
      execute: async (_input, runContext?: RunContext<AnalysisWorkflowContext>) => {
        const workflow = this.getAnalysisWorkflow(runContext);
        const opportunities = await this.runOpportunityStep(workflow);
        return JSON.stringify(opportunities);
      },
      isEnabled: async ({ runContext }) => {
        const workflow = runContext.context;
        return workflow.steps.marketImpact && !workflow.steps.opportunity;
      },
    });
  }

  private createFocusedExpansionTool() {
    return tool({
      name: 'focused_causal_expansion_tool',
      description: 'Expands one selected graph node into deterministic second-order nodes and edges.',
      parameters: z.object({}),
      execute: async (_input, runContext?: RunContext<ExpansionWorkflowContext>) => {
        const workflow = this.getExpansionWorkflow(runContext);
        const expansion = await this.runExpansionStep(workflow);
        return JSON.stringify(expansion);
      },
    });
  }

  private async recoverIncompleteWorkflow(workflow: AnalysisWorkflowContext): Promise<void> {
    if (!workflow.steps.research) {
      await this.runResearchStep(workflow);
    }

    if (!workflow.steps.causal) {
      await this.runCausalStep(workflow);
    }

    if (!workflow.steps.expansion) {
      await this.runBulkExpansionStep(workflow);
    }

    if (!workflow.steps.marketImpact) {
      await this.runMarketImpactStep(workflow);
    }

    if (!workflow.steps.opportunity) {
      await this.runOpportunityStep(workflow);
    }
  }

  private async runResearchStep(workflow: AnalysisWorkflowContext): Promise<ResearchBriefing> {
    if (workflow.steps.research) {
      return workflow.research;
    }

    workflow.logger.info('Running research agent tool', {
      correlationId: workflow.correlationId,
    });

    try {
      const rawResults = await this.webSearch.search(workflow.event);
      workflow.logger.info('Web search completed', {
        correlationId: workflow.correlationId,
        resultLength: rawResults.length,
      });

      if (!rawResults || rawResults.trim().length < 50) {
        const fallback = this.getFallbackBriefing('No substantial search results found.');
        workflow.research = fallback;
        workflow.errors.push('Research Unavailable (Proceeding with LLM internal knowledge)');
        workflow.steps.research = true;
        return fallback;
      }

      const userPrompt = RESEARCH_USER_PROMPT_TEMPLATE
        .replace('{event}', workflow.event)
        .replace('{rawResults}', rawResults);

      const result = await this.runWithTimeout(
        this.runner.run(this.researchSummaryAgent, userPrompt, {
          context: workflow,
          maxTurns: 4,
        }),
        this.AGENT_RUN_TIMEOUT_MS,
        'ResearchSummaryAgent',
      );
      const finalOutput = this.requireFinalOutput(result.finalOutput, 'ResearchSummaryAgent');

      const sourceMatches = [...rawResults.matchAll(/SOURCE:\s*(.*?)\nURL:\s*(.*?)\n/g)];
      const sourceKey = sourceMatches.map((match, index) => `[${index + 1}] ${match[1]} (${match[2]})`).join('\n');
      const research: ResearchBriefing = {
        content: `${finalOutput.content}\n\n### SOURCE KEY (FOR CITATIONS):\n${sourceKey}`,
        sourceCount: sourceMatches.length,
        research_unavailable: false,
      };

      workflow.research = research;
      workflow.steps.research = true;
      return research;
    } catch (error) {
      const fallback = this.getFallbackBriefing(
        `Search error: ${error instanceof Error ? error.message : String(error)}`,
      );
      workflow.logger.warn('Research agent tool failed, using fallback', {
        correlationId: workflow.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      workflow.research = fallback;
      workflow.errors.push('Research Unavailable (Proceeding with LLM internal knowledge)');
      workflow.steps.research = true;
      return fallback;
    }
  }

  private async runCausalStep(workflow: AnalysisWorkflowContext): Promise<CausalAgentResponse> {
    if (workflow.steps.causal && workflow.firstOrderData) {
      return workflow.firstOrderData;
    }

    workflow.logger.info('Running causal agent tool', {
      correlationId: workflow.correlationId,
    });

    const formattedContext = workflow.research.content
      ? `### RESEARCH CONTEXT (USE THIS TO GROUND YOUR ANALYSIS):\n${workflow.research.content}\n`
      : '';

    const userPrompt = CAUSAL_USER_PROMPT_TEMPLATE
      .replace('{event}', workflow.event)
      .replace('{searchContext}', formattedContext);

    let finalOutput: CausalAgentResponse;
    try {
      const result = await this.runWithTimeout(
        this.runner.run(this.causalAnalysisAgent, userPrompt, {
          context: workflow,
          maxTurns: 4,
        }),
        this.AGENT_RUN_TIMEOUT_MS,
        'CausalAnalysisAgent',
      );
      finalOutput = this.requireFinalOutput(
        result.finalOutput as CausalAgentResponse | undefined,
        'CausalAnalysisAgent',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      workflow.logger.warn('Causal agent tool failed, using empty fallback graph', {
        correlationId: workflow.correlationId,
        error: message,
      });
      workflow.errors.push(`Causal Agent Failed: ${message}`);
      finalOutput = { firstOrder: [] };
    }

    const graphSegment = this.graphBuilder.buildCoreGraph(workflow.event, finalOutput);

    workflow.firstOrderData = finalOutput;
    workflow.graph = {
      ...workflow.graph,
      nodes: graphSegment.nodes,
      edges: graphSegment.edges,
    };
    workflow.steps.causal = true;
    return finalOutput;
  }

  private async runBulkExpansionStep(
    workflow: AnalysisWorkflowContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    if (workflow.steps.expansion) {
      return {
        nodes: workflow.graph.nodes,
        edges: workflow.graph.edges,
      };
    }

    workflow.logger.info('Running causal expansion agent tool', {
      correlationId: workflow.correlationId,
    });

    const firstOrderNodes = workflow.graph.nodes.filter((node) => node.type === 'first_order_effect');

    if (firstOrderNodes.length === 0) {
      workflow.steps.expansion = true;
      return { nodes: workflow.graph.nodes, edges: workflow.graph.edges };
    }

    try {
      const expansionResults = await Promise.all(
        firstOrderNodes.map((node) =>
          this.runExpansionStep({
            correlationId: workflow.correlationId,
            logger: workflow.logger,
            nodeId: node.id,
            nodeText: node.text,
            rootEvent: workflow.event,
          }),
        ),
      );

      const nextGraph = {
        ...workflow.graph,
        nodes: [...workflow.graph.nodes],
        edges: [...workflow.graph.edges],
      };

      expansionResults.forEach((segment) => {
        this.graphBuilder.mergeGraphSegments(nextGraph, segment);
      });

      workflow.graph = nextGraph;
      workflow.steps.expansion = true;
      return { nodes: nextGraph.nodes, edges: nextGraph.edges };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      workflow.logger.warn('Causal expansion tool failed, preserving partial graph', {
        correlationId: workflow.correlationId,
        error: message,
      });
      workflow.errors.push(`Causal Expansion Failed (Partial graph preserved): ${message}`);
      workflow.steps.expansion = true;
      return { nodes: workflow.graph.nodes, edges: workflow.graph.edges };
    }
  }

  private async runExpansionStep(
    workflow: ExpansionWorkflowContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    workflow.logger.info('Running focused expansion agent tool', {
      correlationId: workflow.correlationId,
      nodeId: workflow.nodeId,
    });

    const userPrompt = EXPAND_NODE_USER_PROMPT_TEMPLATE
      .replace('{nodeText}', workflow.nodeText)
      .replace('{rootEvent}', workflow.rootEvent);

    const result = await this.runWithTimeout(
      this.runner.run(this.causalExpansionAgent, userPrompt, {
        context: workflow as unknown as AnalysisWorkflowContext,
        maxTurns: 4,
      }),
      this.AGENT_RUN_TIMEOUT_MS,
      'CausalExpansionAgent',
    );
    const finalOutput = this.requireFinalOutput(
      result.finalOutput as { effects: CausalEffect[] } | undefined,
      'CausalExpansionAgent',
    );

    return this.graphBuilder.buildExpansionGraph(workflow.nodeId, finalOutput.effects);
  }

  private async runMarketImpactStep(workflow: AnalysisWorkflowContext): Promise<MarketImpact[]> {
    if (workflow.steps.marketImpact) {
      return workflow.graph.marketImpacts || [];
    }

    workflow.logger.info('Running market impact agent tool', {
      correlationId: workflow.correlationId,
    });

    const chainSummary = {
      event: workflow.event,
      consequences: workflow.graph.nodes
        .filter((node) => node.type !== 'macro_event')
        .map((node) => ({
          text: node.text,
          type: node.type,
          reasoning: node.reasoning,
        })),
    };

    try {
      const userPrompt = MARKET_IMPACT_USER_PROMPT_TEMPLATE
        .replace('{causalChain}', JSON.stringify(chainSummary, null, 2))
        .replace('{researchContext}', workflow.research.content || 'No additional research available.');

      const result = await this.runWithTimeout(
        this.runner.run(this.marketImpactAgent, userPrompt, {
          context: workflow,
          maxTurns: 4,
        }),
        this.AGENT_RUN_TIMEOUT_MS,
        'MarketImpactAgent',
      );
      const finalOutput = this.requireFinalOutput(result.finalOutput, 'MarketImpactAgent');

      const impacts = finalOutput.impacts.filter(
        (impact) =>
          impact.sector &&
          ['positive', 'negative', 'neutral'].includes(impact.direction) &&
          typeof impact.confidence === 'number' &&
          impact.explanation,
      );

      if (impacts.length === 0) {
        throw new Error('All returned impacts failed schema validation.');
      }

      workflow.graph = {
        ...workflow.graph,
        marketImpacts: impacts,
      };
      workflow.steps.marketImpact = true;
      return impacts;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = this.getFallbackMarketImpacts();
      workflow.logger.warn('Market impact agent tool failed, using fallback', {
        correlationId: workflow.correlationId,
        error: message,
      });
      workflow.graph = {
        ...workflow.graph,
        marketImpacts: fallback,
      };
      workflow.errors.push(`Market Impact Agent used fallback: ${message}`);
      workflow.steps.marketImpact = true;
      return fallback;
    }
  }

  private async runOpportunityStep(workflow: AnalysisWorkflowContext): Promise<Opportunity[]> {
    if (workflow.steps.opportunity) {
      return workflow.graph.opportunities || [];
    }

    workflow.logger.info('Running opportunity agent tool', {
      correlationId: workflow.correlationId,
    });

    const impacts = workflow.graph.marketImpacts || [];
    if (impacts.length === 0) {
      workflow.errors.push('Opportunity Agent Skipped: Dependent Market Impacts missing.');
      workflow.steps.opportunity = true;
      return [];
    }

    try {
      const userPrompt = OPPORTUNITY_USER_PROMPT_TEMPLATE
        .replace('{marketImpacts}', JSON.stringify(impacts, null, 2))
        .replace('{researchContext}', workflow.research.content || 'No additional research available.');

      const result = await this.runWithTimeout(
        this.runner.run(this.opportunityAgent, userPrompt, {
          context: workflow,
          maxTurns: 4,
        }),
        this.AGENT_RUN_TIMEOUT_MS,
        'OpportunityAgent',
      );
      const finalOutput = this.requireFinalOutput(result.finalOutput, 'OpportunityAgent');

      const opportunities = finalOutput.opportunities.filter(
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

      workflow.graph = {
        ...workflow.graph,
        opportunities,
      };
      workflow.steps.opportunity = true;
      return opportunities;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = this.getFallbackOpportunities();
      workflow.logger.warn('Opportunity agent tool failed, using fallback', {
        correlationId: workflow.correlationId,
        error: message,
      });
      workflow.graph = {
        ...workflow.graph,
        opportunities: fallback,
      };
      workflow.errors.push(`Opportunity Agent used fallback: ${message}`);
      workflow.steps.opportunity = true;
      return fallback;
    }
  }

  private getAnalysisWorkflow(runContext?: RunContext<AnalysisWorkflowContext>): AnalysisWorkflowContext {
    if (!runContext) {
      throw new Error('Analysis workflow context is required for this tool.');
    }

    return runContext.context;
  }

  private getExpansionWorkflow(runContext?: RunContext<ExpansionWorkflowContext>): ExpansionWorkflowContext {
    if (!runContext) {
      throw new Error('Expansion workflow context is required for this tool.');
    }

    return runContext.context;
  }

  private getFallbackBriefing(reason: string): ResearchBriefing {
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
        rationale: 'Fallback entry — no actionable rationale available at this time.',
      },
    ];
  }

  private requireFinalOutput<T>(output: T | undefined, agentName: string): T {
    if (output === undefined) {
      throw new Error(`${agentName} produced no final output.`);
    }

    return output;
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
