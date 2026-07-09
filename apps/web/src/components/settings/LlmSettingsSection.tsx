import { useMemo, useState } from 'react';
import type { AgentLlmConfig, AgentSpeakingStyle, LlmApiFormat, Settings } from '@/api/types';
import { GlassSelect } from '@/components/common/GlassSelect';
import { AGENT_CATALOG } from '@/constants/agentCatalog';
import {
  findProviderPreset,
  LLM_API_FORMAT_OPTIONS,
  LLM_PROVIDER_PRESETS,
  SPEAKING_STYLE_OPTIONS,
} from '@/constants/llmConfig';

interface LlmSettingsSectionProps {
  settings: Settings;
  updateSettings: (data: Partial<Settings>) => Promise<unknown>;
  testLLM: () => Promise<unknown>;
  isTestingLLM: boolean;
  testResult: { success: boolean; latency_ms?: number } | null;
  onSaveApiKey: (key: string) => void;
}

export function LlmSettingsSection({
  settings,
  updateSettings,
  testLLM,
  isTestingLLM,
  testResult,
  onSaveApiKey,
}: LlmSettingsSectionProps) {
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [newModelInput, setNewModelInput] = useState('');

  const agentConfigsMap = useMemo(() => {
    const m = new Map<string, AgentLlmConfig>();
    for (const c of settings.agent_llm_configs) m.set(c.agent_id, c);
    return m;
  }, [settings.agent_llm_configs]);

  const applyProviderPreset = (providerId: string) => {
    const preset = findProviderPreset(providerId);
    if (!preset) return;
    void updateSettings({
      llm_provider: preset.id,
      llm_provider_display_name: preset.display_name,
      llm_api_base: preset.default_base_url || null,
      llm_api_format: preset.api_format,
      llm_available_models: [...preset.available_models],
      llm_default_model: preset.default_model,
      llm_model: preset.default_model,
    });
  };

  const updateAgentConfig = (agentId: string, patch: Partial<AgentLlmConfig>) => {
    const next = AGENT_CATALOG.map((a) => {
      const existing = agentConfigsMap.get(a.id) ?? {
        agent_id: a.id,
        model_override: null,
        speaking_style: 'default' as AgentSpeakingStyle,
      };
      return a.id === agentId ? { ...existing, ...patch } : existing;
    });
    void updateSettings({ agent_llm_configs: next });
  };

  const addModel = () => {
    const name = newModelInput.trim();
    if (!name || settings.llm_available_models.includes(name)) return;
    void updateSettings({
      llm_available_models: [...settings.llm_available_models, name],
    });
    setNewModelInput('');
  };

  const removeModel = (model: string) => {
    const next = settings.llm_available_models.filter((m) => m !== model);
    const defaultModel =
      settings.llm_default_model === model ? (next[0] ?? '') : settings.llm_default_model;
    void updateSettings({
      llm_available_models: next,
      llm_default_model: defaultModel,
      llm_model: defaultModel,
    });
  };

  const modelOptions =
    settings.llm_available_models.length > 0
      ? settings.llm_available_models
      : [settings.llm_default_model].filter(Boolean);

  return (
    <div className="llm-settings">
      {!settings.llm_configured && (
        <div className="alert alert-warning">
          <strong>未配置</strong> — 请填写 API Key 并测试连通；未配置时 Agent 将使用规则降级模式。
        </div>
      )}

      <div className="llm-settings-block glass-card glass-card--overview-inner">
        <h3 className="llm-block-title">供应商连接</h3>
        <p className="llm-block-desc">名称、Base URL、API 格式与密钥</p>

        <div className="form-row">
          <label htmlFor="llm-provider">供应商预设</label>
          <GlassSelect
            id="llm-provider"
            value={settings.llm_provider}
            options={LLM_PROVIDER_PRESETS.map((p) => ({
              value: p.id,
              label: p.display_name,
            }))}
            onChange={applyProviderPreset}
            aria-label="供应商预设"
          />
        </div>

        <div className="form-row">
          <label htmlFor="llm-provider-name">供应商名称</label>
          <input
            id="llm-provider-name"
            className="field input"
            value={settings.llm_provider_display_name}
            onChange={(e) => void updateSettings({ llm_provider_display_name: e.target.value })}
            placeholder="展示用名称，如 智谱 AI"
          />
        </div>

        <div className="form-row">
          <label htmlFor="llm-base-url">Base URL</label>
          <input
            id="llm-base-url"
            className="field input"
            value={settings.llm_api_base ?? ''}
            onChange={(e) => void updateSettings({ llm_api_base: e.target.value || null })}
            placeholder="https://api.example.com/v1"
          />
          <p className="field-hint">OpenAI 兼容接口通常以 /v1 结尾</p>
        </div>

        <div className="form-row">
          <label htmlFor="llm-api-format">API 格式</label>
          <GlassSelect
            id="llm-api-format"
            value={settings.llm_api_format}
            options={LLM_API_FORMAT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: `${opt.label} — ${opt.hint}`,
            }))}
            onChange={(v) => void updateSettings({ llm_api_format: v as LlmApiFormat })}
            aria-label="API 格式"
          />
        </div>

        <div className="form-row">
          <label htmlFor="llm-api-key">
            API Key
            {settings.llm_api_key_masked ? (
              <span className="llm-key-masked">（已保存 {settings.llm_api_key_masked}）</span>
            ) : null}
          </label>
          <input
            id="llm-api-key"
            type="password"
            className="field input"
            placeholder="sk-… 或供应商密钥"
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="settings-actions llm-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (apiKeyDraft.trim()) onSaveApiKey(apiKeyDraft.trim());
            }}
          >
            保存密钥
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isTestingLLM}
            onClick={() => void testLLM()}
          >
            {isTestingLLM ? '测试中…' : '测试连通'}
          </button>
          {testResult && (
            <span className={testResult.success ? 'text-success' : 'text-error'}>
              {testResult.success ? `成功 · ${testResult.latency_ms}ms` : '连接失败'}
            </span>
          )}
          {settings.llm_last_test && (
            <span className="llm-last-test muted">
              上次测试 {new Date(settings.llm_last_test).toLocaleString('zh-CN')}
              {settings.llm_latency_ms ? ` · ${settings.llm_latency_ms}ms` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="llm-settings-block glass-card glass-card--overview-inner">
        <h3 className="llm-block-title">模型</h3>
        <p className="llm-block-desc">可选模型列表与全局默认模型</p>

        <div className="form-row">
          <label htmlFor="llm-default-model">默认模型</label>
          <GlassSelect
            id="llm-default-model"
            value={settings.llm_default_model}
            options={modelOptions.map((m) => ({ value: m, label: m }))}
            onChange={(v) =>
              void updateSettings({
                llm_default_model: v,
                llm_model: v,
              })
            }
            aria-label="默认模型"
          />
          <p className="field-hint">未单独配置的 Agent 均使用此模型</p>
        </div>

        <div className="form-row">
          <label>可选模型</label>
          <ul className="llm-model-list">
            {settings.llm_available_models.map((m) => (
              <li key={m} className="llm-model-chip">
                <span>{m}</span>
                {m === settings.llm_default_model && (
                  <span className="llm-model-chip__default">默认</span>
                )}
                <button type="button" aria-label={`移除 ${m}`} onClick={() => removeModel(m)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="llm-model-add">
            <input
              className="field input"
              placeholder="如 glm-5.2"
              value={newModelInput}
              onChange={(e) => setNewModelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addModel();
                }
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={addModel}>
              添加模型
            </button>
          </div>
        </div>
      </div>

      <div className="llm-settings-block glass-card glass-card--overview-inner">
        <h3 className="llm-block-title">Agent 模型与风格</h3>
        <p className="llm-block-desc">
          为每个 Agent 指定模型覆盖与说话风格；模型留空则使用全局默认
        </p>

        <div className="llm-agent-table-wrap">
          <table className="llm-agent-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>模型</th>
                <th>说话风格</th>
              </tr>
            </thead>
            <tbody>
              {AGENT_CATALOG.map((agent) => {
                const cfg = agentConfigsMap.get(agent.id) ?? {
                  agent_id: agent.id,
                  model_override: null,
                  speaking_style: 'default' as AgentSpeakingStyle,
                };
                return (
                  <tr key={agent.id}>
                    <td>
                      <div className="llm-agent-cell">
                        <span
                          className="llm-agent-avatar"
                          style={{ background: agent.color }}
                          aria-hidden
                        >
                          {agent.name[0]}
                        </span>
                        <div>
                          <div className="llm-agent-name">{agent.name}</div>
                          <div className="llm-agent-tagline muted">{agent.tagline}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <GlassSelect
                        size="sm"
                        value={cfg.model_override ?? ''}
                        options={[
                          {
                            value: '',
                            label: `使用默认（${settings.llm_default_model}）`,
                          },
                          ...modelOptions.map((m) => ({ value: m, label: m })),
                        ]}
                        onChange={(v) =>
                          updateAgentConfig(agent.id, {
                            model_override: v || null,
                          })
                        }
                        aria-label={`${agent.name} 模型`}
                      />
                    </td>
                    <td>
                      <GlassSelect
                        size="sm"
                        value={cfg.speaking_style}
                        options={SPEAKING_STYLE_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: `${opt.label} — ${opt.desc}`,
                        }))}
                        onChange={(v) =>
                          updateAgentConfig(agent.id, {
                            speaking_style: v as AgentSpeakingStyle,
                          })
                        }
                        aria-label={`${agent.name} 说话风格`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
