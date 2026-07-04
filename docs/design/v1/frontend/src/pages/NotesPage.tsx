import { useMemo, useState } from 'react';
import { useAllNotes, useCreateNote, useDeleteNote, useUpdateNote } from '@/hooks/useNotes';
import { useProjects } from '@/hooks/useProjects';
import { useNoteStore } from '@/stores/noteStore';
import { NoteList } from '@/components/note/NoteList';
import { NoteEditor } from '@/components/note/NoteEditor';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/uiStore';

export function NotesPage() {
  const { data: notes = [], isLoading } = useAllNotes();
  const { data: projectsData } = useProjects();
  const searchQuery = useNoteStore((s) => s.searchQuery);
  const setSearchQuery = useNoteStore((s) => s.setSearchQuery);
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId);
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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="page notes-page">
      <aside className="notes-sidebar glass">
        <input
          className="input"
          type="search"
          placeholder="搜索笔记…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            startEditing('new', '新笔记', '');
            setNewProjectId(projectsData?.items[0]?.id ?? '');
          }}
        >
          新建笔记
        </button>
        {filtered.length > 0 ? (
          <NoteList
            notes={filtered}
            projectNames={projectNames}
            selectedId={selectedNoteId}
            onSelect={(n) => startEditing(n.id, n.title, n.content)}
          />
        ) : (
          <EmptyState title="暂无笔记" description="在项目详情页或此处创建笔记" />
        )}
      </aside>
      <main className="notes-content">
        {editingNoteId ? (
          <>
            {editingNoteId === 'new' && (
              <select
                className="input"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
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
                className="btn btn-danger"
                onClick={() => setDeleteOpen(true)}
              >
                删除
              </button>
            )}
          </>
        ) : (
          <EmptyState title="选择一条笔记" description="从左侧列表选择或新建笔记" />
        )}
      </main>
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
