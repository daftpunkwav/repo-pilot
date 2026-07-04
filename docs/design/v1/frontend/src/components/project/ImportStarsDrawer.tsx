import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StarRepo } from '@/api/types';
import { useGithubStars, useImportProjects } from '@/hooks/useProjects';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface ImportStarsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ImportStarsDrawer({ open, onClose }: ImportStarsDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const { data: stars, isLoading } = useGithubStars();
  const importMutation = useImportProjects();
  const addToast = useUIStore((s) => s.addToast);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  if (!open) return null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImport = async () => {
    if (!stars) return;
    const repos = stars
      .filter((s) => selected.has(`${s.owner}/${s.repo}`) && !s.already_imported)
      .map((s) => ({ owner: s.owner, repo: s.repo, url: s.url }));
    if (repos.length === 0) {
      addToast({ type: 'warning', message: '请选择未导入的项目' });
      return;
    }
    try {
      const result = await importMutation.mutateAsync(repos);
      addToast({ type: 'success', message: result.summary });
      onClose();
    } catch {
      addToast({ type: 'error', message: '导入失败' });
    }
  };

  const githubBound = user?.github_bound ?? false;

  return (
    <div className="drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="drawer glass"
        role="dialog"
        aria-label="导入 GitHub Stars"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer__header">
          <h2>同步 GitHub Stars</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        {!githubBound ? (
          <div className="drawer__body">
            <p>请先在设置中绑定 GitHub 账号。</p>
            <Link to="/settings" className="btn btn-primary" onClick={onClose}>
              去设置绑定
            </Link>
          </div>
        ) : isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="drawer__body">
            <ul className="star-list">
              {(stars ?? []).map((s: StarRepo) => {
                const key = `${s.owner}/${s.repo}`;
                return (
                  <li key={key} className="star-list__item">
                    <label>
                      <input
                        type="checkbox"
                        disabled={s.already_imported}
                        checked={selected.has(key) || s.already_imported}
                        onChange={() => toggle(key)}
                      />
                      <span className="font-mono">{key}</span>
                      {s.already_imported && (
                        <span className="star-list__imported">已导入</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importMutation.isPending}
              onClick={handleImport}
            >
              {importMutation.isPending ? '导入中…' : '确认导入'}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
