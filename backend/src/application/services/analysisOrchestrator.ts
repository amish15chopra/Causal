import type { CausalGraph } from '../../domain/models';
import type { AnalysisResponse } from '../contracts/analysis';
import { logger } from '../../infrastructure/logging/logger';
import { OpenAIAnalysisWorkflow } from './openAIAnalysisWorkflow';

export class AnalysisOrchestrator {
  private readonly workflow: OpenAIAnalysisWorkflow;

  public constructor(workflow: OpenAIAnalysisWorkflow = new OpenAIAnalysisWorkflow()) {
    this.workflow = workflow;
  }

  /**
   * Runs the manager-led agent workflow and returns the stable analysis response shape.
   */
  public async orchestrate(eventText: string): Promise<AnalysisResponse> {
    const correlationId = `analysis-${Date.now()}`;

    try {
      return this.workflow.analyze(eventText, {
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

    return this.workflow.expandNode(nodeId, nodeText, rootEvent, {
      correlationId,
      logger,
    });
  }
}
