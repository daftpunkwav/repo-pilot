import { useMemo, useState } from 'react';
import type { AgentLlmConfig, AgentSpeakingStyle, LlmApiFormat, Settings } from '@/api/types';
import type { LlmTestResult } from '@/stores/settingsStore';
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
  testLLM: (model?: string) => Promise<unknown>;
  isTestingLLM: boolean;
  testResult: LlmTestResult | null;
  onSaveApiKey: (key: string) => Promise<unknown>;
}

/** 将毫秒格式化为可读耗时（避免把 9967ms 误看成 10ms） */
function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = ms / 1000;
  return `${sec.toFixed(sec >= 10 ? 1 : 2)} s（${Math.round(ms)} ms）`;
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
    const configs = Array.isArray(settings.agent_llm_configs)
      ? settings.agent_llm_configs
      : [];
    for (const c of configs) m.set(c.agent_id, c);
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

  // 以默认模型为准，避免 llm_model / llm_default_model 不一致
  const activeModel =
    settings.llm_default_model || settings.llm_model || modelOptions[0] || '';

  return (
    <div className="llm-settings">
      {!settings.llm_configured && (
        <div className="alert alert-warning">
          <strong>未配置</strong> — 请填写 API Key 并测试模型；未配置时 Agent 将使用规则降级模式。
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
            placeholder="展示用名称，如 MiniMax"
          />
        </div>

        <div className="form-row">
          <label htmlFor="llm-base-url">Base URL</label>
          <input
            id="llm-base-url"
            className="field input"
            value={settings.llm_api_base ?? ''}
            onChange={(e) => void updateSettings({ llm_api_base: e.target.value || null })}
            placeholder="https://api.minimaxi.com/anthropic"
          />
          <p className="field-hint">
            Anthropic 兼容填到 /anthropic 即可（如 MiniMax）；OpenAI 兼容通常以 /v1 结尾
          </p>
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
              const key = apiKeyDraft.trim();
              if (!key) return;
              void (async () => {
                await onSaveApiKey(key);
                setApiKeyDraft('');
              })();
            }}
          >
            保存密钥
          </button>
        </div>
      </div>

      <div className="llm-settings-block glass-card glass-card--overview-inner">
        <h3 className="llm-block-title">模型</h3>
        <p className="llm-block-desc">
          选择默认模型后，点击「测试模型」向该模型发起一次真实请求；返回有效内容即通过
        </p>

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
          <p className="field-hint">未单独配置的 Agent 均使用此模型；测试也针对此模型</p>
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
              placeholder="如 MiniMax-M2.7"
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

        <div className="llm-test-panel">
          <div className="settings-actions llm-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isTestingLLM || !settings.llm_configured || !activeModel}
              onClick={() => void testLLM(activeModel)}
              data-testid="test-llm-btn"
            >
              {isTestingLLM
                ? `正在请求 ${activeModel}…（推理模型可能需 5–20 秒）`
                : `测试模型 · ${activeModel || '未选择'}`}
            </button>
            {!settings.llm_configured && (
              <span className="muted">请先保存 API Key</span>
            )}
          </div>

          {testResult && (
            <div
              className={`llm-test-result ${testResult.success ? 'llm-test-result--ok' : 'llm-test-result--fail'}`}
              role="status"
            >
              <div className="llm-test-result__head">
                <strong>{testResult.success ? '✓ 测试通过' : '✗ 测试失败'}</strong>
                <span className="muted">
                  模型 {testResult.model ?? activeModel}
                  {typeof testResult.latency_ms === 'number'
                    ? ` · 耗时 ${formatLatency(testResult.latency_ms)}`
                    : ''}
                </span>
              </div>
              {testResult.success ? (
                <div className="llm-test-result__body">
                  <div className="field-hint">模型回复：</div>
                  <pre className="llm-test-result__reply">
                    {testResult.reply?.trim() || '（无正文，但请求已成功）'}
                  </pre>
                </div>
              ) : (
                <div className="llm-test-result__body">
                  <div className="field-hint">错误信息：</div>
                  <pre className="llm-test-result__error">
                    {testResult.error?.trim() || '未知错误，请查看后端日志'}
                  </pre>
                </div>
              )}
              {testResult.litellm_model && (
                <p className="field-hint">路由：{testResult.litellm_model}</p>
              )}
            </div>
          )}

          {settings.llm_last_test && !testResult && (
            <p className="llm-last-test muted">
              上次测试 {new Date(settings.llm_last_test).toLocaleString('zh-CN')}
              {typeof settings.llm_latency_ms === 'number'
                ? ` · ${formatLatency(settings.llm_latency_ms)}`
                : ''}
            </p>
          )}
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
