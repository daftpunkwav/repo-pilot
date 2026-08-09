/**
 * 节点预算步进与 L1 过滤辅助
 */
import { describe, expect, it } from 'vitest';

function clampNodeBudget(value: number, step = 5000, max = 10_000_000): number {
  if (!Number.isFinite(value)) return step;
  const stepped = Math.round(value / step) * step;
  if (stepped < step) return step;
  if (stepped > max) return max;
  return stepped;
}

function filterNodes(
  nodes: Array<{ kind: string; status?: string }>,
  opts: { kinds?: Set<string> | null; onlyDead?: boolean; hideTests?: boolean },
) {
  let out = nodes;
  if (opts.kinds) out = out.filter((n) => opts.kinds!.has(n.kind));
  if (opts.onlyDead) out = out.filter((n) => n.status === 'dead');
  if (opts.hideTests) out = out.filter((n) => n.status !== 'test');
  return out;
}

describe('code graph helpers', () => {
  it('clamps node budget to 5k steps', () => {
    expect(clampNodeBudget(0)).toBe(5000);
    expect(clampNodeBudget(7500)).toBe(5000);
    expect(clampNodeBudget(9000)).toBe(10000);
  });

  it('filters by kind and dead/test flags', () => {
    const nodes = [
      { kind: 'Function', status: 'normal' },
      { kind: 'Class', status: 'dead' },
      { kind: 'Function', status: 'test' },
    ];
    expect(filterNodes(nodes, { kinds: new Set(['Function']) })).toHaveLength(2);
    expect(filterNodes(nodes, { onlyDead: true })).toHaveLength(1);
    expect(filterNodes(nodes, { hideTests: true })).toHaveLength(2);
  });
});

describe('toRenderGraph id mapping', () => {
  it('maps string node ids so edges survive', async () => {
    const { toRenderGraph } = await import('./types');
    const g = toRenderGraph({
      nodes: [
        { id: 'n_aaa', name: 'a', kind: 'File', x: 1, y: 2, z: 3, color: '' },
        { id: 'n_bbb', name: 'b', label: 'Function', x: 0, y: 0, z: 0 },
      ],
      edges: [{ source: 'n_aaa', target: 'n_bbb', relation: 'CONTAINS' }],
    });
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]!.source).toBe(g.nodes[0]!.id);
    expect(g.edges[0]!.target).toBe(g.nodes[1]!.id);
    expect(g.nodes[0]!.color).toMatch(/^#/);
    expect(g.nodes[1]!.color).toMatch(/^#/);
  });
});
