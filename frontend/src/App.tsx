import { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { AnalyzePage } from './pages/AnalyzePage';

function App() {
  const [resetKey, setResetKey] = useState(0);

  const handleNewAnalysis = useCallback(() => {
    setResetKey(k => k + 1);
  }, []);

  return (
    <Layout onNewAnalysis={handleNewAnalysis}>
      <AnalyzePage key={resetKey} />
    </Layout>
  );
}

export default App;
