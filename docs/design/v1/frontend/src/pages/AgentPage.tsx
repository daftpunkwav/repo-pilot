import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAgentStore } from '@/stores/agentStore';
import { ChatPanel } from '@/components/agent/ChatPanel';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatRelativeTime } from '@/utils/date';
import { getApi } from '@/api/client';
import { Link } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';

const AGENT_TAG_CLASS: Record<string, string> = {
  hub: 'agent-tag-hub',
  scout: 'agent-tag-scout',
  mentor: 'agent-tag-mentor',
  navigator: 'agent-tag-navigator',
  curator: 'agent-tag-curator',
  scribe: 'agent-tag-scribe',
};

export function AgentPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const sessions = useAgentStore((s) => s.sessions);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const loadSessions = useAgentStore((s) => s.loadSessions);
  const switchSession = useAgentStore((s) => s.switchSession);
  const createSession = useAgentStore((s) => s.createSession);
  const deleteSession = useAgentStore((s) => s.deleteSession);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { settings } = useSettings();

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
            新建对话
          </button>
        </div>
        <div className="session-list-tabs">
          <span className="session-tab active">全部 {sessions.length}</span>
        </div>
        <div className="session-list-body">
          {sessions.map((s) => (
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
              <div className="session-meta">
                <span className={`agent-tag ${AGENT_TAG_CLASS[s.agent] ?? 'agent-tag-hub'}`}>
                  {s.agent}
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
      </aside>

      <main className="chat-area">
        {currentSessionId ? <ChatPanel /> : <p className="muted">创建或选择一个会话开始对话</p>}
      </main>

      <aside className="context-panel">
        <div className="context-section">
          <div className="context-title">
            <span>记忆摘要</span>
          </div>
          <div className="profile-summary">
            <div className="profile-row">
              <span className="profile-key">学习摘要</span>
              <span className="profile-val">{profile?.history_summary?.slice(0, 80) ?? '—'}</span>
            </div>
            <div className="profile-row">
              <span className="profile-key">目标数</span>
              <span className="profile-val">{profile?.goals?.length ?? 0}</span>
            </div>
          </div>
        </div>
        {settings?.llm_configured === false && (
          <div className="context-section" style={{ marginTop: 'auto' }}>
            <div className="context-title">降级提示</div>
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
