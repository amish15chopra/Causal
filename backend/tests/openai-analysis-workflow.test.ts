import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIAnalysisWorkflow } from '../src/application/services/openAIAnalysisWorkflow';
import type { Logger } from '../src/infrastructure/logging/logger';

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const context = {
  correlationId: 'test-correlation-id',
  logger,
};

test('runs built-in steps in order', async () => {
  const calls: string[] = [];
  const workflow = new OpenAIAnalysisWorkflow({
    search: async () =>
      'SOURCE: Example\nURL: https://example.com\nCONTENT: This is a sufficiently long result body that exceeds fifty characters.',
    invokeAgent: async (agentName) => {
      calls.push(agentName);

      if (agentName === 'ResearchSummaryAgent') {
        return {
          content: 'Research summary [1]',
          sourceCount: 1,
          research_unavailable: false,
        };
      }

      if (agentName === 'CausalAnalysisAgent') {
        return {
          firstOrder: [
            {
              text: 'Demand rises',
              confidence: 0.8,
              reasoning: 'Direct effect.',
              sources: [],
              secondOrder: [],
            },
          ],
        };
      }

      if (agentName === 'CausalExpansionAgent') {
        return {
          effects: [
            {
              text: 'Supply tightens',
              confidence: 0.7,
              reasoning: 'Follow-on effect.',
              sources: [],
              secondOrder: [],
            },
          ],
        };
      }

      if (agentName === 'MarketImpactAgent') {
        return {
          impacts: [
            {
              sector: 'Semiconductors',
              direction: 'positive',
              confidence: 0.8,
              explanation: 'Positive sector effect.',
            },
          ],
        };
      }

      return {
        opportunities: [
          {
            type: 'investment',
            title: 'Long chip tooling',
            description: 'Opportunity exists.',
            confidence: 0.7,
            rationale: 'Causal chain.',
          },
        ],
      };
    },
  });

  const result = await workflow.analyze('AI demand surges', context);

  assert.deepEqual(calls, [
    'ResearchSummaryAgent',
    'CausalAnalysisAgent',
    'CausalExpansionAgent',
    'MarketImpactAgent',
    'OpportunityAgent',
  ]);
  assert.equal(result.graph.nodes.length, 3);
  assert.equal(result.graph.marketImpacts.length, 1);
  assert.equal(result.graph.opportunities.length, 1);
});

test('skips downstream steps when there is nothing to analyze', async () => {
  const calls: string[] = [];
  const workflow = new OpenAIAnalysisWorkflow({
    search: async () =>
      'SOURCE: Example\nURL: https://example.com\nCONTENT: This is a sufficiently long result body that exceeds fifty characters.',
    invokeAgent: async (agentName) => {
      calls.push(agentName);

      if (agentName === 'ResearchSummaryAgent') {
        return {
          content: 'Research summary [1]',
          sourceCount: 1,
          research_unavailable: false,
        };
      }

      return {
        firstOrder: [],
      };
    },
  });

  const result = await workflow.analyze('Muted event', context);

  assert.deepEqual(calls, ['ResearchSummaryAgent', 'CausalAnalysisAgent']);
  assert.equal(result.graph.nodes.length, 1);
  assert.equal(result.graph.marketImpacts.length, 0);
  assert.equal(result.graph.opportunities.length, 0);
});

test('uses fallbacks when steps fail', async () => {
  const workflow = new OpenAIAnalysisWorkflow({
    search: async () => '',
    invokeAgent: async (agentName) => {
      if (agentName === 'CausalAnalysisAgent') {
        throw new Error('causal failure');
      }

      throw new Error(`unexpected call: ${agentName}`);
    },
  });

  const result = await workflow.analyze('Fallback event', context);

  assert.match(result.errors[0], /Research Unavailable/);
  assert.match(result.errors[1], /Causal Agent Failed: causal failure/);
  assert.equal(result.graph.nodes.length, 1);
  assert.equal(result.graph.marketImpacts.length, 0);
  assert.equal(result.graph.opportunities.length, 0);
});
