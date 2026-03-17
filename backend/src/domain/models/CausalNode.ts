/**
 * Represents a single node in the causal chain.
 */
export interface CausalNode {
  /** 
   * Deterministic ID generated to ensure graph integrity.
   * Expected to be generated via generateNodeId(text, parentId) 
   */
  id: string;
  
  /** The semantic type of the node (e.g., 'macro_event', 'market_shift', 'consequence') */
  type: string;
  
  /** The distinct event description or factual claim */
  text: string;
  
  /** Calibrated confidence / probability score from the LLM (0.0 to 1.0) */
  probability: number;
  
  /** Short reasoning explaining why this node exists or follows its parent */
  reasoning: string;
}
