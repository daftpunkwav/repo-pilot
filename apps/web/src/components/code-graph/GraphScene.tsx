import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { NodeCloud } from './NodeCloud';
import { EdgeLines } from './EdgeLines';
import { NodeLabels } from './NodeLabels';
import { NodeTooltipContent, NodeTooltipTracker } from './NodeTooltip';
import type { CodeGraphData, CodeGraphNode } from './types';
import { useIsDarkTheme } from '@/hooks/useTheme';
import {
  BASE_AUTO_ROTATE_SPEED,
  computeAutoRotateSpeed,
  IDLE_ROTATE_MS,
} from './graphAutoRotate';
import {
  DEFAULT_DISPLAY_SETTINGS,
  bloomIntensityScale,
  nodeBoostScale,
  type DisplaySettings,
} from './density';

const BASE_BLOOM_INTENSITY = 1.45;
export const GRAPH_CANVAS_DPR: [number, number] = [1, 1.5];
export const GRAPH_COMPOSER_MULTISAMPLING = 0;

export interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

function CameraAnimator({
  target,
  controlsRef,
}: {
  target: CameraTarget | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const targetRef = useRef<CameraTarget | null>(null);
  const progress = useRef(1);

  useEffect(() => {
    if (target) {
      targetRef.current = target;
      progress.current = 0;
    }
  }, [target]);

  useFrame(() => {
    if (!targetRef.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + 0.02);
    const t = 1 - Math.pow(1 - progress.current, 3);
    camera.position.lerp(targetRef.current.position, t * 0.08);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.lerp(targetRef.current.lookAt, t * 0.08);
      controls.update();
    } else {
      camera.lookAt(targetRef.current.lookAt);
    }
  });

  return null;
}

function IdleAutoRotate({
  controlsRef,
  idleMs = IDLE_ROTATE_MS,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  idleMs?: number;
}) {
  const { camera } = useThree();
  const lastInteraction = useRef(Date.now());
  const resetTimer = useCallback(() => {
    lastInteraction.current = Date.now();
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, [controlsRef]);

  useEffect(() => {
    const canvas = document.querySelector('.code-graph-canvas canvas');
    if (!canvas) return;
    canvas.addEventListener('pointerdown', resetTimer);
    canvas.addEventListener('wheel', resetTimer);
    return () => {
      canvas.removeEventListener('pointerdown', resetTimer);
      canvas.removeEventListener('wheel', resetTimer);
    };
  }, [resetTimer]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const idle = Date.now() - lastInteraction.current > idleMs;
    controls.autoRotate = idle;

    if (idle) {
      const dist = camera.position.distanceTo(controls.target);
      controls.autoRotateSpeed = computeAutoRotateSpeed(dist);
    }
  });

  return null;
}

interface GraphSceneProps {
  data: CodeGraphData;
  highlightedIds: Set<number> | null;
  cameraTarget: CameraTarget | null;
  showLabels: boolean;
  enableBloom: boolean;
  /** 空闲多久后自动旋转（毫秒） */
  idleRotateMs?: number;
  display?: DisplaySettings;
  onNodeClick: (node: CodeGraphNode) => void;
  onBackgroundClick?: () => void;
}

