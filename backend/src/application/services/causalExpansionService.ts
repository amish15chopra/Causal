import type { CausalAgent } from '../../agents/causalAgent';
import type { CausalEdge, CausalNode } from '../../domain/models';
import type { PipelineContext } from '../pipeline/types';
import { GraphBuilder } from './graphBuilder';

export class CausalExpansionService {
  public constructor(
    private readonly causalAgent: CausalAgent,
    private readonly graphBuilder: GraphBuilder,
  ) {}

  public async expandNode(
    nodeId: string,
    nodeText: string,
    rootEvent: string,
    context: PipelineContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }> {
    context.logger.info('Expanding causal node', {
      correlationId: context.correlationId,
      nodeId,
    });

    const effects = await this.causalAgent.expandNode(nodeText, rootEvent, context);
    return this.graphBuilder.buildExpansionGraph(nodeId, effects);
  }
}
