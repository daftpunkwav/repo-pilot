import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAgentStore } from '@/stores/agentStore';
import { ChatPanel } from '@/components/agent/ChatPanel';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatRelativeTime } from '@/utils/date';
import { getApi } from '@/api/client';
import { useSettings } from '@/hooks/useSettings';
import { useProjects } from '@/hooks/useProjects';
import { AGENT_TAG_CLASS } from '@/utils/labels';
import { formatNumber, REPO_AVATAR_GRADIENTS, splitRepoName } from '@/utils/format';
import { categoryLabel } from '@/utils/labels';

const AGENT_DISPLAY: Record<string, string> = {
  hub: 'Hub',
  scout: 'Scout',
  mentor: 'Mentor',
  navigator: 'Navigator',
  curator: 'Curator',
  scribe: 'Scribe',
};

export function AgentPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const sessions = useAgentStore((s) => s.sessions);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const toolCalls = useAgentStore((s) => s.toolCalls);
  const loadSessions = useAgentStore((s) => s.loadSessions);
  const switchSession = useAgentStore((s) => s.switchSession);
  const createSession = useAgentStore((s) => s.createSession);
  const deleteSession = useAgentStore((s) => s.deleteSession);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [toolLogOpen, setToolLogOpen] = useState(true);
  const { settings } = useSettings();
  const { data: projectsData } = useProjects();

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await getApi().getUserProfile()).data,
  });

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (sessionId) {
      void switchSession(sessionId);
    } else if (!currentSessionId && sessions.length > 0) {
      const first = sessions[0];
      if (first) void switchSession(first.id);
    }
  }, [sessionId, sessions, currentSessionId, switchSession]);

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  const contextProjects = (projectsData?.items ?? []).slice(0, 3);

  return (
    <>
      <aside className="session-list">
        <div className="session-list-header">
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="new-session-btn"
            onClick={() => void createSession()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建对话
          </button>
          <div className="field mt-sm" style={{ height: 32 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              placeholder="搜索会话..."
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="session-list-tabs">
          <span className="session-tab active">全部 {sessions.length}</span>
          <span className="session-tab">收藏</span>
          <span className="session-tab">归档</span>
        </div>
        <div className="session-list-body">
          {filteredSessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${currentSessionId === s.id ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => void switchSession(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void switchSession(s.id);
              }}
            >
              <div className="session-title">
                {s.title}
                {s.unread && <span className="session-unread" title="未读" />}
              </div>
              <div className="session-summary">{s.title}</div>
              <div className="session-meta">
                <span className={`agent-tag ${AGENT_TAG_CLASS[s.agent] ?? 'agent-tag-hub'}`}>
                  {AGENT_DISPLAY[s.agent] ?? s.agent}
                </span>
                <span>{formatRelativeTime(s.updated_at)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ marginLeft: 'auto' }}
                  aria-label="删除会话"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(s.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <div
          className="session-list-header"
          style={{ borderTop: '1px solid var(--bg-300)', borderBottom: 0, padding: '10px 14px' }}
        >
          <Link to="/settings" className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start', width: '100%', gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.4.8a7 7 0 00-2.2-1.3L14 3h-4l-.3 2.3a7 7 0 00-2.2 1.3l-2.4-.8-2 3.4 2 1.5a7 7 0 000 2.6l-2 1.5 2 3.4 2.4-.8a7 7 0 002.2 1.3L10 21h4l.3-2.3a7 7 0 002.2-1.3l2.4.8 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" />
            </svg>
            Agent 配置
          </Link>
          <div style={{ fontSize: 10, color: 'var(--text-400)', marginTop: 6, padding: '0 4px', lineHeight: 1.5 }}>
            6 个 Agent 协同工作 · 数据仅存储在你的浏览器
          </div>
        </div>
      </aside>

      <main className="chat-area">
        {currentSessionId ? <ChatPanel /> : <p className="muted" style={{ padding: 24 }}>创建或选择一个会话开始对话</p>}
      </main>

      <aside className="context-panel">
        <div className="context-section">
          <div className="context-title">
            <span>当前上下文 · {contextProjects.length} 个项目</span>
          </div>
          {contextProjects.map((p, i) => {
            const { repo } = splitRepoName(p.name);
            return (
              <div key={p.id} className="ctx-proj">
                <div
                  className="ctx-proj-icon"
                  style={{ background: REPO_AVATAR_GRADIENTS[i % REPO_AVATAR_GRADIENTS.length] }}
                >
                  {(repo[0] ?? 'P').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ctx-proj-name">{p.name}</div>
                  <div className="ctx-proj-meta">
                    {categoryLabel(p.category_id)} · {p.language ?? '-'} · ★{formatNumber(p.stars)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="context-section">
          <div className="context-title">
            <span>记忆摘要</span>
          </div>
          <div className="profile-summary">
            <div className="profile-row">
              <span className="profile-key">学习摘要</span>
              <span className="profile-val">{profile?.history_summary?.slice(0, 40) ?? '—'}</span>
            </div>
            <div className="profile-row">
              <span className="profile-key">学习目标</span>
              <span className="profile-val">{profile?.goals?.length ?? 0} 个</span>
            </div>
            <div className="profile-row">
              <span className="profile-key">偏好</span>
              <span className="profile-val">{profile?.learning_preferences?.style ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="context-section">
          <button
            type="button"
            className="context-title collapsible-head"
            style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}
            onClick={() => setToolLogOpen((v) => !v)}
          >
            <span>工具调用日志</span>
            <svg
              className={`chev-down ${toolLogOpen ? 'open' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width={12}
              height={12}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {toolLogOpen && (
            <div className="tool-log">
              {toolCalls.size === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-400)' }}>暂无工具调用</div>
              ) : (
                Array.from(toolCalls.entries()).map(([id, tc]) => (
                  <div key={id} className={`tool-log-row ${tc.result !== undefined ? 'success' : 'running'}`}>
                    {tc.result !== undefined ? (
                      <span className="check">✓</span>
                    ) : (
                      <span className="dot" />
                    )}
                    <span>{tc.name}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {settings?.llm_configured === false && (
          <div className="context-section" style={{ marginTop: 'auto' }}>
            <div className="degrade-tip">
              <div>
                未配置 API Key 时，Agent 仅使用规则降级。
                <Link to="/settings"> 配置 LLM →</Link>
              </div>
            </div>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除会话"
        message="确定删除此会话？"
        danger
        onConfirm={() => {
          if (deleteTarget) void deleteSession(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
