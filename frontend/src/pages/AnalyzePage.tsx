import React, { useState } from 'react';
import axios from 'axios';
import { InteractiveGraph } from '../components/InteractiveGraph';
import { MarketImpactPanel } from '../components/MarketImpactPanel';
import type { MarketImpact } from '../components/MarketImpactPanel';
import { OpportunityPanel } from '../components/OpportunityPanel';
import type { Opportunity } from '../components/OpportunityPanel';
import { Search, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import type { CausalGraph } from '../graph/transformToGraph';

interface AnalysisResponse {
  graph: CausalGraph & {
    marketImpacts?: MarketImpact[];
    opportunities?: Opportunity[];
  };
}

export const AnalyzePage: React.FC = () => {
  const [eventText, setEventText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!eventText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:3001/analyze', { event: eventText });
      setResult(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Analysis failed.');
      } else {
        setError('Analysis failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{
      maxWidth: result ? '1200px' : '800px',
      margin: '0 auto',
      paddingTop: result ? '0' : '15vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: result ? 'stretch' : 'center',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>

      {/* Search box — hidden when results are displayed */}
      {!result && (
        <>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2.5rem', letterSpacing: '-0.05em' }}>
            horizon
          </h1>

          <div style={{ 
            width: '100%',
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '24px', 
            border: '1px solid var(--border-heavy)',
            boxShadow: 'var(--shadow-md)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '3rem',
          }}>
            <textarea 
              style={{ 
                width: '100%', 
                minHeight: '60px', 
                padding: '0.5rem 0.5rem', 
                fontSize: '1.1rem', 
                lineHeight: '1.5',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                resize: 'none',
                outline: 'none',
                boxShadow: 'none',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400
              }}
              placeholder="Ask anything..."
              value={eventText}
              onChange={(e) => {
                setEventText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <button style={{ background: 'none', border: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, padding: '0.5rem', borderRadius: '8px' }} onMouseOver={e => e.currentTarget.style.backgroundColor='var(--bg-tertiary)'} onMouseOut={e => e.currentTarget.style.backgroundColor='transparent'}>
                  <Search size={14} /> Research
                </button>
              </div>
              <button 
                onClick={handleAnalyze} 
                disabled={loading || !eventText.trim()}
                style={{ 
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: eventText.trim() ? 'var(--text-primary)' : 'var(--bg-tertiary)', 
                  color: eventText.trim() ? 'var(--bg-primary)' : 'var(--text-muted)', 
                  border: 'none', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading || !eventText.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* When loading (before result arrives), show loading indicator */}
      {loading && !result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          <Loader2 className="animate-spin" size={16} />
          <span style={{ fontSize: '0.9rem' }}>Analyzing causal dependencies...</span>
        </div>
      )}

      {/* Query echo header — shown at top when results exist */}
      {result && eventText && (
        <div style={{
          fontSize: '1.4rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '2rem',
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
        }}>
          {eventText}
        </div>
      )}

      {error && (
        <div className="fade-in" style={{ 
          padding: '1.5rem', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          color: 'var(--danger)', 
          borderRadius: '12px', 
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <AlertCircle size={24} />
          <div>
            <strong style={{ display: 'block' }}>Simulation Error</strong>
            <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>{error}</span>
          </div>
        </div>
      )}

      {/* CORE ANALYSIS VIEW */}
      {result && result.graph && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* Causal Topology Graph Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Causal Topology</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.25rem' }}>High-order dependencies mapped via stochastic reasoning</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', fontWeight: 600 }}>
                  NODES: <span style={{ color: 'var(--text-primary)' }}>{result.graph.nodes?.length || 0}</span>
                </span>
                <span style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', fontWeight: 600 }}>
                  EDGES: <span style={{ color: 'var(--text-primary)' }}>{result.graph.edges?.length || 0}</span>
                </span>
              </div>
            </div>
            
            <div style={{ 
              width: '100%',
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '12px', 
              border: '1px solid var(--border-light)',
              overflow: 'hidden',
              height: '650px',
              position: 'relative',
              boxShadow: 'var(--shadow-md)'
            }}>
              <InteractiveGraph graphData={result.graph} />
            </div>
          </section>

          {/* Analysis Panels Grid */}
          <section style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: '3rem',
            alignItems: 'flex-start'
          }}>
            {result.graph.marketImpacts && result.graph.marketImpacts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <MarketImpactPanel impacts={result.graph.marketImpacts} />
              </div>
            )}
            
            {result.graph.opportunities && result.graph.opportunities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 <OpportunityPanel opportunities={result.graph.opportunities} />
              </div>
            )}
          </section>

        </div>
      )}

      {result && (
        <details style={{ marginTop: '4rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, userSelect: 'none' }}>
            View System Diagnostics (JSON)
          </summary>
          <div style={{ marginTop: '1rem' }}>
            <pre style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)',
              padding: '1.5rem', 
              borderRadius: '12px', 
              border: '1px solid var(--border-light)',
              overflowX: 'auto',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              fontFamily: 'var(--font-mono)'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
};
