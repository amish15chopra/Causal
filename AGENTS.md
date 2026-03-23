# AGENTS.md - Causal2 Development Guide

This document provides guidelines and commands for agents working on the Causal2 project.

---

## 1. Project Overview

Causal2 is a decision intelligence platform with a React frontend and Express backend.
- **Frontend**: React 19 + TypeScript + Vite + ReactFlow
- **Backend**: Express + TypeScript + OpenAI + Tavily
- **Architecture**: Multi-agent causal reasoning system

---

## 2. Build, Lint & Test Commands

### Root Commands
```bash
npm run dev           # Run both frontend and backend concurrently
npm run dev:backend   # Run backend only (port 3001)
npm run dev:frontend  # Run frontend only (port 5173)
npm run install:all   # Install all dependencies
```

### Frontend Commands (cd frontend/)
```bash
npm run dev           # Start dev server
npm run build         # TypeScript check + Vite build
npm run lint          # Run ESLint
npm run preview       # Preview production build
```

### Backend Commands (cd backend/)
```bash
npm run dev           # Start dev server with hot reload
npm run build         # Compile TypeScript
```

### Running a Single Test File
```bash
# Backend - using ts-node directly
npx ts-node backend/tests/test-search.ts
npx ts-node backend/tests/test-research-integration.ts

# Frontend - no test framework configured yet
```

---

## 3. Code Style Guidelines

### General Principles
- Use TypeScript for all new code - no plain JavaScript
- Avoid `any` types - use proper typing or `unknown` with type guards
- Keep functions small and focused (single responsibility)
- Handle errors explicitly - never swallow errors silently

### TypeScript Conventions
```typescript
// Use explicit return types for exported functions
export const AnalyzePage: React.FC = () => { ... }

// Use interfaces for object shapes
interface AnalysisResponse {
  graph: CausalGraph;
  marketImpacts?: MarketImpact[];
}

// Use type for unions/types
type LoadingState = 'idle' | 'loading' | 'success' | 'error';
```

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `AnalyzePage.tsx`, `InteractiveGraph` |
| Hooks | camelCase, prefix with `use` | `useGraphState.ts` |
| Functions/variables | camelCase | `handleAnalyze`, `graphData` |
| Classes | PascalCase | `CausalAgent`, `LLMClient` |
| Interfaces | PascalCase, prefix with `I` optional | `CausalEffect` |
| Files | kebab-case | `causal-agent.ts`, `test-search.ts` |
| CSS variables | kebab-case | `--bg-primary`, `--text-secondary` |

### Import Organization
Order imports by category with blank lines between:
```typescript
// 1. React/Framework imports
import React, { useState } from 'react';

// 2. External libraries
import axios from 'axios';
import { Search, Loader2 } from 'lucide-react';

// 3. Internal components
import { InteractiveGraph } from '../components/InteractiveGraph';
import { MarketImpactPanel } from '../components/MarketImpactPanel';

// 4. Types
import type { MarketImpact } from '../components/MarketImpactPanel';
import type { CausalGraph } from '../graph/transformToGraph';

// 5. Relative utilities
import { LLMClient } from '../infrastructure/llm/LLMClient';
```

### React Patterns
```typescript
// Use FC type for components
export const AnalyzePage: React.FC = () => { ... }

// Use early returns for conditionals
if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;

// Destructure props
const { impacts } = props;

// Use useCallback for event handlers passed to children
const handleAnalyze = useCallback(async () => { ... }, [eventText]);
```

### Error Handling
```typescript
// Frontend - Axios errors
try {
  const response = await axios.post('/api/endpoint', data);
} catch (err: unknown) {
  if (axios.isAxiosError(err)) {
    setError(err.response?.data?.error || err.message);
  } else {
    setError('An unexpected error occurred');
  }
}

// Backend - Always log and throw meaningful errors
try {
  const result = await this.llmClient.generate(prompt);
} catch (error) {
  console.error('Failed to generate response:', error);
  throw new Error('LLM generation failed. Please try again.');
}
```

### Async/Await Patterns
```typescript
// Always handle async errors with try-catch
public async analyzeEvent(event: string): Promise<CausalAgentResponse> {
  try {
    const response = await this.llmClient.generate(userPrompt, systemPrompt);
    const parsed = JSON.parse(response);
    return parsed;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw new Error('Failed to analyze event');
  }
}

// Use void for unhandled promises in event handlers
<button onClick={() => void handleAsyncAction()} />
```

### File Organization
```
frontend/src/
├── api/           # API client layer (create when needed)
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks
├── pages/         # Page-level components
├── graph/         # Graph transformation utilities
└── types/         # Shared type definitions (create when needed)

backend/src/
├── agents/        # LLM agent implementations
├── application/   # Business logic services
├── domain/        # Domain models and entities
├── infrastructure/# External integrations (LLM, search)
├── prompts/       # Prompt templates
└── utils/         # Helper functions
```

### CSS/Styling
- Use CSS variables from `index.css` for theming
- Avoid inline styles except for dynamic values
- Follow existing patterns: `var(--bg-secondary)`, `var(--text-primary)`

---

## 4. API Endpoints

### Backend (http://localhost:3001)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Main analysis endpoint |

---

## 5. Environment Variables

Create `.env` in root (copy from `.env.example`):
```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/hunter-alpha
TAVILY_API_KEY=your_key_here
PORT=3001
```

---

## 6. Known Issues & Recommendations

1. **Hardcoded URLs**: Frontend uses `http://localhost:3001` - use env vars for production
2. **No request timeouts**: Add timeout to axios calls
3. **Missing input validation**: Add length limits on user inputs
4. **No error boundaries**: Consider adding React error boundaries

---

## 7. Testing

- Backend tests are in `backend/tests/`
- Run individual test files with `npx ts-node <path>`
- Frontend has no test framework configured yet

---

## 8. Git Conventions

- Create feature branches from `main`
- Commit messages: clear, concise descriptions
- Run `npm run lint` before committing frontend changes
- Don't commit `.env` files (already in `.gitignore`)
