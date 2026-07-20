# Horizon — a causal exploration tool for macro events

> **Project status: archived.** This was a side project and is no longer actively maintained. I am keeping it here as an exploration of how LLMs, lightweight web research, and a visual graph interface might help people reason through the downstream effects of a changing world.

Horizon starts with a question such as *“Oil prices spike after a supply disruption”* and turns it into a navigable map of possible consequences. Rather than presenting a single prediction, it lays out a chain of cause and effect, highlights the sectors that may be affected, and suggests areas worth investigating further.

The goal was to make second-order thinking easier: when an event happens, what changes immediately, what might change next, and where could that create risk or opportunity?

## Why I built it

News about policy, geopolitics, supply chains, and markets is often easier to consume than to reason about. The difficult part is connecting an event to its knock-on effects without collapsing a complex situation into a confident-sounding headline.

I built Horizon as an experiment in an interface for that process. It combines an LLM's ability to propose causal hypotheses with external search context and makes the assumptions visible as a graph. The intended value is not certainty; it is a clearer starting point for discussion, research, and scenario planning.

## What it does

Given a user-entered event, Horizon:

1. Searches the web for relevant, current context when a Tavily API key is available.
2. Summarizes that context into a compact research briefing.
3. Generates three to five first-order effects directly caused by the event.
4. Expands each branch with two to three second-order consequences.
5. Synthesizes the resulting chain into likely sector-level market impacts.
6. Surfaces a small set of research leads framed as startup or investment opportunities.

The React interface renders the causal chain as an interactive graph. Nodes show the proposed effect, reasoning, confidence, and, where available, sources. Clicking a node asks the backend to extend that specific branch with further consequences.

```text
Event entered by user
        |
        v
Web search + research briefing (optional)
        |
        v
First-order effects -> second-order effects
        |
        +--> interactive causal graph
        |
        +--> sector impacts -> opportunity hypotheses
```

## Example questions

- What could follow if a major shipping route is disrupted?
- How might a large interest-rate increase affect housing, banks, and consumer spending?
- Which sectors could be exposed by a semiconductor supply shock?
- What second-order effects might follow a new energy-policy announcement?

These are prompts for structured exploration, not prompts that produce a trade recommendation or forecast.

## How it works

The backend is a TypeScript/Express service organized around a small analysis pipeline:

- A **research agent** retrieves up to five web results using Tavily and uses the LLM to condense them into context for the rest of the pipeline. If search is unavailable, the application continues in an explicitly flagged fallback mode.
- A **causal agent** returns structured JSON containing first-order effects, confidence estimates, explanations, and sources. Each first-order node is then expanded independently so branches remain focused on their parent effect.
- **Market-impact** and **opportunity** stages consume the complete causal chain and return structured sector assessments and opportunity hypotheses.
- An **orchestrator** converts model output into deterministic graph nodes and directional edges before returning it to the frontend.

The application uses the official OpenAI JavaScript SDK pointed at OpenRouter, so the model can be configured through an environment variable. The UI is built with React, Vite, and React Flow.

## Tech stack

- Frontend: React, TypeScript, Vite, React Flow
- Backend: Node.js, TypeScript, Express
- LLM access: OpenAI SDK with an OpenRouter base URL
- Search: Tavily

## Run locally

### Prerequisites

- Node.js 18+ and npm
- An OpenRouter API key
- A Tavily API key for web-grounded research (optional, but recommended)

Create a `.env` file at the repository root:

```bash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct
TAVILY_API_KEY=your_tavily_key
PORT=3001
```

`OPENROUTER_MODEL` and `PORT` are optional. Without `TAVILY_API_KEY`, the app still runs, but the analysis is based on the configured model's internal knowledge and is marked as having unavailable research.

Install everything and start the frontend and backend together:

```bash
npm run install:all
npm run dev
```

Then open the Vite URL printed in the terminal. The API runs at `http://localhost:3001` by default.

To run the services separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Checks whether the backend is running. |
| `POST /analyze` | Runs the complete research, causal, market-impact, and opportunity pipeline for an event. |
| `POST /expand` | Generates additional direct consequences for one graph node. |

Example:

```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"event":"Oil prices spike after supply disruption"}'
```

## Important limitations

Horizon is a learning project, not a reliable forecasting or decision-making system.

- LLM-generated causal links can be incomplete, wrong, repetitive, or overly persuasive.
- Confidence values are model estimates, not statistical probabilities or calibrated forecasts.
- Search grounding depends on the quality, relevance, and freshness of the retrieved snippets; fallback mode has no external grounding.
- The market and opportunity sections are hypotheses for further research, **not financial, investment, or business advice**.

If I were continuing the project, I would focus on source-level citation verification, explicit competing scenarios, better confidence calibration, and evaluation against known historical events.

## Repository layout

```text
frontend/   React interface and interactive graph
backend/    Express API, agents, prompts, domain models, and integrations
package.json  Convenience scripts for running both applications
```
