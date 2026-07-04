import { useEffect, useState } from 'react';
import { useNoteStore } from '@/stores/noteStore';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface NoteEditorProps {
  onSave: () => void;
  saving?: boolean;
}

export function NoteEditor({ onSave, saving }: NoteEditorProps) {
  const title = useNoteStore((s) => s.editorTitle);
  const content = useNoteStore((s) => s.editorContent);
  const previewMode = useNoteStore((s) => s.previewMode);
  const setTitle = useNoteStore((s) => s.setEditorTitle);
  const setContent = useNoteStore((s) => s.setEditorContent);
  const togglePreview = useNoteStore((s) => s.togglePreview);
  const [debounced, setDebounced] = useState(content);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(content), 200);
    return () => clearTimeout(t);
  }, [content]);

  return (
    <div className="note-editor">
      <div className="note-editor__toolbar">
        <button
          type="button"
          className={`filter-btn ${!previewMode ? 'active' : ''}`}
          onClick={() => previewMode && togglePreview()}
        >
          编辑
        </button>
        <button
          type="button"
          className={`filter-btn ${previewMode ? 'active' : ''}`}
          onClick={() => !previewMode && togglePreview()}
        >
          预览
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          data-testid="save-note-btn"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      <input
        className="input note-editor__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="笔记标题"
      />
      {previewMode ? (
        <MarkdownRenderer content={debounced} className="note-editor__preview" />
      ) : (
        <textarea
          className="input textarea note-editor__body"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Markdown 内容…"
        />
      )}
    </div>
  );
}
