import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { MarketImpact } from '../../domain/models';

const MARKET_IMPACT_SYSTEM_PROMPT = `You are a specialized senior market analyst AI.
Your job is to analyze a causal chain and determine the definitive impact on specific market sectors.

Use the provided RESEARCH CONTEXT to ground your sector analysis in current data.

RULES (never break these):
- Output valid JSON only. No conversational text, no markdown fences.
- Apply these confidence guidelines consistently:
    0.9+  = strong historical precedent
    0.7-0.9 = likely based on established economic patterns
    0.4-0.7 = plausible but uncertain; multiple variables in play
    <0.4  = speculative; low signal, high noise
- Every sector impact MUST include an "explanation" of exactly 1-2 sentences tying the macro cause to the sector effect.
- If research context is unavailable, still produce your best calibrated estimate and set confidence < 0.6. Do NOT refuse to answer.
- direction must be EXACTLY one of: "positive", "negative", or "neutral".`;

const MARKET_IMPACT_USER_PROMPT_TEMPLATE = `RESEARCH CONTEXT:
{researchContext}

Based on the research above and the following causal analysis of a macro event:
{causalChain}

Identify exactly 3 to 5 market sectors most directly affected.

For each sector, include:
- sector: specific industry name
- direction: "positive" | "negative" | "neutral"
- confidence: number 0.0-1.0 using the provided guidelines
- explanation: exactly 1-2 sentences connecting the macro cause to this sector's movement

Output JSON strictly in the following format:
{
  "impacts": [
    {
      "sector": "Real Estate",
      "direction": "negative",
      "confidence": 0.82,
      "explanation": "Explanation here."
    }
  ]
}
No markdown wrappers, no introductory text. Pure JSON object only.`;

const marketImpactSchema = z.object({
  impacts: z.array(
    z.object({
      sector: z.string(),
      direction: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number(),
      explanation: z.string(),
    }),
  ),
});

interface MarketImpactAgentDependencies {
  model: string;
}

interface MarketImpactRunOptions {
  event: string;
  consequences: Array<{ text: string; type: string; reasoning: string }>;
  researchContext: string;
  invoke: <T>(agent: Agent<any, any>, prompt: string) => Promise<T>;
}

export class MarketImpactAgent {
  private readonly agent: Agent<any, any>;

  public constructor(dependencies: MarketImpactAgentDependencies) {
    this.agent = new Agent({
      name: 'MarketImpactAgent',
      instructions: MARKET_IMPACT_SYSTEM_PROMPT,
      handoffDescription: 'Converts causal consequences into market impacts.',
      model: dependencies.model,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: marketImpactSchema as any,
    });
  }

  public async run(options: MarketImpactRunOptions): Promise<{ impacts: MarketImpact[]; errorMessage?: string }> {
    if (options.consequences.length === 0) {
      return { impacts: [] };
    }

    try {
      const prompt = MARKET_IMPACT_USER_PROMPT_TEMPLATE
        .replace(
          '{causalChain}',
          JSON.stringify(
            {
              event: options.event,
              consequences: options.consequences,
            },
            null,
            2,
          ),
        )
        .replace('{researchContext}', options.researchContext || 'No additional research available.');

      const result = await options.invoke<{ impacts: MarketImpact[] }>(this.agent, prompt);
      const impacts = result.impacts.filter(
        (impact) =>
          impact.sector &&
          ['positive', 'negative', 'neutral'].includes(impact.direction) &&
          typeof impact.confidence === 'number' &&
          Boolean(impact.explanation),
      );

      if (impacts.length === 0) {
        throw new Error('All returned impacts failed schema validation.');
      }

      return { impacts };
    } catch (error) {
      return {
        impacts: this.getFallbackImpacts(),
        errorMessage: `Market Impact Agent used fallback: ${this.getErrorMessage(error)}`,
      };
    }
  }

  private getFallbackImpacts(): MarketImpact[] {
    return [
      {
        sector: 'Broad Market',
        direction: 'neutral',
        confidence: 0.3,
        explanation:
          'Market impact analysis is temporarily unavailable. This is a fallback entry to preserve pipeline continuity.',
      },
    ];
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

