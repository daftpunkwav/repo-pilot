/**
 * L0 3D 宇宙图视图 —— 复用 L1 GraphScene（CBM 风格点云 + OrbitControls）
 */
import { useMemo, useState } from 'react';
import type { GraphData, GraphNode } from '@/api/types';
import { GraphScene, computeCameraTarget } from '@/components/graph-viz';
import type { CameraTarget, CodeGraphNode } from '@/components/graph-viz';
import { useGraphStore } from '@/stores/graphStore';
import { projectGraphToScene, projectIdFromSceneNode } from './l0Layout3d';
import {
  DEFAULT_DISPLAY_SETTINGS,
  type DisplaySettings,
} from '@/components/code-graph/density';

interface UniverseGraphViewProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  onNodeDoubleClick: (node: GraphNode) => void;
}

const UNIVERSE_DISPLAY: DisplaySettings = {
  ...DEFAULT_DISPLAY_SETTINGS,
  edgeBrightness: 0.42,
  nodeGlow: 0.9,
  bloom: 0.18,
};

export function UniverseGraphView({
  data,
  onNodeClick,
  onNodeDoubleClick,
}: UniverseGraphViewProps) {
  const layoutMode = useGraphStore((s) => s.layoutMode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const highlightNodeId = useGraphStore((s) => s.highlightNodeId);

  const sceneData = useMemo(
    () => projectGraphToScene(data, layoutMode),
    [data, layoutMode],
  );

  const highlightedIds = useMemo(() => {
    const focus = new Set<string>();
    if (selectedNodeId) focus.add(selectedNodeId);
    if (highlightNodeId) focus.add(highlightNodeId);
    if (focus.size === 0) return null;

    const neighbor = new Set<string>(focus);
    for (const e of data.edges) {
      if (focus.has(e.source)) neighbor.add(e.target);
      if (focus.has(e.target)) neighbor.add(e.source);
    }

    const ids = new Set<number>();
    for (const n of data.nodes) {
      if (!neighbor.has(n.id)) continue;
      const hit = sceneData.nodes.find((s) => s.qualified_name === n.id);
      if (hit) ids.add(hit.id);
    }
    return ids.size > 0 ? ids : null;
  }, [data.edges, data.nodes, sceneData.nodes, selectedNodeId, highlightNodeId]);

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
        /* 始终显示仓库名；邻域高亮时标签优先聚焦 */
        showLabels
        enableBloom
        forceDarkBackground
        idleRotateMs={8_000}
        display={UNIVERSE_DISPLAY}
        onNodeClick={handleClick}
        onBackgroundClick={() => {
          setCameraTarget(null);
          useGraphStore.getState().selectNode(null);
        }}
      />
    </div>
  );
}
