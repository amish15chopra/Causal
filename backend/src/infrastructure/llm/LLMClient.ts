import crypto from 'crypto';
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
export class LLMClient {
  private static instance: LLMClient;

  // Rate Limiting
  private readonly MAX_REQ_PER_MIN = 10;
  private readonly requestTimestamps: number[] = [];

  // 30 min TTL cache: hash(prompt + systemPrompt) => CacheEntry
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;

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
      console.log('⚡ [LLMClient] Serving from immediate memory cache.');
      return cachedEntry.response;
    }

    // 2. Check Rate Limit
    this.cleanRateLimits();
    if (this.requestTimestamps.length >= this.MAX_REQ_PER_MIN) {
      console.warn('⚠️ [LLMClient] Rate limit exceeded (Max 10 / min).');
      return 'Rate limit exceeded: The system allows a maximum of 10 insights per minute. Please try again soon.';
    }

    // 3. Initiate Request with Retries
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        console.log(`🧠 [LLMClient] Invoking OpenRouter (Attempt ${attempt + 1})...`);
        
        // Registering timestamp for rate limit tracking
        this.requestTimestamps.push(Date.now());
        
        const response = await openRouterClient.chat.completions.create({
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: defaultSystem },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2, // Low temperature for deterministic/factual reporting
        });

        const output = response.choices[0]?.message?.content || '';

        // Safely extract token analytics for cost tracking
        const usage = response.usage;
        if (usage) {
          const approxCostPer1k = 0.0001; // Approximate standard blended rate depending on chosen model
          const totalCost = ((usage.total_tokens || 0) / 1000) * approxCostPer1k;
          
          console.log(`📊 [LLMClient Token Analytics] Prompt: ${usage.prompt_tokens} | Completion: ${usage.completion_tokens} | Total: ${usage.total_tokens}`);
          console.log(`💰 [LLMClient Cost] roughly ~$${totalCost.toFixed(6)} for this generation.`);
        }

        // Cache the result
        this.cache.set(cacheKey, {
          response: output,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });

        return output;

      } catch (error: any) {
        attempt++;
        console.error(`❌ [LLMClient] Call completely failed on attempt ${attempt}:`, error.message);
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
