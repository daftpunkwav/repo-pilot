import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StarRepo } from '@/api/types';
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
  const { data: stars, isLoading } = useGithubStars();
  const importMutation = useImportProjects();
  const addToast = useUIStore((s) => s.addToast);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const repoKeys = useMemo(
    () => (stars ?? []).map((s) => `${s.owner}/${s.repo}`),
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
    <ImportAgentModal
      open={open}
      onClose={onClose}
      title="同步 GitHub Stars"
      subtitle="左侧勾选要导入的仓库，右侧可让导入助手推荐"
      agentPanel={
        <EmbedAgentChat
          mode="import"
          title="导入助手"
          subtitle="根据描述推荐 Stars"
          agentInitial="I"
          agentClassName="agent-curator"
          importContext={{
            mode: 'stars',
            available_repo_keys: repoKeys,
            selected_repo_keys: [...selected],
          }}
        />
      }
    >
      {!githubBound ? (
        <div className="import-biz-empty">
          <p>请先在设置中绑定 GitHub 账号。</p>
          <Link to="/settings" className="btn btn-primary" onClick={onClose}>
            去设置绑定
          </Link>
        </div>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="import-biz-toolbar">
            <span className="muted">{(stars ?? []).length} 个 Star 仓库</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={importMutation.isPending}
              onClick={() => void handleImport()}
            >
              导入选中 ({selected.size})
            </button>
          </div>
          <ul className="import-repo-list">
            {(stars ?? []).map((s: StarRepo) => {
              const key = `${s.owner}/${s.repo}`;
              return (
                <li key={key} className="import-repo-item">
                  <label>
                    <input
                      type="checkbox"
                      disabled={s.already_imported}
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                    />
                    <span className="font-mono">{key}</span>
                    {s.description && <span className="import-repo-desc">{s.description}</span>}
                    {s.already_imported && <span className="badge">已导入</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ImportAgentModal>
  );
}
