import React, { useState } from 'react';
import { BarChart3, Rocket, ArrowRight } from 'lucide-react';

export interface Opportunity {
  type: 'investment' | 'startup';
  title: string;
  description: string;
  confidence: number;
  rationale: string;
}

interface OpportunityPanelProps {
  opportunities: Opportunity[];
}

export const OpportunityPanel: React.FC<OpportunityPanelProps> = ({ opportunities }) => {
  const [activeTab, setActiveTab] = useState<'investment' | 'startup'>('investment');

  if (!opportunities || opportunities.length === 0) return null;

  const filtered = opportunities.filter(o => o.type === activeTab);

  return (
    <div style={{ width: '100%' }}>
      {/* Section heading + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Strategic Opportunities
        </span>
        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-light)' }}>
          <TabButton active={activeTab === 'investment'} onClick={() => setActiveTab('investment')} icon={<BarChart3 size={13} />} label="Market" />
          <TabButton active={activeTab === 'startup'} onClick={() => setActiveTab('startup')} icon={<Rocket size={13} />} label="Ventures" />
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}>
            No {activeTab} opportunities identified.
          </div>
        ) : (
          filtered.map((opp, idx) => (
            <div key={idx} className="fade-in" style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4 }}>
                  {opp.title}
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: opp.confidence >= 0.8 ? 'var(--success)' : 'var(--warning)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {Math.round(opp.confidence * 100)}%
                </span>
              </div>

              {/* Description */}
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {opp.description}
              </p>

              {/* Rationale steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px' }}>
                {opp.rationale.split(/[→>]/).filter(s => s.trim()).map((step, sidx) => {
                  const clean = step.trim().replace(/^\d+[.)]\s*/, '');
                  if (!clean) return null;
                  return (
                    <div key={sidx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <ArrowRight size={12} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '3px' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{clean}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{
      padding: '5px 10px',
      fontSize: '0.78rem',
      fontWeight: 600,
      cursor: 'pointer',
      backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
      border: 'none',
      borderRadius: '6px',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      transition: 'all 0.15s',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    }}
  >
    {icon} {label}
  </button>
);
