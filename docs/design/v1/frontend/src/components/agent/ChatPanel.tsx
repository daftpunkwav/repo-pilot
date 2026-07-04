import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import { useAgentStore } from '@/stores/agentStore';
import { useSettings } from '@/hooks/useSettings';
import { AgentSelector } from './AgentSelector';
import { MessageBubble } from './MessageBubble';
import { StreamRenderer } from './StreamRenderer';
import { ToolCallCard } from './ToolCallCard';
import { QuestionPanel } from './QuestionPanel';
import { Link } from 'react-router-dom';

export function ChatPanel() {
  const messages = useAgentStore((s) => s.messages);
  const streaming = useAgentStore((s) => s.streaming);
  const streamingContent = useAgentStore((s) => s.streamingContent);
  const thinkingBuffer = useAgentStore((s) => s.thinkingBuffer);
  const pendingQuestion = useAgentStore((s) => s.pendingQuestion);
  const toolCalls = useAgentStore((s) => s.toolCalls);
  const activeAgent = useAgentStore((s) => s.activeAgent);
  const error = useAgentStore((s) => s.error);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const answerQuestion = useAgentStore((s) => s.answerQuestion);
  const skipQuestion = useAgentStore((s) => s.skipQuestion);
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['agentProfiles'],
    queryFn: async () => (await getApi().getAgentProfiles()).data,
  });

  const profile = profiles.find((p) => p.id === activeAgent);
  const emoji = profile?.avatar_emoji ?? '🤖';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingQuestion]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || pendingQuestion) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const llmOk = settings?.llm_configured !== false;

  return (
    <div className="chat-panel">
      {!llmOk && (
        <div className="chat-panel__banner">
          LLM 未配置，请前往 <Link to="/settings">设置</Link> 配置 API Key。
        </div>
      )}
      <AgentSelector profiles={profiles} />
      <div className="chat-panel__messages">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} emoji={emoji} />
        ))}
        {streaming && (
          <div className="message-bubble message-bubble--agent">
            <span className="message-bubble__avatar">{emoji}</span>
            <div className="message-bubble__content glass">
              <StreamRenderer
                content={streamingContent}
                thinking={thinkingBuffer}
                streaming={streaming}
              />
            </div>
          </div>
        )}
        {Array.from(toolCalls.entries()).map(([id, tc]) => (
          <ToolCallCard key={id} name={tc.name} args={tc.args} result={tc.result} />
        ))}
        {pendingQuestion && (
          <QuestionPanel
            question={pendingQuestion}
            onSubmit={(a) => void answerQuestion(a)}
            onSkip={skipQuestion}
          />
        )}
        {error && <div className="error-banner">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-panel__input">
        <textarea
          className="input textarea"
          data-testid="chat-input"
          rows={2}
          placeholder="输入消息… Enter 发送，Shift+Enter 换行"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming || Boolean(pendingQuestion) || !llmOk}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleSend()}
          disabled={streaming || Boolean(pendingQuestion) || !llmOk}
        >
          发送
        </button>
      </div>
    </div>
  );
}
