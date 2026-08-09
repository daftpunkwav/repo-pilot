/**
 * L0 项目宇宙图 → 共享 GraphScene 渲染数据
 *
 * - 力导向：多球体（cluster），球心=高 foundation，半径∝数量，球可重叠
 * - 树状：堆叠圆，少上多大下，圆内 foundation 径向
 * - 径向：单大圆，高 hubness 近圆心
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

const FOUNDATION_GAMMA = 1.35;
const HUBNESS_DELTA = 1.2;
const FORCE_ITERS_CAP = 80;

export function hashId(s: string): number {
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
  foundation: number;
  hubness: number;
  clusterId: string;
  stars: number;
};

type WLink = { source: string; target: string; w: number };

export function clusterRadius(memberCount: number): number {
  return 36 + Math.sqrt(Math.max(1, memberCount)) * 22;
}

export function foundationRadius(localR: number, foundation: number): number {
  const f = Math.max(0, Math.min(1, foundation));
  return localR * (1 - f) ** FOUNDATION_GAMMA;
}

/**
 * 树状圆内径向：保留 foundation 远近，但钳制最小半径，避免全挤成圆心竖线。
 */
export function treeRingRadius(
  localR: number,
  foundation: number,
  memberCount: number,
): number {
  const raw = foundationRadius(localR, foundation);
  const minFrac = memberCount <= 2 ? 0.42 : 0.28;
  const minR = Math.max(18, localR * minFrac);
  return Math.max(minR, Math.min(localR * 0.98, raw));
}

export function hubnessRadius(maxR: number, hubness: number): number {
  const h = Math.max(0, Math.min(1, hubness));
  return maxR * (1 - h) ** HUBNESS_DELTA;
}

function edgeWeight(e: GraphEdge): number {
  const s = e.similarity;
  if (typeof s === 'number' && Number.isFinite(s)) return Math.max(0.05, Math.min(1, s));
  return 0.55;
}

/** 后端缺字段时的前端降级：阈值并查集社区 */
export function fallbackCommunities(
  nodeIds: string[],
  links: WLink[],
  minW = 0.35,
): Map<string, string> {
  const parent = new Map(nodeIds.map((id) => [id, id]));
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
  const maxMerge = Math.max(1, Math.floor(nodeIds.length * 0.85));
  let merges = 0;
  for (const e of sorted) {
    if (e.w < minW) break;
    if (merges >= maxMerge) break;
    if (find(e.source) === find(e.target)) continue;
    union(e.source, e.target);
    merges += 1;
  }
  const out = new Map<string, string>();
  for (const id of nodeIds) out.set(id, find(id));
  return out;
}

function fibonacciDir(i: number, n: number): { x: number; y: number; z: number } {
  const m = Math.max(1, n);
  const phi = Math.acos(1 - (2 * (i + 0.5)) / m);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
  };
}

/** 组内角向：强边邻居靠近（局部子簇） */
function localAngleBias(
  members: Vec[],
  links: WLink[],
  idx: number,
): number {
  const node = members[idx]!;
  const neighborW = new Map<string, number>();
  for (const e of links) {
    if (e.source === node.id) neighborW.set(e.target, e.w);
    else if (e.target === node.id) neighborW.set(e.source, e.w);
  }
  let angle = (idx / Math.max(1, members.length)) * Math.PI * 2;
  let pull = 0;
  let wSum = 0;
  members.forEach((m, j) => {
    const w = neighborW.get(m.id);
    if (!w || w < 0.4) return;
    const a = (j / Math.max(1, members.length)) * Math.PI * 2;
    pull += a * w;
    wSum += w;
  });
  if (wSum > 0) angle = 0.55 * angle + 0.45 * (pull / wSum);
  return angle;
}

