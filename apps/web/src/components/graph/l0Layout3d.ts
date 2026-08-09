/**
 * L0 项目宇宙图 → 共享 GraphScene 渲染数据
 * 力导向：高相似度强吸引 → 聚成球体；树/径向：按星标×度选根，根在上/中心
 */
import type { GraphData, GraphEdge, GraphNode } from '@/api/types';
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

type Vec = {
  id: string;
  x: number;
  y: number;
  z: number;
  size: number;
  inCalls: number;
  stars: number;
};

type WLink = { source: string; target: string; w: number };

function pickRoot(nodes: Vec[]): Vec {
  /* 星标 × log(1+度)：避免单纯「连接最多」把某仓永远钉在树底 */
  return [...nodes].sort((a, b) => {
    const sa = Math.log1p(a.stars) * (1 + Math.log1p(a.inCalls));
    const sb = Math.log1p(b.stars) * (1 + Math.log1p(b.inCalls));
    if (sb !== sa) return sb - sa;
    return a.id.localeCompare(b.id);
  })[0]!;
}

/** 简易社区：按最强边贪心并查集，形成「球体」分组 */
function communityOf(nodes: Vec[], links: WLink[]): Map<string, string> {
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  const find = (x: string): string => {
    let p = parent.get(x)!;
    while (p !== parent.get(p)) p = parent.get(p)!;
    parent.set(x, p);
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  const sorted = [...links].sort((a, b) => b.w - a.w);
  const maxMerge = Math.max(1, Math.floor(nodes.length * 0.85));
  let merges = 0;
  for (const e of sorted) {
    if (e.w < 0.35) break;
    if (merges >= maxMerge) break;
    if (find(e.source) === find(e.target)) continue;
    union(e.source, e.target);
    merges += 1;
  }
  const out = new Map<string, string>();
  for (const n of nodes) out.set(n.id, find(n.id));
  return out;
}

function forceLayout3d(nodes: Vec[], links: WLink[], iterations = 48) {
  const n = nodes.length;
  if (!n) return;
  const communities = communityOf(nodes, links);
  const commKeys = [...new Set(communities.values())];
  const baseR = 220 + Math.sqrt(n) * 42;
  /* 社区球心先铺在大球面上 */
  const centers = new Map<string, { x: number; y: number; z: number }>();
  commKeys.forEach((key, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(1, commKeys.length));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const R = baseR * (0.55 + Math.min(1.2, Math.sqrt(commKeys.length) * 0.22));
    centers.set(key, {
      x: R * Math.sin(phi) * Math.cos(theta),
      y: R * Math.sin(phi) * Math.sin(theta) * 0.7,
      z: R * Math.cos(phi),
    });
  });
  /* 组内斐波那契球 */
  const byComm = new Map<string, Vec[]>();
  for (const node of nodes) {
    const c = communities.get(node.id)!;
    if (!byComm.has(c)) byComm.set(c, []);
    byComm.get(c)!.push(node);
  }
  for (const [cid, members] of byComm) {
    const c = centers.get(cid)!;
    const localR = 28 + Math.sqrt(members.length) * 14;
    members.forEach((node, i) => {
      const m = members.length;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / m);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      node.x = c.x + localR * Math.sin(phi) * Math.cos(theta);
      node.y = c.y + localR * Math.sin(phi) * Math.sin(theta);
      node.z = c.z + localR * Math.cos(phi);
    });
  }

  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const restBase = 72 + Math.min(40, Math.sqrt(n) * 4);
  const repulsion = 1400 + n * 12;
  for (let iter = 0; iter < iterations; iter += 1) {
    const fx = new Array(n).fill(0);
    const fy = new Array(n).fill(0);
    const fz = new Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const same = communities.get(a.id) === communities.get(b.id);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(dist2);
        const force = (same ? repulsion * 0.55 : repulsion) / dist2;
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
      /* 高权边更短、更强 → 相似项聚球 */
      const rest = restBase * (1.15 - Math.min(0.75, e.w * 0.85));
      const k = 0.018 + e.w * 0.055;
      const force = (dist - rest) * k;
      fx[i] += (force * dx) / dist;
      fy[i] += (force * dy) / dist;
      fz[i] += (force * dz) / dist;
      fx[j] -= (force * dx) / dist;
      fy[j] -= (force * dy) / dist;
      fz[j] -= (force * dz) / dist;
    }
    /* 社区向心 */
    for (let i = 0; i < n; i += 1) {
      const node = nodes[i]!;
      const c = centers.get(communities.get(node.id)!)!;
      fx[i] += (c.x - node.x) * 0.012;
      fy[i] += (c.y - node.y) * 0.012;
      fz[i] += (c.z - node.z) * 0.012;
      fx[i] -= node.x * 0.0025;
      fy[i] -= node.y * 0.0025;
      fz[i] -= node.z * 0.0025;
      const clamp = (v: number) => Math.max(-7.5, Math.min(7.5, v));
      node.x += clamp(fx[i]);
      node.y += clamp(fy[i]);
      node.z += clamp(fz[i]);
    }
  }
}

