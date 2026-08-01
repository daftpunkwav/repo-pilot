import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAgentStore } from '@/stores/agentStore';
import { ChatPanel } from '@/components/agent/ChatPanel';
import { AgentContextSidebar } from '@/components/agent/AgentContextSidebar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatRelativeTime } from '@/utils/date';
import { AGENT_TAG_CLASS } from '@/utils/labels';
import type { AgentSession } from '@/api/types';

const AGENT_DISPLAY: Record<string, string> = {
  hub: 'Hub',
  scout: 'Scout',
  mentor: 'Mentor',
  navigator: 'Navigator',
  curator: 'Curator',
  scribe: 'Scribe',
  atlas: 'Atlas',
};

/** 详情页快速分析会话（折叠显示） */
function isAnalyzeSession(s: AgentSession): boolean {
  if (s.source === 'analyze') return true;
  const t = (s.title || '').trim();
  // scout · owner/repo
  if (/^(scout|mentor|navigator|curator|scribe|atlas)\s·\s/i.test(t)) return true;
  // 分析 owner/repo
  if (/^分析\s+\S+/.test(t)) return true;
  return false;
}

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
  const [batchDeleteIds, setBatchDeleteIds] = useState<string[] | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [toolLogOpen, setToolLogOpen] = useState(true);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(() => {
    try {
      return localStorage.getItem('rp_agent_context_collapsed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const shell = document.querySelector('.agent-shell');
    shell?.classList.toggle('agent-shell--context-collapsed', contextPanelCollapsed);
    try {
      localStorage.setItem('rp_agent_context_collapsed', contextPanelCollapsed ? '1' : '0');
    } catch {
      /* 隐私模式等场景下忽略 */
    }
    return () => shell?.classList.remove('agent-shell--context-collapsed');
  }, [contextPanelCollapsed]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  const chatSessions = useMemo(
    () => filteredSessions.filter((s) => !isAnalyzeSession(s)),
    [filteredSessions]
  );
  const analyzeSessions = useMemo(
    () => filteredSessions.filter((s) => isAnalyzeSession(s)),
    [filteredSessions]
  );

  const visibleForManage = useMemo(() => {
    if (analyzeOpen) return [...chatSessions, ...analyzeSessions];
    return chatSessions;
  }, [chatSessions, analyzeSessions, analyzeOpen]);

  useEffect(() => {
    if (sessionId) {
      void switchSession(sessionId);
      return;
    }
    if (!currentSessionId && chatSessions.length > 0) {
      const first = chatSessions[0];
      if (first) void switchSession(first.id);
    }
  }, [sessionId, chatSessions, currentSessionId, switchSession]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(visibleForManage.map((s) => s.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const exitManage = () => {
    setManageMode(false);
    clearSelection();
  };

  const renderSessionItem = (s: AgentSession) => (
    <div
      key={s.id}
      className={`session-item ${currentSessionId === s.id ? 'active' : ''} ${
        selectedIds.has(s.id) ? 'session-item--selected' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (manageMode) {
          toggleSelect(s.id);
          return;
        }
        void switchSession(s.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (manageMode) toggleSelect(s.id);
          else void switchSession(s.id);
        }
      }}
    >
      {manageMode && (
        <label className="session-check" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.has(s.id)}
            onChange={() => toggleSelect(s.id)}
            aria-label={`选择 ${s.title}`}
          />
        </label>
      )}
      <div className="session-item__main">
        <div className="session-title">
          {s.title}
          {s.unread && <span className="session-unread" title="未读" />}
        </div>
        <div className="session-meta">
          <span className={`agent-tag ${AGENT_TAG_CLASS[s.agent] ?? 'agent-tag-hub'}`}>
            {AGENT_DISPLAY[s.agent] ?? s.agent}
          </span>
          <span>{formatRelativeTime(s.updated_at)}</span>
          {!manageMode && (
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
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="session-list">
        <div className="session-list-header">
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="new-session-btn"
            onClick={() => void createSession()}
            disabled={manageMode}
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
          <div className="session-manage-bar">
            {!manageMode ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setManageMode(true)}
              >
                批量管理
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllVisible}>
                  全选
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection}>
                  清空
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger, #ff6b6b)' }}
                  disabled={selectedIds.size === 0}
                  onClick={() => setBatchDeleteIds([...selectedIds])}
                >
                  删除 ({selectedIds.size})
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exitManage}>
                  完成
                </button>
              </>
            )}
          </div>
        </div>
        <div className="session-list-tabs">
          <span className="session-tab active">对话 {chatSessions.length}</span>
          {analyzeSessions.length > 0 && (
            <button
              type="button"
              className={`session-tab ${analyzeOpen ? 'active' : ''}`}
              onClick={() => setAnalyzeOpen((v) => !v)}
            >
              快速分析 {analyzeSessions.length}
            </button>
          )}
        </div>
        <div className="session-list-body">
          {chatSessions.length === 0 && (
            <p className="muted" style={{ padding: '12px 8px', fontSize: 12 }}>
              暂无主动对话，点击上方新建
            </p>
          )}
          {chatSessions.map(renderSessionItem)}

          {analyzeSessions.length > 0 && (
            <div className="session-analyze-fold">
              <button
                type="button"
                className="session-analyze-fold__head"
                onClick={() => setAnalyzeOpen((v) => !v)}
                aria-expanded={analyzeOpen}
              >
                <span>快速分析记录</span>
                <span className="session-analyze-fold__meta">
                  {analyzeSessions.length}
                  <svg
                    className={`chev-down ${analyzeOpen ? 'open' : ''}`}
                    viewBox="0 0 24 24"
                    width={12}
                    height={12}
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
              </button>
              {analyzeOpen && (
                <div className="session-analyze-fold__body">
                  {analyzeSessions.map(renderSessionItem)}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          className="session-list-header"
          style={{ borderTop: '1px solid var(--bg-300)', borderBottom: 0, padding: '10px 14px' }}
        >
          <Link
            to="/settings"
            className="btn btn-sm btn-ghost"
            style={{ justifyContent: 'flex-start', width: '100%', gap: 8 }}
          >
            Agent 配置
          </Link>
        </div>
      </aside>

      <main className="chat-area">
        {currentSessionId ? (
          <ChatPanel />
        ) : (
          <p className="muted" style={{ padding: 24 }}>
            创建或选择一个会话开始对话
          </p>
        )}
      </main>

      <AgentContextSidebar
        sessionId={currentSessionId}
        toolLogOpen={toolLogOpen}
        onToggleToolLog={() => setToolLogOpen((v) => !v)}
        toolCalls={toolCalls}
        collapsed={contextPanelCollapsed}
        onToggleCollapse={() => setContextPanelCollapsed((v) => !v)}
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

      <ConfirmDialog
        open={batchDeleteIds !== null}
        title="批量删除会话"
        message={`确定删除选中的 ${batchDeleteIds?.length ?? 0} 个会话？此操作不可撤销。`}
        danger
        onConfirm={() => {
          const ids = batchDeleteIds ?? [];
          setBatchDeleteIds(null);
          void (async () => {
            for (const id of ids) {
              await deleteSession(id);
            }
            exitManage();
          })();
        }}
        onCancel={() => setBatchDeleteIds(null)}
      />
    </>
  );
}
