import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ExternalLink } from 'lucide-react';

interface Source {
  title: string;
  url: string;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  macro_event: 'Trigger Event',
  first_order_effect: 'First Order',
  second_order_effect: 'Second Order',
};

const CausalNode = ({ data }: NodeProps) => {
  const { label, probability, reasoning, nodeType, sources } = data;

  const isTrigger = nodeType === 'macro_event';
  const probPct = Math.round((probability || 0) * 100);

  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: '10px',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: isTrigger ? '1px solid var(--border-heavy)' : '1px solid var(--border-light)',
      width: '300px',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
    }}>
      {/* Top handle */}
      <Handle type="target" position={Position.Top} style={{ background: 'var(--border-heavy)', width: '6px', height: '6px', border: 'none', borderRadius: '50%' }} />

      {/* Type badge + confidence */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: isTrigger ? 'var(--text-primary)' : 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          backgroundColor: isTrigger ? 'var(--bg-tertiary)' : 'transparent',
          padding: isTrigger ? '2px 6px' : '0',
          borderRadius: '4px',
        }}>
          {NODE_TYPE_LABELS[nodeType] ?? nodeType.replace(/_/g, ' ')}
        </span>

        {probability < 1 && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: probPct >= 80 ? 'var(--success)' : 'var(--warning)',
            fontFamily: 'var(--font-mono)',
          }}>
            {probPct}%
          </span>
        )}
      </div>

      {/* Label */}
      <div style={{
        fontSize: '0.95rem',
        fontWeight: 600,
        lineHeight: 1.45,
        color: 'var(--text-primary)',
        marginBottom: reasoning && reasoning !== 'Triggering Event' ? '10px' : '0',
      }}>
        {label}
      </div>

      {/* Reasoning */}
      {reasoning && reasoning !== 'Triggering Event' && (
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
          margin: 0,
          marginBottom: sources && sources.length > 0 ? '12px' : '0',
        }}>
          {reasoning}
        </p>
      )}

      {/* Sources */}
      {sources && sources.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          flexWrap: 'wrap' as const,
          gap: '6px',
        }}>
          {sources.map((source: Source, idx: number) => (
            <a
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '3px 8px',
                borderRadius: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: '1px solid var(--border-light)',
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-heavy)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }}
            >
              <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {source.title}
              </span>
              <ExternalLink size={10} />
            </a>
          ))}
        </div>
      )}

      {/* Bottom handle */}
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--border-heavy)', width: '6px', height: '6px', border: 'none', borderRadius: '50%' }} />
    </div>
  );
};

export default memo(CausalNode);
