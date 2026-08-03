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

/** 状态/脚手架行：不应单独冒充「思考过程」 */
export function isStatusLine(ln: string): boolean {
  const t = ln.trim();
  if (!t) return true;
  if (/^\[(状态|执行|规划|规划完成|收口|纠正)\]/.test(t)) return true;
  // 「执行 · Mentor · 1/3」或「执行 · Mentor · 第 1/3 轮」
  if (/^执行\s*·/.test(t)) return true;
  if (/^意图识别:/.test(t)) return true;
  if (/^意图路由\b/.test(t)) return true;
  if (/^正在生成/.test(t)) return true;
  if (/^\[中间推理\]\s*$/.test(t)) return true;
  // 兼容旧格式或模型回声：「Mentor 推理中（第 1/3 轮 · tot）」
  if (/推理中\s*[（(]/.test(t) && /第\s*\d+\s*\/\s*\d+\s*轮/.test(t)) {
    return true;
  }
  // 单独一行的轮次脚手架
  if (/^第\s*\d+\s*\/\s*\d+\s*轮\b/.test(t)) return true;
  if (/第\s*\d+\s*\/\s*\d+\s*轮\s*·\s*(tot|react|cot|plan_execute|reflexion|direct)\b/i.test(t)
    && t.length < 80) {
    return true;
  }
  // 「Hub 推理中 (第 1/4 轮 · plan_execute)」整行脚手架
  if (/推理中/.test(t) && /plan_execute|react|tot|reflexion/.test(t) && t.length < 100) {
    return true;
  }
  return false;
}

/**
 * 拆分 thinking：状态脚手架 vs 实质推理。
 * 仅含脚手架时视为 status-only。
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
      // 「[中间推理]」标题行后的正文算真思考
      const rest = ln.replace(/^\[中间推理\]\s*/, '').trim();
      if (rest) realParts.push(rest);
      else statusLines.push('[中间推理]');
    } else {
      realParts.push(ln);
    }
  }
  const realThinking = realParts.join('\n').trim();
  return { statusLines, realThinking };
}

/** 仅含执行/状态标记、无实质推理时，不渲染成「思考过程」大面板 */
export function isStatusOnlyThinking(text: string): boolean {
  const { realThinking } = partitionThinking(text);
  return !realThinking;
}

function statusLineLabel(ln: string): string {
  // 「[状态] Hub · 汇总中…」→「状态 · Hub · 汇总中…」
  if (/^\[([^\]]+)\]/.test(ln)) {
    return ln.replace(/^\[([^\]]+)\]\s*/u, '$1 · ').replace(/\s+/g, ' ').trim();
  }
  return ln.replace(/\s+/g, ' ').trim();
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

  const thinkingTrim = (thinking ?? '').trim();
  const { statusLines, realThinking } = partitionThinking(thinkingTrim);
  const hasRealThinking = Boolean(realThinking);
  const hasStatus = statusLines.length > 0;
  const hasBody = Boolean(rendered && rendered.trim());
  const thinkingLines = hasRealThinking
    ? realThinking.split('\n').filter(Boolean).length
    : 0;

  // 流式出现真思考 → 展开；一旦有正文 → 收起；仅脚手架 → 不展开面板
  useEffect(() => {
    if (hasBody && hasRealThinking) {
      setThinkingExpanded(false);
      return;
    }
    if (streaming && hasRealThinking && !hasBody) {
      setThinkingExpanded(true);
      return;
    }
    if (streaming && !hasRealThinking) {
      setThinkingExpanded(thinkingOpen);
    }
  }, [streaming, hasRealThinking, hasBody, thinkingOpen]);

  // 仅脚手架：流式中显示 chip；落库/非流式不展示，避免历史假思考
  const showStatusChips = hasStatus && streaming && !hasRealThinking;
  const showThinkingPanel = hasRealThinking;

  return (
    <div className="stream-renderer" data-testid="stream-renderer">
      {showStatusChips && (
        <div className="stream-renderer__status" aria-label="执行状态">
          {statusLines.map((ln, i) => (
            <span key={`${i}-${ln.slice(0, 24)}`} className="stream-renderer__status-line">
              {statusLineLabel(ln)}
            </span>
          ))}
        </div>
      )}
      {showThinkingPanel && (
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
            {!thinkingExpanded && streaming && !hasBody && (
              <span className="stream-renderer__thinking-hint">生成中 · 点击展开</span>
            )}
            {!thinkingExpanded && (!streaming || hasBody) && thinkingLines > 0 && (
              <span className="stream-renderer__thinking-hint">
                {thinkingLines} 行 · 点击展开
              </span>
            )}
            {thinkingExpanded && (
              <span className="stream-renderer__thinking-hint">点击收起</span>
            )}
          </button>
          {thinkingExpanded && (
            <pre className="stream-renderer__thinking-body">{realThinking}</pre>
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
              ? '推理中，等待正文…'
              : /汇总|合并/.test(thinkingTrim)
                ? '汇总中…'
                : hasStatus || thinkingTrim
                  ? '执行中…'
                  : '正在输出…'}
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