export function forceLayout3d(nodes: Vec[], links: WLink[], iterations = 48) {
  const n = nodes.length;
  if (!n) return;

  const byComm = new Map<string, Vec[]>();
  for (const node of nodes) {
    if (!byComm.has(node.clusterId)) byComm.set(node.clusterId, []);
    byComm.get(node.clusterId)!.push(node);
  }
  const commKeys = [...byComm.keys()].sort((a, b) => {
    const na = byComm.get(a)!.length;
    const nb = byComm.get(b)!.length;
    if (nb !== na) return nb - na;
    return a.localeCompare(b);
  });

  const centers = new Map<string, { x: number; y: number; z: number; R: number }>();
  const spread = 160 + Math.sqrt(n) * 28;
  commKeys.forEach((key, i) => {
    const members = byComm.get(key)!;
    const R = clusterRadius(members.length);
    const dir = fibonacciDir(i, commKeys.length);
    /* 弱拉开球心，允许球体重叠 */
    const dist = spread * (0.35 + 0.12 * Math.min(commKeys.length, 12));
    centers.set(key, {
      x: dir.x * dist,
      y: dir.y * dist * 0.75,
      z: dir.z * dist,
      R,
    });
  });

  for (const [cid, members] of byComm) {
    const c = centers.get(cid)!;
    members
      .slice()
      .sort((a, b) => b.foundation - a.foundation || a.id.localeCompare(b.id))
      .forEach((node, i) => {
        const r = foundationRadius(c.R, node.foundation);
        const angle = localAngleBias(members, links, members.indexOf(node));
        const elev = ((hashId(node.id) % 100) / 100 - 0.5) * Math.PI * 0.55;
        const dir = fibonacciDir(i, members.length);
        /* 径向用 foundation，角向混入斐波那契 + 邻居偏置 */
        const mix = 0.65;
        const dx = mix * Math.cos(elev) * Math.cos(angle) + (1 - mix) * dir.x;
        const dy = mix * Math.sin(elev) + (1 - mix) * dir.y;
        const dz = mix * Math.cos(elev) * Math.sin(angle) + (1 - mix) * dir.z;
        const norm = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        node.x = c.x + (r * dx) / norm;
        node.y = c.y + (r * dy) / norm;
        node.z = c.z + (r * dz) / norm;
      });
  }

  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const repulsion = 900 + n * 8;
  for (let iter = 0; iter < iterations; iter += 1) {
    const fx = new Array(n).fill(0);
    const fy = new Array(n).fill(0);
    const fz = new Array(n).fill(0);

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const same = a.clusterId === b.clusterId;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(dist2);
        /* 组间排斥弱 → 球体可重叠 */
        const force = (same ? repulsion * 0.65 : repulsion * 0.28) / dist2;
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
      const same = a.clusterId === b.clusterId;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const restBase = same ? 48 : 110;
      const rest = restBase * (1.1 - Math.min(0.7, e.w * 0.8));
      const k = (same ? 0.028 : 0.01) + e.w * (same ? 0.06 : 0.02);
      const force = (dist - rest) * k;
      fx[i] += (force * dx) / dist;
      fy[i] += (force * dy) / dist;
      fz[i] += (force * dz) / dist;
      fx[j] -= (force * dx) / dist;
      fy[j] -= (force * dy) / dist;
      fz[j] -= (force * dz) / dist;
    }

    /* 社区向心 + 按 foundation 拉向球心（高 foundation 更强） */
    for (let i = 0; i < n; i += 1) {
      const node = nodes[i]!;
      const c = centers.get(node.clusterId)!;
      const pull = 0.01 + node.foundation * 0.028;
      fx[i] += (c.x - node.x) * pull;
      fy[i] += (c.y - node.y) * pull;
      fz[i] += (c.z - node.z) * pull;
      /* 极弱全局向心，避免唯一绝对中心 */
      fx[i] -= node.x * 0.0012;
      fy[i] -= node.y * 0.0012;
      fz[i] -= node.z * 0.0012;
      const clamp = (v: number) => Math.max(-6.5, Math.min(6.5, v));
      node.x += clamp(fx[i]);
      node.y += clamp(fy[i]);
      node.z += clamp(fz[i]);
    }
  }
}

