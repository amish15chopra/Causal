import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// We use the official OpenAI SDK but point it at OpenRouter
export const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3001', // Update based on your domain in production
    'X-Title': 'Decision Intelligence Platform',
  },
});

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct';

/**
 * Example function to test text completion via OpenRouter
 */
export async function testOpenRouterCompletion(prompt: string) {
  const response = await openRouterClient.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content;
}
