import type { AgentRuntime } from '../runtime/agentRuntime';
import { OpenAIAgentRuntime } from '../runtime/openAIAgentRuntime';
import type { CausalGraph } from '../../domain/models';
import type { AnalysisResponse } from '../pipeline/types';
import { logger } from '../../infrastructure/logging/logger';

export class AnalysisOrchestrator {
  private readonly runtime: AgentRuntime;

  public constructor(runtime: AgentRuntime = new OpenAIAgentRuntime()) {
    this.runtime = runtime;
  }

  /**
   * Runs the manager-led agent workflow and returns the stable analysis response shape.
   */
  public async orchestrate(eventText: string): Promise<AnalysisResponse> {
    const correlationId = `analysis-${Date.now()}`;

    try {
      return this.runtime.runAnalysisWorkflow(eventText, {
        correlationId,
        logger,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Analysis pipeline aborted', {
        correlationId,
        error: message,
      });

      return {
        event: eventText,
        graph: {
          nodes: [],
          edges: [],
          marketImpacts: [],
          opportunities: [],
        },
        errors: [`Causal Agent (Stage 1) Failed: ${message}`],
      };
    }
  }

  /**
   * Generates derivative consequences strictly from a specific selected node,
   * returning them formatted as deterministic nodes and appending edges.
   */
  public async expandCausalNode(nodeId: string, nodeText: string, rootEvent: string = ''): Promise<{ nodes: CausalGraph['nodes']; edges: CausalGraph['edges'] }> {
    const correlationId = `expand-${Date.now()}`;

    return this.runtime.runExpansionWorkflow(nodeId, nodeText, rootEvent, {
      correlationId,
      logger,
    });
  }
}
