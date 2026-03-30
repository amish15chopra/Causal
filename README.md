# Decision Intelligence Platform

Decision Intelligence Platform is a full-stack app for turning a real-world event into a causal graph, market impact analysis, and opportunity surfacing.

It consists of:

- A Vite + React frontend for entering an event and exploring the resulting graph
- A TypeScript + Express backend that orchestrates research, causal analysis, market impact, and opportunity generation

## Features

- Analyze an event and generate a causal dependency graph
- Expand individual causal nodes into deeper second-order effects
- Surface market impacts and follow-on opportunities
- Inspect the raw analysis payload for debugging

## Project Structure

- `frontend/` - React + Vite UI
- `backend/` - Express API and analysis orchestration
- `package.json` - Root convenience scripts for running both apps together

## Prerequisites

- Node.js 18+ recommended
- npm
- API keys for the backend integrations

## Environment Variables

Create a `.env` file at the repository root with the values required by the backend:

```bash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct
TAVILY_API_KEY=your_tavily_key
PORT=3001
```

`OPENROUTER_MODEL` and `PORT` are optional. If omitted, the backend falls back to its defaults.

## Installation

Install dependencies for the root, backend, and frontend:

```bash
npm run install:all
```

You can also install each workspace separately if you prefer:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

## Development

Run both the frontend and backend together:

```bash
npm run dev
```

Or run them individually:

```bash
npm run dev:backend
npm run dev:frontend
```

By default:

- Backend: `http://localhost:3001`
- Frontend: Vite dev server on the standard Vite port

## Backend API

- `GET /health` - Health check
- `POST /analyze` - Run the full analysis pipeline for an event
- `POST /expand` - Expand a specific causal node

Example request:

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"event":"Oil prices spike after supply disruption"}'
```

## Notes

- The frontend talks to the backend at `http://localhost:3001`
- The backend reads `.env` from the repository root
- If `TAVILY_API_KEY` is missing, web search falls back gracefully

## Frontend README

There is also a frontend-specific README at [`frontend/README.md`](./frontend/README.md), but it is just the default Vite template and can be replaced later if needed.
