/**
 * L0 布局纯函数单测：半径单调、树状 Y 序、径向 hubness 反相关
 */
import { describe, expect, it } from 'vitest';
import {
  clusterRadius,
  fallbackCommunities,
  forceLayout3d,
  foundationRadius,
  hubnessRadius,
  radialLayout3d,
  treeClusterOrderY,
  treeLayout3d,
  treeRingRadius,
} from '@/components/graph/l0Layout3d';

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

function makeVec(
  id: string,
  clusterId: string,
  foundation: number,
  hubness: number,
): Vec {
  return {
    id,
    x: 0,
    y: 0,
    z: 0,
    size: 3,
    foundation,
    hubness,
    clusterId,
    stars: 100,
  };
}

describe('l0 layout metrics', () => {
  it('clusterRadius grows with member count', () => {
    expect(clusterRadius(100)).toBeGreaterThan(clusterRadius(5));
    expect(clusterRadius(5)).toBeGreaterThan(clusterRadius(1));
  });

  it('foundationRadius: higher foundation → closer to center', () => {
    const R = 100;
    expect(foundationRadius(R, 0.9)).toBeLessThan(foundationRadius(R, 0.2));
  });

  it('treeRingRadius enforces a visible minimum', () => {
    const R = 100;
    const nearCore = treeRingRadius(R, 0.99, 8);
    expect(nearCore).toBeGreaterThanOrEqual(R * 0.28);
    expect(nearCore).toBeLessThan(treeRingRadius(R, 0.1, 8));
  });

  it('hubnessRadius: higher hubness → closer to center', () => {
    const R = 200;
    expect(hubnessRadius(R, 0.95)).toBeLessThan(hubnessRadius(R, 0.1));
  });
});

describe('l0 tree layout', () => {
  it('orders smaller clusters above larger ones (higher Y for larger)', () => {
    const nodes = [
      makeVec('a1', 'small', 0.8, 0.5),
      makeVec('a2', 'small', 0.3, 0.4),
      makeVec('a3', 'small', 0.2, 0.3),
      ...Array.from({ length: 8 }, (_, i) =>
        makeVec(`b${i}`, 'large', 0.5, 0.4),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeVec(`m${i}`, 'mid', 0.5, 0.4),
      ),
    ];
    treeLayout3d(nodes, []);
    const order = treeClusterOrderY(nodes);
    expect(order[0]).toBe('small');
    expect(order[order.length - 1]).toBe('large');

    const smallY = nodes.filter((n) => n.clusterId === 'small').reduce((s, n) => s + n.y, 0) / 3;
    const largeY = nodes.filter((n) => n.clusterId === 'large').reduce((s, n) => s + n.y, 0) / 8;
    expect(largeY).toBeGreaterThan(smallY);
  });

  it('spreads nodes on each ring instead of a vertical line', () => {
    const nodes = Array.from({ length: 12 }, (_, i) =>
      makeVec(`n${i}`, 'ring', 0.9, 0.4),
    );
    treeLayout3d(nodes, []);
    const xs = nodes.map((n) => n.x);
    const zs = nodes.map((n) => n.z);
    const xSpan = Math.max(...xs) - Math.min(...xs);
    const zSpan = Math.max(...zs) - Math.min(...zs);
    expect(xSpan).toBeGreaterThan(30);
    expect(zSpan).toBeGreaterThan(30);
    /* 高 foundation 也不得塌到圆心 */
    for (const n of nodes) {
      expect(Math.hypot(n.x, n.z)).toBeGreaterThan(20);
    }
  });

  it('stacked circles do not overlap vertically', () => {
    const nodes = [
      ...Array.from({ length: 3 }, (_, i) => makeVec(`s${i}`, 'c3', 0.5, 0.4)),
      ...Array.from({ length: 8 }, (_, i) => makeVec(`m${i}`, 'c8', 0.5, 0.4)),
      ...Array.from({ length: 20 }, (_, i) => makeVec(`b${i}`, 'c20', 0.5, 0.4)),
    ];
    treeLayout3d(nodes, []);
    const scale = 1.35;
    const centers = ['c3', 'c8', 'c20'].map((cid) => {
      const ms = nodes.filter((n) => n.clusterId === cid);
      const y = ms.reduce((s, n) => s + n.y, 0) / ms.length;
      return { cid, y, R: clusterRadius(ms.length) * scale };
    });
    centers.sort((a, b) => a.y - b.y);
    for (let i = 1; i < centers.length; i += 1) {
      const gap = centers[i]!.y - centers[i - 1]!.y;
      const need = centers[i]!.R + centers[i - 1]!.R;
      expect(gap).toBeGreaterThanOrEqual(need - 20);
    }
  });
});

describe('l0 radial layout', () => {
  it('places higher hubness closer to origin', () => {
    const nodes = [
      makeVec('hub', 'c1', 0.5, 0.95),
      makeVec('leaf', 'c1', 0.2, 0.05),
      makeVec('mid', 'c2', 0.4, 0.5),
    ];
    radialLayout3d(nodes, []);
    const dist = (n: Vec) => Math.hypot(n.x, n.z);
    const hub = nodes.find((n) => n.id === 'hub')!;
    const leaf = nodes.find((n) => n.id === 'leaf')!;
    expect(dist(hub)).toBeLessThan(dist(leaf));
  });
});

describe('l0 force layout', () => {
  it('keeps higher foundation nearer its cluster centroid', () => {
    const nodes = [
      makeVec('core', 'g', 0.95, 0.6),
      makeVec('app1', 'g', 0.15, 0.3),
      makeVec('app2', 'g', 0.2, 0.25),
      makeVec('other', 'h', 0.5, 0.4),
      makeVec('other2', 'h', 0.4, 0.35),
    ];
    const links = [
      { source: 'core', target: 'app1', w: 0.8 },
      { source: 'core', target: 'app2', w: 0.75 },
      { source: 'app1', target: 'app2', w: 0.5 },
      { source: 'other', target: 'other2', w: 0.7 },
    ];
    forceLayout3d(nodes, links, 40);
    const g = nodes.filter((n) => n.clusterId === 'g');
    const cx = g.reduce((s, n) => s + n.x, 0) / g.length;
    const cy = g.reduce((s, n) => s + n.y, 0) / g.length;
    const cz = g.reduce((s, n) => s + n.z, 0) / g.length;
    const d = (n: Vec) => Math.hypot(n.x - cx, n.y - cy, n.z - cz);
    const core = nodes.find((n) => n.id === 'core')!;
    const app = nodes.find((n) => n.id === 'app1')!;
    expect(d(core)).toBeLessThan(d(app));
  });
});

describe('fallbackCommunities', () => {
  it('merges strong edges', () => {
    const m = fallbackCommunities(
      ['a', 'b', 'c', 'd'],
      [
        { source: 'a', target: 'b', w: 0.9 },
        { source: 'b', target: 'c', w: 0.85 },
        { source: 'd', target: 'a', w: 0.1 },
      ],
    );
    expect(m.get('a')).toBe(m.get('b'));
    expect(m.get('b')).toBe(m.get('c'));
  });
});
