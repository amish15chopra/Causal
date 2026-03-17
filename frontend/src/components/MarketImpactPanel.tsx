import React from 'react';

interface MarketImpact {
  sector: string;
  direction: 'positive' | 'negative' | 'neutral';
  confidence: number;
  explanation: string;
}

interface MarketImpactPanelProps {
  impacts: MarketImpact[];
}

const DIRECTION_CONFIG: Record<string, { label: string; bg: string; color: string; bar: string }> = {
  positive: { label: '▲ Positive', bg: '#dcfce7', color: '#16a34a', bar: '#22c55e' },
  negative: { label: '▼ Negative', bg: '#fee2e2', color: '#dc2626', bar: '#ef4444' },
  neutral:  { label: '→ Neutral',  bg: '#f1f5f9', color: '#475569', bar: '#94a3b8' },
};

/**
 * Sidebar table showing full sector-level market impacts with
 * directional color badges, calibrated confidence bars, and grounded explanation text.
 */
export const MarketImpactPanel: React.FC<MarketImpactPanelProps> = ({ impacts }) => {
  if (!impacts || impacts.length === 0) return null;

  return (
    <div style={{
      width: '340px',
      flexShrink: 0,
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '600px',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontWeight: 700,
        fontSize: '0.875rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        📊 Market Impact Analysis
      </div>

      {/* Scrollable list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {impacts.map((impact, idx) => {
          const cfg = DIRECTION_CONFIG[impact.direction] || DIRECTION_CONFIG.neutral;
          const confidencePct = Math.round((impact.confidence || 0) * 100);

          return (
            <div key={idx} style={{
              padding: '14px 18px',
              borderBottom: idx < impacts.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              {/* Row 1: sector + badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', flex: 1 }}>
                  {impact.sector}
                </span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.label}
                </span>
              </div>

              {/* Row 2: confidence bar */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>CONFIDENCE</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>{confidencePct}%</span>
                </div>
                <div style={{ height: '5px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${confidencePct}%`,
                    backgroundColor: cfg.bar,
                    borderRadius: '999px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              {/* Row 3: explanation */}
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
                {impact.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
