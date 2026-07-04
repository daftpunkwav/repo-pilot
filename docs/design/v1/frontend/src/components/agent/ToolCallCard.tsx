interface ToolCallCardProps {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export function ToolCallCard({ name, args, result }: ToolCallCardProps) {
  return (
    <details className="tool-call-card glass">
      <summary>🔧 {name}</summary>
      <div className="tool-call-card__body">
        <p className="tool-call-card__label">参数</p>
        <pre>{JSON.stringify(args, null, 2)}</pre>
        {result !== undefined && (
          <>
            <p className="tool-call-card__label">结果</p>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </>
        )}
      </div>
    </details>
  );
}
