import { useState } from 'react';
import { useSettings, useTheme } from '@/hooks/useSettings';
import { useGithubAccounts } from '@/hooks/useProjects';
import { getApi } from '@/api/client';
import { useUIStore } from '@/stores/uiStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { GlassCard } from '@/components/common/GlassCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Section = 'appearance' | 'github' | 'llm' | 'data' | 'about';

export function SettingsPage() {
  const { settings, isLoading, updateSettings, testLLM, isTestingLLM, testResult } =
    useSettings();
  const { theme, setTheme, fontScale, setFontScale } = useTheme();
  const { data: accounts = [], refetch: refetchAccounts } = useGithubAccounts();
  const addToast = useUIStore((s) => s.addToast);
  const [section, setSection] = useState<Section>('appearance');
  const [ghUser, setGhUser] = useState('');
  const [ghPat, setGhPat] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [unbindId, setUnbindId] = useState<string | null>(null);

  if (isLoading || !settings) return <LoadingSpinner />;

  const bindGithub = async () => {
    try {
      await getApi().bindGithub({ username: ghUser, pat: ghPat });
      setGhPat('');
      void refetchAccounts();
      addToast({ type: 'success', message: 'GitHub 绑定成功' });
    } catch {
      addToast({ type: 'error', message: '绑定失败' });
    }
  };

  const unbindGithub = async (id: string) => {
    await getApi().unbindGithub(id);
    void refetchAccounts();
    addToast({ type: 'success', message: '已解绑' });
  };

  const exportProjects = async () => {
    const res = await getApi().exportProjects();
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repopilot-projects.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportNotes = async () => {
    const res = await getApi().listAllNotes();
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repopilot-notes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page settings-page">
      <nav className="settings-subnav glass">
        {(
          [
            ['appearance', '外观'],
            ['github', 'GitHub'],
            ['llm', 'LLM'],
            ['data', '数据'],
            ['about', '关于'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`settings-subnav__item ${section === key ? 'active' : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
            {key === 'llm' && !settings.llm_configured && (
              <span className="dot-unset" aria-label="未配置" />
            )}
          </button>
        ))}
      </nav>

      <div className="settings-main">
        {section === 'appearance' && (
          <GlassCard>
            <h2>外观</h2>
            <label className="form-field">
              主题
              <select
                className="input"
                value={theme}
                onChange={(e) => {
                  const v = e.target.value as 'dark' | 'light' | 'system';
                  setTheme(v);
                  if (v !== 'system') {
                    void updateSettings({ theme: v });
                  }
                }}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </label>
            <label className="form-field">
              字体缩放 {fontScale.toFixed(1)}
              <input
                type="range"
                min={0.8}
                max={1.5}
                step={0.1}
                value={fontScale}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFontScale(v);
                  void updateSettings({ font_scale: v });
                }}
              />
            </label>
          </GlassCard>
        )}

        {section === 'github' && (
          <GlassCard>
            <h2>GitHub 绑定</h2>
            <ul>
              {accounts.map((a) => (
                <li key={a.id}>
                  {a.username}
                  <button type="button" className="btn btn-ghost" onClick={() => setUnbindId(a.id)}>
                    解绑
                  </button>
                </li>
              ))}
            </ul>
            <label className="form-field">
              GitHub 用户名
              <input className="input" value={ghUser} onChange={(e) => setGhUser(e.target.value)} />
            </label>
            <label className="form-field">
              Personal Access Token
              <input
                className="input"
                type="password"
                value={ghPat}
                onChange={(e) => setGhPat(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void bindGithub()}>
              绑定
            </button>
          </GlassCard>
        )}

        {section === 'llm' && (
          <GlassCard>
            <h2>LLM 配置</h2>
            <label className="form-field">
              Provider
              <select
                className="input"
                value={settings.llm_provider}
                onChange={(e) => void updateSettings({ llm_provider: e.target.value })}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label className="form-field">
              Model
              <input
                className="input"
                value={settings.llm_model}
                onChange={(e) => void updateSettings({ llm_model: e.target.value })}
              />
            </label>
            <label className="form-field">
              API Base
              <input
                className="input"
                value={settings.llm_api_base ?? ''}
                onChange={(e) => void updateSettings({ llm_api_base: e.target.value || null })}
              />
            </label>
            <label className="form-field">
              API Key（当前：{settings.llm_api_key_masked}）
              <input
                className="input"
                type="password"
                placeholder="sk-…"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
              />
            </label>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (llmKey) {
                    void updateSettings({
                      llm_api_key_masked: `sk-****${llmKey.slice(-4)}`,
                      llm_configured: true,
                    });
                  }
                }}
              >
                保存
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
                  {testResult.success
                    ? `成功 · ${testResult.latency_ms}ms`
                    : '测试失败'}
                </span>
              )}
            </div>
          </GlassCard>
        )}

        {section === 'data' && (
          <GlassCard>
            <h2>数据导出</h2>
            <button type="button" className="btn btn-primary" onClick={() => void exportProjects()}>
              导出项目 JSON
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void exportNotes()}>
              导出笔记 JSON
            </button>
          </GlassCard>
        )}

        {section === 'about' && (
          <GlassCard>
            <h2>关于</h2>
            <p>RepoPilot v1.0.0</p>
            <p>GitHub 项目学习驾驶舱</p>
          </GlassCard>
        )}
      </div>

      <ConfirmDialog
        open={unbindId !== null}
        title="解绑 GitHub"
        message="确定解绑此账号？"
        danger
        onConfirm={() => {
          if (unbindId) void unbindGithub(unbindId);
          setUnbindId(null);
        }}
        onCancel={() => setUnbindId(null)}
      />
    </div>
  );
}
