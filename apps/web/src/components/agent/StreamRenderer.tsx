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

/** 状态/脚手架行：不应冒充「思考过程」 */
export function isStatusLine(ln: string): boolean {
  const t = ln.trim();
  if (!t) return true;
  if (/^\[(状态|执行|规划|规划完成|收口|纠正|阶段)\]/.test(t)) return true;
  if (/^执行\s*·/.test(t)) return true;
  if (/^意图识别:/.test(t)) return true;
  if (/^意图路由\b/.test(t)) return true;
  if (/^正在生成/.test(t)) return true;
  if (/^（思路阶段无内容/.test(t)) return true;
  if (/^\[中间推理\]\s*$/.test(t)) return true;
  // 旧格式：「Hub 推理中 (第 1/4 轮 · plan_execute)」
  if (/推理中/.test(t) && /第\s*\d+\s*\/\s*\d+\s*轮/.test(t)) return true;
  if (/推理中/.test(t) && /plan_execute|react|tot|reflexion|direct/i.test(t) && t.length < 120) {
    return true;
  }
  if (/^第\s*\d+\s*\/\s*\d+\s*轮\b/.test(t)) return true;
  if (
    /第\s*\d+\s*\/\s*\d+\s*轮\s*·\s*(tot|react|cot|plan_execute|reflexion|direct)\b/i.test(t) &&
    t.length < 80
  ) {
    return true;
  }
  return false;
}

/**
 * 拆分 thinking：状态脚手架 vs 实质推理。
 */
export function partitionThinking(text: string): {
  statusLines: string[];
  realThinking: string;
} {
  const statusLines: string[] = [];
  const realParts: string[] = [];
  for (const raw of text.split('\n')) {
    const ln = raw.trimEnd();
    if (!ln.trim()) {
      if (realParts.length > 0) realParts.push('');
      continue;
    }
    if (isStatusLine(ln)) {
      statusLines.push(ln.trim());
    } else if (/^\[中间推理\]/.test(ln.trim())) {
      const rest = ln.replace(/^\[中间推理\]\s*/, '').trim();
      if (rest) realParts.push(rest);
      else statusLines.push('[中间推理]');
    } else {
      realParts.push(ln);
    }
  }
  return { statusLines, realThinking: realParts.join('\n').trim() };
}

/** 仅含执行/状态标记、无实质推理 */
export function isStatusOnlyThinking(text: string): boolean {
  return !partitionThinking(text).realThinking;
}

/** 落库用：只保留真实思考，丢弃脚手架 */
export function persistableThinking(text: string | undefined | null): string {
  const real = partitionThinking((text ?? '').trim()).realThinking;
  return real;
}

/** 仅调度说明、无实质正文时，把长思考提升为可见正文（防 Mentor 空泡） */
export function isDispatchNoticeOnly(content: string): boolean {
  const t = (content ?? '').trim();
  if (!t || t.length > 280) return false;
  if (/^#{1,3}\s/m.test(t)) return false;
  return (
    /^先交由\s*\*{0,2}[A-Za-z\u4e00-\u9fff]+/.test(t) ||
    /^交由\s*\*{0,2}[A-Za-z\u4e00-\u9fff]+/.test(t)
  );
}

export function coalesceEmptyBodyWithThinking(
  content: string,
  thinking: string | undefined | null
): { content: string; thinking: string } {
  const body = (content ?? '').trim();
  const { realThinking } = partitionThinking((thinking ?? '').trim());
  if (!isDispatchNoticeOnly(body) || realThinking.length < 80) {
    return { content: content ?? '', thinking: thinking ?? '' };
  }
  return {
    content: `${body}\n\n${realThinking}`.trim(),
    thinking: '',
  };
}

/** 流式 Markdown；真实思考默认收起，脚手架不进思考面板 */
export function StreamRenderer({
  content,
  thinking,
  streaming,
  thinkingOpen = false,
  collapseBody = false,
}: StreamRendererProps) {
  const coalesced = coalesceEmptyBodyWithThinking(content, thinking);
  const displayContent = coalesced.content;
  const displayThinking = coalesced.thinking;

  const [rendered, setRendered] = useState(displayContent);
  const [thinkingExpanded, setThinkingExpanded] = useState(thinkingOpen);

  useEffect(() => {
    if (!streaming) {
      setRendered(displayContent);
      return;
    }
    const t = setTimeout(() => setRendered(displayContent), 32);
    return () => clearTimeout(t);
  }, [displayContent, streaming]);

  const thinkingTrim = displayThinking.trim();
  const { realThinking } = partitionThinking(thinkingTrim);
  const hasRealThinking = Boolean(realThinking);
  const hasBody = Boolean(rendered && rendered.trim());
  const thinkingLines = hasRealThinking
    ? realThinking.split('\n').filter(Boolean).length
    : 0;

  // 有正文时强制收起；绝不因流式自动展开（默认收起）
  useEffect(() => {
    if (hasBody && hasRealThinking) {
      setThinkingExpanded(false);
    }
  }, [hasBody, hasRealThinking]);

  // 外部显式要求展开时同步一次
  useEffect(() => {
    if (thinkingOpen) setThinkingExpanded(true);
  }, [thinkingOpen]);

  const showThinkingPanel = hasRealThinking;

  return (
    <div className="stream-renderer" data-testid="stream-renderer">
      {showThinkingPanel && (
        <div
          className="stream-renderer__thinking"
          data-open={thinkingExpanded ? '1' : '0'}
          data-testid="thinking-panel"
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
            {!thinkingExpanded && (
              <span className="stream-renderer__thinking-hint">
                {streaming && !hasBody
                  ? '生成中 · 点击展开'
                  : thinkingLines > 0
                    ? `${thinkingLines} 行 · 点击展开`
                    : '点击展开'}
              </span>
            )}
            {thinkingExpanded && (
              <span className="stream-renderer__thinking-hint">点击收起</span>
            )}
          </button>
          {thinkingExpanded && (
            <pre className="stream-renderer__thinking-body" data-testid="thinking-body">
              {realThinking}
            </pre>
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
            {hasRealThinking
              ? '正在组织回答…'
              : /汇总|合并/.test(thinkingTrim)
                ? '汇总中…'
                : /评估/.test(thinkingTrim)
                  ? '评估中…'
                  : '执行中…'}
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
