import type { Edge, Node } from 'reactflow';

export interface CausalNode {
  id: string;
  type: string;
  text: string;
  probability: number;
  reasoning: string;
}

export interface CausalEdge {
  source: string;
  target: string;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

/**
 * Transforms the backend CausalGraph into React Flow Node and Edge arrays,
 * calculating an elegant horizontal distribution per depth layer.
 */
export function transformToGraph(graph: CausalGraph): { nodes: Node[], edges: Edge[] } {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // 1. Group nodes by type to emulate "layers"
  const macroEvents = graph.nodes.filter(n => n.type === 'macro_event');
  const firstOrder = graph.nodes.filter(n => n.type === 'first_order_effect');
  const secondOrder = graph.nodes.filter(n => n.type === 'second_order_effect');

  // Hardcoded visual configuration
  const LAYER_Y_SPACING = 250;
  const NODE_X_SPACING = 350;

  const positionLayer = (layerNodes: CausalNode[], depthLevel: number) => {
    // Center the layer around X=0
    const totalWidth = (layerNodes.length - 1) * NODE_X_SPACING;
    const startX = -(totalWidth / 2);

    layerNodes.forEach((n, index) => {
      rfNodes.push({
        id: n.id,
        position: { x: startX + index * NODE_X_SPACING, y: depthLevel * LAYER_Y_SPACING },
        data: {
          label: n.text,
          probability: n.probability,
          reasoning: n.reasoning,
          nodeType: n.type
        },
        type: 'default', // Using default for now, can be customized later
      });
    });
  };

  // 2. Position each layer
  positionLayer(macroEvents, 0);
  positionLayer(firstOrder, 1);
  positionLayer(secondOrder, 2);

  // 3. Map Edges directly
  graph.edges.forEach((e, i) => {
    rfEdges.push({
      id: `e-${e.source}-${e.target}-${i}`, // guaranteed stable path key
      source: e.source,
      target: e.target,
      animated: true, // Cool flowing animation
      style: { stroke: '#475569', strokeWidth: 2 }
    });
  });

  return { nodes: rfNodes, edges: rfEdges };
}
