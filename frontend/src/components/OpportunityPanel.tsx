import React, { useState } from 'react';

interface Opportunity {
  type: 'investment' | 'startup';
  title: string;
  description: string;
  confidence: number;
  rationale: string;
}

interface OpportunityPanelProps {
  opportunities: Opportunity[];
}

/**
 * Tabbed interface for displaying Investment and Startup opportunities.
 * Features rich aesthetics, confidence badges, and structured rationale chains.
 */
export const OpportunityPanel: React.FC<OpportunityPanelProps> = ({ opportunities }) => {
  const [activeTab, setActiveTab] = useState<'investment' | 'startup'>('investment');

  if (!opportunities || opportunities.length === 0) return null;

  const filtered = opportunities.filter(o => o.type === activeTab);

  return (
    <div style={{ marginTop: '3rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 700 }}>
          Strategic Opportunities
        </h2>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0' }}>
        <button 
          onClick={() => setActiveTab('investment')}
          style={{
            padding: '12px 4px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'investment' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'investment' ? '#2563eb' : '#64748b',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📈</span> Investments
        </button>
        <button 
          onClick={() => setActiveTab('startup')}
          style={{
            padding: '12px 4px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'startup' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'startup' ? '#2563eb' : '#64748b',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🚀</span> Startup Concepts
        </button>
      </div>

      {/* Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', 
        gap: '1.5rem',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {filtered.length === 0 ? (
          <div style={{ 
            gridColumn: '1 / -1', 
            padding: '3rem', 
            textAlign: 'center', 
            backgroundColor: '#f8fafc', 
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
            color: '#64748b'
          }}>
            No {activeTab} opportunities identified for this specific causal chain.
          </div>
        ) : (
          filtered.map((opp, idx) => (
            <div key={idx} style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'default'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800, lineHeight: 1.3 }}>
                  {opp.title}
                </h3>
                <div style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.025em',
                  backgroundColor: opp.confidence >= 0.8 ? '#dcfce7' : (opp.confidence >= 0.6 ? '#fef9c3' : '#fee2e2'),
                  color: opp.confidence >= 0.8 ? '#166534' : (opp.confidence >= 0.6 ? '#854d0e' : '#991b1b'),
                  whiteSpace: 'nowrap',
                  border: '1px solid rgba(0,0,0,0.05)'
                }}>
                  {Math.round(opp.confidence * 100)}% CONFIDENCE
                </div>
              </div>
              
              <p style={{ margin: 0, fontSize: '0.925rem', color: '#475569', lineHeight: 1.6 }}>
                {opp.description}
              </p>

              <div style={{ 
                backgroundColor: '#f1f5f9', 
                padding: '1.25rem', 
                borderRadius: '12px',
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 800, 
                  color: '#64748b', 
                  marginBottom: '0.75rem', 
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}>
                  Strategic Rationale
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.6 }}>
                  {opp.rationale.split(/[→>]/).map((step, sidx) => {
                    const cleanStep = step.trim().replace(/^\d+[\.\)]\s*/, '');
                    if (!cleanStep) return null;
                    return (
                      <div key={sidx} style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.75rem', 
                        marginBottom: '0.5rem' 
                      }}>
                        <div style={{ 
                          minWidth: '20px', 
                          height: '20px', 
                          borderRadius: '50%', 
                          backgroundColor: '#3b82f6', 
                          color: 'white', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          marginTop: '2px'
                        }}>
                          {sidx + 1}
                        </div>
                        <span style={{ fontWeight: 500 }}>{cleanStep}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};
