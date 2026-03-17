import { LLMClient } from '../infrastructure/llm/LLMClient';
import { WebSearch } from '../infrastructure/search/webSearch';
import { RESEARCH_SUMMARIZATION_PROMPT, RESEARCH_USER_PROMPT_TEMPLATE } from '../prompts/subAgentsPrompt';

export interface ResearchBriefing {
  content: string;
  sourceCount: number;
  research_unavailable: boolean;
}

export class ResearchAgent {
  private llmClient: LLMClient;
  private webSearch: WebSearch;

  constructor() {
    this.llmClient = LLMClient.getInstance();
    this.webSearch = WebSearch.getInstance();
  }

  /**
   * Conducts centralized web research for an event, summarizes it,
   * and provides a robust fallback if searching fails.
   */
  public async conductResearch(event: string): Promise<ResearchBriefing> {
    try {
      const rawResults = await this.webSearch.search(event);
      
      if (!rawResults || rawResults.trim().length < 50) {
        return this.getFallbackBriefing("No substantial search results found.");
      }

      const userPrompt = RESEARCH_USER_PROMPT_TEMPLATE
        .replace('{event}', event)
        .replace('{rawResults}', rawResults);

      const summary = await this.llmClient.generate(userPrompt, RESEARCH_SUMMARIZATION_PROMPT);

      // Extract titles and URLs for the source key
      const sourceMatches = [...rawResults.matchAll(/SOURCE:\s*(.*?)\nURL:\s*(.*?)\n/g)];
      const sourceKey = sourceMatches.map((m, i) => `[${i + 1}] ${m[1]} (${m[2]})`).join('\n');

      return {
        content: `${summary}\n\n### SOURCE KEY (FOR CITATIONS):\n${sourceKey}`,
        sourceCount: sourceMatches.length,
        research_unavailable: false
      };
    } catch (error) {
      console.error("[ResearchAgent] Tavily search failed, using fallback:", error);
      return this.getFallbackBriefing(`Search error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getFallbackBriefing(reason: string): ResearchBriefing {
    return {
      content: `### RESEARCH UNAVAILABLE / FALLBACK MODE\nReason: ${reason}\nUsing internal knowledge models for analysis. Grounded data may be limited or outdated.`,
      sourceCount: 0,
      research_unavailable: true
    };
  }
}
