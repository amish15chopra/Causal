import type { CausalAnalysisResult, CausalEffect } from '../contracts/analysis';
import type { CausalEdge, CausalNode } from '../../domain/models';
import { generateNodeId } from '../../utils/hash';

export class GraphBuilder {
  public buildCoreGraph(rootEvent: string, firstOrderPayload: CausalAnalysisResult): { nodes: CausalNode[]; edges: CausalEdge[] } {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    const rootId = generateNodeId(rootEvent);
    nodes.push({
      id: rootId,
      type: 'macro_event',
      text: rootEvent,
      probability: 1,
      reasoning: 'Triggering Event',
    });

    const firstOrder = Array.isArray(firstOrderPayload.firstOrder) ? firstOrderPayload.firstOrder : [];

    firstOrder.forEach((effect) => {
      const effectId = generateNodeId(effect.text, rootId);
      nodes.push({
        id: effectId,
        type: 'first_order_effect',
        text: effect.text,
        probability: Number(effect.confidence) || 0.5,
        reasoning: effect.reasoning || '',
        sources: effect.sources,
      });
      edges.push({ source: rootId, target: effectId });
    });

    return { nodes, edges };
  }

  public buildExpansionGraph(parentNodeId: string, effects: CausalEffect[]): { nodes: CausalNode[]; edges: CausalEdge[] } {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    effects.forEach((effect) => {
      const effectId = generateNodeId(effect.text, parentNodeId);
      nodes.push({
        id: effectId,
        type: 'second_order_effect',
        text: effect.text,
        probability: effect.confidence || 0.5,
        reasoning: effect.reasoning || '',
        sources: effect.sources,
      });
      edges.push({ source: parentNodeId, target: effectId });
    });

    return { nodes, edges };
  }

  public mergeGraphSegments(
    target: { nodes: CausalNode[]; edges: CausalEdge[] },
    segment: { nodes: CausalNode[]; edges: CausalEdge[] },
  ): void {
    segment.nodes.forEach((node) => {
      if (!target.nodes.find((existingNode) => existingNode.id === node.id)) {
        target.nodes.push(node);
      }
    });

    segment.edges.forEach((edge) => {
      const exists = target.edges.find(
        (existingEdge) => existingEdge.source === edge.source && existingEdge.target === edge.target,
      );

      if (!exists) {
        target.edges.push(edge);
      }
    });
  }
}
