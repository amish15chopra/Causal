/**
 * Details the direct impact of a causal chain on a specific market sector.
 */
export interface MarketImpact {
  /** The specific sector or industry affected (e.g., 'Real Estate', 'Logistics') */
  sector: string;
  
  /** Directionality of the impact */
  direction: 'positive' | 'negative' | 'neutral';
  
  /** Evaluated confidence level for this specific sector impact (0.0 to 1.0) */
  confidence: number;
  
  /** 1-2 sentence explanation connecting the macro cause to this specific sector effect */
  explanation: string;
}
