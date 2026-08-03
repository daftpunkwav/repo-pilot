interface ToolCallCardProps {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

function previewArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args ?? {});
  if (entries.length === 0) return '';
  // 优先展示路由/定位字段，避免 description/task 长文挤占首屏
  const priority = [
    'target_agent',
    'name',
    'project_id',
    'owner',
    'repo',
    'path',
    'query',
    'task',
    'reason',
    'description',
  ];
  const rank = (k: string) => {
    const i = priority.indexOf(k);
    return i === -1 ? priority.length + 1 : i;
  };
  const ordered = [...entries].sort(([a], [b]) => rank(a) - rank(b));
  const parts = ordered.slice(0, 3).map(([k, v]) => {
    const raw = typeof v === 'string' ? v : JSON.stringify(v);
    const short = raw.length > 36 ? `${raw.slice(0, 34)}…` : raw;
    return `${k}=${short}`;
  });
  const more = ordered.length > 3 ? ` +${ordered.length - 3}` : '';
  return parts.join(' · ') + more;
}

function formatBlock(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 工具调用：气泡外细行，默认收起，避免嵌套厚卡片 */
export function ToolCallCard({ name, args, result }: ToolCallCardProps) {
  const done = result !== undefined;
  const argPreview = previewArgs(args);

  return (
    <details className={`tool-call ${done ? 'is-done' : 'is-running'}`}>
      <summary className="tool-call__summary">
        <span className="tool-call__caret" aria-hidden>
          ▸
        </span>
        <span className="tool-call__dot" aria-hidden />
        <span className="tool-call__name">{name}</span>
        {argPreview && (
          <span className="tool-call__preview" title={argPreview}>
            {argPreview}
          </span>
        )}
        <span className="tool-call__status">{done ? '完成' : '调用中'}</span>
      </summary>
      <div className="tool-call__panel">
        <div className="tool-call__section">
          <span className="tool-call__k">参数</span>
          <pre className="tool-call__code">{formatBlock(args)}</pre>
        </div>
        {done && (
          <div className="tool-call__section">
            <span className="tool-call__k">结果</span>
            <pre className="tool-call__code">{formatBlock(result)}</pre>
          </div>
        )}
      </div>
    </details>
  );
}
