import type { AgentMessage } from '@/api/types';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface MessageBubbleProps {
  message: AgentMessage;
  emoji?: string;
}

export function MessageBubble({ message, emoji }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--agent'}`}>
      {!isUser && emoji && <span className="message-bubble__avatar">{emoji}</span>}
      <div className="message-bubble__content glass">
        {message.content && <MarkdownRenderer content={message.content} />}
      </div>
    </div>
  );
}
