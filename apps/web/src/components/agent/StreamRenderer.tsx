import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface StreamRendererProps {
  content: string;
  thinking?: string;
  streaming: boolean;
  /** 是否默认展开思考区；默认收起 */
  thinkingOpen?: boolean;
  /** 仅折叠正文，不影响思考区（长文折叠用） */
  collapseBody?: boolean;
}

/** 仅含执行/状态标记、无实质推理时，不渲染成「思考过程」大面板 */
export function isStatusOnlyThinking(text: string): boolean {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;
  if (lines.length > 6) return false;
  return lines.every((ln) => {
    if (/^\[(状态|执行|规划完成|收口|纠正)\]/.test(ln)) return true;
    if (/^意图识别:/.test(ln)) return true;
    // 「[中间推理]」后若几乎无正文，仍视为状态
    if (/^\[中间推理\]\s*$/.test(ln)) return true;
    return false;
  });
}

function statusLineLabel(ln: string): string {
  // 「[状态] Hub · 汇总中…」→「状态 · Hub · 汇总中…」，避免留下「状态]」残缺括号
  return ln.replace(/^\[([^\]]+)\]\s*/u, '$1 · ').replace(/\s+/g, ' ').trim();
}

/** 流式 Markdown；真思考可展开，纯状态行用紧凑条，避免「思考过程」名不副实 */
export function StreamRenderer({
  content,
  thinking,
  streaming,
  thinkingOpen = false,
  collapseBody = false,
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

  useEffect(() => {
    if (streaming) setThinkingExpanded(thinkingOpen);
  }, [streaming, thinkingOpen]);

  const thinkingTrim = (thinking ?? '').trim();
  const hasThinking = Boolean(thinkingTrim);
  const statusOnly = hasThinking && isStatusOnlyThinking(thinkingTrim);
  const hasBody = Boolean(rendered && rendered.trim());
  const thinkingLines = hasThinking
    ? thinkingTrim.split('\n').filter(Boolean).length
    : 0;
  const statusLines = statusOnly
    ? thinkingTrim
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="stream-renderer" data-testid="stream-renderer">
      {hasThinking && statusOnly && streaming && (
        <div className="stream-renderer__status" aria-label="执行状态">
          {statusLines.map((ln, i) => (
            <span key={`${i}-${ln.slice(0, 24)}`} className="stream-renderer__status-line">
              {statusLineLabel(ln)}
            </span>
          ))}
        </div>
      )}
      {hasThinking && !statusOnly && (
        <div
          className="stream-renderer__thinking"
          data-open={thinkingExpanded ? '1' : '0'}
        >
          <button
            type="button"
            className="stream-renderer__thinking-toggle"
            aria-expanded={thinkingExpanded}
            onClick={() => setThinkingExpanded((v) => !v)}
          >
            <span className="stream-renderer__thinking-caret" aria-hidden>
              {thinkingExpanded ? '▾' : '▸'}
            </span>
            <span className="stream-renderer__thinking-title">思考过程</span>
            {!thinkingExpanded && streaming && (
              <span className="stream-renderer__thinking-hint">生成中 · 点击展开</span>
            )}
            {!thinkingExpanded && !streaming && thinkingLines > 0 && (
              <span className="stream-renderer__thinking-hint">
                {thinkingLines} 行 · 点击展开
              </span>
            )}
            {thinkingExpanded && (
              <span className="stream-renderer__thinking-hint">点击收起</span>
            )}
          </button>
          {thinkingExpanded && (
            <pre className="stream-renderer__thinking-body">{thinkingTrim}</pre>
          )}
        </div>
      )}
      <div
        className={`stream-renderer__body${
          collapseBody ? ' stream-renderer__body--collapsed' : ''
        }`}
      >
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
    </div>
  );
}
