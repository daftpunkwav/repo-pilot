import { Link } from 'react-router-dom';
import type { Note } from '@/api/types';
import { formatRelativeTime } from '@/utils/date';

interface NoteListProps {
  notes: Note[];
  projectNames: Map<string, string>;
  selectedId: string | null;
  onSelect: (note: Note) => void;
}

export function NoteList({ notes, projectNames, selectedId, onSelect }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="muted" style={{ padding: 12 }}>暂无笔记</p>;
  }

  return (
    <>
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          data-testid="note-item"
          className={`note-card ${selectedId === n.id ? 'active' : ''}`}
          onClick={() => onSelect(n)}
        >
          <div className="note-card-title">{n.title}</div>
          <div className="note-card-meta">
            <Link to={`/projects/${n.project_id}`} onClick={(e) => e.stopPropagation()}>
              {projectNames.get(n.project_id) ?? n.project_id}
            </Link>
            <span>· {formatRelativeTime(n.updated_at)}</span>
          </div>
        </button>
      ))}
    </>
  );
}
