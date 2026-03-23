import type { AnalysisPipelineState, PipelineContext, PipelineStage } from '../pipeline/types';
import { OpportunityService } from '../services/opportunityService';

export class OpportunityStage implements PipelineStage<AnalysisPipelineState> {
  public readonly name = 'opportunity-analysis';

  public constructor(private readonly opportunityService: OpportunityService) {}

  public async execute(state: AnalysisPipelineState, context: PipelineContext): Promise<AnalysisPipelineState> {
    if (!state.graph.marketImpacts || state.graph.marketImpacts.length === 0) {
      return {
        ...state,
        errors: [...state.errors, 'Opportunity Agent Skipped: Dependent Market Impacts missing.'],
      };
    }

    try {
      const { opportunities, fallbackUsed, error } = await this.opportunityService.getOpportunities(
        state.graph.marketImpacts,
        state.research.content,
        context,
      );

      const errors = [...state.errors];
      if (fallbackUsed && error) {
        errors.push(`Opportunity Agent used fallback: ${error}`);
      }

      return {
        ...state,
        errors,
        graph: {
          ...state.graph,
          opportunities,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.warn('Opportunity stage failed', {
        correlationId: context.correlationId,
        error: message,
      });

      return {
        ...state,
        errors: [...state.errors, `Opportunity Surfacing stage error: ${message}`],
      };
    }
  }
}
