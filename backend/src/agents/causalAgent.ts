import { LLMClient } from '../infrastructure/llm/LLMClient';
import { CAUSAL_SYSTEM_PROMPT, CAUSAL_USER_PROMPT_TEMPLATE, EXPAND_NODE_USER_PROMPT_TEMPLATE } from '../prompts/causalPrompt';

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

export class CausalAgent {
  private llmClient: LLMClient;

  constructor() {
    this.llmClient = LLMClient.getInstance();
  }

  /**
   * Generates a raw causal reasoning breakdown based on a given macro event.
   * Grounded in provided research context.
   */
  public async analyzeEvent(event: string, researchContext: string = ''): Promise<CausalAgentResponse> {
    const formattedContext = researchContext 
      ? `### RESEARCH CONTEXT (USE THIS TO GROUND YOUR ANALYSIS):\n${researchContext}\n`
      : '';

    const userPrompt = CAUSAL_USER_PROMPT_TEMPLATE
      .replace('{event}', event)
      .replace('{searchContext}', formattedContext);
    
    // Generate causal chain using LLM
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
  public async expandNode(nodeText: string, rootEvent: string = ''): Promise<CausalEffect[]> {
    const userPrompt = EXPAND_NODE_USER_PROMPT_TEMPLATE
      .replace('{nodeText}', nodeText)
      .replace('{rootEvent}', rootEvent);
    
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
