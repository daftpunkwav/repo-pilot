import { AgentMessage } from "../../types/agent";

interface MessageBubbleProps {
  message: AgentMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div className={`max-w-xl ${isUser ? "ml-auto text-right" : "mr-auto text-left"}`}>
      <span className="inline-block px-4 py-2 rounded-lg border border-border bg-surface whitespace-pre-wrap text-sm">{message.content}</span>
    </div>
  );
}
