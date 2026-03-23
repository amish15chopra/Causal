import type { IntelligenceAgent, AgentRunContext } from '../application/agents/types';
import type { LLMGateway } from '../application/ports/llmGateway';
import { LLMClient } from '../infrastructure/llm/LLMClient';
import { CAUSAL_SYSTEM_PROMPT, CAUSAL_USER_PROMPT_TEMPLATE, EXPAND_NODE_USER_PROMPT_TEMPLATE } from '../prompts/causalPrompt';
import { parseJSON } from '../utils/json';

export interface CausalEffect {
  text: string;
  confidence: number;
  reasoning: string;
  sources?: { title: string; url: string }[];
  secondOrder?: CausalEffect[];
}

export interface CausalAgentResponse {
  firstOrder: CausalEffect[];
}

export interface CausalAnalysisInput {
  event: string;
  researchContext?: string;
}

export class CausalAgent implements IntelligenceAgent<CausalAnalysisInput, CausalAgentResponse> {
  public readonly id = 'causal-agent';

  public constructor(private readonly llmClient: LLMGateway = LLMClient.getInstance()) {}

  /**
   * Generates a raw causal reasoning breakdown based on a given macro event.
   * Grounded in provided research context.
   */
  public async execute(input: CausalAnalysisInput, context: AgentRunContext): Promise<CausalAgentResponse> {
    return this.analyzeEvent(input.event, input.researchContext || '', context);
  }

  public async analyzeEvent(
    event: string,
    researchContext: string = '',
    context?: AgentRunContext,
  ): Promise<CausalAgentResponse> {
    const formattedContext = researchContext 
      ? `### RESEARCH CONTEXT (USE THIS TO GROUND YOUR ANALYSIS):\n${researchContext}\n`
      : '';

    const userPrompt = CAUSAL_USER_PROMPT_TEMPLATE
      .replace('{event}', event)
      .replace('{searchContext}', formattedContext);
    
    // Generate causal chain using LLM
    const responseText = await this.llmClient.generate(userPrompt, CAUSAL_SYSTEM_PROMPT);

    try {
      return parseJSON<CausalAgentResponse>(responseText, 'CausalAgent yielded invalid JSON format.');
    } catch (error) {
      context?.logger.error('Failed to parse CausalAgent response', {
        correlationId: context.correlationId,
        responseText,
      });
      throw new Error('CausalAgent yielded invalid JSON format.');
    }
  }

  /**
   * Generates localized next-step consequences for a specific node in an existing graph.
   */
  public async expandNode(nodeText: string, rootEvent: string = '', context?: AgentRunContext): Promise<CausalEffect[]> {
    const userPrompt = EXPAND_NODE_USER_PROMPT_TEMPLATE
      .replace('{nodeText}', nodeText)
      .replace('{rootEvent}', rootEvent);
    
    const responseText = await this.llmClient.generate(userPrompt, CAUSAL_SYSTEM_PROMPT);

    try {
      const parsed = parseJSON<CausalEffect[]>(responseText, 'CausalAgent yielded invalid expansion JSON format.');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      context?.logger.error('Failed to parse CausalAgent expansion response', {
        correlationId: context.correlationId,
        responseText,
      });
      throw new Error('CausalAgent yielded invalid expansion JSON format.');
    }
  }
}
