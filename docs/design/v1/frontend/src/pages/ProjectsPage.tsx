import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCategories,
  useProjects,
  useProjectStats,
  useTags,
} from '@/hooks/useProjects';
import { useProjectStore } from '@/stores/projectStore';
import { FilterBar, useProjectLanguages } from '@/components/project/FilterBar';
import { ProjectTable } from '@/components/project/ProjectTable';
import { ImportStarsDrawer } from '@/components/project/ImportStarsDrawer';
import { ImportUrlsModal } from '@/components/project/ImportUrlsModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatNumber } from '@/utils/format';

export function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const { data: stats } = useProjectStats();
  const page = useProjectStore((s) => s.page);
  const pageSize = useProjectStore((s) => s.pageSize);
  const setPage = useProjectStore((s) => s.setPage);
  const search = useProjectStore((s) => s.search);
  const [starsOpen, setStarsOpen] = useState(false);
  const [urlsOpen, setUrlsOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) useProjectStore.getState().setSearch(q);
    if (searchParams.get('import') === 'stars') setStarsOpen(true);
  }, [searchParams]);

  const total = data?.total ?? 0;
  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;
  const byP = stats?.by_progress;

  const languages = useProjectLanguages(data?.items ?? []);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (search) parts.push(`"${search}"`);
    const tail = parts.length ? ` · 已筛选 ${parts.join(' · ')}` : '';
    return `${total} 个项目 · 最后同步于 ${new Date().toLocaleDateString('zh-CN')}${tail}`;
  }, [total, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>我的项目库</h1>
          <div className="subtitle">{subtitle}</div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-github"
            data-testid="import-stars-btn"
            onClick={() => setStarsOpen(true)}
          >
            <span className="gh-dot" />
            GitHub 同步
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setUrlsOpen(true)}>
            导入项目
          </button>
        </div>
      </div>

      {stats && (
        <section className="stat-grid">
          <article className="stat-card">
            <div className="stat-label">总项目数</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-delta">活跃库</div>
          </article>
          <article className="stat-card stat-green">
            <div className="stat-label">已掌握</div>
            <div className="stat-value">{byP?.mastered ?? 0}</div>
            <div className="stat-delta">
              {stats.total ? Math.round(((byP?.mastered ?? 0) / stats.total) * 100) : 0}% · 占比
            </div>
          </article>
          <article className="stat-card stat-orange">
            <div className="stat-label">学习中</div>
            <div className="stat-value">{byP?.learning ?? 0}</div>
            <div className="stat-delta">
              {stats.total ? Math.round(((byP?.learning ?? 0) / stats.total) * 100) : 0}% · 占比
            </div>
          </article>
          <article className="stat-card stat-purple">
            <div className="stat-label">待开始</div>
            <div className="stat-value">{byP?.none ?? 0}</div>
            <div className="stat-delta" style={{ color: 'var(--text-500)' }}>
              {stats.total ? Math.round(((byP?.none ?? 0) / stats.total) * 100) : 0}% · 占比
            </div>
          </article>
        </section>
      )}

      <FilterBar categories={categories} tags={tags} languages={languages} />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <ProjectTable
            projects={data?.items ?? []}
            tags={tags}
            onImportClick={() => setStarsOpen(true)}
          />
          {data && data.items.length > 0 && (
            <div className="pagination">
              <span className="info">
                第 {page} / {totalPages} 页 · 共 {formatNumber(data.total)} 项
              </span>
              <div className="pages">
                <button
                  type="button"
                  className="page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ‹
                </button>
                <button type="button" className="page-btn active">
                  {page}
                </button>
                <button
                  type="button"
                  className="page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ImportStarsDrawer open={starsOpen} onClose={() => setStarsOpen(false)} />
      <ImportUrlsModal open={urlsOpen} onClose={() => setUrlsOpen(false)} />
    </>
  );
}
