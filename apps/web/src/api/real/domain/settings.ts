/**
 * Settings 域 — 用户设置 + LLM API Key + 自测
 */
import type { ApiResponse, Settings } from '@/api/types';
import type { HttpCtx } from './http-ctx';

export class SettingsApi {
  constructor(private readonly ctx: HttpCtx) {}

  async getSettings(): Promise<ApiResponse<Settings>> {
    return this.ctx.apiRequest<Settings>('/settings/');
  }

  async updateSettings(data: Partial<Settings>): Promise<ApiResponse<Settings>> {
    return this.ctx.apiRequest<Settings>('/settings/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async saveLlmApiKey(apiKey: string): Promise<ApiResponse<{ masked: string }>> {
    return this.ctx.apiRequest<{ masked: string }>('/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    });
  }

  async testLLM(params?: {
    model?: string;
  }): Promise<
    ApiResponse<{
      success: boolean;
      latency_ms: number;
      model: string;
      reply?: string;
      error?: string;
      litellm_model?: string;
    }>
  > {
    return this.ctx.apiRequest('/settings/test-llm', {
      method: 'POST',
      body: JSON.stringify({ model: params?.model }),
    });
  }
}
