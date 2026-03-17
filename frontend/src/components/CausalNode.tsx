import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

interface Source {
  title: string;
  url: string;
}

/**
 * Premium custom node for Causal Topology.
 * Features probability badges, reasoning tooltips (simplified for now), and hyperlinked citations.
 */
const CausalNode = ({ data }: NodeProps) => {
  const { label, probability, reasoning, nodeType, sources } = data;

  const getBackgroundColor = () => {
    switch (nodeType) {
      case 'macro_event': return '#0f172a';
      case 'first_order_effect': return '#ffffff';
      case 'second_order_effect': return '#ffffff';
      default: return '#ffffff';
    }
  };

  const getTextColor = () => {
    return nodeType === 'macro_event' ? '#f8fafc' : '#1e293b';
  };

  return (
    <div style={{
      padding: '16px',
      borderRadius: '12px',
      backgroundColor: getBackgroundColor(),
      color: getTextColor(),
      border: nodeType === 'macro_event' ? 'none' : '1px solid #e2e8f0',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      width: '280px',
      fontFamily: 'Inter, system-ui, sans-serif',
      transition: 'all 0.2s ease',
      position: 'relative'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />
      
      {/* Probability Badge */}
      {probability < 1 && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '10px',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '0.65rem',
          fontWeight: 800,
          backgroundColor: probability >= 0.8 ? '#dcfce7' : (probability >= 0.6 ? '#fef9c3' : '#fee2e2'),
          color: probability >= 0.8 ? '#166534' : (probability >= 0.6 ? '#854d0e' : '#991b1b'),
          border: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          {Math.round(probability * 100)}% CONFIDENCE
        </div>
      )}

      {/* Main Label */}
      <div style={{ 
        fontSize: '0.95rem', 
        fontWeight: 600, 
        lineHeight: 1.4,
        marginBottom: '8px' 
      }}>
        {label}
      </div>

      {/* Reasoning (Subtle) */}
      {reasoning && reasoning !== 'Triggering Event' && (
        <div style={{ 
          fontSize: '0.75rem', 
          color: nodeType === 'macro_event' ? '#94a3b8' : '#64748b',
          lineHeight: 1.5,
          fontStyle: 'italic',
          borderTop: '1px solid ' + (nodeType === 'macro_event' ? '#1e293b' : '#f1f5f9'),
          paddingTop: '8px',
          marginTop: '8px'
        }}>
          {reasoning}
        </div>
      )}

      {/* Citations / Sources */}
      {sources && sources.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px dashed ' + (nodeType === 'macro_event' ? '#1e293b' : '#e2e8f0'),
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          {sources.map((source: Source, idx: number) => (
            <a
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} // Prevent node expansion when clicking source
              style={{
                fontSize: '0.65rem',
                color: nodeType === 'macro_event' ? '#3b82f6' : '#2563eb',
                textDecoration: 'none',
                backgroundColor: nodeType === 'macro_event' ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                border: '1px solid transparent',
                transition: 'border-color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = 'transparent')}
            >
              <span>🔗</span>
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {source.title}
              </span>
            </a>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
    </div>
  );
};

export default memo(CausalNode);
