import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { SelectReposEvent, StarRepo } from '@/api/types';
import { useCreateProject, useImportProjects } from '@/hooks/useProjects';
import { useUIStore } from '@/stores/uiStore';
import { validateGithubUrls } from '@/utils/validators';
import { ImportAgentModal } from './ImportAgentModal';
import { EmbedAgentChat } from '@/components/agent/EmbedAgentChat';

type ImportTab = 'paste' | 'search';

interface ImportUrlsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportUrlsModal({ open, onClose }: ImportUrlsModalProps) {
  const [tab, setTab] = useState<ImportTab>('paste');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const importMutation = useImportProjects();
  const createMutation = useCreateProject();
  const addToast = useUIStore((s) => s.addToast);

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['githubSearch', search],
    queryFn: async () => (await getApi().searchGithubRepos(search)).data,
    enabled: open && tab === 'search' && search.trim().length >= 2,
  });

  useEffect(() => {
    if (!open) {
      setText('');
      setSearch('');
      setSelected(new Set());
      setTab('paste');
    }
  }, [open]);

  if (!open) return null;

  const { valid, invalid } = validateGithubUrls(text);

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

  const importRepos = async (repos: Array<{ owner: string; repo: string; url: string }>) => {
    if (repos.length === 0) {
      addToast({ type: 'warning', message: '请选择要导入的项目' });
      return;
    }
    try {
      const result = await importMutation.mutateAsync(repos);
      addToast({ type: 'success', message: result.summary });
      onClose();
    } catch {
      let ok = 0;
      for (const v of repos) {
        try {
          await createMutation.mutateAsync({
            name: `${v.owner}/${v.repo}`,
            url: v.url,
          });
          ok += 1;
        } catch {
          /* skip dup */
        }
      }
      addToast({ type: ok > 0 ? 'success' : 'error', message: `成功 ${ok} 条` });
      if (ok > 0) onClose();
    }
  };

  const handlePasteImport = () =>
    void importRepos(valid.map((v) => ({ owner: v.owner, repo: v.repo, url: v.url })));

  const handleSearchImport = () => {
    const repos = searchResults
      .filter((s) => selected.has(`${s.owner}/${s.repo}`) && !s.already_imported)
      .map((s) => ({ owner: s.owner, repo: s.repo, url: s.url }));
    void importRepos(repos);
  };

  const availableKeys =
    tab === 'search'
      ? searchResults.map((s) => `${s.owner}/${s.repo}`)
      : valid.map((v) => v.name);

  return (
    <ImportAgentModal
      open={open}
      onClose={onClose}
      title="导入项目"
      subtitle="粘贴地址或搜索；右侧助手可自动勾选并说明"
      size="large"
      agentPanel={
        <EmbedAgentChat
          mode="import"
          title="导入助手"
          subtitle="智能勾选 · 说明清单"
          agentInitial="S"
          agentClassName="agent-scout"
          importContext={{
            mode: tab === 'search' ? 'search' : 'urls',
            available_repo_keys: availableKeys,
            selected_repo_keys: [...selected],
          }}
          onSelectRepos={applyAgentSelection}
        />
      }
    >
      <div className="import-biz-layout">
        <div className="import-tabs">
          <button
            type="button"
            className={`import-tab ${tab === 'paste' ? 'active' : ''}`}
            onClick={() => setTab('paste')}
          >
            粘贴地址
          </button>
          <button
            type="button"
            className={`import-tab ${tab === 'search' ? 'active' : ''}`}
            onClick={() => setTab('search')}
          >
            搜索导入
          </button>
        </div>

        {tab === 'paste' ? (
          <>
            <p className="import-hint">
              每行一个 URL，支持多个仓库（后端将解析并批量导入）
            </p>
            <textarea
              className="input textarea import-url-textarea"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
            <p className="import-hint">
              有效 {valid.length} 行，无效 {invalid.length} 行
            </p>
            <div className="import-biz-footer">
              <span className="muted">有效 {valid.length}</span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importMutation.isPending || valid.length === 0}
                onClick={handlePasteImport}
              >
                确认导入
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="graph-search import-search-field">
              <input
                placeholder="搜索 GitHub 仓库…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {isFetching && <p className="muted">搜索中…</p>}
            <ul className="import-repo-list import-repo-list--fill">
              {searchResults.map((s: StarRepo) => {
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
                onClick={handleSearchImport}
              >
                {importMutation.isPending
                  ? '导入中…'
                  : `导入选中 (${selected.size})`}
              </button>
            </div>
          </>
        )}
      </div>
    </ImportAgentModal>
  );
}
