import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { MarketImpact, Opportunity } from '../../domain/models';

const OPPORTUNITY_SYSTEM_PROMPT = `You are a top-tier venture capitalist and hedge fund analyst.
Your task is to extract highly actionable strategic opportunities (startup concepts or investments) grounded in the provided market sector impacts.

Use the provided RESEARCH CONTEXT to ground your analysis.

RULES (never break these):
- Output valid JSON only. No conversational text, no markdown fences.
- Apply these confidence guidelines consistently:
    0.9+  = near-certain structural opportunity with strong historical analogues
    0.7-0.9 = high-conviction thesis based on established market dynamics
    0.4-0.7 = plausible but requires monitoring
    <0.4  = speculative
- Every opportunity MUST include a "rationale" field with a step-by-step logical chain.
- "type" must be EXACTLY one of: "investment" or "startup".
- Do NOT generate generic opportunities.`;

const OPPORTUNITY_USER_PROMPT_TEMPLATE = `RESEARCH CONTEXT:
{researchContext}

Based on the research above and these market sector impacts stemming from a recent macro event:
{marketImpacts}

Derive exactly 2 to 4 concrete, actionable opportunities.

For each opportunity, include:
- type: "investment" | "startup"
- title: short, punchy, specific title
- description: the structural reason this gap exists right now
- confidence: number 0.0-1.0
- rationale: a step-by-step logical chain

Output JSON strictly in the following format:
{
  "opportunities": [
    {
      "type": "investment",
      "title": "Example title",
      "description": "Example description.",
      "confidence": 0.78,
      "rationale": "1. Step one -> 2. Step two -> 3. Step three"
    }
  ]
}
No markdown wrappers, no introductory text. Pure JSON object only.`;

const opportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      type: z.enum(['investment', 'startup']),
      title: z.string(),
      description: z.string(),
      confidence: z.number(),
      rationale: z.string(),
    }),
  ),
});

interface OpportunityAgentDependencies {
  model: string;
}

interface OpportunityRunOptions {
  marketImpacts: MarketImpact[];
  researchContext: string;
  invoke: <T>(agent: Agent<any, any>, prompt: string) => Promise<T>;
}

export class OpportunityAgent {
  private readonly agent: Agent<any, any>;

  public constructor(dependencies: OpportunityAgentDependencies) {
    this.agent = new Agent({
      name: 'OpportunityAgent',
      instructions: OPPORTUNITY_SYSTEM_PROMPT,
      handoffDescription: 'Converts market impacts into opportunities.',
      model: dependencies.model,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: opportunitySchema as any,
    });
  }

  public async run(options: OpportunityRunOptions): Promise<{ opportunities: Opportunity[]; errorMessage?: string }> {
    if (!options.marketImpacts || options.marketImpacts.length === 0) {
      return { opportunities: [] };
    }

    try {
      const prompt = OPPORTUNITY_USER_PROMPT_TEMPLATE
        .replace('{marketImpacts}', JSON.stringify(options.marketImpacts, null, 2))
        .replace('{researchContext}', options.researchContext || 'No additional research available.');

      const result = await options.invoke<{ opportunities: Opportunity[] }>(this.agent, prompt);
      const opportunities = result.opportunities.filter(
        (opportunity) =>
          (opportunity.type === 'investment' || opportunity.type === 'startup') &&
          opportunity.title.length > 0 &&
          typeof opportunity.description === 'string' &&
          typeof opportunity.confidence === 'number' &&
          opportunity.rationale.length > 0,
      );

      if (opportunities.length === 0) {
        throw new Error('All returned opportunities failed schema validation.');
      }

      return { opportunities };
    } catch (error) {
      return {
        opportunities: this.getFallbackOpportunities(),
        errorMessage: `Opportunity Agent used fallback: ${this.getErrorMessage(error)}`,
      };
    }
  }

  private getFallbackOpportunities(): Opportunity[] {
    return [
      {
        type: 'investment',
        title: 'Opportunity Analysis Unavailable',
        description:
          'Opportunity surfacing is temporarily unavailable. This is a fallback entry to preserve pipeline continuity.',
        confidence: 0.2,
        rationale: 'Fallback entry - no actionable rationale available at this time.',
      },
    ];
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
