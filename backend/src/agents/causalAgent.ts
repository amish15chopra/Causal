import { LLMClient } from '../infrastructure/llm/LLMClient';
import { CAUSAL_SYSTEM_PROMPT, CAUSAL_USER_PROMPT_TEMPLATE, EXPAND_NODE_USER_PROMPT_TEMPLATE } from '../prompts/causalPrompt';

export interface CausalEffect {
  text: string;
  confidence: number;
  reasoning: string;
}

export interface CausalAgentResponse {
  firstOrder: CausalEffect[];
  secondOrder: CausalEffect[];
}

export class CausalAgent {
  private llmClient: LLMClient;

  constructor() {
    this.llmClient = LLMClient.getInstance();
  }

  /**
   * Generates a raw causal reasoning breakdown based on a given macro event.
   */
  public async analyzeEvent(event: string): Promise<CausalAgentResponse> {
    const userPrompt = CAUSAL_USER_PROMPT_TEMPLATE.replace('{event}', event);
    
    // Pass strictly through the cost-controlled singleton logic
    const responseText = await this.llmClient.generate(userPrompt, CAUSAL_SYSTEM_PROMPT);

    try {
      const cleanedJSON = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJSON) as CausalAgentResponse;
      return parsed;
    } catch (error) {
      console.error('Failed to parse CausalAgent response:', responseText);
      throw new Error('CausalAgent yielded invalid JSON format.');
    }
  }

  /**
   * Generates localized next-step consequences for a specific node in an existing graph.
   */
  public async expandNode(nodeText: string): Promise<CausalEffect[]> {
    const userPrompt = EXPAND_NODE_USER_PROMPT_TEMPLATE.replace('{nodeText}', nodeText);
    
    const responseText = await this.llmClient.generate(userPrompt, CAUSAL_SYSTEM_PROMPT);

    try {
      const cleanedJSON = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJSON) as CausalEffect[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse CausalAgent Expansion response:', responseText);
      throw new Error('CausalAgent yielded invalid expansion JSON format.');
    }
  }
}
