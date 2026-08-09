import { useMemo } from 'react';
import type { CodeGraphData } from './types';
import { useCodeGraphStore } from '@/stores/codeGraphStore';
import { getApi } from '@/api/client';
import { useState } from 'react';

interface Props {
  data: CodeGraphData | null;
  projectId: string;
}

export function CodeGraphSidebar({ data, projectId }: Props) {
  const {
    showLabels,
    setShowLabels,
    showOnlyDead,
    setShowOnlyDead,
    colorByStatus,
    setColorByStatus,
    hideTests,
    setHideTests,
    hideEntryPoints,
    setHideEntryPoints,
    toggleNodeType,
    nodeTypeFilter,
    searchQuery,
    setSearchQuery,
  } = useCodeGraphStore();

  const [dirFilter, setDirFilter] = useState<string | null>(null);
  const [arch, setArch] = useState<Record<string, unknown> | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const kindCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of data?.nodes || []) {
      const k = n.kind || n.label;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const deadCount = useMemo(
    () => (data?.nodes || []).filter((n) => n.status === 'dead').length,
    [data],
  );

  const dirs = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of data?.nodes || []) {
      const fp = n.file_path || '';
      const top = fp.split(/[/\\]/).filter(Boolean)[0];
      if (top) m.set(top, (m.get(top) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const loadArch = async () => {
    try {
      const res = await getApi().getCodeArchitecture(projectId);
      setArch(res.data);
    } catch {
      setArch(null);
    }
  };

  return (
    <aside className={`code-graph-sidebar glass-card glass-card--panel${collapsed ? ' is-collapsed' : ''}`}>
      <div className="code-graph-sidebar__chrome">
        <span>{collapsed ? '滤' : '过滤'}</span>
        <button
          type="button"
          className="code-graph-sidebar__toggle"
          title={collapsed ? '展开侧栏' : '折叠侧栏'}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '⟩' : '⟨'}
        </button>
      </div>
      {!collapsed && (
        <>
      <label className="code-graph-search">
        <span>搜索</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="符号 / 路径"
        />
      </label>

      <section>
        <h3>节点类型</h3>
        <ul className="code-graph-filter-list">
          {kindCounts.map(([kind, count]) => {
            const on = !nodeTypeFilter || nodeTypeFilter.has(kind);
            return (
              <li key={kind}>
                <button
                  type="button"
                  className={on ? 'is-on' : ''}
                  onClick={() => toggleNodeType(kind)}
                >
                  <span className="dot" data-kind={kind} />
                  {kind}
                  <span className="count">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>死代码 · {deadCount}</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={colorByStatus}
            onChange={(e) => setColorByStatus(e.target.checked)}
          />
          按状态着色
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showOnlyDead}
            onChange={(e) => setShowOnlyDead(e.target.checked)}
          />
          仅显示死代码
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={hideEntryPoints}
            onChange={(e) => setHideEntryPoints(e.target.checked)}
          />
          隐藏入口点
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={hideTests}
            onChange={(e) => setHideTests(e.target.checked)}
          />
          隐藏测试
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          显示标签
        </label>
      </section>

      <section>
        <h3>目录</h3>
        <ul className="code-graph-filter-list">
          {dirs.map(([d, c]) => (
            <li key={d}>
              <button
                type="button"
                className={dirFilter === d ? 'is-on' : ''}
                onClick={() => {
                  setDirFilter(dirFilter === d ? null : d);
                  setSearchQuery(dirFilter === d ? '' : d);
                }}
              >
                {d}
                <span className="count">{c}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>架构</h3>
        <button type="button" className="btn btn-ghost" onClick={loadArch}>
          加载 clusters / layers
        </button>
        {arch && (
          <pre className="code-graph-arch-preview">
            {JSON.stringify(
              {
                clusters: (arch.clusters as unknown[])?.slice?.(0, 5) ?? arch.clusters,
                layers: arch.layers,
              },
              null,
              2,
            ).slice(0, 1200)}
          </pre>
        )}
      </section>
        </>
      )}
    </aside>
  );
}
