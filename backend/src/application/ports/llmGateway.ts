export interface LLMGateway {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}
