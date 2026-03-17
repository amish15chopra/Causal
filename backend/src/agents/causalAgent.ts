import { LLMClient } from '../infrastructure/llm/LLMClient';
import { WebSearch } from '../infrastructure/search/webSearch';
import { CAUSAL_SYSTEM_PROMPT, CAUSAL_USER_PROMPT_TEMPLATE, EXPAND_NODE_USER_PROMPT_TEMPLATE } from '../prompts/causalPrompt';

export interface CausalEffect {
  text: string;
  confidence: number;
  reasoning: string;
  sources?: { title: string; url: string }[];
}

export interface CausalAgentResponse {
  firstOrder: CausalEffect[];
  secondOrder: CausalEffect[];
}

export class CausalAgent {
  private llmClient: LLMClient;
  private webSearch: WebSearch;

  constructor() {
    this.llmClient = LLMClient.getInstance();
    this.webSearch = WebSearch.getInstance();
  }

  /**
   * Generates a raw causal reasoning breakdown based on a given macro event.
   * Grounded in real-time search results via Tavily.
   */
  public async analyzeEvent(event: string): Promise<CausalAgentResponse> {
    // Stage 1: Search for real-time context
    const searchResult = await this.webSearch.search(event);
    const searchContext = searchResult 
      ? `### SEARCH CONTEXT (USE THIS TO GROUND YOUR ANALYSIS):\n${searchResult}\n`
      : '';

    const userPrompt = CAUSAL_USER_PROMPT_TEMPLATE
      .replace('{event}', event)
      .replace('{searchContext}', searchContext);
    
    // Stage 2: Generate causal chain using LLM
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
