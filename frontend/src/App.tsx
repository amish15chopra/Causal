import React from 'react';
import { HomePage } from './pages/HomePage';
import { AnalyzePage } from './pages/AnalyzePage';

function App() {
  return (
    <div>
      <HomePage />
      <hr style={{ margin: '2rem 0' }} />
      <AnalyzePage />
    </div>
  );
}

export default App;
