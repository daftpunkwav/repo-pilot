import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { getApi } from '@/api/client';
import type { ImportAssistContext } from '@/api/types';
import { asSSETextDelta } from '@/utils/sse-helpers';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

export type EmbedChatMode = 'import' | 'graph';

interface ChatLine {
  id: string;
  role: 'user' | 'assistant';
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
}: EmbedAgentChatProps) {
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        mode === 'import'
          ? '我是 **导入助手**，可以帮你从左侧列表挑选或推荐要导入的项目。试试说「推荐几个 Python Web 框架」。'
          : '我是 **Atlas · 图谱向导**，专门解读项目关系网络。可以问我「这两个项目为什么相连」。',
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [tokenHint, setTokenHint] = useState({ in: 0, out: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, streaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setLines((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', content: text }]);
    setStreaming(true);
    let assistant = '';
    const api = getApi();
    const stream =
      mode === 'import'
        ? api.importAssistChat(text, importContext ?? { mode: 'stars' })
        : api.graphGuideChat(text, { selected_node_id: graphNodeId });

    try {
      for await (const event of stream) {
        if (event.event === 'text_delta') {
          assistant += asSSETextDelta(event.data).content;
          setLines((prev) => {
            const rest = prev.filter((l) => l.id !== 'streaming');
            return [...rest, { id: 'streaming', role: 'assistant', content: assistant }];
          });
        }
        if (event.event === 'done') {
          const usage = event.data as { usage?: { tokens?: number } };
          setTokenHint((t) => ({
            in: t.in + Math.round(text.length / 4),
            out: t.out + (usage.usage?.tokens ?? assistant.length / 4),
          }));
        }
      }
      setLines((prev) => {
        const rest = prev.filter((l) => l.id !== 'streaming');
        return [...rest, { id: `a_${Date.now()}`, role: 'assistant', content: assistant }];
      });
    } finally {
      setStreaming(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
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
      </header>
      <div className="embed-agent-chat__messages">
        {lines.map((l) => (
          <div key={l.id} className={`embed-msg embed-msg--${l.role}`}>
            {l.role === 'assistant' ? (
              <MarkdownRenderer content={l.content} />
            ) : (
              l.content
            )}
          </div>
        ))}
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
        />
        <button type="button" className="send-btn" onClick={() => void send()} disabled={streaming}>
          发送
        </button>
      </div>
      <footer className="embed-agent-chat__footer">
        <span className="mono">
          in {Math.round(tokenHint.in)} · out {Math.round(tokenHint.out)} tok
        </span>
      </footer>
    </div>
  );
}
