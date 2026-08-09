/**
 * L0 3D 宇宙图视图 —— 复用 L1 GraphScene（CBM 风格点云 + OrbitControls）
 */
import { useMemo, useState } from 'react';
import type { GraphData, GraphNode } from '@/api/types';
import { GraphScene, computeCameraTarget } from '@/components/graph-viz';
import type { CameraTarget, CodeGraphNode } from '@/components/graph-viz';
import { useGraphStore } from '@/stores/graphStore';
import { useTheme } from '@/hooks/useTheme';
import { projectGraphToScene, projectIdFromSceneNode } from './l0Layout3d';

interface UniverseGraphViewProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  onNodeDoubleClick: (node: GraphNode) => void;
}

export function UniverseGraphView({
  data,
  onNodeClick,
  onNodeDoubleClick,
}: UniverseGraphViewProps) {
  const layoutMode = useGraphStore((s) => s.layoutMode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const highlightNodeId = useGraphStore((s) => s.highlightNodeId);
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const sceneData = useMemo(
    () => projectGraphToScene(data, layoutMode),
    [data, layoutMode],
  );

  const highlightedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const n of data.nodes) {
      if (n.id === selectedNodeId || n.id === highlightNodeId) {
        const hit = sceneData.nodes.find((s) => s.qualified_name === n.id);
        if (hit) ids.add(hit.id);
      }
    }
    return ids.size > 0 ? ids : null;
  }, [data.nodes, sceneData.nodes, selectedNodeId, highlightNodeId]);

  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [lastClickAt, setLastClickAt] = useState(0);

  const handleClick = (node: CodeGraphNode) => {
    const projectId = projectIdFromSceneNode(node, data);
    const project = data.nodes.find((n) => n.id === projectId);
    if (!project) return;
    const now = Date.now();
    if (now - lastClickAt < 320) {
      onNodeDoubleClick(project);
      setLastClickAt(0);
      return;
    }
    setLastClickAt(now);
    onNodeClick(project);
    setCameraTarget(computeCameraTarget(sceneData.nodes, new Set([node.id])));
  };

  return (
    <div className="universe-graph-3d" style={{ position: 'absolute', inset: 0 }}>
      <GraphScene
        data={sceneData}
        highlightedIds={highlightedIds}
        cameraTarget={cameraTarget}
        /* 全量标签在 50+ 节点时必然叠字；名称靠 Tooltip / 详情面板 */
        showLabels={false}
        enableBloom={isDark}
        onNodeClick={handleClick}
        onBackgroundClick={() => setCameraTarget(null)}
      />
    </div>
  );
}
