import { CausalNode } from './CausalNode';
import { MarketImpact } from './MarketImpact';
import { Opportunity } from './Opportunity';

/**
 * An explicit directional edge defining a parent-child relationship between causal nodes.
 */
export interface CausalEdge {
  /** The id of the origin / parent node */
  source: string;
  
  /** The id of the receiving / child node */
  target: string;
}

/**
 * The complete structure encapsulating the macro event breakdown.
 */
export interface CausalGraph {
  /** Map or List of all verified causal nodes */
  nodes: CausalNode[];
  
  /** Directional relationships chaining nodes together */
  edges: CausalEdge[];
  
  /** Aggregate market impacts surfacing from the node relationships */
  marketImpacts: MarketImpact[];
  
  /** Derived actionable steps based on market vectors */
  opportunities: Opportunity[];
}
