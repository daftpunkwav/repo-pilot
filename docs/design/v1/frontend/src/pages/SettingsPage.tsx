import { useState } from 'react';
import { useSettings, useTheme } from '@/hooks/useSettings';
import { useGithubAccounts } from '@/hooks/useProjects';
import { getApi } from '@/api/client';
import { useUIStore } from '@/stores/uiStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Section = 'appearance' | 'github' | 'llm' | 'data' | 'about';

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'appearance', label: '外观', icon: '◐' },
  { id: 'github', label: 'GitHub', icon: '⌂' },
  { id: 'llm', label: 'LLM', icon: '◇' },
  { id: 'data', label: '数据', icon: '▤' },
  { id: 'about', label: '关于', icon: 'i' },
];

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
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repopilot-projects.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportNotes = async () => {
    const res = await getApi().listAllNotes();
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repopilot-notes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="settings-shell">
      <nav className="subnav" aria-label="设置分类">
        <div className="subnav-title">设置</div>
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`subnav-item ${section === item.id ? 'active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
            {item.id === 'llm' && !settings.llm_configured && <span className="dot-unset" />}
          </button>
        ))}
      </nav>

      <div className="settings-main">
        {section === 'appearance' && (
          <section className="settings-section glass-card glass-card--overview-outer">
            <h2>外观</h2>
            <p className="section-desc">主题与阅读舒适度</p>
            <div className="theme-cards">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`theme-card ${theme === t ? 'active' : ''}`}
                  onClick={() => {
                    setTheme(t);
                    if (t !== 'system') void updateSettings({ theme: t });
                  }}
                >
                  <div className={`theme-preview pv-${t === 'system' ? 'auto' : t}`}>
                    <div className="pv-side">
                      <i className="on" />
                      <i />
                      <i />
                    </div>
                    <div className="pv-body">
                      <i className="t" />
                      <i />
                    </div>
                  </div>
                  <div className="theme-card-label">
                    {t === 'light' ? '浅色' : t === 'dark' ? '深色' : '跟随系统'}
                    <span className="theme-card-check">✓</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="font-row" style={{ marginTop: 24 }}>
              <div className="font-slider-block form-row">
                <label className="field-label">
                  字体缩放 <span className="val">{fontScale.toFixed(1)}×</span>
                </label>
                <input
                  type="range"
                  className="slider"
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
              </div>
              <div className="font-preview">
                <div className="fp-sample">
                  <span className="fp-aa">Aa</span>
                  <span className="fp-cn">阅读预览</span>
                </div>
                <div className="fp-en">The quick brown fox</div>
              </div>
            </div>
          </section>
        )}

        {section === 'github' && (
          <section className="settings-section glass-card glass-card--overview-outer">
            <h2>GitHub</h2>
            <p className="section-desc">绑定账号以同步 Stars</p>
            {accounts.map((a) => (
              <div key={a.id} className="gh-card" style={{ marginBottom: 16 }}>
                <div className="gh-avatar">{a.username[0]?.toUpperCase()}</div>
                <div className="gh-meta">
                  <div className="gh-handle">@{a.username}</div>
                  <div className="gh-sub">已绑定 · {new Date(a.bound_at).toLocaleDateString('zh-CN')}</div>
                </div>
                <div className="gh-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUnbindId(a.id)}>
                    解绑
                  </button>
                </div>
              </div>
            ))}
            <div className="form-row">
              <label>GitHub 用户名</label>
              <input className="field input" value={ghUser} onChange={(e) => setGhUser(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Personal Access Token</label>
              <input
                className="field input"
                type="password"
                value={ghPat}
                onChange={(e) => setGhPat(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void bindGithub()}>
              绑定账号
            </button>
          </section>
        )}

        {section === 'llm' && (
          <section className="settings-section glass-card glass-card--overview-outer">
            <h2>LLM 配置</h2>
            <p className="section-desc">Agent 对话使用的模型与 API</p>
            {!settings.llm_configured && (
              <div className="alert alert-warning">
                <strong>未配置</strong> — Agent 将使用规则降级模式。
              </div>
            )}
            <div className="form-row">
              <label>Provider</label>
              <select
                className="field input"
                value={settings.llm_provider}
                onChange={(e) => void updateSettings({ llm_provider: e.target.value })}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="local">Local</option>
              </select>
            </div>
            <div className="form-row">
              <label>Model</label>
              <input
                className="field input"
                value={settings.llm_model}
                onChange={(e) => void updateSettings({ llm_model: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>API Key（当前 {settings.llm_api_key_masked}）</label>
              <div className="field-with-action">
                <input
                  type="password"
                  placeholder="sk-…"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                />
              </div>
            </div>
            <div className="settings-actions" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (llmKey) {
                    void updateSettings({
                      llm_api_key_masked: `sk-****${llmKey.slice(-4)}`,
                      llm_configured: true,
                    });
                    addToast({ type: 'success', message: '已保存' });
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
                  {testResult.success ? `成功 · ${testResult.latency_ms}ms` : '失败'}
                </span>
              )}
            </div>
          </section>
        )}

        {section === 'data' && (
          <section className="settings-section glass-card glass-card--overview-outer">
            <h2>数据</h2>
            <p className="section-desc">导出本地项目与笔记</p>
            <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={() => void exportProjects()}>
              导出项目 JSON
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void exportNotes()}>
              导出笔记 JSON
            </button>
          </section>
        )}

        {section === 'about' && (
          <section className="settings-section glass-card glass-card--overview-outer">
            <h2>关于 RepoPilot</h2>
            <div className="about-row">
              <span className="k">版本</span>
              <span>v1.0.0</span>
            </div>
            <div className="about-row">
              <span className="k">定位</span>
              <span>GitHub 项目学习驾驶舱</span>
            </div>
          </section>
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
