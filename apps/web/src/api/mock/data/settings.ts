import type { Settings } from '@/api/types';
import { createDefaultAgentLlmConfigs } from '@/constants/llmConfig';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  font_scale: 1.0,
  code_font: 'JetBrains Mono',
  llm_provider: 'openai',
  llm_provider_display_name: 'OpenAI',
  llm_default_model: 'gpt-4o',
  llm_model: 'gpt-4o',
  llm_api_base: 'https://api.openai.com/v1',
  llm_api_format: 'openai',
  llm_available_models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
  llm_api_key_masked: 'sk-****a8d2',
  llm_configured: true,
  llm_last_test: '2026-07-04T14:18:00Z',
  llm_latency_ms: 412,
  agent_llm_configs: createDefaultAgentLlmConfigs(),
};
