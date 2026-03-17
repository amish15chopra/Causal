import { tavily, TavilyClient } from 'tavily';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface SearchCacheEntry {
  content: string;
  timestamp: number;
}

/**
 * Singleton client for web search using Tavily.
 * Includes in-memory caching and content concentration.
 */
export class WebSearch {
  private static instance: WebSearch;
  private client: TavilyClient;
  private cache: Map<string, SearchCacheEntry> = new Map();
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour

  private constructor() {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === 'your_tavily_api_key_here') {
      console.warn('⚠️ TAVILY_API_KEY not configured. Search will return empty results.');
    }
    // Correct initialization for tavily npm package (transitive-bullshit/tavily)
    this.client = new TavilyClient({ apiKey: apiKey === 'your_tavily_api_key_here' ? undefined : apiKey });
  }

  public static getInstance(): WebSearch {
    if (!WebSearch.instance) {
      WebSearch.instance = new WebSearch();
    }
    return WebSearch.instance;
  }

  /**
   * Performs a search and returns a concentrated markdown-like summary of the findings.
   * @param query - The search query
   */
  public async search(query: string): Promise<string> {
    const cached = this.cache.get(query);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      console.log(`[SearchCache] Hit for: "${query}"`);
      return cached.content;
    }

    try {
      console.log(`[Tavily] Searching for: "${query}"...`);
      // The search method in this version of the SDK takes a single argument (string or options object)
      const response = await this.client.search({
        query,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: true
      });

      // Concatenate relevant snippets into a context block
      let context = response.answer ? `DIRECT ANSWER: ${response.answer}\n\n` : '';
      if (response.results && response.results.length > 0) {
        context += response.results.map(r => `SOURCE: ${r.title}\nURL: ${r.url}\nCONTENT: ${r.content}`).join('\n\n');
      }

      this.cache.set(query, {
        content: context,
        timestamp: Date.now()
      });

      return context;
    } catch (error: any) {
      console.error(`[Tavily] Search failed for "${query}":`, error.message);
      return ''; // Graceful degradation
    }
  }
}
