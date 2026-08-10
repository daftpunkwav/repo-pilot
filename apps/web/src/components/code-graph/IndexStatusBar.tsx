import type { GraphIndexStatus } from './types';

const STATUS_ZH: Record<string, string> = {
  NONE: '未索引',
  QUEUED: '队列中',
  CLONING: '克隆中',
  INDEXING: '索引中',
  READY: '就绪',
  STALE: '过期',
  CLONE_FAILED: '克隆失败',
  INDEX_FAILED: '索引失败',
};

interface Props {
  status?: GraphIndexStatus;
  loading?: boolean;
  onIndex: (mode: 'fast' | 'moderate' | 'full') => void;
  onRefresh: (mode: 'fast' | 'moderate' | 'full') => void;
  nodeBudget: number;
  onBudgetChange: (n: number) => void;
  totalNodes?: number | null;
  shownNodes?: number;
  shownEdges?: number;
}

/** L1 索引状态：嵌入左侧浮动信息栏（对标 L0 GraphIndexProgressBar） */
export function IndexStatusBar({
  status,
  loading,
  onIndex,
  onRefresh,
  nodeBudget,
  onBudgetChange,
  totalNodes,
  shownNodes,
  shownEdges,
}: Props) {
  const st = status?.status ?? 'NONE';
  const statsText =
    totalNodes != null && shownNodes != null && totalNodes > shownNodes
      ? `${shownNodes.toLocaleString()} / ${totalNodes.toLocaleString()} 节点`
      : shownNodes != null
        ? `${shownNodes.toLocaleString()} 节点${
            shownEdges != null ? ` / ${shownEdges.toLocaleString()} 边` : ''
          }`
        : null;

  const errorText =
    status?.error?.trim() ||
    (st === 'CLONE_FAILED' || st === 'INDEX_FAILED'
      ? '索引失败，请重试'
      : null);

  const primaryAction =
    st === 'READY' || st === 'STALE' ? (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={loading}
        onClick={() => onRefresh('moderate')}
      >
        刷新
      </button>
    ) : (
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={loading}
        onClick={() => onIndex('moderate')}
      >
        索引
      </button>
    );

  return (
    <div className="code-graph-statusbar code-graph-statusbar--inline">
      <div className="code-graph-statusbar__row">
        <span className={`status-pill status-pill--${st.toLowerCase()}`}>
          {STATUS_ZH[st] ?? st}
        </span>
        {status?.index_mode && <span className="muted">模式: {status.index_mode}</span>}
      </div>
      {errorText && <p className="error">{errorText}</p>}
      <div className="code-graph-statusbar__row code-graph-statusbar__budget">
        {statsText && <span className="code-graph-statusbar__stats">{statsText}</span>}
        <label className="code-graph-statusbar__limit">
          上限
          <input
            type="number"
            min={1000}
            step={1000}
            value={nodeBudget}
            onChange={(e) => onBudgetChange(Number(e.target.value) || 5000)}
          />
        </label>
      </div>
      <div className="code-graph-statusbar__row code-graph-statusbar__actions">
        {primaryAction}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={loading}
          onClick={() => onIndex('fast')}
        >
          快速
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={loading}
          onClick={() => onIndex('full')}
        >
          完整
        </button>
      </div>
    </div>
  );
}
