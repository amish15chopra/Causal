import React, { useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import type { Node, NodeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphState } from '../hooks/useGraphState';
import type { CausalGraph } from '../graph/transformToGraph';
import CausalNode from './CausalNode';

interface InteractiveGraphProps {
  graphData: CausalGraph | null;
}

const nodeTypes = {
  causal: CausalNode,
};

export const InteractiveGraph: React.FC<InteractiveGraphProps> = ({ graphData }) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    initializeGraph,
    expandNode,
    isExpanding
  } = useGraphState();

  // Load the initial static payload once it arrives from the Orchestrator
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      initializeGraph(graphData);
    }
  }, [graphData, initializeGraph]);

  const handleNodeClick: NodeMouseHandler = (event, node: Node) => {
    event.stopPropagation();
    
    // Safety check - ignore if we lack labels or are already resolving
    if (!node.data?.label || isExpanding) return;

    // Trigger deterministic expansion based on actual click coordinates
    expandNode(node.id, node.data.label, node.position.x, node.position.y);
  };

  if (!nodes || nodes.length === 0) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
        <p style={{ color: '#64748b' }}>No graph data generated yet.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {isExpanding && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#0f172a', color: '#fff', padding: '6px 12px', borderRadius: '4px', zIndex: 10, fontSize: '0.8rem' }}>
          ⏳ Expanding Causality...
        </div>
      )}
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
};
