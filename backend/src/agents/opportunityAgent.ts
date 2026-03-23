import type { IntelligenceAgent, AgentRunContext } from '../application/agents/types';
import type { LLMGateway } from '../application/ports/llmGateway';
import { LLMClient } from '../infrastructure/llm/LLMClient';
import { MarketImpact } from '../domain/models/MarketImpact';
import { Opportunity } from '../domain/models/Opportunity';
import { OPPORTUNITY_SYSTEM_PROMPT, OPPORTUNITY_USER_PROMPT_TEMPLATE } from '../prompts/subAgentsPrompt';
import { parseJSON } from '../utils/json';

export interface OpportunityInput {
  impacts: MarketImpact[];
  researchContext?: string;
}

export class OpportunityAgent implements IntelligenceAgent<OpportunityInput, Opportunity[]> {
  public readonly id = 'opportunity-agent';

  public constructor(private readonly llmClient: LLMGateway = LLMClient.getInstance()) {}

  public async execute(input: OpportunityInput, context: AgentRunContext): Promise<Opportunity[]> {
    return this.extractOpportunities(input.impacts, input.researchContext || '', context);
  }

  /**
   * Generates derivative execution opportunities directly dependent on the calculated market shifts
   */
  public async extractOpportunities(
    impacts: MarketImpact[],
    researchContext: string = '',
    context?: AgentRunContext,
  ): Promise<Opportunity[]> {
    const serializedImpacts = JSON.stringify(impacts, null, 2);
    const userPrompt = OPPORTUNITY_USER_PROMPT_TEMPLATE
      .replace('{marketImpacts}', serializedImpacts)
      .replace('{researchContext}', researchContext || 'No additional research available.');

    const responseText = await this.llmClient.generate(userPrompt, OPPORTUNITY_SYSTEM_PROMPT);

    try {
      const parsed = parseJSON<Opportunity[]>(responseText, 'OpportunityAgent yielded invalid JSON format.');
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      context?.logger.error('Failed to parse OpportunityAgent response', {
        correlationId: context.correlationId,
        responseText,
      });
      throw new Error('OpportunityAgent yielded invalid JSON format.');
    }
  }
}
