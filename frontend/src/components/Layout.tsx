import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Compass, Settings, ShieldAlert, Activity, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import axios from 'axios';

interface LayoutProps {
  children: React.ReactNode;
  onNewAnalysis?: () => void;
}

interface HealthResponse {
  status: string;
  timestamp: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onNewAnalysis }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get<HealthResponse>('http://localhost:3001/health');
        setHealth(response.data);
        setError(false);
      } catch {
        setError(true);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const sidebarWidth = isExpanded ? '240px' : '72px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{ 
        width: sidebarWidth, 
        borderRight: '1px solid var(--border-light)', 
        display: 'flex', 
        flexDirection: 'column',
        padding: isExpanded ? '1.5rem 1rem' : '1.5rem 0.5rem',
        alignItems: isExpanded ? 'stretch' : 'center',
        backgroundColor: 'var(--bg-primary)', // Match main background
        position: 'fixed',
        height: '100vh',
        zIndex: 10,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            position: 'absolute',
            right: '-12px',
            top: '2rem',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            zIndex: 20
          }}
        >
          {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: '0.75rem', marginBottom: '2.5rem', padding: '0 0.5rem', width: '100%' }}>
          <Activity size={24} color="var(--text-primary)" style={{ flexShrink: 0 }} />
          {isExpanded && <span style={{ fontWeight: 600, fontSize: '1.25rem', color: 'var(--text-primary)', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden' }}>horizon</span>}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, width: '100%' }}>
          {/* New Analysis — like Perplexity "New Thread" */}
          <div
            onClick={onNewAnalysis}
            title={!isExpanded ? 'New Analysis' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              gap: '0.75rem',
              padding: isExpanded ? '0.6rem 0.5rem' : '0.6rem 0',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              marginBottom: '0.5rem',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <div style={{ flexShrink: 0 }}><Plus size={20} /></div>
            {isExpanded && <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>New Analysis</span>}
          </div>

          <NavItem icon={<Compass size={20} />} label="Intelligence Terminal" active isExpanded={isExpanded} />
          <NavItem icon={<LayoutDashboard size={20} />} label="Scenario History" isExpanded={isExpanded} />
          <NavItem icon={<ShieldAlert size={20} />} label="Risk Analysis" isExpanded={isExpanded} />
          <NavItem icon={<Settings size={20} />} label="Settings" isExpanded={isExpanded} />
        </nav>

        <div style={{ 
          marginTop: 'auto', 
          padding: '0.75rem', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: isExpanded ? 'stretch' : 'center',
          gap: '0.5rem',
          width: '100%',
          overflow: 'hidden'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: isExpanded ? 'flex-start' : 'center', 
            gap: '0.75rem',
            padding: '0.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <div style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: error ? 'var(--danger)' : health ? 'var(--success)' : 'var(--warning)',
              }}></div>
            </div>
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                 <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                   System Status
                 </span>
                 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                   {error ? 'Disconnected' : health ? 'Operational' : 'Connecting...'}
                 </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ 
        marginLeft: sidebarWidth, 
        flex: 1, 
        padding: '3rem 4rem', 
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {children}
      </main>
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; isExpanded: boolean }> = ({ icon, label, active, isExpanded }) => (
  <div 
    title={!isExpanded ? label : undefined}
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: isExpanded ? 'flex-start' : 'center',
      gap: '0.75rem', 
      padding: isExpanded ? '0.6rem 0.5rem' : '0.6rem 0', 
      borderRadius: '8px', 
      cursor: 'pointer',
      backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      transition: 'all 0.2s ease',
      fontWeight: active ? 600 : 500
    }}
    onMouseOver={(e) => {
      if (!active) {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }
    }}
    onMouseOut={(e) => {
      if (!active) {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }
    }}
  >
    <div style={{ flexShrink: 0, color: active ? 'var(--text-primary)' : 'inherit' }}>{icon}</div>
    {isExpanded && <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
  </div>
);
