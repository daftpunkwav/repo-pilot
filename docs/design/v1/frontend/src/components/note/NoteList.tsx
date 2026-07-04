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
    return <p className="note-list__empty">暂无笔记</p>;
  }

  return (
    <ul className="note-list">
      {notes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            data-testid="note-item"
            className={`note-list__item ${selectedId === n.id ? 'note-list__item--active' : ''}`}
            onClick={() => onSelect(n)}
          >
            <span className="note-list__title">{n.title}</span>
            <span className="note-list__meta">
              <Link
                to={`/projects/${n.project_id}`}
                onClick={(e) => e.stopPropagation()}
              >
                {projectNames.get(n.project_id) ?? n.project_id}
              </Link>
              · {formatRelativeTime(n.updated_at)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
