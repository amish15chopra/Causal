/**
 * Concrete actionable insights derived from the market impacts.
 */
export interface Opportunity {
  /** The nature of the opportunity */
  type: 'investment' | 'startup';
  
  /** Short punchy title for the specific opportunity */
  title: string;
  
  /** The detailed structural reason this gap or edge exists */
  description: string;
  
  /** Evaluated success confidence probability for this opportunity (0.0 to 1.0) */
  confidence: number;
  
  /** The precise logical step-by-step rationale for why this makes sense now */
  rationale: string;
}
