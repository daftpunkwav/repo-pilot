import { useEffect, useState } from 'react';
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
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { GlassCard } from '@/components/common/GlassCard';

export function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const { data: stats } = useProjectStats();
  const page = useProjectStore((s) => s.page);
  const pageSize = useProjectStore((s) => s.pageSize);
  const setPage = useProjectStore((s) => s.setPage);
  const [starsOpen, setStarsOpen] = useState(false);
  const [urlsOpen, setUrlsOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('import') === 'stars') {
      setStarsOpen(true);
    }
  }, [searchParams]);

  const languages = useProjectLanguages(data?.items ?? []);
  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="page projects-page">
      <header className="page-head">
        <div>
          <h1>项目库</h1>
          <p className="page-head__sub">管理你导入的 GitHub 项目</p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn-primary"
            data-testid="import-stars-btn"
            onClick={() => setStarsOpen(true)}
          >
            同步 GitHub Stars
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setUrlsOpen(true)}>
            批量粘贴 URL
          </button>
        </div>
      </header>

      {stats && (
        <div className="stats-grid stats-grid--compact">
          <GlassCard className="stat-card stat-card--sm">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">项目</span>
          </GlassCard>
          <GlassCard className="stat-card stat-card--sm">
            <span className="stat-card__value">{stats.by_progress.learning}</span>
            <span className="stat-card__label">学习中</span>
          </GlassCard>
        </div>
      )}

      <FilterBar categories={categories} tags={tags} languages={languages} />

      {isLoading ? (
        <LoadingSpinner />
      ) : data && data.items.length > 0 ? (
        <>
          <ProjectTable projects={data.items} categories={categories} tags={tags} />
          <div className="pagination">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          title="还没有项目"
          description="导入 GitHub Stars 或粘贴 URL 开始"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setStarsOpen(true)}>
              导入 GitHub Stars
            </button>
          }
        />
      )}

      <ImportStarsDrawer open={starsOpen} onClose={() => setStarsOpen(false)} />
      <ImportUrlsModal open={urlsOpen} onClose={() => setUrlsOpen(false)} />
    </div>
  );
}
