import type { CausalGraph } from '../../domain/models';

export interface SourceReference {
  title: string;
  url: string;
}

export interface CausalEffect {
  text: string;
  confidence: number;
  reasoning: string;
  sources?: SourceReference[];
  secondOrder?: CausalEffect[];
}

export interface CausalAnalysisResult {
  firstOrder: CausalEffect[];
}

export interface ResearchBriefing {
  content: string;
  sourceCount: number;
  research_unavailable: boolean;
}

export interface AnalysisResponse {
  event: string;
  graph: CausalGraph;
  errors: string[];
}
