import type { CausalGraph } from '../../domain/models';
import type { CausalAgentResponse } from '../../agents/causalAgent';
import type { ResearchBriefing } from '../../agents/researchAgent';
import type { Logger } from '../../infrastructure/logging/logger';

export interface AnalysisResponse {
  event: string;
  graph: CausalGraph;
  errors: string[];
}

export interface AnalysisPipelineState {
  event: string;
  graph: CausalGraph;
  errors: string[];
  research: ResearchBriefing;
  firstOrderData?: CausalAgentResponse;
}

export interface PipelineContext {
  correlationId: string;
  logger: Logger;
}

export interface PipelineStage<TState> {
  readonly name: string;
  execute(state: TState, context: PipelineContext): Promise<TState>;
}
