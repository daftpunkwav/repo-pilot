import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAgentStore } from '@/stores/agentStore';
import { ChatPanel } from '@/components/agent/ChatPanel';
import { AgentContextSidebar } from '@/components/agent/AgentContextSidebar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatRelativeTime } from '@/utils/date';
import { useProjects } from '@/hooks/useProjects';
import { AGENT_TAG_CLASS } from '@/utils/labels';

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
  const { data: projectsData } = useProjects();

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
            新建对话
          </button>
          <div className="field mt-sm" style={{ height: 32 }}>
            <input
              placeholder="搜索会话..."
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="session-list-tabs">
          <span className="session-tab active">全部 {sessions.length}</span>
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
            Agent 配置
          </Link>
        </div>
      </aside>

      <main className="chat-area">
        {currentSessionId ? <ChatPanel /> : <p className="muted" style={{ padding: 24 }}>创建或选择一个会话开始对话</p>}
      </main>

      <AgentContextSidebar
        contextProjects={contextProjects}
        sessionId={currentSessionId}
        toolLogOpen={toolLogOpen}
        onToggleToolLog={() => setToolLogOpen((v) => !v)}
        toolCalls={toolCalls}
      />

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
