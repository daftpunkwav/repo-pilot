import { useMemo, useState } from 'react';
import type { CodeGraphData, CodeGraphNode } from './types';
import { useCodeGraphStore } from '@/stores/codeGraphStore';
import type { L1LayoutMode } from './l1Layout';
import { colorForLabel } from './colors';

interface Props {
  data: CodeGraphData | null;
  selectedPath: string | null;
  onSelectPath: (path: string, nodeIds: Set<number>) => void;
  layoutMode: L1LayoutMode;
  onLayoutModeChange: (m: L1LayoutMode) => void;
}

interface DirNode {
  name: string;
  fullPath: string;
  children: Map<string, DirNode>;
  nodeIds: Set<number>;
  directNodes: CodeGraphNode[];
}

/** 对齐 CBM Sidebar.buildFileTree */
function buildFileTree(nodes: CodeGraphNode[]): DirNode {
  const root: DirNode = {
    name: '/',
    fullPath: '',
    children: new Map(),
    nodeIds: new Set(),
    directNodes: [],
  };
  for (const node of nodes) {
    if (!node.file_path) continue;
    const parts = node.file_path.replace(/\\/g, '/').split('/');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!parts[i]) continue;
      let child = cur.children.get(parts[i]!);
      if (!child) {
        const prefix = parts.slice(0, i + 1).join('/');
        child = {
          name: parts[i]!,
          fullPath: prefix,
          children: new Map(),
          nodeIds: new Set(),
          directNodes: [],
        };
        cur.children.set(parts[i]!, child);
      }
      cur = child;
    }
    cur.directNodes.push(node);
  }
  const collect = (d: DirNode): Set<number> => {
    const ids = new Set<number>();
    for (const n of d.directNodes) ids.add(n.id);
    for (const c of d.children.values()) {
      for (const id of collect(c)) ids.add(id);
    }
    d.nodeIds = ids;
    return ids;
  };
  collect(root);
  return root;
}

function flattenSingleChild(dir: DirNode): DirNode {
  const children = new Map<string, DirNode>();
  for (const [key, child] of dir.children) {
    let flat = flattenSingleChild(child);
    while (flat.children.size === 1 && flat.directNodes.length === 0) {
      const entry = [...flat.children.entries()][0];
      if (!entry) break;
      const [sk, sc] = entry;
      flat = {
        ...sc,
        name: `${flat.name}/${sk}`,
        children: flattenSingleChild(sc).children,
      };
    }
    children.set(key, flat);
  }
  return { ...dir, children };
}

