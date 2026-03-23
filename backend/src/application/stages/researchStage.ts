import type { ResearchAgent } from '../../agents/researchAgent';
import type { AnalysisPipelineState, PipelineContext, PipelineStage } from '../pipeline/types';

export class ResearchStage implements PipelineStage<AnalysisPipelineState> {
  public readonly name = 'research';

  public constructor(private readonly researchAgent: ResearchAgent) {}

  public async execute(state: AnalysisPipelineState, context: PipelineContext): Promise<AnalysisPipelineState> {
    try {
      const research = await this.researchAgent.execute(state.event, context);
      const errors = [...state.errors];

      if (research.research_unavailable) {
        errors.push('Research Unavailable (Proceeding with LLM internal knowledge)');
      }

      return {
        ...state,
        errors,
        research,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error('Research stage failed', {
        correlationId: context.correlationId,
        error: message,
      });

      return {
        ...state,
        errors: [...state.errors, `Research System Malfunction: ${message}`],
      };
    }
  }
}
