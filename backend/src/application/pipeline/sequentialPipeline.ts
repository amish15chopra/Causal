import type { PipelineContext, PipelineStage } from './types';

export class SequentialPipeline<TState> {
  public constructor(private readonly stages: PipelineStage<TState>[]) {}

  public async run(initialState: TState, context: PipelineContext): Promise<TState> {
    let currentState = initialState;

    for (const stage of this.stages) {
      context.logger.info(`Running pipeline stage: ${stage.name}`, {
        correlationId: context.correlationId,
      });
      currentState = await stage.execute(currentState, context);
    }

    return currentState;
  }
}
