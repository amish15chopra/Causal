import { MarketImpactAgent } from '../../agents/marketImpactAgent';
import type { MarketImpact } from '../../domain/models/MarketImpact';
import type { CausalAgentResponse } from '../../agents/causalAgent';

/**
 * Application service responsible for producing market sector impact analysis
 * from a resolved causal chain. Decouples the orchestrator from agent internals.
 */
export class MarketImpactService {
  private agent: MarketImpactAgent;

  constructor() {
    this.agent = new MarketImpactAgent();
  }

  /**
   * Accepts a resolved causal chain payload and returns calibrated sector impacts.
   * Returns a typed fallback array if the agent fails, preserving pipeline continuity.
   *
   * @param causalData - The resolved causal chain from CausalAgent
   * @returns Array of MarketImpact with direction, confidence, and mandatory explanation
   */
  public async getMarketImpacts(causalData: CausalAgentResponse, researchContext: string = ''): Promise<{
    impacts: MarketImpact[];
    fallbackUsed: boolean;
    error?: string;
  }> {
    try {
      const impacts = await this.agent.analyzeImpacts(causalData, researchContext);

      // Validate that each impact has all required fields
      const validated = impacts.filter(
        (i) =>
          i.sector &&
          ['positive', 'negative', 'neutral'].includes(i.direction) &&
          typeof i.confidence === 'number' &&
          i.explanation
      );

      if (validated.length === 0) {
        throw new Error('All returned impacts failed schema validation.');
      }

      return { impacts: validated, fallbackUsed: false };
    } catch (e: any) {
      console.warn(`⚠️ [MarketImpactService] Agent failed, using fallback. Reason: ${e.message}`);

      // Graceful typed fallback: surface a generic "data unavailable" impact
      // so the graph is never empty and downstream opportunity surfacing can still proceed
      const fallback: MarketImpact[] = [
        {
          sector: 'Broad Market',
          direction: 'neutral',
          confidence: 0.3,
          explanation:
            'Market impact analysis is temporarily unavailable. This is a fallback entry to preserve pipeline continuity.',
        },
      ];

      return { impacts: fallback, fallbackUsed: true, error: e.message };
    }
  }
}
