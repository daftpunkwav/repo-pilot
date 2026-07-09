import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectNotes } from '@/hooks/useNotes';
import {
  useDeleteProject,
  useProject,
  useProjects,
  useUpdateProgress,
} from '@/hooks/useProjects';
import { useGraph } from '@/hooks/useGraph';
import { useUIStore } from '@/stores/uiStore';
import { getApi } from '@/api/client';
import type { AgentId, ProjectProgress } from '@/api/types';
import { asSSETextDelta } from '@/utils/sse-helpers';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { NoteEditor } from '@/components/note/NoteEditor';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StreamRenderer } from '@/components/agent/StreamRenderer';
import {
  useCreateNote,
  useUpdateNote,
} from '@/hooks/useNotes';
import { useNoteStore } from '@/stores/noteStore';
import { formatNumber, REPO_AVATAR_GRADIENTS, splitRepoName } from '@/utils/format';
import { formatDate } from '@/utils/date';
import { AGENT_CARDS, categoryLabel } from '@/utils/labels';
import { OVERVIEW_INNER_GLASS, OVERVIEW_OUTER_GLASS } from '@/constants/overviewGlass';

const PD_PROGRESS: { id: ProjectProgress; label: string; className: string }[] = [
  { id: 'none', label: '未开始', className: 'progress-none' },
  { id: 'learning', label: '学习中', className: 'progress-learning' },
  { id: 'learned', label: '已入门', className: 'progress-learned' },
  { id: 'mastered', label: '已掌握', className: 'progress-mastered' },
];

