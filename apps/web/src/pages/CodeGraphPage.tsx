import { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraphScene, computeCameraTarget } from '@/components/graph-viz';
import type { CameraTarget, CodeGraphNode } from '@/components/graph-viz';
import { CodeGraphSidebar } from '@/components/code-graph/CodeGraphSidebar';
import { NodeDetailPanel } from '@/components/code-graph/NodeDetailPanel';
import { IndexStatusBar } from '@/components/code-graph/IndexStatusBar';
import {
  useCodeGraph,
  useIndexStatus,
  useTriggerIndex,
  useRefreshIndex,
} from '@/hooks/useCodeGraph';
import { useCodeGraphStore } from '@/stores/codeGraphStore';
import { useTheme } from '@/hooks/useTheme';
import { getApi } from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function CodeGraphPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const {
    showLabels,
    nodeBudget,
    selectedNode,
    searchQuery,
    nodeTypeFilter,
    edgeTypeFilter,
    showOnlyDead,
    hideTests,
    hideEntryPoints,
    selectNode,
    setNodeBudget,
  } = useCodeGraphStore();

  const statusQ = useIndexStatus(id);
  const status = statusQ.data?.data;
  const ready = status?.status === 'READY';

  const graphQ = useCodeGraph(id, { maxNodes: nodeBudget, enabled: Boolean(ready) });
  const trigger = useTriggerIndex(id);
  const refresh = useRefreshIndex(id);

  const projectQ = useQuery({
    queryKey: ['project', id],
    enabled: Boolean(id),
    queryFn: () => getApi().getProject(id!),
  });

  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<number> | null>(null);

  const render = graphQ.data?.render;
  const filtered = useMemo(() => {
    if (!render) return null;
    let nodes: CodeGraphNode[] = render.nodes;
    if (nodeTypeFilter) {
      nodes = nodes.filter((n) => nodeTypeFilter.has(n.kind || n.label));
    }
    if (showOnlyDead) nodes = nodes.filter((n) => n.status === 'dead');
    if (hideTests) nodes = nodes.filter((n) => n.status !== 'test');
    if (hideEntryPoints) nodes = nodes.filter((n) => n.status !== 'entry');
    const ids = new Set(nodes.map((n) => n.id));
    let edges = render.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    if (edgeTypeFilter) {
      edges = edges.filter((e) => edgeTypeFilter.has(e.type || e.relation || ''));
    }
    return { ...render, nodes, edges };
  }, [render, nodeTypeFilter, edgeTypeFilter, showOnlyDead, hideTests, hideEntryPoints]);

  useEffect(() => {
    if (!searchQuery || !filtered) {
      setHighlightedIds(null);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = filtered.nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.qualified_name || '').toLowerCase().includes(q) ||
        (n.file_path || '').toLowerCase().includes(q),
    );
    const ids = new Set(matches.map((n) => n.id));
    setHighlightedIds(ids.size ? ids : null);
    if (ids.size) setCameraTarget(computeCameraTarget(filtered.nodes, ids));
  }, [searchQuery, filtered]);

  /** 首次有节点时框住全图，避免相机过远导致「小白点」 */
  useEffect(() => {
    if (!filtered?.nodes.length) return;
    const ids = new Set(filtered.nodes.map((n) => n.id));
    setCameraTarget(computeCameraTarget(filtered.nodes, ids));
  }, [filtered?.nodes.length, id]);

  const onNodeClick = (node: CodeGraphNode) => {
    selectNode(node);
    if (filtered) setCameraTarget(computeCameraTarget(filtered.nodes, new Set([node.id])));
  };

  const projectName = projectQ.data?.data?.name || id;

  return (
    <div className="code-graph-page">
      <header className="code-graph-breadcrumb glass-card glass-card--panel">
        <Link to="/graph">图谱</Link>
        <span aria-hidden>/</span>
        <span>{projectName}</span>
        <span className="code-graph-breadcrumb__hint">代码知识图谱</span>
      </header>

      <IndexStatusBar
        status={status}
        loading={statusQ.isLoading || trigger.isPending || refresh.isPending}
        onIndex={(mode) => trigger.mutate(mode)}
        onRefresh={(mode) => refresh.mutate(mode)}
        nodeBudget={nodeBudget}
        onBudgetChange={setNodeBudget}
        totalNodes={filtered?.total_nodes ?? status?.node_count ?? undefined}
        shownNodes={filtered?.nodes.length}
        shownEdges={filtered?.edges.length}
      />

      <div className="code-graph-layout">
        <CodeGraphSidebar data={filtered} projectId={id!} />

        <main className="code-graph-stage">
          {!ready && (
            <div className="code-graph-empty glass-card">
              <h2>尚未构建代码图谱</h2>
              <p>
                {status?.status === 'CLONE_FAILED' || status?.status === 'INDEX_FAILED'
                  ? status.error || '克隆或索引失败，请重试'
                  : status && ['QUEUED', 'CLONING', 'INDEXING'].includes(status.status)
                    ? `正在处理：${status.status}`
                    : '请先浅克隆 GitHub 仓库并构建代码图谱（自研引擎，无需第三方进程）。'}
              </p>
              {(!status ||
                ['NONE', 'CLONE_FAILED', 'INDEX_FAILED', 'STALE'].includes(status.status)) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => trigger.mutate('moderate')}
                  disabled={trigger.isPending}
                >
                  开始索引
                </button>
              )}
            </div>
          )}

          {ready && graphQ.isLoading && <LoadingSpinner />}
          {ready && graphQ.isError && (
            <div className="code-graph-empty glass-card">
              <h2>加载代码图谱失败</h2>
              <p>{(graphQ.error as Error)?.message || '无法获取布局数据'}</p>
            </div>
          )}
          {ready && filtered && (
            <GraphScene
              data={filtered}
              highlightedIds={highlightedIds}
              cameraTarget={cameraTarget}
              showLabels={showLabels}
              enableBloom={isDark}
              onNodeClick={onNodeClick}
              onBackgroundClick={() => selectNode(null)}
            />
          )}
        </main>

        <NodeDetailPanel node={selectedNode} projectId={id!} onClose={() => selectNode(null)} />
      </div>
    </div>
  );
}
