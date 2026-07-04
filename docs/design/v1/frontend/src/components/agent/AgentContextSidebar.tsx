import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { Goal, MemoryItem, Project, UserProfile } from '@/api/types';
import { formatNumber, REPO_AVATAR_GRADIENTS, splitRepoName } from '@/utils/format';
import { categoryLabel, progressLabel } from '@/utils/labels';
import { ProgressBadge } from '@/components/project/ProgressBadge';
import { ContextWindowPanel } from './ContextWindowPanel';

const MEMORY_LABELS: Record<MemoryItem['category'], string> = {
  summary: '记忆摘要',
  goal: '学习目标',
  tech: '技术栈',
  preference: '偏好',
};

interface AgentContextSidebarProps {
  contextProjects: Project[];
  sessionId?: string | null;
  toolLogOpen: boolean;
  onToggleToolLog: () => void;
  toolCalls: Map<string, { name: string; result?: unknown }>;
}

export function AgentContextSidebar({
  contextProjects,
  sessionId,
  toolLogOpen,
  onToggleToolLog,
  toolCalls,
}: AgentContextSidebarProps) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await getApi().getUserProfile()).data,
  });

  const updateProfile = useMutation({
    mutationFn: async (data: Partial<UserProfile>) =>
      (await getApi().updateUserProfile(data)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['userProfile'] }),
  });

  const memoryItems = profile?.memory_items ?? [];
  const goals = profile?.goals ?? [];

  const addMemory = (category: MemoryItem['category']) => {
    const content = window.prompt(`添加${MEMORY_LABELS[category]}：`);
    if (!content?.trim()) return;
    const item: MemoryItem = {
      id: `mem_${Date.now()}`,
      category,
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    void updateProfile.mutate({ memory_items: [...memoryItems, item] });
  };

  const removeMemory = (id: string) => {
    void updateProfile.mutate({
      memory_items: memoryItems.filter((m) => m.id !== id),
    });
  };

  const removeGoal = (index: number) => {
    void updateProfile.mutate({
      goals: goals.filter((_, i) => i !== index),
    });
  };

  const addGoal = () => {
    const title = window.prompt('新学习目标：');
    if (!title?.trim()) return;
    const goal: Goal = {
      title: title.trim(),
      priority: goals.length + 1,
      status: 'active',
    };
    void updateProfile.mutate({ goals: [...goals, goal] });
  };

  const itemsByCategory = (cat: MemoryItem['category']) =>
    memoryItems.filter((m) => m.category === cat);

  return (
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
                <div className="ctx-proj-progress">
                  <ProgressBadge progress={p.progress} />
                  <span className="ctx-mastery-label">{progressLabel(p.progress)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <p className="ctx-proj-hint muted">掌握程度由 Agent 根据对话与笔记自动维护</p>
      </div>

      {(['summary', 'goal', 'tech', 'preference'] as const).map((cat) => (
        <div key={cat} className="context-section">
          <div className="context-title">
            <span>{MEMORY_LABELS[cat]}</span>
            <button
              type="button"
              className="ctx-add-btn"
              title={`添加${MEMORY_LABELS[cat]}`}
              onClick={() => addMemory(cat)}
            >
              +
            </button>
          </div>
          {cat === 'goal'
            ? goals.map((g, i) => (
                <div key={`${g.title}-${i}`} className="memory-chip">
                  <span>{g.title}</span>
                  <button type="button" aria-label="删除" onClick={() => removeGoal(i)}>
                    ×
                  </button>
                </div>
              ))
            : itemsByCategory(cat).map((m) => (
                <div key={m.id} className="memory-chip">
                  <span>{m.content}</span>
                  <button type="button" aria-label="删除" onClick={() => removeMemory(m.id)}>
                    ×
                  </button>
                </div>
              ))}
          {cat === 'goal' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addGoal}>
              添加目标
            </button>
          )}
          {cat !== 'goal' && itemsByCategory(cat).length === 0 && (
            <p className="muted" style={{ fontSize: 11 }}>
              暂无条目 · Agent 会在对话中自动补充
            </p>
          )}
        </div>
      ))}

      <div className="context-section">
        <button
          type="button"
          className="context-title collapsible-head"
          style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}
          onClick={onToggleToolLog}
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
                  {tc.result !== undefined ? <span className="check">✓</span> : <span className="dot" />}
                  <span>{tc.name}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="context-section context-section--footer">
        <ContextWindowPanel sessionId={sessionId} compact />
      </div>
    </aside>
  );
}
