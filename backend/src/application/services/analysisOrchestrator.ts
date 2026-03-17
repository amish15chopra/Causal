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
  private buildCoreGraph(rootEvent: string, causalPayload: any): { nodes: CausalNode[], edges: CausalEdge[] } {
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

    // 2. Iterate layer by layer
    const firstOrder = Array.isArray(causalPayload.firstOrder) ? causalPayload.firstOrder : [];
    const secondOrder = Array.isArray(causalPayload.secondOrder) ? causalPayload.secondOrder : [];

    // Map 1st Order Nodes (Children of Root)
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

      // Because the LLM second order structure isn't directly parented yet,
      // For now we link all second order to all first order linearly.
      // Evolving prompt designs would map second-order direct inheritance, but this builds the visual graph.
      secondOrder.forEach((so: any) => {
         const soId = generateNodeId(so.text, foId);
         // Check if node already exists via other paths
         if (!nodes.find(n => n.id === soId)) {
            nodes.push({
              id: soId,
              type: 'second_order_effect',
              text: so.text,
              probability: Number(so.confidence) || 0.5,
              reasoning: so.reasoning || "",
              sources: so.sources
            });
         }
         edges.push({ source: foId, target: soId });
      });
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

    // Stage 1: Core Causality Generation
    let rawCausality;
    try {
      rawCausality = await this.causalAgent.analyzeEvent(eventText, researchContext);
      const built = this.buildCoreGraph(eventText, rawCausality);
      graph.nodes = built.nodes;
      graph.edges = built.edges;
    } catch (e: any) {
      errors.push(`Causal Agent Failed: ${e.message}`);
      // Hard fail if we can't get foundational causality
      return { event: eventText, graph, errors };
    }

    // Stage 2: Market Analysis (routed through MarketImpactService for validation + fallback)
    if (rawCausality) {
      const { impacts, fallbackUsed, error } = await this.marketImpactService.getMarketImpacts(rawCausality, researchContext);
      graph.marketImpacts = impacts;
      if (fallbackUsed && error) {
        errors.push(`Market Impact Agent used fallback: ${error}`);
      }
    }

    // Stage 3: Opportunity Surfacing (routed through OpportunityService for validation + fallback)
    if (graph.marketImpacts && graph.marketImpacts.length > 0) {
      const { opportunities, fallbackUsed, error } = await this.opportunityService.getOpportunities(graph.marketImpacts, researchContext);
      graph.opportunities = opportunities;
      if (fallbackUsed && error) {
        errors.push(`Opportunity Agent used fallback: ${error}`);
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
  public async expandCausalNode(nodeId: string, nodeText: string): Promise<{ nodes: CausalNode[], edges: CausalEdge[] }> {
    const newEffects = await this.causalAgent.expandNode(nodeText);
    
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
