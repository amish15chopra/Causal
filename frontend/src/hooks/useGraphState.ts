import { useCallback, useState } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import axios from 'axios';
import { transformToGraph } from '../graph/transformToGraph';
import type { CausalGraph } from '../graph/transformToGraph';

export function useGraphState() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExpanding, setIsExpanding] = useState(false);

  // Initialize from a fresh strict CausalGraph payload
  const initializeGraph = useCallback((graphData: CausalGraph) => {
    const { nodes: newNodes, edges: newEdges } = transformToGraph(graphData);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  // Handle the infinite expansion interaction
  const expandNode = useCallback(async (nodeId: string, nodeText: string, currentX: number, currentY: number) => {
    setIsExpanding(true);

    try {
      // 1. Fetch exact deterministic deltas from the backend
      const response = await axios.post('http://localhost:3001/expand', { nodeId, nodeText });
      const { nodes: deltaNodes, edges: deltaEdges } = response.data;

      // 2. Visually position the new nodes directly below the parent that was clicked
      const Y_OFFSET = 250;
      const X_SPACING = 300;
      
      const totalWidth = (deltaNodes.length - 1) * X_SPACING;
      const startX = currentX - (totalWidth / 2);

      const positionedDeltaNodes: Node[] = deltaNodes.map((n: any, i: number) => ({
        id: n.id,
        position: { x: startX + (i * X_SPACING), y: currentY + Y_OFFSET },
        data: {
          label: n.text,
          probability: n.probability,
          reasoning: n.reasoning,
          nodeType: n.type
        },
        type: 'default'
      }));

      const formattedDeltaEdges: Edge[] = deltaEdges.map((e: any, i: number) => ({
        id: `e-${e.source}-${e.target}-${i}-${Date.now()}`, // Force uniqueness for ReactFlow
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 } // Different color to highlight newly expanded paths
      }));

      // 3. Immutably merge into existing Hook state without wiping the canvas
      setNodes((nds) => {
        const uniqueNodes = positionedDeltaNodes.filter(
          newNd => !nds.find(existing => existing.id === newNd.id)
        );
        return [...nds, ...uniqueNodes];
      });

      setEdges((eds) => [...eds, ...formattedDeltaEdges]);

    } catch (error) {
      console.error("Failed to expand node:", error);
      alert("Failed to expand node causality.");
    } finally {
      setIsExpanding(false);
    }
  }, [setNodes, setEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    initializeGraph,
    expandNode,
    isExpanding
  };
}
