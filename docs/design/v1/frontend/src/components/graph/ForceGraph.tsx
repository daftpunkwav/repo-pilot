import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { D3DragEvent, SimulationLinkDatum, SimulationNodeDatum } from 'd3';
import type { GraphData, GraphNode } from '@/api/types';
import { useGraphStore } from '@/stores/graphStore';

export const FORCE_CONFIG = {
  linkDistance: 80,
  chargeStrength: -200,
  collideRadius: 12,
};

interface ForceGraphProps {
  data: GraphData;
  width: number;
  height: number;
  onNodeClick: (node: GraphNode) => void;
  onNodeDoubleClick: (node: GraphNode) => void;
}

type SimNode = SimulationNodeDatum & GraphNode;

type SimLink = SimulationLinkDatum<SimNode> & { similarity: number };

export function ForceGraph({
  data,
  width,
  height,
  onNodeClick,
  onNodeDoubleClick,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const highlightNodeId = useGraphStore((s) => s.highlightNodeId);
  const setZoomLevel = useGraphStore((s) => s.setZoomLevel);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || width <= 0 || height <= 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = [];

    for (const e of data.edges) {
      const source = nodeById.get(e.source);
      const target = nodeById.get(e.target);
      if (source && target) {
        links.push({ source, target, similarity: e.similarity });
      }
    }

    const g = svg.append('g');

    const labelsLayer = g.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
        labelsLayer.selectAll('text').style('opacity', event.transform.k > 0.8 ? 1 : 0);
      });

    svg.call(zoom);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d: SimNode) => d.id)
          .distance(FORCE_CONFIG.linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(FORCE_CONFIG.chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(FORCE_CONFIG.collideRadius));

    const dragBehavior = d3
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d: SimNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d: SimNode) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d: SimNode) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--text-300)')
      .attr('stroke-opacity', (d: SimLink) => 0.1 + d.similarity * 0.7);

    const node = g
      .append('g')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('data-testid', 'graph-node')
      .attr('r', (d: SimNode) =>
        Math.min(20, Math.max(4, Math.log2(d.stars + 1) * 2 + 4))
      )
      .attr('fill', (d: SimNode) => `var(--chart-${(d.id.charCodeAt(2) % 8) + 1})`)
      .attr('stroke', (d: SimNode) =>
        d.id === selectedNodeId || d.id === highlightNodeId
          ? 'var(--brand-500)'
          : 'transparent'
      )
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (_e: MouseEvent, d: SimNode) => onNodeClick(d))
      .on('dblclick', (_e: MouseEvent, d: SimNode) => onNodeDoubleClick(d))
      .call(dragBehavior);

    const labels = labelsLayer
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodes)
      .join('text')
      .text((d: SimNode) => d.name.split('/')[1] ?? d.name)
      .attr('font-size', 10)
      .attr('fill', 'var(--text-600)')
      .attr('text-anchor', 'middle')
      .attr('dy', -14)
      .style('pointer-events', 'none')
      .style('opacity', 0);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: SimLink) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d: SimLink) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d: SimLink) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d: SimLink) => (d.target as SimNode).y ?? 0);
      node.attr('cx', (d: SimNode) => d.x ?? 0).attr('cy', (d: SimNode) => d.y ?? 0);
      labels.attr('x', (d: SimNode) => d.x ?? 0).attr('y', (d: SimNode) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [
    data,
    width,
    height,
    onNodeClick,
    onNodeDoubleClick,
    selectedNodeId,
    highlightNodeId,
    setZoomLevel,
  ]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="force-graph-svg"
      data-testid="force-graph-svg"
    />
  );
}
