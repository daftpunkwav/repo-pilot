import { useEffect, useState } from 'react';
import type { CodeGraphNode } from './types';
import { getApi } from '@/api/client';

interface Props {
  node: CodeGraphNode | null;
  projectId: string;
  onClose: () => void;
}

export function NodeDetailPanel({ node, projectId, onClose }: Props) {
  const [trace, setTrace] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTrace(null);
  }, [node?.id]);

  if (!node) return null;

  const loadTrace = async (direction: 'upstream' | 'downstream' | 'both') => {
    if (!node.qualified_name && !node.name) return;
    setLoading(true);
    try {
      const res = await getApi().traceCodeGraph(projectId, {
        symbol: node.qualified_name || node.name,
        direction,
        depth: 3,
      });
      setTrace(res.data);
    } catch (e) {
      setTrace({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="code-graph-detail glass-card glass-card--panel">
      <header>
        <div>
          <div className="kind">{node.kind || node.label}</div>
          <h2 title={node.qualified_name || node.name}>{node.name}</h2>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </header>
      <dl>
        {node.file_path && (
          <>
            <dt>Path</dt>
            <dd>{node.file_path}</dd>
          </>
        )}
        {(node.start_line || node.end_line) && (
          <>
            <dt>Lines</dt>
            <dd>
              {node.start_line}
              {node.end_line ? `�?{node.end_line}` : ''}
            </dd>
          </>
        )}
        {node.status && (
          <>
            <dt>Status</dt>
            <dd>{node.status}</dd>
          </>
        )}
        {node.in_calls != null && (
          <>
            <dt>In calls</dt>
            <dd>{node.in_calls}</dd>
          </>
        )}
        {node.qualified_name && (
          <>
            <dt>QN</dt>
            <dd className="mono">{node.qualified_name}</dd>
          </>
        )}
      </dl>
      <div className="code-graph-detail__actions">
        <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => loadTrace('upstream')}>
          Callers
        </button>
        <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => loadTrace('downstream')}>
          Callees
        </button>
        <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => loadTrace('both')}>
          Both
        </button>
      </div>
      {trace != null && (
        <pre className="code-graph-arch-preview">{JSON.stringify(trace, null, 2).slice(0, 2000)}</pre>
      )}
    </aside>
  );
}
