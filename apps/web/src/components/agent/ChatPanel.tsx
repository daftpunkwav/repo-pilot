import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getApi } from '@/api/client';
import { useAgentStore } from '@/stores/agentStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettings } from '@/hooks/useSettings';
import { useProjects } from '@/hooks/useProjects';
import { AgentSelector } from './AgentSelector';
import { MessageBubble } from './MessageBubble';
import { StreamRenderer } from './StreamRenderer';
import { ToolCallCard } from './ToolCallCard';
import { QuestionPanel } from './QuestionPanel';
import { AGENT_INITIALS, AGENT_ROLE_LABELS } from '@/utils/labels';

export function ChatPanel() {
  const sessions = useAgentStore((s) => s.sessions);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
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
  const user = useAuthStore((s) => s.user);
  const { data: projectsData } = useProjects();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['agentProfiles'],
    queryFn: async () => (await getApi().getAgentProfiles()).data,
  });

  const profile = profiles.find((p) => p.id === activeAgent);
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const projectCount = projectsData?.items.length ?? 0;
  const llmOk = settings?.llm_configured !== false;
  const modelName = settings?.llm_model ?? 'gpt-4o';

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

  return (
    <>
      <header className="chat-header">
        <AgentSelector profiles={profiles} />
        <div className="chat-title">
          <h2>{currentSession?.title ?? '新对话'}</h2>
          <div className="ctx">
            项目库 {projectCount} · {user?.username ?? 'guest'} · {modelName}
            <span className="dot" />
            <span style={{ color: 'var(--brand-500)' }}>
              Hub 智能调度 · 7 Agent 在线
            </span>
          </div>
        </div>
        <div className="chat-actions">
          <button type="button" className="chat-icon-btn" title="导出对话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <path d="M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          <button type="button" className="chat-icon-btn" title="更多">
            <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}>
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {!llmOk && (
        <div className="degrade-tip" style={{ margin: '8px 20px 0' }}>
          LLM 未配置，请前往 <Link to="/settings">设置</Link> 配置 API Key。
        </div>
      )}

      <div className="chat-messages">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            agentName={profiles.find((p) => p.id === m.agent)?.name}
          />
        ))}
        {streaming && (
          <div className="msg">
            <div className={`msg-avatar agent-${activeAgent}`}>
              {AGENT_INITIALS[activeAgent] ?? 'A'}
            </div>
            <div className="msg-body">
              <div className="msg-head">
                <span className="msg-name">{profile?.name ?? activeAgent}</span>
                <span className="msg-role">{AGENT_ROLE_LABELS[activeAgent]}</span>
                <span className="streaming-indicator">
                  <span className="streaming-dot" />
                  生成中
                </span>
              </div>
              <div className="msg-content">
                <StreamRenderer
                  content={streamingContent}
                  thinking={thinkingBuffer}
                  streaming={streaming}
                />
              </div>
            </div>
          </div>
        )}
        {Array.from(toolCalls.entries()).map(([id, tc]) => (
          <ToolCallCard key={id} name={tc.name} args={tc.args} result={tc.result} />
        ))}
        {pendingQuestion && (
          <div className="msg">
            <div className={`msg-avatar agent-${activeAgent}`}>
              {AGENT_INITIALS[activeAgent] ?? 'A'}
            </div>
            <div className="msg-body">
              <QuestionPanel
                question={pendingQuestion}
                onSubmit={(a) => void answerQuestion(a)}
                onSkip={skipQuestion}
              />
            </div>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-wrap">
        <div className="chat-input">
          <textarea
            className="chat-textarea"
            data-testid="chat-input"
            rows={2}
            placeholder="问 RepoPilot 任何关于开源项目的问题..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || Boolean(pendingQuestion) || !llmOk}
          />
          <div className="chat-toolbar">
            <span className="ctx-chip active">
              {projectCount > 0 ? `${projectCount} 个项目上下文` : '无项目上下文'}
            </span>
            <div className="spacer" />
            <span style={{ fontSize: 11, color: 'var(--text-400)', fontFamily: 'var(--font-mono)' }}>
              {input.length} 字符
            </span>
            <button
              type="button"
              className="send-btn"
              title="发送 (Enter)"
              onClick={() => void handleSend()}
              disabled={streaming || Boolean(pendingQuestion) || !llmOk}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={14} height={14}>
                <path d="M5 12l14 0M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="chat-hint">
          <span>
            <kbd>Enter</kbd> 发送 · <kbd>Shift</kbd>+<kbd>Enter</kbd> 换行
          </span>
          <span>SSE 流式输出已启用</span>
        </div>
      </div>
    </>
  );
}
