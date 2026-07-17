import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface StreamRendererProps {
  content: string;
  thinking?: string;
  streaming: boolean;
  /** 思考区默认是否展开；默认收起 */
  thinkingOpen?: boolean;
}

/** 流式 Markdown 批量渲染，50ms 防抖减轻卡顿 */
export function StreamRenderer({
  content,
  thinking,
  streaming,
  thinkingOpen = false,
}: StreamRendererProps) {
  const [rendered, setRendered] = useState(content);

  useEffect(() => {
    if (!streaming) {
      setRendered(content);
      return;
    }
    // 流式时更短防抖，降低「无输出」错觉
    const t = setTimeout(() => setRendered(content), 32);
    return () => clearTimeout(t);
  }, [content, streaming]);

  const hasThinking = Boolean(thinking && thinking.trim());
  const hasBody = Boolean(rendered && rendered.trim());

  return (
    <div className="stream-renderer" data-testid="stream-renderer">
      {hasThinking && (
        <details
          className="stream-renderer__thinking"
          // React DOM 类型无 defaultOpen；仅在显式要求时用 open 强制展开
          {...(thinkingOpen ? { open: true } : {})}
        >
          <summary>
            思考过程
            {streaming && !hasBody ? '（推理生成中…）' : ''}
            {!streaming && hasThinking && !hasBody ? '（仅状态/推理，无正文）' : ''}
          </summary>
          <pre>{thinking}</pre>
        </details>
      )}
      {hasBody ? (
        <MarkdownRenderer content={rendered} />
      ) : streaming ? (
        <p className="stream-renderer__placeholder muted">正在输出…</p>
      ) : null}
      {streaming && hasBody && (
        <span className="stream-renderer__cursor" aria-hidden>
          ▊
        </span>
      )}
    </div>
  );
}
