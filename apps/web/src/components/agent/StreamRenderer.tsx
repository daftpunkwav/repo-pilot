import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface StreamRendererProps {
  content: string;
  thinking?: string;
  streaming: boolean;
  /** 是否默认展开思考区；默认收起 */
  thinkingOpen?: boolean;
}

/** 流式 Markdown 批量渲染；思考过程入口始终可见，默认折叠 */
export function StreamRenderer({
  content,
  thinking,
  streaming,
  thinkingOpen = false,
}: StreamRendererProps) {
  const [rendered, setRendered] = useState(content);
  const [thinkingExpanded, setThinkingExpanded] = useState(thinkingOpen);

  useEffect(() => {
    if (!streaming) {
      setRendered(content);
      return;
    }
    const t = setTimeout(() => setRendered(content), 32);
    return () => clearTimeout(t);
  }, [content, streaming]);

  // 新一轮流式开始时按 prop 重置展开状态（默认收起）
  useEffect(() => {
    if (streaming) setThinkingExpanded(thinkingOpen);
  }, [streaming, thinkingOpen]);

  const hasThinking = Boolean(thinking && thinking.trim());
  const hasBody = Boolean(rendered && rendered.trim());
  const thinkingLines = hasThinking
    ? thinking!.trim().split('\n').filter(Boolean).length
    : 0;
  const thinkingPreview = (() => {
    if (!hasThinking) return '';
    const lines = thinking!
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const meaningful = lines.filter(
      (l) =>
        !l.startsWith('[状态]') &&
        !l.startsWith('[执行]') &&
        !l.startsWith('意图识别:') &&
        !l.startsWith('正在生成') &&
        !l.startsWith('[规划完成]')
    );
    return meaningful.at(-1) ?? lines.at(-1) ?? '';
  })();

  return (
    <div className="stream-renderer" data-testid="stream-renderer">
      {hasThinking && (
        <div className="stream-renderer__thinking" data-open={thinkingExpanded ? '1' : '0'}>
          <button
            type="button"
            className="stream-renderer__thinking-toggle"
            aria-expanded={thinkingExpanded}
            onClick={() => setThinkingExpanded((v) => !v)}
          >
            <span className="stream-renderer__thinking-caret" aria-hidden>
              {thinkingExpanded ? '▾' : '▸'}
            </span>
            <span>思考过程</span>
            {!thinkingExpanded && streaming && (
              <span className="stream-renderer__thinking-hint">生成中 · 点击展开</span>
            )}
            {!thinkingExpanded && !streaming && thinkingLines > 0 && (
              <span className="stream-renderer__thinking-hint">{thinkingLines} 行 · 点击展开</span>
            )}
            {thinkingExpanded && (
              <span className="stream-renderer__thinking-hint">点击收起</span>
            )}
          </button>
          {!thinkingExpanded && thinkingPreview && (
            <p className="stream-renderer__thinking-preview">{thinkingPreview}</p>
          )}
          {thinkingExpanded && <pre className="stream-renderer__thinking-body">{thinking}</pre>}
        </div>
      )}
      {hasBody ? (
        <MarkdownRenderer content={rendered} />
      ) : streaming ? (
        <p className="stream-renderer__placeholder muted">
          {hasThinking ? '推理中，等待正文…' : '正在输出…'}
        </p>
      ) : null}
      {streaming && hasBody && (
        <span className="stream-renderer__cursor" aria-hidden>
          ▊
        </span>
      )}
    </div>
  );
}
