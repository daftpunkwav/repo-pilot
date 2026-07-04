import type { AgentMessage } from '@/api/types';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { formatMessageTime } from '@/utils/date';
import { AGENT_INITIALS, AGENT_ROLE_LABELS } from '@/utils/labels';

interface MessageBubbleProps {
  message: AgentMessage;
  agentName?: string;
}

export function MessageBubble({ message, agentName }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const agentId = message.agent;
  const name = agentName ?? agentId.charAt(0).toUpperCase() + agentId.slice(1);
  const role = AGENT_ROLE_LABELS[agentId] ?? agentId;
  const initial = isUser ? 'Z' : (AGENT_INITIALS[agentId] ?? name[0]);

  return (
    <div className={`msg ${isUser ? 'msg-user' : ''}`}>
      <div className={`msg-avatar ${isUser ? '' : `agent-${agentId}`}`}>{initial}</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">{isUser ? '你' : name}</span>
          {!isUser && <span className="msg-role">{role}</span>}
          <span className="msg-time">{formatMessageTime(message.created_at)}</span>
        </div>
        <div className="msg-content">
          {message.content && <MarkdownRenderer content={message.content} />}
        </div>
      </div>
    </div>
  );
}
