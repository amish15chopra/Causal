import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { CausalEffect } from '../contracts/analysis';

const CAUSAL_SYSTEM_PROMPT = `You are an expert causal reasoning agent for macro events and markets. Always output valid JSON only. Use these confidence guidelines: 0.9+ = strong historical precedent, 0.7-0.9 = likely based on economic patterns, 0.4-0.7 = plausible but uncertain, <0.4 = speculative. Every effect must include 1-2 sentence reasoning.`;

const EXPAND_NODE_USER_PROMPT_TEMPLATE = `### CAUSAL CONTEXT
1. GLOBAL EVENT: {rootEvent}
2. SPECIFIC BRANCH: {nodeText}

### TASK
Identify 2-3 unique CONSEQUENCES that result DIRECTLY from the "SPECIFIC BRANCH" above.
These consequences must be logical successors of "{nodeText}", not just re-statements of the effects of "{rootEvent}".

### RULES
- Output JSON strictly in the following format:
{
  "effects": [
    {
      "text": "description of direct effect",
      "confidence": 0.75,
      "reasoning": "Explain step-by-step how '{nodeText}' leads to this specific effect.",
      "sources": [],
      "secondOrder": []
    }
  ]
}
- DO NOT repeat generic effects of the global event.
- Focus only on the unique dimension represented by the "SPECIFIC BRANCH".
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

const causalExpansionSchema = z.object({
  effects: z.array(causalEffectSchema),
});

interface CausalExpansionAgentDependencies {
  model: string;
}

interface CausalExpansionRunOptions {
  nodeText: string;
  rootEvent: string;
  invoke: <T>(agent: Agent<any, any>, prompt: string) => Promise<T>;
}

export class CausalExpansionAgent {
  private readonly agent: Agent<any, any>;

  public constructor(dependencies: CausalExpansionAgentDependencies) {
    this.agent = new Agent({
      name: 'CausalExpansionAgent',
      instructions: CAUSAL_SYSTEM_PROMPT,
      handoffDescription: 'Expands a graph node into second-order consequences.',
      model: dependencies.model,
      modelSettings: {
        temperature: 0.2,
      },
      outputType: causalExpansionSchema as any,
    });
  }

  public async run(options: CausalExpansionRunOptions): Promise<{ effects: CausalEffect[]; errorMessage?: string }> {
    try {
      const prompt = EXPAND_NODE_USER_PROMPT_TEMPLATE
        .replace('{nodeText}', options.nodeText)
        .replace('{rootEvent}', options.rootEvent);

      const result = await options.invoke<{ effects: CausalEffect[] }>(this.agent, prompt);
      return { effects: result.effects };
    } catch (error) {
      return {
        effects: [],
        errorMessage: `Causal Expansion Failed (Partial graph preserved): ${this.getErrorMessage(error)}`,
      };
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

