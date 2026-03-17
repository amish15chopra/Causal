import { CausalAgent } from '../../agents/causalAgent';
import { MarketImpactAgent } from '../../agents/marketImpactAgent';
import { OpportunityAgent } from '../../agents/opportunityAgent';
import { ResearchAgent } from '../../agents/researchAgent';
import { MarketImpactService } from './marketImpactService';
import { OpportunityService } from './opportunityService';
import { CausalGraph, CausalNode, CausalEdge } from '../../domain/models';
import { generateNodeId } from '../../utils/hash';

export interface AnalysisResponse {
  event: string;
  graph: CausalGraph;
  errors: string[];
}

export class AnalysisOrchestrator {
  private causalAgent: CausalAgent;
  private marketAgent: MarketImpactAgent;
  private marketImpactService: MarketImpactService;
  private opportunityAgent: OpportunityAgent;
  private opportunityService: OpportunityService;
  private researchAgent: ResearchAgent;

  constructor() {
    this.causalAgent = new CausalAgent();
    this.marketAgent = new MarketImpactAgent();
    this.marketImpactService = new MarketImpactService();
    this.opportunityAgent = new OpportunityAgent();
    this.opportunityService = new OpportunityService();
    this.researchAgent = new ResearchAgent();
  }

  /**
   * Translates the raw tree generation from an LLM into mathematically exact graph nodes/edges
   */
  private buildCoreGraph(rootEvent: string, firstOrderPayload: any): { nodes: CausalNode[], edges: CausalEdge[] } {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // 1. Establish the Root Node representing the macro event
    const rootId = generateNodeId(rootEvent);
    nodes.push({
      id: rootId,
      type: 'macro_event',
      text: rootEvent,
      probability: 1.0, 
      reasoning: 'Triggering Event'
    });

    // 2. Build initial first-order nodes
    const firstOrder = Array.isArray(firstOrderPayload.firstOrder) ? firstOrderPayload.firstOrder : [];

    firstOrder.forEach((fo: any) => {
      const foId = generateNodeId(fo.text, rootId);
      nodes.push({
        id: foId,
        type: 'first_order_effect',
        text: fo.text,
        probability: Number(fo.confidence) || 0.5,
        reasoning: fo.reasoning || "",
        sources: fo.sources
      });
      edges.push({ source: rootId, target: foId });
    });

    return { nodes, edges };
  }

  /**
   * The single pipeline invoking and chaining all agent calls synchronously.
   * If any downstream agent fails, gracefully falls back to earlier partial output strings.
   */
  public async orchestrate(eventText: string): Promise<AnalysisResponse> {
    const errors: string[] = [];
    
    // Base State Initialization
    let graph: CausalGraph = {
      nodes: [],
      edges: [],
      marketImpacts: [],
      opportunities: []
    };

    // Stage 0: Research (Grounding Context)
    let researchContext = '';
    try {
      const research = await this.researchAgent.conductResearch(eventText);
      researchContext = research.content;
      if (research.research_unavailable) {
        errors.push("Research Unavailable (Proceeding with LLM internal knowledge)");
      }
    } catch (e: any) {
      errors.push(`Research System Malfunction: ${e.message}`);
    }

    // Stage 1: Core Causality Generation (Step 1: First-Order Consequences)
    let firstOrderData;
    try {
      firstOrderData = await this.causalAgent.analyzeEvent(eventText, researchContext);
      const built = this.buildCoreGraph(eventText, firstOrderData);
      graph.nodes = built.nodes;
      graph.edges = built.edges;
    } catch (e: any) {
      errors.push(`Causal Agent (Stage 1) Failed: ${e.message}`);
      return { event: eventText, graph, errors };
    }

    // Stage 1b: Sequential Expansion (Step 2: Second-Order Effects for each child)
    // We isolate the generation for each branch to prevent concept-leak and duplication
    const firstOrderNodes = graph.nodes.filter(n => n.type === 'first_order_effect');
    
    try {
      const expansionResults = await Promise.all(
        firstOrderNodes.map(node => this.expandCausalNode(node.id, node.text, eventText))
      );

      // Consolidate expansion nodes/edges into the main graph
      expansionResults.forEach(result => {
        result.nodes.forEach(n => {
          if (!graph.nodes.find(existing => existing.id === n.id)) {
            graph.nodes.push(n);
          }
        });
        graph.edges.push(...result.edges);
      });
    } catch (e: any) {
      errors.push(`Causal Expansion Failed (Partial graph preserved): ${e.message}`);
    }

    // Stage 2: Market Analysis
    // We pass the entire resolved chain (flattened nodes/edges) to sub-agents for full context
    const fullChainSummary = {
      event: eventText,
      consequences: graph.nodes.filter(n => n.type !== 'macro_event').map(n => ({
        text: n.text,
        type: n.type,
        reasoning: n.reasoning
      }))
    };

    try {
      const { impacts, fallbackUsed, error } = await this.marketImpactService.getMarketImpacts(fullChainSummary as any, researchContext);
      graph.marketImpacts = impacts;
      if (fallbackUsed && error) {
        errors.push(`Market Impact Agent used fallback: ${error}`);
      }
    } catch (e: any) {
      errors.push(`Market Analysis stage error: ${e.message}`);
    }

    // Stage 3: Opportunity Surfacing
    if (graph.marketImpacts && graph.marketImpacts.length > 0) {
      try {
        const { opportunities, fallbackUsed, error } = await this.opportunityService.getOpportunities(graph.marketImpacts, researchContext);
        graph.opportunities = opportunities;
        if (fallbackUsed && error) {
          errors.push(`Opportunity Agent used fallback: ${error}`);
        }
      } catch (e: any) {
        errors.push(`Opportunity Surfacing stage error: ${e.message}`);
      }
    } else {
      errors.push('Opportunity Agent Skipped: Dependent Market Impacts missing.');
    }

    return {
      event: eventText,
      graph,
      errors
    };
  }

  /**
   * Generates derivative consequences strictly from a specific selected node,
   * returning them formatted as deterministic nodes and appending edges.
   */
  public async expandCausalNode(nodeId: string, nodeText: string, rootEvent: string = ''): Promise<{ nodes: CausalNode[], edges: CausalEdge[] }> {
    const newEffects = await this.causalAgent.expandNode(nodeText, rootEvent);
    
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    newEffects.forEach((effect) => {
      const effectId = generateNodeId(effect.text, nodeId);
      nodes.push({
        id: effectId,
        type: 'second_order_effect', // Visually grouping expanded nodes into child-tiers
        text: effect.text,
        probability: effect.confidence || 0.5,
        reasoning: effect.reasoning || "",
        sources: effect.sources
      });
      edges.push({ source: nodeId, target: effectId });
    });

    return { nodes, edges };
  }
}
