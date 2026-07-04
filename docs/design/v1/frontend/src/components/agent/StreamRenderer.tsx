import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface StreamRendererProps {
  content: string;
  thinking?: string;
  streaming: boolean;
}

/** 流式 Markdown 批量渲染，50ms 防抖减轻卡顿 */
export function StreamRenderer({ content, thinking, streaming }: StreamRendererProps) {
  const [rendered, setRendered] = useState(content);

  useEffect(() => {
    if (!streaming) {
      setRendered(content);
      return;
    }
    const t = setTimeout(() => setRendered(content), 50);
    return () => clearTimeout(t);
  }, [content, streaming]);

  return (
    <div className="stream-renderer" data-testid="stream-renderer">
      {thinking && (
        <details className="stream-renderer__thinking">
          <summary>思考过程</summary>
          <pre>{thinking}</pre>
        </details>
      )}
      <MarkdownRenderer content={rendered} />
      {streaming && <span className="stream-renderer__cursor" aria-hidden>▊</span>}
    </div>
  );
}
