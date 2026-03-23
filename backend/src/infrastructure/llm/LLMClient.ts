import crypto from 'crypto';
import type { LLMGateway } from '../../application/ports/llmGateway';
import { logger } from '../logging/logger';
import { openRouterClient, DEFAULT_MODEL } from './openRouterClient';

interface CacheEntry {
  response: string;
  expiresAt: number;
}

/**
 * Singleton Client responsible for interacting with OpenRouter/LLMs.
 * Features:
 * - Cost transparency (Token logging)
 * - Auto-retries (up to 2)
 * - Simple 30-min In-Memory cache
 * - Simple In-Memory rate limiter (10 req / min)
 */
export class LLMClient implements LLMGateway {
  private static instance: LLMClient;

  // Rate Limiting
  private readonly MAX_REQ_PER_MIN = 10;
  private readonly requestTimestamps: number[] = [];

  // 30 min TTL cache: hash(prompt + systemPrompt) => CacheEntry
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;
  private readonly REQUEST_TIMEOUT_MS = 60 * 1000;

  private constructor() {}

  public static getInstance(): LLMClient {
    if (!LLMClient.instance) {
      LLMClient.instance = new LLMClient();
    }
    return LLMClient.instance;
  }

  /**
   * Cleans up expired requests from the rate-limit window
   */
  private cleanRateLimits() {
    const oneMinAgo = Date.now() - 60 * 1000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < oneMinAgo) {
      this.requestTimestamps.shift();
    }
  }

  /**
   * Hashes prompt combination into a simple stable ID
   */
  private hashPrompt(prompt: string, systemPrompt: string = ''): string {
    return crypto
      .createHash('sha256')
      .update(systemPrompt + '|' + prompt)
      .digest('base64');
  }

  /**
   * Clears out naturally expired cache entries
   */
  private evictStaleCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Primary method for generating responses from the LLM.
   */
  public async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const defaultSystem = systemPrompt || 'You are a helpful, senior decision-intelligence AI.';

    // 1. Check Cache
    this.evictStaleCache();
    const cacheKey = this.hashPrompt(prompt, defaultSystem);
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      logger.debug('Serving LLM response from cache');
      return cachedEntry.response;
    }

    // 2. Check Rate Limit
    this.cleanRateLimits();
    if (this.requestTimestamps.length >= this.MAX_REQ_PER_MIN) {
      logger.warn('LLM rate limit exceeded', { maxPerMinute: this.MAX_REQ_PER_MIN });
      return 'Rate limit exceeded: The system allows a maximum of 10 insights per minute. Please try again soon.';
    }

    // 3. Initiate Request with Retries
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        logger.info('Invoking LLM provider', { attempt: attempt + 1, model: DEFAULT_MODEL });
        
        // Registering timestamp for rate limit tracking
        this.requestTimestamps.push(Date.now());
        const timeoutError = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`LLM request timed out after ${this.REQUEST_TIMEOUT_MS / 1000}s`));
          }, this.REQUEST_TIMEOUT_MS);
        });

        const completionRequest = openRouterClient.chat.completions.create({
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: defaultSystem },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2, // Low temperature for deterministic/factual reporting
        });

        const response = await Promise.race([completionRequest, timeoutError]);

        const output = response.choices[0]?.message?.content || '';

        // Safely extract token analytics for cost tracking
        const usage = response.usage;
        if (usage) {
          const approxCostPer1k = 0.0001; // Approximate standard blended rate depending on chosen model
          const totalCost = ((usage.total_tokens || 0) / 1000) * approxCostPer1k;
          
          logger.debug('LLM token analytics', {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            estimatedCostUsd: Number(totalCost.toFixed(6)),
          });
        }

        // Cache the result
        this.cache.set(cacheKey, {
          response: output,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });

        return output;

      } catch (error: any) {
        attempt++;
        logger.error('LLM call failed', {
          attempt,
          error: error.message,
        });
        if (attempt > MAX_RETRIES) {
          throw new Error(`LLM Error: Exhausted all ${MAX_RETRIES} retries. Reason: ${error.message}`);
        }
        // Very rudimentary exponential backoff before the next internal retry
        await new Promise(res => setTimeout(res, 1000 * attempt));
      }
    }

    throw new Error('LLM Error: Unexpected execution escape');
  }
}
