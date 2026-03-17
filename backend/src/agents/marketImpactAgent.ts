import { LLMClient } from '../infrastructure/llm/LLMClient';
import { MarketImpact } from '../domain/models/MarketImpact';
import { MARKET_IMPACT_SYSTEM_PROMPT, MARKET_IMPACT_USER_PROMPT_TEMPLATE } from '../prompts/subAgentsPrompt';
import { CausalAgentResponse } from './causalAgent';

export class MarketImpactAgent {
  private llmClient: LLMClient;

  constructor() {
    this.llmClient = LLMClient.getInstance();
  }

  /**
   * Evaluates the causal event cascade and infers the respective macro-economic sector impacts
   */
  public async analyzeImpacts(causalData: CausalAgentResponse): Promise<MarketImpact[]> {
    const serializedChain = JSON.stringify(causalData, null, 2);
    const userPrompt = MARKET_IMPACT_USER_PROMPT_TEMPLATE.replace('{causalChain}', serializedChain);

    const responseText = await this.llmClient.generate(userPrompt, MARKET_IMPACT_SYSTEM_PROMPT);

    try {
      const cleanedJSON = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJSON) as MarketImpact[];
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse MarketImpactAgent response:', responseText);
      throw new Error('MarketImpactAgent yielded invalid JSON format.');
    }
  }
}