function treeLayout3d(nodes: Vec[], links: WLink[]) {
  if (!nodes.length) return;
  const root = pickRoot(nodes);
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
    /* 根在上（+Y），子层向下展开；层内按社区聚类角距 */
    ring.sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id));
    ring.forEach((n, i) => {
      const angle = (i / Math.max(1, ring.length)) * Math.PI * 2;
      const r = d === 0 ? 0 : 70 + d * (130 + Math.sqrt(ring.length) * 10);
      n.x = r * Math.cos(angle);
      n.y = (maxD - d) * 110; /* 根最高 */
      n.z = r * Math.sin(angle);
    });
  }
}

function radialLayout3d(nodes: Vec[], links: WLink[]) {
  if (!nodes.length) return;
  const root = pickRoot(nodes);
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
  for (const [ring, ringNodes] of byRing) {
    const count = Math.max(1, ringNodes.length);
    ringNodes.sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id));
    const r =
      ring === 0
        ? 0
        : 90 + ring * (100 + Math.sqrt(count) * 16) + Math.min(count, 40) * 2.5;
    ringNodes.forEach((n, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const clusterBump = Math.sin(angle * 3 + ring) * (12 + count * 0.4);
      n.x = r * Math.cos(angle);
      n.y = clusterBump * 0.35;
      n.z = r * Math.sin(angle);
    });
  }
}

function edgeWeight(e: GraphEdge): number {
  const s = e.similarity;
  if (typeof s === 'number' && Number.isFinite(s)) return Math.max(0.05, Math.min(1, s));
  return 0.55;
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

  /* 边少（阈值高）时放大节点，避免「点太小」 */
  const edgeSparse = data.edges.length < Math.max(8, data.nodes.length * 0.8);
  const sizeBoost = edgeSparse ? 1.55 : 1;

  const vecs: Vec[] = data.nodes.map((n) => ({
    id: n.id,
    x: 0,
    y: 0,
    z: 0,
    size: Math.max(
      2.8,
      (2.2 + Math.min(9, Math.log2((n.stars || 0) + 1) * 1.55)) * sizeBoost,
    ),
    inCalls: degree.get(n.id) || 0,
    stars: n.stars || 0,
  }));
  const links: WLink[] = data.edges.map((e) => ({
    source: e.source,
    target: e.target,
    w: edgeWeight(e),
  }));

  if (layoutMode === 'tree') treeLayout3d(vecs, links);
  else if (layoutMode === 'radial') radialLayout3d(vecs, links);
  else forceLayout3d(vecs, links, Math.min(80, 32 + Math.floor(vecs.length / 2)));

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
      type: e.edge_type || e.relation || 'similarity',
      relation: e.edge_type || e.relation || 'similarity',
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
