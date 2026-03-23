import type { AnalysisPipelineState, PipelineContext, PipelineStage } from '../pipeline/types';
import { MarketImpactService } from '../services/marketImpactService';

export class MarketImpactStage implements PipelineStage<AnalysisPipelineState> {
  public readonly name = 'market-impact-analysis';

  public constructor(private readonly marketImpactService: MarketImpactService) {}

  public async execute(state: AnalysisPipelineState, context: PipelineContext): Promise<AnalysisPipelineState> {
    const chainSummary = {
      event: state.event,
      consequences: state.graph.nodes
        .filter((node) => node.type !== 'macro_event')
        .map((node) => ({
          text: node.text,
          type: node.type,
          reasoning: node.reasoning,
        })),
    };

    try {
      const { impacts, fallbackUsed, error } = await this.marketImpactService.getMarketImpacts(
        chainSummary,
        state.research.content,
        context,
      );

      const errors = [...state.errors];
      if (fallbackUsed && error) {
        errors.push(`Market Impact Agent used fallback: ${error}`);
      }

      return {
        ...state,
        errors,
        graph: {
          ...state.graph,
          marketImpacts: impacts,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.warn('Market impact stage failed', {
        correlationId: context.correlationId,
        error: message,
      });

      return {
        ...state,
        errors: [...state.errors, `Market Analysis stage error: ${message}`],
      };
    }
  }
}
