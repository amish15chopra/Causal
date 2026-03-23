import type { IntelligenceAgent, AgentRunContext } from '../application/agents/types';
import type { LLMGateway } from '../application/ports/llmGateway';
import type { SearchGateway } from '../application/ports/searchGateway';
import { LLMClient } from '../infrastructure/llm/LLMClient';
import { WebSearch } from '../infrastructure/search/webSearch';
import { RESEARCH_SUMMARIZATION_PROMPT, RESEARCH_USER_PROMPT_TEMPLATE } from '../prompts/subAgentsPrompt';
import { parseJSON } from '../utils/json';

export interface ResearchBriefing {
  content: string;
  sourceCount: number;
  research_unavailable: boolean;
}

export class ResearchAgent implements IntelligenceAgent<string, ResearchBriefing> {
  public readonly id = 'research-agent';

  public constructor(
    private readonly llmClient: LLMGateway = LLMClient.getInstance(),
    private readonly webSearch: SearchGateway = WebSearch.getInstance(),
  ) {}

  /**
   * Conducts centralized web research for an event, summarizes it,
   * and provides a robust fallback if searching fails.
   */
  public async execute(event: string, context: AgentRunContext): Promise<ResearchBriefing> {
    return this.conductResearch(event, context);
  }

  public async conductResearch(event: string, context?: AgentRunContext): Promise<ResearchBriefing> {
    try {
      const rawResults = await this.webSearch.search(event);
      
      if (!rawResults || rawResults.trim().length < 50) {
        return this.getFallbackBriefing("No substantial search results found.");
      }

      const userPrompt = RESEARCH_USER_PROMPT_TEMPLATE
        .replace('{event}', event)
        .replace('{rawResults}', rawResults);

      const responseText = await this.llmClient.generate(userPrompt, RESEARCH_SUMMARIZATION_PROMPT);
      const parsedSummary = this.parseSummaryResponse(responseText);

      // Extract titles and URLs for the source key
      const sourceMatches = [...rawResults.matchAll(/SOURCE:\s*(.*?)\nURL:\s*(.*?)\n/g)];
      const sourceKey = sourceMatches.map((m, i) => `[${i + 1}] ${m[1]} (${m[2]})`).join('\n');

      return {
        content: `${parsedSummary.content}\n\n### SOURCE KEY (FOR CITATIONS):\n${sourceKey}`,
        sourceCount: sourceMatches.length,
        research_unavailable: false
      };
    } catch (error) {
      context?.logger.warn('Research agent search failed, using fallback', {
        correlationId: context.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
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

  private parseSummaryResponse(responseText: string): ResearchBriefing {
    try {
      const parsed = parseJSON<Partial<ResearchBriefing>>(responseText, 'ResearchAgent yielded invalid JSON format.');
      if (typeof parsed.content === 'string' && parsed.content.trim().length > 0) {
        return {
          content: parsed.content,
          sourceCount: typeof parsed.sourceCount === 'number' ? parsed.sourceCount : 0,
          research_unavailable: parsed.research_unavailable === true,
        };
      }
    } catch {
      // Fall back to treating the response as plain text for backward compatibility.
    }

    return {
      content: responseText.trim(),
      sourceCount: 0,
      research_unavailable: false,
    };
  }
}
