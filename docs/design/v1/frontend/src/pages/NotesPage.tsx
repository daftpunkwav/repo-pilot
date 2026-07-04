import { useMemo, useState } from 'react';
import { useAllNotes, useCreateNote, useDeleteNote, useUpdateNote } from '@/hooks/useNotes';
import { useProjects } from '@/hooks/useProjects';
import { useNoteStore } from '@/stores/noteStore';
import { NoteList } from '@/components/note/NoteList';
import { NoteEditor } from '@/components/note/NoteEditor';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/uiStore';

export function NotesPage() {
  const { data: notes = [], isLoading } = useAllNotes();
  const { data: projectsData } = useProjects();
  const searchQuery = useNoteStore((s) => s.searchQuery);
  const setSearchQuery = useNoteStore((s) => s.setSearchQuery);
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId);
  const editorContent = useNoteStore((s) => s.editorContent);
  const startEditing = useNoteStore((s) => s.startEditing);
  const editingNoteId = useNoteStore((s) => s.editingNoteId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const addToast = useUIStore((s) => s.addToast);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');

  const projectNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectsData?.items ?? []) {
      m.set(p.id, p.name);
    }
    return m;
  }, [projectsData]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const handleSave = async () => {
    const title = useNoteStore.getState().editorTitle;
    const content = useNoteStore.getState().editorContent;
    if (!title.trim()) {
      addToast({ type: 'warning', message: '请输入标题' });
      return;
    }
    if (editingNoteId && editingNoteId.startsWith('n_')) {
      await updateNote.mutateAsync({ id: editingNoteId, title, content });
    } else if (newProjectId) {
      await createNote.mutateAsync({ projectId: newProjectId, title, content });
    } else {
      addToast({ type: 'warning', message: '请选择关联项目' });
      return;
    }
    addToast({ type: 'success', message: '笔记已保存' });
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="notes-shell" data-view="split">
      <header className="notes-topbar">
        <div className="notes-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="搜索笔记标题、内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            startEditing('new', '新笔记', '');
            setNewProjectId(projectsData?.items[0]?.id ?? '');
          }}
        >
          新建笔记
        </button>
      </header>

      <aside className="notes-list-pane">
        <div className="notes-list-header">
          <h3>笔记</h3>
          <span className="badge" style={{ fontFamily: 'var(--font-mono)' }}>
            {filtered.length}
          </span>
        </div>
        <div className="notes-list-body">
          <NoteList
            notes={filtered}
            projectNames={projectNames}
            selectedId={selectedNoteId}
            onSelect={(n) => startEditing(n.id, n.title, n.content)}
          />
        </div>
      </aside>

      <section className="edit-pane">
        {editingNoteId ? (
          <>
            {editingNoteId === 'new' && (
              <select
                className="input"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                style={{ marginBottom: 12 }}
              >
                <option value="">选择项目</option>
                {(projectsData?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <NoteEditor onSave={() => void handleSave()} saving={updateNote.isPending} />
            {editingNoteId.startsWith('n_') && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setDeleteOpen(true)}
              >
                删除
              </button>
            )}
          </>
        ) : (
          <p className="muted" style={{ padding: 24 }}>
            从左侧选择或新建笔记
          </p>
        )}
      </section>

      <section className="preview-pane">
        {editingNoteId ? (
          <MarkdownRenderer content={editorContent} className="markdown-body" />
        ) : (
          <p className="muted" style={{ padding: 24 }}>
            预览区
          </p>
        )}
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="删除笔记"
        message="确定删除此笔记？"
        danger
        onConfirm={() => {
          if (editingNoteId?.startsWith('n_')) {
            void deleteNote.mutateAsync(editingNoteId);
          }
          setDeleteOpen(false);
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
