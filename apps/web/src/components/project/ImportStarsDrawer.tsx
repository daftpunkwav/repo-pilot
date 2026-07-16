import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { SelectReposEvent, StarRepo } from '@/api/types';
import { useGithubStars, useImportProjects } from '@/hooks/useProjects';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { ImportAgentModal } from './ImportAgentModal';
import { EmbedAgentChat } from '@/components/agent/EmbedAgentChat';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface ImportStarsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ImportStarsDrawer({ open, onClose }: ImportStarsDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { data: starsResult, isLoading, isFetching } = useGithubStars({
    enabled: open && Boolean(user?.github_bound),
  });
  const importMutation = useImportProjects();
  const addToast = useUIStore((s) => s.addToast);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const stars = starsResult?.items ?? [];

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const repoKeys = useMemo(
    () => stars.map((s) => `${s.owner}/${s.repo}`),
    [stars]
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyAgentSelection = (ev: SelectReposEvent) => {
    setSelected((prev) => {
      if (ev.action === 'set') return new Set(ev.repo_keys);
      if (ev.action === 'add') {
        const next = new Set(prev);
        for (const k of ev.repo_keys) next.add(k);
        return next;
      }
      const next = new Set(prev);
      for (const k of ev.repo_keys) next.delete(k);
      return next;
    });
  };

  const handleImport = async () => {
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { getApi } = await import('@/api/client');
      const res = await getApi().listStars({ refresh: true });
      qc.setQueryData(['githubStars'], res.data);
      addToast({
        type: 'success',
        message: `已刷新 ${res.data.total} 个 Stars`,
      });
    } catch {
      addToast({ type: 'error', message: '刷新 Stars 失败' });
    } finally {
      setRefreshing(false);
    }
  };

  const githubBound = user?.github_bound ?? false;

  return (
    <ImportAgentModal
      open={open}
      onClose={onClose}
      title="同步 GitHub Stars"
      subtitle="左侧勾选仓库；右侧导入助手可自动勾选并说明推荐"
      agentPanel={
        <EmbedAgentChat
          mode="import"
          title="导入助手"
          subtitle="智能勾选 · 说明清单"
          agentInitial="C"
          agentClassName="agent-curator"
          importContext={{
            mode: 'stars',
            available_repo_keys: repoKeys,
            selected_repo_keys: [...selected],
          }}
          onSelectRepos={applyAgentSelection}
        />
      }
    >
      {!githubBound ? (
        <div className="import-biz-empty">
          <p>请先在设置中绑定 GitHub 账号（需要 PAT）。</p>
          <Link to="/settings" className="btn btn-primary" onClick={onClose}>
            去设置绑定
          </Link>
        </div>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="import-biz-layout">
          <div className="import-biz-toolbar">
            <div className="import-biz-meta">
              <span className="muted">
                {starsResult?.total ?? stars.length} 个 Star
                {starsResult?.cached ? ' · 缓存' : ' · 实时'}
              </span>
              {starsResult?.fetched_at && (
                <span className="muted small">
                  更新于 {new Date(starsResult.fetched_at).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={isFetching || refreshing}
              onClick={() => void handleRefresh()}
            >
              {refreshing || isFetching ? '刷新中…' : '强制刷新'}
            </button>
          </div>
          <ul className="import-repo-list import-repo-list--fill">
            {stars.map((s: StarRepo) => {
              const key = `${s.owner}/${s.repo}`;
              const isOn = selected.has(key);
              return (
                <li
                  key={key}
                  className={`import-repo-item ${isOn ? 'import-repo-item--selected' : ''}`}
                >
                  <label>
                    <input
                      type="checkbox"
                      disabled={s.already_imported}
                      checked={isOn}
                      onChange={() => toggle(key)}
                    />
                    <span className="font-mono">{key}</span>
                    {s.language && <span className="badge">{s.language}</span>}
                    {s.already_imported && <span className="badge">已导入</span>}
                    {s.description && (
                      <span className="import-repo-desc">{s.description}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="import-biz-footer">
            <span className="muted">已选 {selected.size}</span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importMutation.isPending || selected.size === 0}
              onClick={() => void handleImport()}
            >
              {importMutation.isPending
                ? '导入中…'
                : `导入选中 (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </ImportAgentModal>
  );
}