/** 树状：按 cluster_size 升序上下堆叠圆，互不重叠；圆内均分角向错开 */
export function treeLayout3d(nodes: Vec[], links: WLink[]) {
  if (!nodes.length) return;
  const byComm = new Map<string, Vec[]>();
  for (const node of nodes) {
    if (!byComm.has(node.clusterId)) byComm.set(node.clusterId, []);
    byComm.get(node.clusterId)!.push(node);
  }
  const ordered = [...byComm.entries()].sort((a, b) => {
    if (a[1].length !== b[1].length) return a[1].length - b[1].length;
    return a[0].localeCompare(b[0]);
  });

  const gap = 56;
  let yCursor = 0;
  /* 树状圆略放大，避免侧视时挤成针 */
  const radii = ordered.map(([, members]) => clusterRadius(members.length) * 1.35);

  ordered.forEach(([, members], ci) => {
    const R = radii[ci]!;
    if (ci === 0) {
      yCursor = R;
    } else {
      yCursor += radii[ci - 1]! + R + gap;
    }
    const cy = yCursor;
    const m = members.length;
    const sorted = members
      .slice()
      .sort((a, b) => b.foundation - a.foundation || a.id.localeCompare(b.id));

    sorted.forEach((node, i) => {
      const r = treeRingRadius(R, node.foundation, m);
      /* 主：均分圆周错开；辅：强边邻居角向微调，避免全叠同一方位 */
      const evenly = (i / Math.max(1, m)) * Math.PI * 2;
      const bias = localAngleBias(members, links, members.indexOf(node));
      const angle = m <= 1 ? evenly + (hashId(node.id) % 360) * (Math.PI / 180) : evenly * 0.78 + bias * 0.22;
      /* 轻微倾斜出水平面，侧视也能看出圆环而不是一条缝 */
      const tilt = Math.sin(angle * 2 + ci) * Math.min(14, R * 0.08);
      node.x = r * Math.cos(angle);
      node.y = cy + tilt;
      node.z = r * Math.sin(angle);
    });
  });

  const minY = Math.min(...nodes.map((n) => n.y));
  if (minY < 40) {
    const shift = 40 - minY;
    for (const n of nodes) n.y += shift;
  }
}

/** 径向：单平面大圆，hubness 高 → 近圆心；角向按 cluster 分扇区 */
export function radialLayout3d(nodes: Vec[], _links: WLink[]) {
  if (!nodes.length) return;
  const clusters = [...new Set(nodes.map((n) => n.clusterId))].sort();
  const sector = (Math.PI * 2) / Math.max(1, clusters.length);
  const maxR = 120 + Math.sqrt(nodes.length) * 55;

  const byComm = new Map<string, Vec[]>();
  for (const node of nodes) {
    if (!byComm.has(node.clusterId)) byComm.set(node.clusterId, []);
    byComm.get(node.clusterId)!.push(node);
  }

  clusters.forEach((cid, ci) => {
    const members = byComm.get(cid)!;
    const base = ci * sector;
    members
      .slice()
      .sort((a, b) => b.hubness - a.hubness || a.id.localeCompare(b.id))
      .forEach((node, i) => {
        const r = hubnessRadius(maxR, node.hubness);
        const jitter =
          ((i + 0.5) / Math.max(1, members.length)) * sector * 0.85 - sector * 0.4;
        const angle = base + sector * 0.5 + jitter;
        node.x = r * Math.cos(angle);
        node.y = Math.sin(angle * 2 + ci) * 8;
        node.z = r * Math.sin(angle);
      });
  });
}

function resolveNodeMetrics(
  data: GraphData,
  links: WLink[],
): { foundation: Map<string, number>; hubness: Map<string, number>; cluster: Map<string, string> } {
  const foundation = new Map<string, number>();
  const hubness = new Map<string, number>();
  const cluster = new Map<string, string>();

  const hasBackendCluster = data.nodes.some((n) => n.cluster_id);
  const fallback = hasBackendCluster
    ? null
    : fallbackCommunities(
        data.nodes.map((n) => n.id),
        links,
      );

  const wdeg = new Map<string, number>();
  for (const e of links) {
    wdeg.set(e.source, (wdeg.get(e.source) || 0) + e.w);
    wdeg.set(e.target, (wdeg.get(e.target) || 0) + e.w);
  }
  const maxW = Math.max(1, ...wdeg.values(), 1);

  for (const n of data.nodes) {
    const cid = n.cluster_id || fallback?.get(n.id) || n.id;
    cluster.set(n.id, cid);
    const cent = (wdeg.get(n.id) || 0) / maxW;
    foundation.set(
      n.id,
      typeof n.foundation_score === 'number'
        ? n.foundation_score
        : Math.min(1, 0.25 + cent * 0.35 + Math.log1p(n.stars || 0) / 30),
    );
    hubness.set(
      n.id,
      typeof n.hubness === 'number'
        ? n.hubness
        : Math.min(1, cent * 0.7 + ((wdeg.get(n.id) || 0) > 0 ? 0.15 : 0)),
    );
  }
  return { foundation, hubness, cluster };
}

