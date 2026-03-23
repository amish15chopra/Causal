export const CAUSAL_SYSTEM_PROMPT = `You are an expert causal reasoning agent for macro events and markets. Always output valid JSON only. Use these confidence guidelines: 0.9+ = strong historical precedent, 0.7–0.9 = likely based on economic patterns, 0.4–0.7 = plausible but uncertain, <0.4 = speculative. Every effect must include 1-2 sentence reasoning. Use any provided SEARCH CONTEXT to ground your analysis in current real-world data and PROVIDE CITATIONS (source title and URL) in the "sources" field for any factual claims derived from the context.`;

export const CAUSAL_USER_PROMPT_TEMPLATE = `Event: {event}
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
      ]
    }
  ]
}
RULES:
1. Generate 3-5 distinct first-order effects.
2. Ensure they cover different dimensions (e.g., economic, social, geopolitical, supply chain).
No markdown wrappers, no introductory text. Pure JSON object only.`;

export const EXPAND_NODE_USER_PROMPT_TEMPLATE = `### CAUSAL CONTEXT
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
