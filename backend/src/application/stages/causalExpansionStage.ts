import type { AnalysisPipelineState, PipelineContext, PipelineStage } from '../pipeline/types';
import { CausalExpansionService } from '../services/causalExpansionService';
import { GraphBuilder } from '../services/graphBuilder';

export class CausalExpansionStage implements PipelineStage<AnalysisPipelineState> {
  public readonly name = 'causal-expansion';

  public constructor(
    private readonly expansionService: CausalExpansionService,
    private readonly graphBuilder: GraphBuilder,
  ) {}

  public async execute(state: AnalysisPipelineState, context: PipelineContext): Promise<AnalysisPipelineState> {
    const firstOrderNodes = state.graph.nodes.filter((node) => node.type === 'first_order_effect');

    if (firstOrderNodes.length === 0) {
      return state;
    }

    try {
      const expansionResults = await Promise.all(
        firstOrderNodes.map((node) => this.expansionService.expandNode(node.id, node.text, state.event, context)),
      );

      const nextGraph = {
        ...state.graph,
        nodes: [...state.graph.nodes],
        edges: [...state.graph.edges],
      };

      expansionResults.forEach((result) => {
        this.graphBuilder.mergeGraphSegments(nextGraph, result);
      });

      return {
        ...state,
        graph: nextGraph,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.warn('Causal expansion failed', {
        correlationId: context.correlationId,
        error: message,
      });

      return {
        ...state,
        errors: [...state.errors, `Causal Expansion Failed (Partial graph preserved): ${message}`],
      };
    }
  }
}
