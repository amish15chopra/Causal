import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface HealthResponse {
  status: string;
  timestamp: string;
}

export const HomePage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get<HealthResponse>('http://localhost:3001/health');
        setHealth(response.data);
      } catch {
        setError('❌ Backend disconnected');
      }
    };

    checkBackend();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Decision Intelligence Platform</h1>
      <div style={{ marginTop: '2rem' }}>
        {error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : health ? (
          <p style={{ color: 'green' }}>
            ✅ Backend connected (Status: {health.status}, Time: {new Date(health.timestamp).toLocaleString()})
          </p>
        ) : (
          <p>Connecting to backend...</p>
        )}
      </div>
    </div>
  );
};
