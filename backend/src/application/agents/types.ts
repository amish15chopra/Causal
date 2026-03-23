import type { Logger } from '../../infrastructure/logging/logger';

export interface AgentRunContext {
  correlationId: string;
  logger: Logger;
}

export interface IntelligenceAgent<TInput, TOutput> {
  readonly id: string;
  execute(input: TInput, context: AgentRunContext): Promise<TOutput>;
}
