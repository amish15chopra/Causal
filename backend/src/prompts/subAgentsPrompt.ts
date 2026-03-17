export const MARKET_IMPACT_SYSTEM_PROMPT = `You are a specialized market analyst AI. Your job is to strictly analyze a given causal chain and determine the direct impact on specific market sectors. Output valid JSON only. Keep explanations to 1-2 sentences. Ensure confidence is a number between 0.0 and 1.0.`;

export const MARKET_IMPACT_USER_PROMPT_TEMPLATE = `Based on the following causal analysis of a macro event:
{causalChain}

Provide exactly 3 to 5 market sector impacts.
Output JSON strictly in the following format:
[
  {
    "sector": "Sector Name (e.g. Technology, Real Estate, Logistics)",
    "direction": "positive|negative|neutral",
    "confidence": 0.85,
    "explanation": "1-2 sentence explanation of the impact on this sector."
  }
]
No markdown wrappers, no introductory text. Pure JSON array only.`;

export const OPPORTUNITY_SYSTEM_PROMPT = `You are a top-tier venture capitalist and hedge fund analyst. Your task is to extract highly actionable strategic opportunities (startup concepts or investments) grounded uniquely in the provided market impacts. Output valid JSON only. Keep rationales strict and logical.`;

export const OPPORTUNITY_USER_PROMPT_TEMPLATE = `Based on these market impacts stemming from a recent macro event:
{marketImpacts}

Provide exactly 2 to 4 concrete actionable opportunities.
Output JSON strictly in the following format:
[
  {
    "type": "investment|startup",
    "title": "Short punchy title",
    "description": "The detailed structural reason this gap or edge exists",
    "confidence": 0.75,
    "rationale": "The precise logical step-by-step rationale for why this makes sense now"
  }
]
No markdown wrappers, no introductory text. Pure JSON array only.`;
