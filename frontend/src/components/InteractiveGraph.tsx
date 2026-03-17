import React, { useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import type { Node, NodeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphState } from '../hooks/useGraphState';
import type { CausalGraph } from '../graph/transformToGraph';
import CausalNode from './CausalNode';
import { Network, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      initializeGraph(graphData);
    }
  }, [graphData, initializeGraph]);

  const handleNodeClick: NodeMouseHandler = (event, node: Node) => {
    event.stopPropagation();
    if (!node.data?.label || isExpanding) return;
    expandNode(node.id, node.data.label, node.position.x, node.position.y);
  };

  if (!nodes || nodes.length === 0) {
    return (
      <div style={{ 
        height: '600px', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'var(--bg-secondary)', 
        borderRadius: '16px', 
        border: '1px dashed var(--border-heavy)',
        color: 'var(--text-muted)',
        gap: '1rem'
      }}>
        <Network size={48} style={{ opacity: 0.3 }} />
        <p style={{ fontWeight: 500 }}>No graph data generated yet.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%', 
      backgroundColor: 'var(--bg-primary)', 
      borderRadius: '0px', 
      overflow: 'hidden' 
    }}>
      {isExpanding && (
        <div style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          backgroundColor: 'var(--bg-tertiary)', 
          color: 'var(--accent)', 
          padding: '8px 16px', 
          borderRadius: '8px', 
          zIndex: 10, 
          fontSize: '0.8rem',
          fontWeight: 600,
          border: '1px solid var(--border-heavy)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <Loader2 size={14} className="animate-spin" />
          Resolving Causality...
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
        style={{ background: 'var(--bg-primary)' }}
      >
        <Background color="var(--border-light)" gap={24} />
        <Controls 
          style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-heavy)',
            boxShadow: 'var(--shadow-md)'
          }} 
        />
        <MiniMap 
          nodeStrokeWidth={3} 
          zoomable 
          pannable 
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-heavy)'
          }}
          maskColor="rgba(0, 0, 0, 0.4)"
        />
      </ReactFlow>
    </div>
  );
};
