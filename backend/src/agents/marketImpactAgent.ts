import type { IntelligenceAgent, AgentRunContext } from '../application/agents/types';
import type { LLMGateway } from '../application/ports/llmGateway';
import { LLMClient } from '../infrastructure/llm/LLMClient';
import { MarketImpact } from '../domain/models/MarketImpact';
import { MARKET_IMPACT_SYSTEM_PROMPT, MARKET_IMPACT_USER_PROMPT_TEMPLATE } from '../prompts/subAgentsPrompt';
import { parseJSON } from '../utils/json';

export interface MarketImpactInput {
  causalData: unknown;
  researchContext?: string;
}

export class MarketImpactAgent implements IntelligenceAgent<MarketImpactInput, MarketImpact[]> {
  public readonly id = 'market-impact-agent';

  public constructor(private readonly llmClient: LLMGateway = LLMClient.getInstance()) {}

  public async execute(input: MarketImpactInput, context: AgentRunContext): Promise<MarketImpact[]> {
    return this.analyzeImpacts(input.causalData, input.researchContext || '', context);
  }

  /**
   * Evaluates the causal event cascade and infers the respective macro-economic sector impacts
   */
  public async analyzeImpacts(
    causalData: unknown,
    researchContext: string = '',
    context?: AgentRunContext,
  ): Promise<MarketImpact[]> {
    const serializedChain = JSON.stringify(causalData, null, 2);
    const userPrompt = MARKET_IMPACT_USER_PROMPT_TEMPLATE
      .replace('{causalChain}', serializedChain)
      .replace('{researchContext}', researchContext || 'No additional research available.');

    const responseText = await this.llmClient.generate(userPrompt, MARKET_IMPACT_SYSTEM_PROMPT);

    try {
      const parsed = parseJSON<MarketImpact[]>(responseText, 'MarketImpactAgent yielded invalid JSON format.');
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      context?.logger.error('Failed to parse MarketImpactAgent response', {
        correlationId: context.correlationId,
        responseText,
      });
      throw new Error('MarketImpactAgent yielded invalid JSON format.');
    }
  }
}
