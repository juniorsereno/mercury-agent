import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import { BaseProvider } from './base.js';
import type { ProviderConfig } from '../utils/config.js';
import type { LLMResponse, LLMStreamChunk } from './base.js';

const ANTHROPIC_COMPAT_MODELS = new Set([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'minimax-m2.7',
  'minimax-m2.5',
]);

export class OpenCodeGoProvider extends BaseProvider {
  readonly name = 'opencodeGo';
  readonly model: string;
  private client: any;
  private modelInstance: any;

  constructor(config: ProviderConfig) {
    super(config);
    this.model = config.model;

    if (ANTHROPIC_COMPAT_MODELS.has(config.model)) {
      this.client = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
    } else {
      this.client = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
    }
    this.modelInstance = this.client(config.model);
  }

  async generateText(prompt: string, systemPrompt: string): Promise<LLMResponse> {
    const result = await generateText({
      model: this.modelInstance,
      system: systemPrompt,
      prompt,
    });

    return {
      text: result.text,
      inputTokens: result.usage?.promptTokens ?? 0,
      outputTokens: result.usage?.completionTokens ?? 0,
      totalTokens: (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0),
      model: this.model,
      provider: this.name,
    };
  }

  async *streamText(prompt: string, systemPrompt: string): AsyncIterable<LLMStreamChunk> {
    const result = streamText({
      model: this.modelInstance,
      system: systemPrompt,
      prompt,
    });

    for await (const chunk of (await result).textStream) {
      yield { text: chunk, done: false };
    }
    yield { text: '', done: true };
  }

  isAvailable(): boolean {
    return this.config.apiKey.length > 0;
  }

  getModelInstance() {
    return this.modelInstance;
  }
}
