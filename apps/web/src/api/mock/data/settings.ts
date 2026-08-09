import type { Settings } from '@/api/types';
import { AGENT_CATALOG } from '@/constants/agentCatalog';
import { createDefaultAgentLlmConfigs } from '@/constants/llmConfig';

const DEFAULT_PROVIDER_ID = 'mock-openai-provider';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  font_scale: 1.0,
  code_font: 'JetBrains Mono',
  llm_providers: [
    {
      id: DEFAULT_PROVIDER_ID,
      preset_id: 'openai',
      display_name: 'OpenAI',
      enabled: true,
      api_base: 'https://api.openai.com/v1',
      api_format: 'openai',
      available_models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
      default_model: 'gpt-4o',
      api_key_masked: 'sk-****a8d2',
      configured: true,
    },
  ],
  llm_default_provider_id: DEFAULT_PROVIDER_ID,
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
  agent_code_of_conduct: '',
  agent_guidelines: AGENT_CATALOG.map((a) => ({ agent_id: a.id, guideline: '' })),
};