/** 将 L0 GraphData 转为 GraphScene 可用的 CodeGraphData */
export function projectGraphToScene(
  data: GraphData,
  layoutMode: GraphLayoutMode = 'force',
): CodeGraphData {
  const edgeSparse = data.edges.length < Math.max(8, data.nodes.length * 0.8);
  const sizeBoost = edgeSparse ? 1.55 : 1;

  const links: WLink[] = data.edges.map((e) => ({
    source: e.source,
    target: e.target,
    w: edgeWeight(e),
  }));
  const metrics = resolveNodeMetrics(data, links);

  const vecs: Vec[] = data.nodes.map((n) => ({
    id: n.id,
    x: 0,
    y: 0,
    z: 0,
    size: Math.max(
      2.8,
      (2.2 + Math.min(9, Math.log2((n.stars || 0) + 1) * 1.55)) * sizeBoost,
    ),
    foundation: metrics.foundation.get(n.id) ?? 0.3,
    hubness: metrics.hubness.get(n.id) ?? 0.2,
    clusterId: metrics.cluster.get(n.id) ?? n.id,
    stars: n.stars || 0,
  }));

  if (layoutMode === 'tree') treeLayout3d(vecs, links);
  else if (layoutMode === 'radial') radialLayout3d(vecs, links);
  else forceLayout3d(vecs, links, Math.min(FORCE_ITERS_CAP, 32 + Math.floor(vecs.length / 2)));

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
      /* 不再把度数伪装成关联度 */
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

/** 选中节点后，把相对关联度写入 scene 节点（布局不变） */
export function applySelectionRelatedness(
  scene: CodeGraphData,
  data: GraphData,
  selectedProjectId: string | null,
): CodeGraphData {
  if (!selectedProjectId) {
    return {
      ...scene,
      nodes: scene.nodes.map((n) => {
        const { relatedness: _, ...rest } = n as CodeGraphNode & { relatedness?: number };
        return { ...rest };
      }),
    };
  }
  const sim = new Map<string, number>();
  for (const e of data.edges) {
    if (e.source === selectedProjectId) sim.set(e.target, e.similarity);
    else if (e.target === selectedProjectId) sim.set(e.source, e.similarity);
  }
  return {
    ...scene,
    nodes: scene.nodes.map((n) => {
      const pid = n.qualified_name;
      if (!pid || pid === selectedProjectId) {
        const { relatedness: _, ...rest } = n as CodeGraphNode & { relatedness?: number };
        return { ...rest };
      }
      const s = sim.get(pid);
      if (s == null) {
        const { relatedness: _, ...rest } = n as CodeGraphNode & { relatedness?: number };
        return { ...rest };
      }
      return { ...n, relatedness: s };
    }),
  };
}

export function projectIdFromSceneNode(node: CodeGraphNode, data: GraphData): string | null {
  const hit = data.nodes.find((n) => hashId(n.id) === node.id);
  return hit?.id ?? null;
}

/** 测试用：树状布局各社区中心 Y 应随 size 升序 */
export function treeClusterOrderY(nodes: Vec[]): string[] {
  const by = new Map<string, { y: number; n: number }>();
  for (const node of nodes) {
    const cur = by.get(node.clusterId);
    if (!cur) by.set(node.clusterId, { y: node.y, n: 1 });
    else {
      cur.y += node.y;
      cur.n += 1;
    }
  }
  return [...by.entries()]
    .map(([id, v]) => ({ id, y: v.y / v.n, n: v.n }))
    .sort((a, b) => a.y - b.y)
    .map((x) => x.id);
}
