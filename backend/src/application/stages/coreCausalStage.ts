import type { CausalAgent } from '../../agents/causalAgent';
import type { AnalysisPipelineState, PipelineContext, PipelineStage } from '../pipeline/types';
import { GraphBuilder } from '../services/graphBuilder';

export class CoreCausalStage implements PipelineStage<AnalysisPipelineState> {
  public readonly name = 'core-causal-analysis';

  public constructor(
    private readonly causalAgent: CausalAgent,
    private readonly graphBuilder: GraphBuilder,
  ) {}

  public async execute(state: AnalysisPipelineState, context: PipelineContext): Promise<AnalysisPipelineState> {
    const firstOrderData = await this.causalAgent.execute(
      {
        event: state.event,
        researchContext: state.research.content,
      },
      context,
    );

    const graphSegment = this.graphBuilder.buildCoreGraph(state.event, firstOrderData);

    return {
      ...state,
      firstOrderData,
      graph: {
        ...state.graph,
        nodes: graphSegment.nodes,
        edges: graphSegment.edges,
      },
    };
  }
}
