import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MarketImpact {
  sector: string;
  direction: 'positive' | 'negative' | 'neutral';
  confidence: number;
  explanation: string;
}

interface MarketImpactPanelProps {
  impacts: MarketImpact[];
}

const DIRECTION_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  positive: { icon: <TrendingUp size={14} />, color: 'var(--success)' },
  negative: { icon: <TrendingDown size={14} />, color: 'var(--danger)' },
  neutral:  { icon: <Minus size={14} />, color: 'var(--text-muted)' },
};

export const MarketImpactPanel: React.FC<MarketImpactPanelProps> = ({ impacts }) => {
  if (!impacts || impacts.length === 0) return null;

  return (
    <div style={{
      width: '100%',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-light)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Market Impact
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', padding: '1px 7px', borderRadius: '10px' }}>
          {impacts.length}
        </span>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {impacts.map((impact, idx) => {
          const cfg = DIRECTION_CONFIG[impact.direction] || DIRECTION_CONFIG.neutral;
          const confidencePct = Math.round((impact.confidence || 0) * 100);

          return (
            <div key={idx} style={{
              padding: '14px 18px',
              borderBottom: idx < impacts.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {impact.sector}
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: cfg.color,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {cfg.icon}
                  {confidencePct}%
                </div>
              </div>

              {/* Minimal confidence bar */}
              <div style={{ height: '2px', borderRadius: '2px', backgroundColor: 'var(--border-light)', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  height: '100%',
                  width: `${confidencePct}%`,
                  backgroundColor: cfg.color,
                  opacity: 0.7,
                  borderRadius: '2px',
                  transition: 'width 0.8s ease',
                }} />
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {impact.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
