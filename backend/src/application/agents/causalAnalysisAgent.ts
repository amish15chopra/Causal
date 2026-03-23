import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { CausalAnalysisResult } from '../contracts/analysis';

const CAUSAL_SYSTEM_PROMPT = `You are an expert causal reasoning agent for macro events and markets. Always output valid JSON only. Use these confidence guidelines: 0.9+ = strong historical precedent, 0.7-0.9 = likely based on economic patterns, 0.4-0.7 = plausible but uncertain, <0.4 = speculative. Every effect must include 1-2 sentence reasoning. Use any provided SEARCH CONTEXT to ground your analysis in current real-world data and PROVIDE CITATIONS (source title and URL) in the "sources" field for any factual claims derived from the context.`;

const CAUSAL_USER_PROMPT_TEMPLATE = `Event: {event}
{searchContext}
Please analyze this macro event and identify its DIRECT (first-order) consequences.
Focus only on immediate effects that happen as a direct result of the event.
Output JSON strictly in the following format:
{
  "firstOrder": [
    {
      "text": "description of direct effect",
      "confidence": 0.85,
      "reasoning": "1-2 sentence reasoning explaining why",
      "sources": [
        { "title": "Actual Source Name from Context", "url": "https://actual-source-url.com" }
      ],
      "secondOrder": []
    }
  ]
}
RULES:
1. Generate 3-5 distinct first-order effects.
2. Ensure they cover different dimensions (e.g. economic, social, geopolitical, supply chain).
No markdown wrappers, no introductory text. Pure JSON object only.`;

const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

const causalEffectSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    text: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
    sources: z.array(sourceSchema),
    secondOrder: z.array(causalEffectSchema),
  }),
);

const causalAnalysisResultSchema = z.object({
  firstOrder: z.array(causalEffectSchema),
});

interface CausalAnalysisAgentDependencies {
  model: string;
}

interface CausalAnalysisRunOptions {
  event: string;
  researchContext: string;
  invoke: <T>(agent: Agent<any, any>, prompt: string) => Promise<T>;
}

export class CausalAnalysisAgent {
  private readonly agent: Agent<any, any>;

  public constructor(dependencies: CausalAnalysisAgentDependencies) {
    this.agent = new Agent({
      name: 'CausalAnalysisAgent',
      instructions: CAUSAL_SYSTEM_PROMPT,
      handoffDescription: 'Produces first-order causal effects.',
      model: dependencies.model,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: causalAnalysisResultSchema as any,
    });
  }

  public async run(options: CausalAnalysisRunOptions): Promise<{ analysis: CausalAnalysisResult; errorMessage?: string }> {
    try {
      const formattedContext = options.researchContext
        ? `### RESEARCH CONTEXT (USE THIS TO GROUND YOUR ANALYSIS):\n${options.researchContext}\n`
        : '';

      const prompt = CAUSAL_USER_PROMPT_TEMPLATE
        .replace('{event}', options.event)
        .replace('{searchContext}', formattedContext);

      const analysis = await options.invoke<CausalAnalysisResult>(this.agent, prompt);
      return { analysis };
    } catch (error) {
      return {
        analysis: { firstOrder: [] },
        errorMessage: `Causal Agent Failed: ${this.getErrorMessage(error)}`,
      };
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

