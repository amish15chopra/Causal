import * as dotenv from 'dotenv';
import path from 'path';
import { logger } from '../logging/logger';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface SearchCacheEntry {
  content: string;
  timestamp: number;
}

interface TavilySearchResult {
  url: string;
  title: string;
  content: string;
}

interface TavilySearchResponse {
  answer?: string;
  results?: TavilySearchResult[];
}

class SearchTimeoutError extends Error {
  public constructor(timeoutMs: number) {
    super(`Web search timed out after ${timeoutMs}ms`);
    this.name = 'SearchTimeoutError';
  }
}

/**
 * Singleton client for web search using Tavily.
 * Includes in-memory caching and content concentration.
 */
export class WebSearch {
  private static instance: WebSearch;
  private cache: Map<string, SearchCacheEntry> = new Map();
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour
  private readonly SEARCH_TIMEOUT_MS = 12000;
  private readonly apiKey: string;

  private constructor() {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === 'your_tavily_api_key_here') {
      logger.warn('TAVILY_API_KEY not configured. Search will return empty results.');
    }
    this.apiKey = apiKey === 'your_tavily_api_key_here' ? '' : (apiKey || '');
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
      logger.debug('Search cache hit', { query });
      return cached.content;
    }

    if (!this.apiKey) {
      logger.warn('TAVILY_API_KEY missing. Search will return empty results.', { query });
      return '';
    }

    try {
      logger.info('Running web search', { query });
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const requestPromise = (async () => {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: this.apiKey,
            query,
            search_depth: 'advanced',
            max_results: 5,
            include_answer: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Tavily search failed with HTTP ${response.status}`);
        }

        return (await response.json()) as TavilySearchResponse;
      })();
      const timeoutPromise = new Promise<TavilySearchResponse>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new SearchTimeoutError(this.SEARCH_TIMEOUT_MS));
        }, this.SEARCH_TIMEOUT_MS);
      });

      {
        try {
          const response = await Promise.race<TavilySearchResponse>([requestPromise, timeoutPromise]);

          // Concatenate relevant snippets into a context block
          let context = response.answer ? `DIRECT ANSWER: ${response.answer}\n\n` : '';
          if (response.results && response.results.length > 0) {
            context += response.results
              .map((r) => `SOURCE: ${r.title}\nURL: ${r.url}\nCONTENT: ${r.content}`)
              .join('\n\n');
          }

          this.cache.set(query, {
            content: context,
            timestamp: Date.now(),
          });

          return context;
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        error instanceof SearchTimeoutError ||
        message.toLowerCase().includes('abort') ||
        message.toLowerCase().includes('timed out')
      ) {
        logger.warn('Web search timed out, returning fallback', { query, timeoutMs: this.SEARCH_TIMEOUT_MS });
        return '';
      }
      logger.error('Web search failed', { query, error: message });
      return ''; // Graceful degradation
    }
  }
}
