import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { ResearchBriefing } from '../contracts/analysis';

const RESEARCH_SUMMARIZATION_PROMPT = `You are a senior research analyst. Your goal is to synthesize raw web search results into a concise, high-density briefing for downstream causal analysis agents.

RULES:
1. Identify specific factual anchors (dates, rates, names, specific percentages).
2. Integrate numeric citations [1], [2], etc., directly after facts derived from specific sources.
3. Remove irrelevant noise (ads, navigation text).
4. Keep the summary under 250 words total.
5. Focus on the direct implications of the macro event for financial markets.
6. DO NOT include a reference list in your output; only use the numeric markers. I will append the list myself.`;

const RESEARCH_USER_PROMPT_TEMPLATE = `EVENT: {event}
RAW SEARCH RESULTS:
{rawResults}

Please provide a concise research briefing with numeric citations [n].

Output JSON strictly in the following format:
{
  "content": "Concise research briefing with inline numeric citations [1], [2], etc.",
  "sourceCount": 3,
  "research_unavailable": false
}

RULES:
1. Set "sourceCount" to the number of usable sources in the raw results.
2. Set "research_unavailable" to false when the raw results contain usable source material.
3. No markdown wrappers, no introductory text. Pure JSON object only.`;

const researchBriefingSchema = z.object({
  content: z.string(),
  sourceCount: z.number(),
  research_unavailable: z.boolean(),
});

interface ResearchAgentDependencies {
  model: string;
}

interface ResearchAgentRunOptions {
  event: string;
  search: (query: string) => Promise<string>;
  invoke: <T>(agent: Agent<any, any>, prompt: string) => Promise<T>;
}

export class ResearchAgent {
  private readonly agent: Agent<any, any>;

  public constructor(dependencies: ResearchAgentDependencies) {
    this.agent = new Agent({
      name: 'ResearchSummaryAgent',
      instructions: RESEARCH_SUMMARIZATION_PROMPT,
      handoffDescription: 'Summarizes web research for downstream analysis.',
      model: dependencies.model,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: researchBriefingSchema as any,
    });
  }

  public async run(options: ResearchAgentRunOptions): Promise<{ briefing: ResearchBriefing; errorMessage?: string }> {
    try {
      const rawResults = await options.search(options.event);

      if (!rawResults || rawResults.trim().length < 50) {
        return {
          briefing: this.getFallbackBriefing('No substantial search results found.'),
          errorMessage: 'Research Unavailable (Proceeding with LLM internal knowledge)',
        };
      }

      const prompt = RESEARCH_USER_PROMPT_TEMPLATE
        .replace('{event}', options.event)
        .replace('{rawResults}', rawResults);

      const result = await options.invoke<ResearchBriefing>(this.agent, prompt);
      const { sourceCount, sourceKey } = this.buildSourceKey(rawResults);

      return {
        briefing: {
          content: `${result.content}\n\n### SOURCE KEY (FOR CITATIONS):\n${sourceKey}`,
          sourceCount,
          research_unavailable: false,
        },
      };
    } catch (error) {
      return {
        briefing: this.getFallbackBriefing(this.getErrorMessage(error)),
        errorMessage: 'Research Unavailable (Proceeding with LLM internal knowledge)',
      };
    }
  }

  private buildSourceKey(rawResults: string): { sourceCount: number; sourceKey: string } {
    const sourceMatches = [...rawResults.matchAll(/SOURCE:\s*(.*?)\nURL:\s*(.*?)\n/g)];

    return {
      sourceCount: sourceMatches.length,
      sourceKey: sourceMatches.map((match, index) => `[${index + 1}] ${match[1]} (${match[2]})`).join('\n'),
    };
  }

  private getFallbackBriefing(reason: string): ResearchBriefing {
    return {
      content: `### RESEARCH UNAVAILABLE / FALLBACK MODE\nReason: ${reason}\nUsing internal knowledge models for analysis. Grounded data may be limited or outdated.`,
      sourceCount: 0,
      research_unavailable: true,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

