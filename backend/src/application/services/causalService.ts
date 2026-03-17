import { CausalAgent, CausalAgentResponse } from '../../agents/causalAgent';

export class CausalService {
  private causalAgent: CausalAgent;

  constructor() {
    this.causalAgent = new CausalAgent();
  }

  /**
   * Pipeline step 1: Generate causal logic from a raw string event
   */
  public async analyzeMacroEvent(event: string): Promise<CausalAgentResponse> {
    if (!event || event.trim().length === 0) {
      throw new Error("Missing or invalid 'event' parameter.");
    }

    // Pass the execution to the core Reasoning Agent
    const reasoningPayload = await this.causalAgent.analyzeEvent(event);
    
    // In later iterations, domain/models processing, hashing, and graph building occur here
    return reasoningPayload;
  }
}
