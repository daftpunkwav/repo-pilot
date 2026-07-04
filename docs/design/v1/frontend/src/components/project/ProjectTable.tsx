import { useNavigate } from 'react-router-dom';
import type { Category, Project, Tag } from '@/api/types';
import { ProgressBadge } from './ProgressBadge';

interface ProjectTableProps {
  projects: Project[];
  categories: Category[];
  tags: Tag[];
}

export function ProjectTable({ projects, categories, tags }: ProjectTableProps) {
  const navigate = useNavigate();

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="table-wrap" data-testid="project-table">
      <table className="table">
        <thead>
          <tr>
            <th>仓库</th>
            <th>语言</th>
            <th>Stars</th>
            <th>分类</th>
            <th>进度</th>
            <th>标签</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              className="table__row--clickable"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <td className="font-mono">{p.name}</td>
              <td>
                {p.language && (
                  <span className={`lang-dot lang-dot--${p.language.toLowerCase()}`}>
                    {p.language}
                  </span>
                )}
              </td>
              <td>{p.stars.toLocaleString()}</td>
              <td>{p.category_id ? catMap.get(p.category_id) : '—'}</td>
              <td>
                <ProgressBadge progress={p.progress} />
              </td>
              <td>
                <div className="tag-list">
                  {p.tags.slice(0, 3).map((tid) => (
                    <span key={tid} className="tag">
                      {tagMap.get(tid) ?? tid}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${p.id}`);
                  }}
                >
                  Scout
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