type DetailTab = 'readme' | 'notes' | 'ai' | 'related';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const { data: project, isLoading, isError } = useProject(id);
  const { data: notes = [] } = useProjectNotes(id);
  const { data: graphData } = useGraph();
  const { data: allProjects } = useProjects();
  const updateProgress = useUpdateProgress();
  const deleteProject = useDeleteProject();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const editingNoteId = useNoteStore((s) => s.editingNoteId);
  const startEditing = useNoteStore((s) => s.startEditing);

  const [tab, setTab] = useState<DetailTab>('readme');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scoutContent, setScoutContent] = useState('');
  const [scoutStreaming, setScoutStreaming] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const scoutAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isError) {
      addToast({ type: 'error', message: '项目不存在' });
      navigate('/projects', { replace: true });
    }
  }, [isError, navigate, addToast]);

  // 离开 ai 标签 / 卸载页面时中断流，避免陈旧结果与资源浪费
  useEffect(() => {
    if (tab !== 'ai' && scoutAbortRef.current) {
      scoutAbortRef.current.abort();
      scoutAbortRef.current = null;
      setScoutStreaming(false);
    }
  }, [tab]);

  useEffect(
    () => () => {
      scoutAbortRef.current?.abort();
    },
    [],
  );

  const related = useMemo(() => {
    if (!graphData || !id) return [];
    return graphData.edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => ({
        id: e.source === id ? e.target : e.source,
        sim: e.similarity,
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5);
  }, [graphData, id]);

  const projectMap = useMemo(() => {
    const m = new Map<string, { name: string }>();
    for (const p of allProjects?.items ?? []) {
      m.set(p.id, { name: p.name });
    }
    return m;
  }, [allProjects]);

  const recommendedAgent: AgentId = project?.progress === 'mastered' ? 'mentor' : 'scout';
  const { repo } = splitRepoName(project?.name ?? '');
  const scribeName = repo || project?.name || '';

  const runScout = async () => {
    if (!id) return;
    setTab('ai');
    setScoutContent('');
    setScoutStreaming(true);
    scoutAbortRef.current?.abort();
    const ac = new AbortController();
    scoutAbortRef.current = ac;
    const stream = getApi().analyzeProject(id, 'scout');
    try {
      for await (const event of stream) {
        if (ac.signal.aborted) break;
        switch (event.event) {
          case 'text_delta': {
            const d = asSSETextDelta(event.data);
            setScoutContent((c) => c + d.content);
            break;
          }
          case 'error': {
            const msg = (event.data as { message?: string })?.message ?? '分析失败';
            addToast({ type: 'error', message: msg });
            break;
          }
          default:
            break;
        }
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        const message = err instanceof Error ? err.message : '分析失败';
        addToast({ type: 'error', message });
      }
    } finally {
      if (scoutAbortRef.current === ac) {
        setScoutStreaming(false);
      }
    }
  };

  const handleSaveNote = async () => {
    const title = useNoteStore.getState().editorTitle;
    const content = useNoteStore.getState().editorContent;
    if (!id) return;
    if (editingNoteId && editingNoteId.startsWith('n_')) {
      await updateNote.mutateAsync({ id: editingNoteId, title, content });
    } else {
      await createNote.mutateAsync({ projectId: id, title, content });
    }
    addToast({ type: 'success', message: '笔记已保存' });
  };

  const handleNewNote = () => {
    startEditing('new', '新笔记', '');
  };

  const copyReadme = async () => {
    if (!project?.readme) return;
    try {
      await navigator.clipboard.writeText(project.readme);
      addToast({ type: 'success', message: 'README 已复制' });
    } catch {
      addToast({ type: 'error', message: '复制失败' });
    }
  };

  if (isLoading || !project) return <LoadingSpinner />;

  return (
    <div className="pd-shell">
      <section className="pd-main">
        <div className={`pd-hero ${OVERVIEW_OUTER_GLASS}`}>
          <div className="pd-avatar">
            <svg viewBox="-11.5 -10.232 23 20.464" fill="none">
              <circle r="2.05" fill="#fff" />
              <g stroke="#fff" strokeWidth="1" fill="none">
                <ellipse rx="11" ry="4.2" />
                <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                <ellipse rx="11" ry="4.2" transform="rotate(120)" />
              </g>
            </svg>
          </div>
          <div className="pd-hero-body">
            <h1 className="pd-title">{project.name}</h1>
            <p className="pd-desc">{project.description}</p>
            <div className="pd-meta">
              <span className="pd-meta-item">
                <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14}>
                  <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                <strong>{formatNumber(project.stars)}</strong>&nbsp;stars
              </span>
              <span className="pd-meta-sep" />
              <span className="pd-meta-item">
                <strong>{project.language ?? '-'}</strong>
              </span>
              <span className="pd-meta-sep" />
              <span className="pd-meta-item">
                添加于 <strong>{formatDate(project.imported_at)}</strong>
              </span>
            </div>
          </div>
          <div className="pd-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => void runScout()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Scout 快速分析
            </button>
            <a
              className={`btn ${OVERVIEW_INNER_GLASS}`}
              href={project.url}
              target="_blank"
              rel="noreferrer"
            >
              在 GitHub 打开
            </a>
          </div>
        </div>

        <div className={`pd-progress ${OVERVIEW_OUTER_GLASS}`}>
          <div className="pd-progress-head">
            <span className="label">学习进度</span>
          </div>
          <div className="pd-progress-list" role="radiogroup" aria-label="学习进度">
            {PD_PROGRESS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pd-progress-pill ${p.className}`}
                aria-selected={project.progress === p.id ? 'true' : 'false'}
                onClick={() => updateProgress.mutate({ id: project.id, progress: p.id })}
              >
                <span className="dot" />
                {p.label}
              </button>
            ))}
          </div>
          <div className="pd-scribe-tip">
            <div className="tip-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <strong style={{ color: 'var(--chart-4)' }}>Scribe Agent</strong>
              &nbsp;我可以基于 <span className="mono">{scribeName}</span> 的源码帮你生成笔记大纲，要试试吗？
            </div>
            <Link className="tip-cta" to={`/notes?project=${project.id}`}>
              生成笔记
            </Link>
          </div>
        </div>

        <div className="pd-tabs" role="tablist">
          {(
            [
              ['readme', 'README', notes.length, false],
              ['notes', '笔记', notes.length, true],
              ['ai', 'AI 分析', 0, false],
              ['related', '关联项目', related.length, true],
            ] as const
          ).map(([key, label, count, showCount]) => (
            <button
              key={key}
              type="button"
              className="pd-tab"
              role="tab"
              aria-selected={tab === key ? 'true' : 'false'}
              data-testid={key === 'notes' ? 'tab-notes' : undefined}
              onClick={() => setTab(key)}
            >
              {label}
              {showCount && <span className="pd-tab-count">{count}</span>}
            </button>
          ))}
        </div>

        {tab === 'readme' && (
          <article className="pd-readme">
            <div className="pd-readme-toolbar">
              <div className="left">
                <span>README.md</span>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-500)' }}>字号</span>
              <div className="font-ctrl">
                <button type="button" aria-label="缩小字号" onClick={() => setFontSize((f) => Math.max(11, f - 1))}>
                  −
                </button>
                <span className="font-display">{fontSize > 14 ? 'A+' : 'A'}</span>
                <button type="button" aria-label="放大字号" onClick={() => setFontSize((f) => Math.min(20, f + 1))}>
                  +
                </button>
              </div>
              <button type="button" className={`btn btn-sm ${OVERVIEW_INNER_GLASS}`} style={{ height: 28, marginLeft: 4 }} onClick={() => void copyReadme()}>
                复制全文
              </button>
            </div>
            <div
              className="pd-readme-body markdown"
              data-testid="readme-content"
              style={{ fontSize }}
            >
              {project.readme ? (
                <MarkdownRenderer content={project.readme} />
              ) : (
                <p style={{ color: 'var(--text-400)' }}>该项目暂无 README</p>
              )}
            </div>
          </article>
        )}

        {tab === 'notes' && (
          <div className={`pd-notes-panel ${OVERVIEW_OUTER_GLASS}`}>
            <div className="pd-notes-toolbar">
              <div>
                <h3 className="pd-notes-title">项目笔记</h3>
                <p className="muted small">共 {notes.length} 篇 · Markdown 编辑</p>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleNewNote}>
                新建笔记
              </button>
            </div>

            {!editingNoteId ? (
              notes.length === 0 ? (
                <EmptyState title="暂无笔记" description="为该项目写第一篇学习笔记" />
              ) : (
                <ul className="pd-notes-list">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`pd-notes-list-item ${OVERVIEW_INNER_GLASS}`}
                        onClick={() => startEditing(n.id, n.title, n.content)}
                      >
                        <span className="pd-notes-list-item__title">{n.title}</span>
                        <span className="pd-notes-list-item__meta">{formatDate(n.updated_at)}</span>
                        <span className="pd-notes-list-item__snippet">
                          {n.content.replace(/[#*`]/g, '').slice(0, 100)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className={`pd-notes-editor ${OVERVIEW_INNER_GLASS}`}>
                <NoteEditor
                  variant="notes"
                  onSave={() => void handleSaveNote()}
                  saving={createNote.isPending || updateNote.isPending}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'ai' && (
          <div className={`pd-readme ${OVERVIEW_OUTER_GLASS}`} style={{ minHeight: 200 }}>
            <div className="pd-readme-toolbar">
              <div className="left">Scout AI 分析</div>
              {!scoutContent && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void runScout()}>
                  开始分析
                </button>
              )}
            </div>
            <div className="pd-readme-body">
              {scoutContent ? (
                <StreamRenderer content={scoutContent} streaming={scoutStreaming} />
              ) : (
                <p className="muted">点击「Scout 快速分析」或「开始分析」生成项目速览</p>
              )}
            </div>
          </div>
        )}

        {tab === 'related' && (
          <div className={`${OVERVIEW_OUTER_GLASS}`} style={{ padding: 16 }}>
            {related.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
                暂无关联项目
              </p>
            ) : (
              <div className="pd-related-list">
                {related.map((r, i) => {
                  const p = projectMap.get(r.id);
                  if (!p) return null;
                  const [, repoName] = p.name.split('/');
                  return (
                    <Link key={r.id} className="pd-related-item" to={`/projects/${r.id}`}>
                      <div
                        className="pd-related-avatar"
                        style={{ background: REPO_AVATAR_GRADIENTS[i % REPO_AVATAR_GRADIENTS.length] }}
                      >
                        {(repoName?.[0] ?? 'P').toUpperCase()}
                      </div>
                      <span className="pd-related-name">{p.name}</span>
                      <span className="pd-related-sim">{r.sim.toFixed(2)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="pd-side">
        <div className={OVERVIEW_OUTER_GLASS}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div className="card-title">项目信息</div>
            <span className="card-subtitle">#{project.id}</span>
          </div>
          <div className="pd-info-list">
            <div className="pd-info-row">
              <span className="k">URL</span>
              <span className="v">
                <a href={project.url} target="_blank" rel="noreferrer">
                  {project.url.replace('https://github.com/', '')} ↗
                </a>
              </span>
            </div>
            <div className="pd-info-row">
              <span className="k">分类</span>
              <span className="v">
                <span className="badge">{categoryLabel(project.category_id)}</span>
              </span>
            </div>
            <div className="pd-info-row">
              <span className="k">语言</span>
              <span className="v">{project.language ?? '-'}</span>
            </div>
            <div className="pd-info-row">
              <span className="k">添加时间</span>
              <span className="v mono" style={{ fontSize: 12 }}>
                {formatDate(project.imported_at)}
              </span>
            </div>
            <div className="pd-info-row">
              <span className="k">数据来源</span>
              <span className="v">{project.source === 'github' ? 'GitHub Star 导入' : '手动添加'}</span>
            </div>
          </div>
          <div className="pd-info-actions">
            <button
              type="button"
              className={`btn btn-block ${OVERVIEW_INNER_GLASS}`}
              onClick={() => addToast({ type: 'info', message: '编辑项目（演示）' })}
            >
              编辑项目
            </button>
            <button
              type="button"
              className={`btn btn-block ${OVERVIEW_INNER_GLASS}`}
              onClick={() => addToast({ type: 'info', message: '重新分类（演示）' })}
            >
              重新分类
            </button>
            <button
              type="button"
              className={`btn btn-block ${OVERVIEW_INNER_GLASS}`}
              style={{ color: 'var(--error)' }}
              onClick={() => setDeleteOpen(true)}
            >
              删除项目
            </button>
          </div>
        </div>

        <div className={OVERVIEW_OUTER_GLASS}>
          <div className="card-header">
            <div className="card-title">AI 学习助手</div>
            <span className="card-subtitle">6 agents</span>
          </div>
          <div className="pd-agent-grid">
            {AGENT_CARDS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`pd-agent ${a.id === recommendedAgent ? 'recommended' : ''}`}
                onClick={() => navigate(`/agent?analyze=${project.id}&agent=${a.id}`)}
              >
                <div className="pd-agent-icon" style={{ background: a.color }}>
                  {a.name[0]}
                </div>
                <div className="pd-agent-name">{a.name}</div>
                <div className="pd-agent-desc">{a.desc}</div>
                <span className={`btn btn-sm ${OVERVIEW_INNER_GLASS}`}>调用</span>
              </button>
            ))}
          </div>
        </div>

        <div className={OVERVIEW_OUTER_GLASS}>
          <div className="card-header">
            <div className="card-title">
              我的笔记{' '}
              <span style={{ color: 'var(--text-400)', fontWeight: 500 }}>({notes.length})</span>
            </div>
            <button
              type="button"
              className={`btn btn-sm ${OVERVIEW_INNER_GLASS}`}
              onClick={() => {
                startEditing('new', '新笔记', '');
                setTab('notes');
              }}
            >
              新建
            </button>
          </div>
          <div className="pd-note-list">
            {notes.length === 0 ? (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-400)', fontSize: 12 }}>
                暂无笔记
                <br />
                <br />
                <Link to={`/notes?project=${project.id}`} style={{ color: 'var(--brand-500)', fontWeight: 600 }}>
                  写第一篇笔记 →
                </Link>
              </div>
            ) : (
              notes.slice(0, 5).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="pd-note"
                  onClick={() => {
                    startEditing(n.id, n.title, n.content);
                    setTab('notes');
                  }}
                >
                  <div className="pd-note-title">{n.title}</div>
                  <div className="pd-note-meta">{formatDate(n.updated_at)}</div>
                  <div className="pd-note-summary">
                    {n.content.replace(/[#*`]/g, '').slice(0, 80)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={OVERVIEW_OUTER_GLASS}>
          <div className="card-header">
            <div className="card-title">相似的项目</div>
            <Link className="card-subtitle" to="/graph" style={{ color: 'var(--brand-500)' }}>
              查看图谱 →
            </Link>
          </div>
          <div className="pd-related-list">
            {related.length === 0 ? (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-400)', fontSize: 12 }}>
                暂无关联项目
              </div>
            ) : (
              related.map((r, i) => {
                const p = projectMap.get(r.id);
                if (!p) return null;
                const [, repoName] = p.name.split('/');
                return (
                  <Link key={r.id} className="pd-related-item" to={`/projects/${r.id}`}>
                    <div
                      className="pd-related-avatar"
                      style={{ background: REPO_AVATAR_GRADIENTS[i % REPO_AVATAR_GRADIENTS.length] }}
                    >
                      {(repoName?.[0] ?? 'P').toUpperCase()}
                    </div>
                    <span className="pd-related-name">{p.name}</span>
                    <span className="pd-related-sim">{r.sim.toFixed(2)}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={deleteOpen}
        title="删除项目"
        message={`确定删除 ${project.name}？此操作不可撤销。`}
        danger
        onConfirm={() => {
          deleteProject.mutate(project.id, {
            onSuccess: () => navigate('/projects'),
          });
          setDeleteOpen(false);
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
