import { LLMClient } from '../infrastructure/llm/LLMClient';
import { MarketImpact } from '../domain/models/MarketImpact';
import { Opportunity } from '../domain/models/Opportunity';
import { OPPORTUNITY_SYSTEM_PROMPT, OPPORTUNITY_USER_PROMPT_TEMPLATE } from '../prompts/subAgentsPrompt';

export class OpportunityAgent {
  private llmClient: LLMClient;

  constructor() {
    this.llmClient = LLMClient.getInstance();
  }

  /**
   * Generates derivative execution opportunities directly dependent on the calculated market shifts
   */
  public async extractOpportunities(impacts: MarketImpact[]): Promise<Opportunity[]> {
    const serializedImpacts = JSON.stringify(impacts, null, 2);
    const userPrompt = OPPORTUNITY_USER_PROMPT_TEMPLATE.replace('{marketImpacts}', serializedImpacts);

    const responseText = await this.llmClient.generate(userPrompt, OPPORTUNITY_SYSTEM_PROMPT);

    try {
      const cleanedJSON = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJSON) as Opportunity[];
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse OpportunityAgent response:', responseText);
      throw new Error('OpportunityAgent yielded invalid JSON format.');
    }
  }
}
