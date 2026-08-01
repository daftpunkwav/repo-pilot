interface ToolCallCardProps {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export function ToolCallCard({ name, args, result }: ToolCallCardProps) {
  const done = result !== undefined;
  return (
    <details className={`tool-call-card ${done ? 'is-done' : 'is-running'}`}>
      <summary>
        <span className="tool-call-card__icon" aria-hidden>
          {done ? '✓' : '…'}
        </span>
        <span className="tool-call-card__name">{name}</span>
        <span className="tool-call-card__status">{done ? '完成' : '调用中'}</span>
      </summary>
      <div className="tool-call-card__body">
        <p className="tool-call-card__label">参数</p>
        <pre>{JSON.stringify(args, null, 2)}</pre>
        {done && (
          <>
            <p className="tool-call-card__label">结果</p>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </>
        )}
      </div>
    </details>
  );
}
