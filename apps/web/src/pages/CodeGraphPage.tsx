import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraphScene, computeCameraTarget } from '@/components/graph-viz';
import type { CameraTarget, CodeGraphNode } from '@/components/graph-viz';
import { CodeGraphSidebar } from '@/components/code-graph/CodeGraphSidebar';
import { NodeDetailPanel } from '@/components/code-graph/NodeDetailPanel';
import { IndexStatusBar } from '@/components/code-graph/IndexStatusBar';
import { GraphGuidePanel } from '@/components/graph/GraphGuidePanel';
import { applyL1Layout, type L1LayoutMode } from '@/components/code-graph/l1Layout';
import {
  useCodeGraph,
  useIndexStatus,
  useTriggerIndex,
  useRefreshIndex,
} from '@/hooks/useCodeGraph';
import { useCodeGraphStore } from '@/stores/codeGraphStore';
import { getApi } from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DEFAULT_DISPLAY_SETTINGS } from '@/components/code-graph/density';

export function CodeGraphPage() {
  const { id } = useParams<{ id: string }>();

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
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<L1LayoutMode>('force');

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
    return applyL1Layout({ ...render, nodes, edges }, layoutMode);
  }, [
    render,
    nodeTypeFilter,
    edgeTypeFilter,
    showOnlyDead,
    hideTests,
    hideEntryPoints,
    layoutMode,
  ]);

  useEffect(() => {
    if (selectedPath) return;
    if (!searchQuery || !filtered) {
      if (!selectedPath) setHighlightedIds(null);
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
  }, [searchQuery, filtered, selectedPath]);

  useEffect(() => {
    if (!filtered?.nodes.length) return;
    if (selectedNode || selectedPath) return;
    const ids = new Set(filtered.nodes.map((n) => n.id));
    setCameraTarget(computeCameraTarget(filtered.nodes, ids));
  }, [filtered?.nodes.length, id, layoutMode, selectedNode, selectedPath]);

  const onSelectPath = (path: string, nodeIds: Set<number>) => {
    if (!path || nodeIds.size === 0) {
      setSelectedPath(null);
      setHighlightedIds(null);
      selectNode(null);
      return;
    }
    setSelectedPath(path);
    setHighlightedIds(nodeIds);
    if (filtered) {
      setCameraTarget(computeCameraTarget(filtered.nodes, nodeIds));
      const candidates = filtered.nodes.filter((n) => nodeIds.has(n.id));
      const prefer =
        candidates.find((n) => (n.kind || n.label) === 'File') ||
        candidates.find((n) => (n.file_path || '') === path) ||
        candidates[0];
      if (prefer) selectNode(prefer);
    }
  };

  const onNodeClick = (node: CodeGraphNode) => {
    selectNode(node);
    if (!filtered) return;
    const neigh = new Set<number>([node.id]);
    for (const e of filtered.edges) {
      if (e.source === node.id) neigh.add(e.target);
      if (e.target === node.id) neigh.add(e.source);
    }
    setHighlightedIds(neigh);
    setCameraTarget(computeCameraTarget(filtered.nodes, new Set([node.id])));
  };

  const projectName = projectQ.data?.data?.name || id;
  const statusSlot = (
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
  );

  return (
    <div className="code-graph-page">
      <div className="code-graph-stage">
        <CodeGraphSidebar
          data={filtered}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          statusSlot={statusSlot}
        />

        {!ready && (
          <div className="code-graph-empty glass-card glass-card--overview-inner">
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
          <div className="code-graph-empty glass-card glass-card--overview-inner">
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
            enableBloom
            display={{
              ...DEFAULT_DISPLAY_SETTINGS,
              edgeBrightness: 0.55,
              nodeGlow: 0.85,
              bloom: 0.22,
            }}
            onNodeClick={onNodeClick}
            onBackgroundClick={() => {
              selectNode(null);
              setHighlightedIds(null);
              setSelectedPath(null);
            }}
          />
        )}

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            allNodes={filtered?.nodes || []}
            allEdges={filtered?.edges || []}
            projectId={id!}
            onClose={() => selectNode(null)}
            onNavigate={onNodeClick}
          />
        )}

        <div className="code-graph-footer glass-card glass-card--overview-inner">
          <span className="stat-row">
            <span className="stat-dot" />
            <span className="stat-mono">
              {filtered
                ? `${filtered.nodes.length} 节点 / ${filtered.edges.length} 连线`
                : projectName}
            </span>
          </span>
        </div>
      </div>

      <GraphGuidePanel selectedNodeId={id ?? null} />
    </div>
  );
}
