/**
 * L0 项目宇宙图 → 共享 GraphScene 渲染数据
 * 布局算法对标引擎 force_layout_3d（球面初值 + 斥力/弹簧/向心）
 */
import type { GraphData, GraphNode } from '@/api/types';
import type { CodeGraphData, CodeGraphNode } from '@/components/code-graph/types';
import type { GraphLayoutMode } from '@/stores/graphStore';

const CATEGORY_COLORS: Record<string, string> = {
  frontend: '#007aff',
  backend: '#30d158',
  ai: '#ff3b30',
  data: '#ff9f0a',
  devops: '#5e5ce6',
  tool: '#6e6e73',
};

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function colorForProject(n: GraphNode): string {
  const key = (n.category_id || '').toLowerCase();
  for (const [k, c] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return c;
  }
  const palette = Object.values(CATEGORY_COLORS);
  return palette[hashId(n.id) % palette.length]!;
}

type Vec = { id: string; x: number; y: number; z: number; size: number; inCalls: number };

function forceLayout3d(nodes: Vec[], links: Array<{ source: string; target: string }>, iterations = 40) {
  const n = nodes.length;
  if (!n) return;
  for (let i = 0; i < n; i += 1) {
    const node = nodes[i]!;
    if (node.x === 0 && node.y === 0 && node.z === 0) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 80 + Math.min(n, 500) * 0.8;
      node.x = r * Math.sin(phi) * Math.cos(theta);
      node.y = r * Math.sin(phi) * Math.sin(theta);
      node.z = r * Math.cos(phi);
    }
  }
  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  for (let iter = 0; iter < iterations; iter += 1) {
    const fx = new Array(n).fill(0);
    const fy = new Array(n).fill(0);
    const fz = new Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(dist2);
        const force = 220 / dist2;
        fx[i] += (force * dx) / dist;
        fy[i] += (force * dy) / dist;
        fz[i] += (force * dz) / dist;
        fx[j] -= (force * dx) / dist;
        fy[j] -= (force * dy) / dist;
        fz[j] -= (force * dz) / dist;
      }
    }
    for (const e of links) {
      const i = idx.get(e.source);
      const j = idx.get(e.target);
      if (i == null || j == null) continue;
      const a = nodes[i]!;
      const b = nodes[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const force = (dist - 48) * 0.035;
      fx[i] += (force * dx) / dist;
      fy[i] += (force * dy) / dist;
      fz[i] += (force * dz) / dist;
      fx[j] -= (force * dx) / dist;
      fy[j] -= (force * dy) / dist;
      fz[j] -= (force * dz) / dist;
    }
    for (let i = 0; i < n; i += 1) {
      const node = nodes[i]!;
      fx[i] -= node.x * 0.012;
      fy[i] -= node.y * 0.012;
      fz[i] -= node.z * 0.012;
      const clamp = (v: number) => Math.max(-3.5, Math.min(3.5, v));
      node.x += clamp(fx[i]);
      node.y += clamp(fy[i]);
      node.z += clamp(fz[i]);
    }
  }
}

function treeLayout3d(nodes: Vec[], links: Array<{ source: string; target: string }>) {
  if (!nodes.length) return;
  const root = [...nodes].sort((a, b) => b.inCalls - a.inCalls)[0]!;
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of links) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  const depth = new Map<string, number>([[root.id, 0]]);
  const q = [root.id];
  while (q.length) {
    const cur = q.shift()!;
    for (const nb of adj.get(cur) || []) {
      if (depth.has(nb)) continue;
      depth.set(nb, (depth.get(cur) || 0) + 1);
      q.push(nb);
    }
  }
  const byDepth = new Map<number, Vec[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 1;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }
  const maxD = Math.max(...byDepth.keys(), 1);
  for (const [d, ring] of byDepth) {
    ring.forEach((n, i) => {
      const angle = (i / Math.max(1, ring.length)) * Math.PI * 2;
      const r = d === 0 ? 0 : 40 + d * 90;
      n.x = r * Math.cos(angle);
      n.y = d * 70 - maxD * 35;
      n.z = r * Math.sin(angle);
    });
  }
}

function radialLayout3d(nodes: Vec[], links: Array<{ source: string; target: string }>) {
  if (!nodes.length) return;
  const root = [...nodes].sort((a, b) => b.inCalls - a.inCalls)[0]!;
  const dist = new Map<string, number>([[root.id, 0]]);
  const q = [root.id];
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of links) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  while (q.length) {
    const cur = q.shift()!;
    for (const nb of adj.get(cur) || []) {
      if (dist.has(nb)) continue;
      dist.set(nb, (dist.get(cur) || 0) + 1);
      q.push(nb);
    }
  }
  const byRing = new Map<number, Vec[]>();
  for (const n of nodes) {
    const d = dist.get(n.id) ?? 1;
    if (!byRing.has(d)) byRing.set(d, []);
    byRing.get(d)!.push(n);
  }
  const maxRing = Math.max(1, byRing.size - 1);
  for (const [ring, ringNodes] of byRing) {
    const r = ring === 0 ? 0 : (ring / maxRing) * (90 + nodes.length * 1.2);
    ringNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, ringNodes.length)) * Math.PI * 2 - Math.PI / 2;
      n.x = r * Math.cos(angle);
      n.y = (ring - maxRing / 2) * 12;
      n.z = r * Math.sin(angle);
    });
  }
}

/** 将 L0 GraphData 转为 GraphScene 可用的 CodeGraphData */
export function projectGraphToScene(
  data: GraphData,
  layoutMode: GraphLayoutMode = 'force',
): CodeGraphData {
  const degree = new Map<string, number>();
  for (const e of data.edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }

  const vecs: Vec[] = data.nodes.map((n) => ({
    id: n.id,
    x: 0,
    y: 0,
    z: 0,
    size: 2 + Math.min(10, Math.log2((n.stars || 0) + 1) * 1.8),
    inCalls: degree.get(n.id) || 0,
  }));
  const links = data.edges.map((e) => ({ source: e.source, target: e.target }));

  if (layoutMode === 'tree') treeLayout3d(vecs, links);
  else if (layoutMode === 'radial') radialLayout3d(vecs, links);
  else forceLayout3d(vecs, links, Math.min(55, 20 + Math.floor(vecs.length / 3)));

  const pos = new Map(vecs.map((v) => [v.id, v]));
  const nodes: CodeGraphNode[] = data.nodes.map((n) => {
    const p = pos.get(n.id)!;
    return {
      id: hashId(n.id),
      x: p.x,
      y: p.y,
      z: p.z,
      label: 'Project',
      name: n.name,
      kind: 'Project',
      size: p.size,
      color: colorForProject(n),
      status: 'normal',
      in_calls: p.inCalls,
      qualified_name: n.id,
      file_path: n.language || undefined,
    };
  });

  const idMap = new Map(data.nodes.map((n) => [n.id, hashId(n.id)]));
  const edges = data.edges
    .map((e) => ({
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      type: e.edge_type || 'similarity',
      relation: e.edge_type || 'similarity',
    }))
    .filter((e) => e.source && e.target);

  return {
    nodes,
    edges,
    stats: { node_count: nodes.length, edge_count: edges.length },
  };
}

export function projectIdFromSceneNode(node: CodeGraphNode, data: GraphData): string | null {
  const hit = data.nodes.find((n) => hashId(n.id) === node.id);
  return hit?.id ?? null;
}
