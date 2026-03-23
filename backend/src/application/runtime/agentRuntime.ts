import type { AnalysisResponse, PipelineContext } from '../pipeline/types';
import type { CausalEdge, CausalNode } from '../../domain/models';

export interface AgentRuntime {
  runAnalysisWorkflow(eventText: string, context: PipelineContext): Promise<AnalysisResponse>;
  runExpansionWorkflow(
    nodeId: string,
    nodeText: string,
    rootEvent: string,
    context: PipelineContext,
  ): Promise<{ nodes: CausalNode[]; edges: CausalEdge[] }>;
}
