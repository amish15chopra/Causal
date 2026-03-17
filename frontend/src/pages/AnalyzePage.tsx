import React, { useState } from 'react';
import axios from 'axios';
import { InteractiveGraph } from '../components/InteractiveGraph';
import { MarketImpactPanel } from '../components/MarketImpactPanel';
import { OpportunityPanel } from '../components/OpportunityPanel';

export const AnalyzePage: React.FC = () => {
  const [eventText, setEventText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!eventText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:3001/analyze', { event: eventText });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#0f172a' }}>Macro Event Analysis</h1>
      
      <div style={{ margin: '2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <textarea 
          style={{ width: '100%', height: '100px', padding: '1rem', fontSize: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
          placeholder="Enter a macro event (e.g., Output constraint in Lithium mines...)"
          value={eventText}
          onChange={(e) => setEventText(e.target.value)}
        />
        <div>
          <button 
            onClick={handleAnalyze} 
            disabled={loading || !eventText.trim()}
            style={{ 
              padding: '0.75rem 1.75rem', 
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: loading ? '#94a3b8' : '#2563eb', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          >
            {loading ? 'Analyzing Macro Physics...' : 'Generate Causal Chain'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1.25rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      {/* TWO-COLUMN LAYOUT: graph left, impact panel right */}
      {result && result.graph && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', color: '#1e293b' }}>Causal Topology</h2>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            {/* Graph canvas — grows to fill remaining space */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <InteractiveGraph graphData={result.graph} />
            </div>
            {/* Market Impact Panel — fixed width on the right */}
            {result.graph.marketImpacts && result.graph.marketImpacts.length > 0 && (
              <MarketImpactPanel impacts={result.graph.marketImpacts} />
            )}
          </div>
        </div>
      )}

      {/* STRATEGIC OPPORTUNITIES SECTION */}
      {result && result.graph && result.graph.opportunities && (
        <OpportunityPanel opportunities={result.graph.opportunities} />
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Raw Diagnostic JSON</h3>
          <pre style={{ 
            backgroundColor: '#1e293b', 
            color: '#e2e8f0',
            padding: '1.5rem', 
            borderRadius: '8px', 
            overflowX: 'auto',
            fontSize: '0.85rem',
            lineHeight: '1.5'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
