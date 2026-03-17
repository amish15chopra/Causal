export const CAUSAL_SYSTEM_PROMPT = `You are an expert causal reasoning agent for macro events and markets. Always output valid JSON only. Use these confidence guidelines: 0.9+ = strong historical precedent, 0.7–0.9 = likely based on economic patterns, 0.4–0.7 = plausible but uncertain, <0.4 = speculative. Every effect must include 1-2 sentence reasoning.`;

export const CAUSAL_USER_PROMPT_TEMPLATE = `Event: {event}
Please analyze this macro event and break it down into causal chains.
Output JSON strictly in the following format:
{
  "firstOrder": [
    {
      "text": "description of direct effect",
      "confidence": 0.85,
      "reasoning": "1-2 sentence reasoning explaining why"
    }
  ],
  "secondOrder": [
    {
      "text": "description of secondary effect resulting from first order effect",
      "confidence": 0.65,
      "reasoning": "1-2 sentence reasoning"
    }
  ]
}
No markdown wrappers, no introductory text. Pure JSON object only.`;

export const EXPAND_NODE_USER_PROMPT_TEMPLATE = `Current Macro State: {nodeText}

What happens next as a DIRECT result of this state? 
Output exactly 1 to 3 new consequences.
Output JSON strictly in the following format:
[
  {
    "text": "description of direct effect",
    "confidence": 0.75,
    "reasoning": "1-2 sentence reasoning explaining why"
  }
]
No markdown wrappers, no introductory text. Pure JSON array only.`;
