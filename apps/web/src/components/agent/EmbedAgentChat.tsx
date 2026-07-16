import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { getApi } from '@/api/client';
import type { ImportAssistContext, SelectReposEvent, SSEEvent } from '@/api/types';
import { asSSETextDelta } from '@/utils/sse-helpers';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { useUIStore } from '@/stores/uiStore';

export type EmbedChatMode = 'import' | 'graph';

interface ChatLine {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface EmbedAgentChatProps {
  mode: EmbedChatMode;
  title: string;
  subtitle?: string;
  agentInitial?: string;
  agentClassName?: string;
  importContext?: ImportAssistContext;
  graphNodeId?: string | null;
  placeholder?: string;
  /** Agent 操控勾选：父组件同步左侧 checkbox */
  onSelectRepos?: (event: SelectReposEvent) => void;
}

export function EmbedAgentChat({
  mode,
  title,
  subtitle,
  agentInitial = 'A',
  agentClassName = 'agent-hub',
  importContext,
  graphNodeId,
  placeholder = '向助手描述你的需求…',
  onSelectRepos,
}: EmbedAgentChatProps) {
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        mode === 'import'
          ? '我是 **导入助手**。可以说「推荐几个 Python Web 框架」——我会**在左侧自动勾选**，并说明推荐理由。确认后点「导入选中」。'
          : '我是 **Atlas · 图谱向导**，专门解读项目关系网络。可以问我「这两个项目为什么相连」。',
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [tokenHint, setTokenHint] = useState({ in: 0, out: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const addToast = useUIStore((s) => s.addToast);
  // 始终用最新 context，避免闭包陈旧
  const importContextRef = useRef(importContext);
  importContextRef.current = importContext;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, streaming, error, lastAction]);

  useEffect(
    () => () => {
      streamAbortRef.current?.abort();
    },
    [],
  );

  const abortStream = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setStreaming(false);
  };

  const applySelectRepos = (raw: Record<string, unknown>) => {
    const event: SelectReposEvent = {
      repo_keys: Array.isArray(raw.repo_keys)
        ? (raw.repo_keys as unknown[]).map(String)
        : [],
      action: (raw.action as SelectReposEvent['action']) || 'set',
      reason: typeof raw.reason === 'string' ? raw.reason : undefined,
      count: typeof raw.count === 'number' ? raw.count : undefined,
    };
    onSelectRepos?.(event);
    const n = event.repo_keys.length;
    const label =
      event.action === 'remove'
        ? `已取消勾选 ${n} 个仓库`
        : event.action === 'add'
          ? `已追加勾选 ${n} 个仓库`
          : `已自动勾选 ${n} 个仓库`;
    setLastAction(label);
    setLines((prev) => [
      ...prev,
      {
        id: `sys_${Date.now()}`,
        role: 'system',
        content: `⚙️ **系统操控** · ${label}${event.reason ? `\n> ${event.reason}` : ''}${
          n
            ? `\n${event.repo_keys
                .slice(0, 12)
                .map((k) => `- \`${k}\``)
                .join('\n')}${n > 12 ? `\n- …共 ${n} 个` : ''}`
            : ''
        }\n\n请确认左侧勾选，无误后点击 **导入选中**。`,
      },
    ]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError(null);
    setLastAction(null);
    setLines((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', content: text }]);
    setStreaming(true);
    streamAbortRef.current?.abort();
    const ac = new AbortController();
    streamAbortRef.current = ac;
    let assistant = '';
    const api = getApi();
    const ctx = importContextRef.current ?? { mode: 'stars' as const };
    const stream =
      mode === 'import'
        ? api.importAssistChat(text, ctx, ac.signal)
        : api.graphGuideChat(text, { selected_node_id: graphNodeId }, ac.signal);

    let sawError = false;
    let errorMsg = '';
    try {
      let flushScheduled = false;
      const scheduleFlush = () => {
        if (flushScheduled) return;
        flushScheduled = true;
        setTimeout(() => {
          flushScheduled = false;
          const snapshot = assistant;
          setLines((prev) => {
            const rest = prev.filter((l) => l.id !== 'streaming');
            return [...rest, { id: 'streaming', role: 'assistant', content: snapshot }];
          });
        }, 16);
      };

      for await (const event of stream as AsyncGenerator<SSEEvent>) {
        if (ac.signal.aborted) break;
        if (event.event === 'text_delta') {
          assistant += asSSETextDelta(event.data).content;
          scheduleFlush();
        }
        if (event.event === 'select_repos') {
          applySelectRepos(event.data as Record<string, unknown>);
        }
        if (event.event === 'thinking') {
          // 轻量展示：不打断正文
        }
        if (event.event === 'done') {
          const usage = event.data as { usage?: { tokens?: number } };
          setTokenHint((t) => ({
            in: t.in + Math.round(text.length / 4),
            out: t.out + (usage.usage?.tokens ?? assistant.length / 4),
          }));
        }
        if (event.event === 'error') {
          sawError = true;
          errorMsg =
            (event.data as { message?: string })?.message ?? '助手返回错误，请稍后再试。';
          setError(errorMsg);
        }
      }
      setLines((prev) => {
        const rest = prev.filter((l) => l.id !== 'streaming');
        if (!assistant.trim()) {
          if (!sawError) {
            return [
              ...rest,
              {
                id: `a_${Date.now()}`,
                role: 'assistant',
                content:
                  '（助手未返回正文。若未配置 LLM Key，请到设置页配置；或换个说法再试。）',
              },
            ];
          }
          return rest;
        }
        return [...rest, { id: `a_${Date.now()}`, role: 'assistant', content: assistant }];
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const message = err instanceof Error ? err.message : '连接中断，请重试';
      setError(message);
      addToast({ type: 'error', message });
    } finally {
      if (streamAbortRef.current === ac) {
        streamAbortRef.current = null;
      }
      if (sawError) {
        addToast({ type: 'error', message: errorMsg || '助手返回错误' });
      }
      setStreaming(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
      return;
    }
    if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      abortStream();
    }
  };

  return (
    <div className="embed-agent-chat">
      <header className="embed-agent-chat__head">
        <div className={`agent-avatar ${agentClassName} active`}>
          <span>{agentInitial}</span>
        </div>
        <div>
          <div className="embed-agent-chat__title">{title}</div>
          {subtitle && <div className="embed-agent-chat__sub">{subtitle}</div>}
        </div>
        {lastAction && (
          <span className="embed-agent-chat__action-pill" title={lastAction}>
            操控中
          </span>
        )}
      </header>
      <div className="embed-agent-chat__messages">
        {error && (
          <div className="embed-msg embed-msg--error" role="alert" data-testid="embed-chat-error">
            {error}
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`embed-msg embed-msg--${l.role}`}>
            {l.role === 'user' ? (
              l.content
            ) : (
              <MarkdownRenderer content={l.content} />
            )}
          </div>
        ))}
        {streaming && (
          <div className="embed-msg embed-msg--system embed-msg--typing">助手思考中…</div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="embed-agent-chat__input">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={streaming}
          aria-label={`${title} 对话输入`}
        />
        <button
          type="button"
          className="embed-send-btn"
          onClick={() => void send()}
          disabled={streaming || !input.trim()}
          aria-label="发送"
          title="发送 (Enter)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={16} height={16}>
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <footer className="embed-agent-chat__footer">
        <span className="mono">
          in {Math.round(tokenHint.in)} · out {Math.round(tokenHint.out)} tok
        </span>
        {mode === 'import' && (
          <span className="embed-agent-chat__hint">可操控左侧勾选</span>
        )}
      </footer>
    </div>
  );
}