function TreeItem({
  dir,
  depth,
  onSelect,
  selectedPath,
}: {
  dir: DirNode;
  depth: number;
  onSelect: (path: string, ids: Set<number>) => void;
  selectedPath: string | null;
}) {
  /* 默认展开前两级，便于进入次级目录（对齐 CBM 可点击展开） */
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedPath === dir.fullPath;
  const sorted = useMemo(
    () => [...dir.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [dir.children],
  );
  /* 按文件路径聚合符号，点击文件高亮该文件全部节点 */
  const fileGroups = useMemo(() => {
    const m = new Map<string, CodeGraphNode[]>();
    for (const n of dir.directNodes) {
      const fp = (n.file_path || '').replace(/\\/g, '/') || `${dir.fullPath}/${n.name}`;
      if (!m.has(fp)) m.set(fp, []);
      m.get(fp)!.push(n);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dir.directNodes, dir.fullPath]);

  return (
    <div className="code-graph-tree__branch">
      <button
        type="button"
        className={`code-graph-tree__row${isSelected ? ' is-on' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          setExpanded((v) => !v);
          onSelect(dir.fullPath, dir.nodeIds);
        }}
      >
        <span className="code-graph-tree__caret" aria-hidden>
          {dir.children.size > 0 || fileGroups.length > 0 ? (expanded ? '▾' : '▸') : '·'}
        </span>
        <span className="code-graph-tree__name">{dir.name}</span>
        <span className="count">{dir.nodeIds.size}</span>
      </button>
      {expanded && (
        <>
          {sorted.map((c) => (
            <TreeItem
              key={c.fullPath}
              dir={c}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
          {fileGroups.map(([fp, symbols]) => {
            const fileName = fp.split('/').pop() || fp;
            const ids = new Set(symbols.map((s) => s.id));
            const fileSelected = selectedPath === fp;
            return (
              <div key={fp}>
                <button
                  type="button"
                  className={`code-graph-tree__file${fileSelected ? ' is-on' : ''}`}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
                  onClick={() => onSelect(fp, ids)}
                  title={fp}
                >
                  <span className="dot" style={{ background: symbols[0]?.color }} />
                  <span className="code-graph-tree__name mono">{fileName}</span>
                  <span className="count">{symbols.length}</span>
                </button>
                {fileSelected &&
                  symbols
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((gn) => (
                      <button
                        key={gn.id}
                        type="button"
                        className="code-graph-tree__symbol"
                        style={{ paddingLeft: `${(depth + 2) * 14 + 8}px` }}
                        onClick={() => onSelect(fp, new Set([gn.id]))}
                      >
                        <span className="dot" style={{ background: gn.color }} />
                        <span className="code-graph-tree__name mono">{gn.name}</span>
                        <span className="lbl">{gn.kind || gn.label}</span>
                      </button>
                    ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const LAYOUTS: { id: L1LayoutMode; label: string }[] = [
  { id: 'force', label: '力导向' },
  { id: 'tree', label: '树状' },
  { id: 'radial', label: '径向' },
];

export function CodeGraphSidebar({
  data,
  selectedPath,
  onSelectPath,
  layoutMode,
  onLayoutModeChange,
}: Props) {
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

  const [collapsed, setCollapsed] = useState(false);
  const [dirSearch, setDirSearch] = useState('');

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

  const tree = useMemo(
    () => flattenSingleChild(buildFileTree(data?.nodes || [])),
    [data],
  );
  const topLevel = useMemo(
    () => [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [tree],
  );

  const filteredFiles = useMemo(() => {
    if (!dirSearch.trim()) return null;
    const q = dirSearch.toLowerCase();
    return (data?.nodes || [])
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          (n.file_path || '').toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [data, dirSearch]);

  return (
    <aside className={`code-graph-sidebar glass-card glass-card--overview-inner${collapsed ? ' is-collapsed' : ''}`}>
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
          <section>
            <h3>布局</h3>
            <div className="code-graph-layout-switch" role="group" aria-label="L1 布局">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={layoutMode === l.id ? 'is-active' : ''}
                  onClick={() => onLayoutModeChange(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="code-graph-layout-hint">
              力导向=服务球 · 树状/径向=架构层平面
            </p>
          </section>

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
                      <span className="dot" style={{ background: colorForLabel(kind) }} />
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

          <section className="code-graph-dirs">
            <h3>目录</h3>
            <input
              className="code-graph-dir-search"
              value={dirSearch}
              onChange={(e) => setDirSearch(e.target.value)}
              placeholder="检索目录 / 文件…"
            />
            <div className="code-graph-tree">
              {filteredFiles ? (
                filteredFiles.length === 0 ? (
                  <p className="code-graph-tree__empty">无匹配</p>
                ) : (
                  filteredFiles.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="code-graph-tree__file"
                      onClick={() => onSelectPath(n.file_path || '', new Set([n.id]))}
                    >
                      <span className="dot" style={{ background: n.color }} />
                      <span className="code-graph-tree__name">{n.name}</span>
                    </button>
                  ))
                )
              ) : (
                topLevel.map((c) => (
                  <TreeItem
                    key={c.fullPath}
                    dir={c}
                    depth={0}
                    onSelect={onSelectPath}
                    selectedPath={selectedPath}
                  />
                ))
              )}
            </div>
            {selectedPath && (
              <button
                type="button"
                className="btn btn-ghost code-graph-tree__clear"
                onClick={() => onSelectPath('', new Set())}
              >
                清除目录选中
              </button>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
