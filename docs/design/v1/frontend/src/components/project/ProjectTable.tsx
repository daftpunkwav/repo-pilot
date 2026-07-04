import { useNavigate } from 'react-router-dom';
import type { Project, Tag } from '@/api/types';
import { ProgressBadge } from './ProgressBadge';
import { categoryLabel } from '@/utils/labels';
import {
  formatNumber,
  langCssClass,
  REPO_AVATAR_GRADIENTS,
  splitRepoName,
} from '@/utils/format';

interface ProjectTableProps {
  projects: Project[];
  tags: Tag[];
  onImportClick?: () => void;
}

const CAT_CLASS: Record<string, string> = {
  cat_frontend: 'cat-frontend',
  cat_backend: 'cat-backend',
  cat_ai: 'cat-ai',
  cat_data: 'cat-data',
  cat_devops: 'cat-devops',
  cat_tools: 'cat-tools',
};

export function ProjectTable({ projects, tags, onImportClick }: ProjectTableProps) {
  const navigate = useNavigate();
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  if (projects.length === 0) {
    return (
      <div id="table-wrap" data-testid="project-table">
        <div className="empty-state">
          <h3>没有匹配的项目</h3>
          <p>
            尝试调整筛选条件，或{' '}
            <button
              type="button"
              style={{ color: 'var(--brand-500)', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer' }}
              onClick={onImportClick}
            >
              导入新项目
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="table-wrap" data-testid="project-table">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            <th>仓库</th>
            <th>分类</th>
            <th>语言</th>
            <th>Stars</th>
            <th>进度</th>
            <th>标签</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => {
            const { owner, repo } = splitRepoName(p.name);
            const catCls = p.category_id ? CAT_CLASS[p.category_id] : undefined;
            return (
              <tr
                key={p.id}
                data-project-id={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`选择 ${p.name}`} />
                </td>
                <td>
                  <div className="repo-cell">
                    <div
                      className="repo-avatar"
                      style={{
                        background: REPO_AVATAR_GRADIENTS[i % REPO_AVATAR_GRADIENTS.length],
                      }}
                    >
                      {(repo[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="repo-info">
                      <div className="repo-name">
                        <span className="owner">{owner}</span>
                        <span className="slash">/</span>
                        <span>{repo}</span>
                      </div>
                      <div className="repo-desc">{p.description ?? ''}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {catCls ? (
                    <span className={`badge ${catCls}`}>{categoryLabel(p.category_id)}</span>
                  ) : (
                    <span className="badge">{categoryLabel(p.category_id)}</span>
                  )}
                </td>
                <td>
                  <span className={`lang-dot ${langCssClass(p.language)}`}>
                    {p.language ?? '-'}
                  </span>
                </td>
                <td>
                  <span className="stars">★ {formatNumber(p.stars)}</span>
                </td>
                <td>
                  <ProgressBadge progress={p.progress} />
                </td>
                <td>
                  <div className="tags">
                    {p.tags.slice(0, 2).map((tid) => (
                      <span key={tid} className="tag">
                        {tagMap.get(tid) ?? tid.replace(/^tag_/, '')}
                      </span>
                    ))}
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-scout"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      Scout
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