export function GraphScene({
  data,
  highlightedIds,
  cameraTarget,
  showLabels,
  enableBloom,
  idleRotateMs = IDLE_ROTATE_MS,
  display = DEFAULT_DISPLAY_SETTINGS,
  onNodeClick,
  onBackgroundClick,
}: GraphSceneProps) {
  const [hovered, setHovered] = useState<CodeGraphNode | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const isDark = useIsDarkTheme();

  const bg = useMemo(() => {
    if (isDark) return '#06090f';
    /* 浅色不设 scene 背景，透出 CSS 径向渐变 */
    return null;
  }, [isDark]);

  const useBloom = enableBloom && isDark;
  const nodeBoost = nodeBoostScale(data.nodes.length) * display.nodeGlow * 0.95;
  const bloomIntensity =
    BASE_BLOOM_INTENSITY *
    bloomIntensityScale(data.nodes.length) *
    display.bloom *
    (useBloom ? 0.75 : 1);

  // NodeCloud 期望 id:number；将 string 数字归一
  const nodes = useMemo(
    () =>
      data.nodes.map((n) => ({
        ...n,
        id: typeof n.id === 'string' ? Number(n.id) || hashId(n.id) : n.id,
      })),
    [data.nodes],
  );
  const edges = useMemo(
    () =>
      data.edges.map((e) => ({
        ...e,
        source: typeof e.source === 'string' ? Number(e.source) || hashId(String(e.source)) : e.source,
        target: typeof e.target === 'string' ? Number(e.target) || hashId(String(e.target)) : e.target,
        type: e.type || e.relation || 'RELATED',
      })),
    [data.edges],
  );

  return (
    <div className="code-graph-canvas" style={{ width: '100%', height: '100%' }}>
      <div className="code-graph-tooltip-layer" aria-hidden={!hovered}>
        {hovered && (
          <div
            ref={tooltipRef}
            className="code-graph-tooltip code-graph-tooltip--screen"
            style={{ visibility: 'hidden' }}
          >
            <NodeTooltipContent node={hovered} />
          </div>
        )}
      </div>
      <Canvas
        key={isDark ? 'graph-dark' : 'graph-light'}
        camera={{ position: [0, 0, 800], fov: 50, near: 0.1, far: 100000 }}
        style={{ background: isDark ? bg! : 'transparent' }}
        dpr={GRAPH_CANVAS_DPR}
        gl={{
          antialias: false,
          alpha: !isDark,
          powerPreference: 'high-performance',
        }}
        onCreated={isDark ? undefined : ({ gl }) => gl.setClearColor(0x000000, 0)}
        onPointerMissed={onBackgroundClick}
      >
        {isDark && bg && <color attach="background" args={[bg]} />}
        <ambientLight intensity={useBloom ? 0.5 : isDark ? 0.85 : 1.05} />
        <pointLight position={[500, 500, 500]} intensity={useBloom ? 0.6 : isDark ? 0.35 : 0.22} />
        <pointLight
          position={[-300, -200, -300]}
          intensity={useBloom ? 0.4 : isDark ? 0.2 : 0.14}
          color={useBloom ? '#6040ff' : isDark ? '#94a3b8' : '#e2e8f0'}
        />

        <EdgeLines
          nodes={nodes as never}
          edges={edges as never}
          highlightedIds={highlightedIds}
          brightness={display.edgeBrightness * 1.1}
          isDark={isDark}
        />
        <NodeCloud
          nodes={nodes as never}
          highlightedIds={highlightedIds}
          onHover={setHovered as never}
          onClick={onNodeClick as never}
          boost={nodeBoost}
          isDark={isDark}
        />
        {showLabels && (
          <NodeLabels nodes={nodes as never} highlightedIds={highlightedIds} />
        )}

        {hovered && (
          <NodeTooltipTracker node={hovered as never} tooltipRef={tooltipRef} />
        )}

        <CameraAnimator target={cameraTarget} controlsRef={controlsRef} />
        <IdleAutoRotate controlsRef={controlsRef} idleMs={idleRotateMs} />

        {useBloom && (
          <EffectComposer multisampling={GRAPH_COMPOSER_MULTISAMPLING}>
            <Bloom
              luminanceThreshold={nodes.length > 1200 ? 0.48 : 0.22}
              luminanceSmoothing={0.7}
              intensity={bloomIntensity * (nodes.length > 1200 ? 0.55 : 1)}
              mipmapBlur
              radius={nodes.length > 1200 ? 0.35 : 0.55}
            />
          </EffectComposer>
        )}

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.5}
          zoomSpeed={1.5}
          zoomToCursor
          minDistance={10}
          maxDistance={50000}
          autoRotateSpeed={BASE_AUTO_ROTATE_SPEED}
        />
      </Canvas>
    </div>
  );
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function computeCameraTarget(
  nodes: CodeGraphNode[],
  ids: Set<number>,
): CameraTarget | null {
  if (ids.size === 0) return null;
  let cx = 0,
    cy = 0,
    cz = 0,
    count = 0;
  for (const node of nodes) {
    const id = typeof node.id === 'string' ? Number(node.id) : node.id;
    if (ids.has(id as number)) {
      cx += node.x;
      cy += node.y;
      cz += node.z;
      count++;
    }
  }
  if (count === 0) return null;
  cx /= count;
  cy /= count;
  cz /= count;
  let maxDist = 0;
  for (const node of nodes) {
    const id = typeof node.id === 'string' ? Number(node.id) : node.id;
    if (ids.has(id as number)) {
      const d = Math.sqrt((node.x - cx) ** 2 + (node.y - cy) ** 2 + (node.z - cz) ** 2);
      if (d > maxDist) maxDist = d;
    }
  }
  const distance = Math.max(
    count <= 3 ? 180 : count <= 12 ? 220 : 160,
    Math.min(720, maxDist * (count <= 8 ? 2.1 : 2.6) + 80),
  );
  return {
    position: new THREE.Vector3(cx + distance * 0.2, cy + distance * 0.15, cz + distance),
    lookAt: new THREE.Vector3(cx, cy, cz),
  };
}
