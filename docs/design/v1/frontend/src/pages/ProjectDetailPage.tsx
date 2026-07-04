import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectNotes } from '@/hooks/useNotes';
import {
  useDeleteProject,
  useProject,
  useSetProjectTags,
  useTags,
  useUpdateProgress,
} from '@/hooks/useProjects';
import { useUIStore } from '@/stores/uiStore';
import { getApi } from '@/api/client';
import type { ProjectProgress } from '@/api/types';
import { asSSETextDelta } from '@/utils/sse-helpers';
import { ProgressBadge } from '@/components/project/ProgressBadge';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { NoteList } from '@/components/note/NoteList';
import { NoteEditor } from '@/components/note/NoteEditor';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StreamRenderer } from '@/components/agent/StreamRenderer';
import {
  useCreateNote,
  useDeleteNote,
  useUpdateNote,
} from '@/hooks/useNotes';
import { useNoteStore } from '@/stores/noteStore';

const PROGRESS_OPTIONS: ProjectProgress[] = ['none', 'learning', 'learned', 'mastered'];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const { data: project, isLoading, isError } = useProject(id);
  const { data: notes = [] } = useProjectNotes(id);
  const { data: tags = [] } = useTags();
  const updateProgress = useUpdateProgress();
  const setProjectTags = useSetProjectTags();
  const deleteProject = useDeleteProject();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const editingNoteId = useNoteStore((s) => s.editingNoteId);
  const startEditing = useNoteStore((s) => s.startEditing);

  const [tab, setTab] = useState<'readme' | 'notes' | 'agent'>('readme');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scoutContent, setScoutContent] = useState('');
  const [scoutStreaming, setScoutStreaming] = useState(false);

  useEffect(() => {
    if (isError) {
      addToast({ type: 'error', message: '项目不存在' });
      navigate('/projects', { replace: true });
    }
  }, [isError, navigate, addToast]);

  const runScout = async () => {
    if (!id) return;
    setScoutStreaming(true);
    setScoutContent('');
    const stream = getApi().analyzeProject(id, 'scout');
    try {
      for await (const event of stream) {
        if (event.event === 'text_delta') {
          const d = asSSETextDelta(event.data);
          setScoutContent((c) => c + d.content);
        }
      }
    } finally {
      setScoutStreaming(false);
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

  if (isLoading || !project) return <LoadingSpinner />;

  const projectNames = new Map([[project.id, project.name]]);

  return (
    <div className="page project-detail-page">
      <header className="pd-header glass">
        <h1 className="font-mono">{project.name}</h1>
        <p>{project.description}</p>
        <div className="pd-header__meta">
          <span>{project.language}</span>
          <span>★ {project.stars.toLocaleString()}</span>
          <ProgressBadge progress={project.progress} />
        </div>
        <div className="pd-header__actions">
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            打开 GitHub
          </a>
          <button type="button" className="btn btn-primary" onClick={() => void runScout()}>
            Scout 分析
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setDeleteOpen(true)}
          >
            删除
          </button>
        </div>
        <div className="progress-pills">
          {PROGRESS_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={`filter-btn ${project.progress === p ? 'active' : ''}`}
              onClick={() => updateProgress.mutate({ id: project.id, progress: p })}
            >
              <ProgressBadge progress={p} />
            </button>
          ))}
        </div>
        <div className="tag-editor">
          {tags.map((t) => (
            <label key={t.id} className="tag">
              <input
                type="checkbox"
                checked={project.tags.includes(t.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...project.tags, t.id]
                    : project.tags.filter((x) => x !== t.id);
                  setProjectTags.mutate({ projectId: project.id, tagIds: next });
                }}
              />
              {t.name}
            </label>
          ))}
        </div>
      </header>

      {scoutContent && (
        <div className="scout-panel glass">
          <StreamRenderer content={scoutContent} streaming={scoutStreaming} />
        </div>
      )}

      <div className="pd-tabs">
        {(['readme', 'notes', 'agent'] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={t === 'notes' ? 'tab-notes' : undefined}
            className={`filter-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'readme' ? 'README' : t === 'notes' ? `笔记 (${notes.length})` : 'Agent'}
          </button>
        ))}
      </div>

      <div className="pd-content">
        {tab === 'readme' &&
          (project.readme ? (
            <div data-testid="readme-content">
              <MarkdownRenderer content={project.readme} />
            </div>
          ) : (
            <EmptyState title="暂无 README" description="Mock 数据中部分项目未包含 README" />
          ))}
        {tab === 'notes' && (
          <div className="pd-notes">
            <NoteList
              notes={notes}
              projectNames={projectNames}
              selectedId={editingNoteId}
              onSelect={(n) => startEditing(n.id, n.title, n.content)}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => startEditing('new', '新笔记', '')}
            >
              新建笔记
            </button>
            {editingNoteId && (
              <>
                <NoteEditor
                  onSave={() => void handleSaveNote()}
                  saving={createNote.isPending || updateNote.isPending}
                />
                {editingNoteId.startsWith('n_') && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void deleteNote.mutateAsync(editingNoteId)}
                  >
                    删除笔记
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {tab === 'agent' && (
          <div className="pd-agent-tab">
            <p>在此项目中与 Agent 对话</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/agent')}
            >
              打开 Agent Chat
            </button>
          </div>
        )}
      </div>

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
