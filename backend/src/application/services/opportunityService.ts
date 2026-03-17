import { OpportunityAgent } from '../../agents/opportunityAgent';
import type { Opportunity } from '../../domain/models/Opportunity';
import type { MarketImpact } from '../../domain/models/MarketImpact';

/**
 * Application service responsible for surfacing actionable investment and startup
 * opportunities from market impact data. Decouples orchestration from agent internals
 * and enforces schema validation + graceful fallback on failure.
 */
export class OpportunityService {
  private agent: OpportunityAgent;

  constructor() {
    this.agent = new OpportunityAgent();
  }

  /**
   * Derives actionable opportunities from resolved market impacts.
   * Validates each opportunity against the required schema fields.
   * Falls back to a typed stub if the agent fails, preserving pipeline continuity.
   *
   * @param impacts - The validated market sector impacts from MarketImpactService
   * @returns Validated opportunities array, fallback flag, and optional error message
   */
  public async getOpportunities(impacts: MarketImpact[], researchContext: string = ''): Promise<{
    opportunities: Opportunity[];
    fallbackUsed: boolean;
    error?: string;
  }> {
    try {
      const raw = await this.agent.extractOpportunities(impacts, researchContext);

      // Validate that each opportunity has all required fields and correct types
      const validated = raw.filter(
        (o) =>
          (o.type === 'investment' || o.type === 'startup') &&
          typeof o.title === 'string' && o.title.length > 0 &&
          typeof o.description === 'string' &&
          typeof o.confidence === 'number' &&
          typeof o.rationale === 'string' && o.rationale.length > 0
      );

      if (validated.length === 0) {
        throw new Error('All returned opportunities failed schema validation.');
      }

      return { opportunities: validated, fallbackUsed: false };
    } catch (e: any) {
      console.warn(`⚠️ [OpportunityService] Agent failed, using fallback. Reason: ${e.message}`);

      // Graceful typed fallback so the graph payload is never empty
      const fallback: Opportunity[] = [
        {
          type: 'investment',
          title: 'Opportunity Analysis Unavailable',
          description: 'Opportunity surfacing is temporarily unavailable. This is a fallback entry to preserve pipeline continuity.',
          confidence: 0.2,
          rationale: 'Fallback entry — no actionable rationale available at this time.',
        },
      ];

      return { opportunities: fallback, fallbackUsed: true, error: e.message };
    }
  }
}
