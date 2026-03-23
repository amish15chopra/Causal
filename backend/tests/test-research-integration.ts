import { AnalysisOrchestrator } from '../src/application/services/analysisOrchestrator';
import { WebSearch } from '../src/infrastructure/search/webSearch';

async function testResearchFlow() {
  const orchestrator = new AnalysisOrchestrator();
  const event = "Nvidia Q1 2026 Earnings Forecast and AI GPU Demand";

  console.log('--- TEST 1: SUCCESSFUL RESEARCH FLOW ---');
  const result = await orchestrator.orchestrate(event);
  
  console.log('Event:', result.event);
  console.log('Errors:', result.errors);
  console.log('Nodes Count:', result.graph.nodes.length);
  console.log('Market Impacts Count:', result.graph.marketImpacts.length);
  console.log('Opportunities Count:', result.graph.opportunities.length);
  
  // Check if research context actually grounded the nodes
  const nodeWithSources = result.graph.nodes.find(n => n.sources && n.sources.length > 0);
  console.log('Nodes have citations:', !!nodeWithSources);
  if (nodeWithSources) {
    console.log('Example citation:', JSON.stringify(nodeWithSources.sources?.[0], null, 2));
  }

  console.log('\n--- TEST 2: FALLBACK FLOW (Simulated Failure) ---');
  // We can simulate a failure by temporarily breaking the search method on the singleton
  const searchInstance = WebSearch.getInstance();
  const originalSearch = searchInstance.search;
  
  searchInstance.search = async () => { throw new Error("Simulated Tavily Timeout"); };
  
  const fallbackResult = await orchestrator.orchestrate("Hypothetical Cosmic Event 2099");
  console.log('Errors (should contain research unavailable):', fallbackResult.errors);
  console.log('Nodes Count (should still be > 0):', fallbackResult.graph.nodes.length);
  
  // Restore
  searchInstance.search = originalSearch;

  console.log('\n--- TEST END ---');
}

testResearchFlow().catch(console.error);
