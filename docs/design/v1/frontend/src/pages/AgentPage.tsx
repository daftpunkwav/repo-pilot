import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAgentStore } from '@/stores/agentStore';
import { ChatPanel } from '@/components/agent/ChatPanel';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useState } from 'react';
import { formatRelativeTime } from '@/utils/date';

export function AgentPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const sessions = useAgentStore((s) => s.sessions);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const loadSessions = useAgentStore((s) => s.loadSessions);
  const switchSession = useAgentStore((s) => s.switchSession);
  const createSession = useAgentStore((s) => s.createSession);
  const deleteSession = useAgentStore((s) => s.deleteSession);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    <div className="page agent-page">
      <aside className="agent-sessions glass">
        <button
          type="button"
          className="btn btn-primary btn-block"
          data-testid="new-session-btn"
          onClick={() => void createSession()}
        >
          新建会话
        </button>
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`session-list__item ${currentSessionId === s.id ? 'active' : ''}`}
                onClick={() => void switchSession(s.id)}
              >
                <span>{s.title}</span>
                <time>{formatRelativeTime(s.updated_at)}</time>
                {s.unread && <span className="session-list__unread" />}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDeleteTarget(s.id)}
                aria-label="删除会话"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="agent-main">
        {currentSessionId ? (
          <ChatPanel />
        ) : (
          <p className="agent-empty">创建或选择一个会话开始对话</p>
        )}
      </div>
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
    </div>
  );
}
