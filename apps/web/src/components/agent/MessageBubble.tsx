import type { AgentMessage } from '@/api/types';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { formatMessageTime } from '@/utils/date';
import { AGENT_INITIALS, AGENT_ROLE_LABELS } from '@/utils/labels';
import {
  ensureAgentQuestion,
  recoverQuestionFromText,
  tryParseAnswerDump,
} from '@/utils/agentQuestion';
import { QuestionAnswerCard, QuestionOfferCard } from './QuestionHistoryCard';

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

  if (message.question) {
    const q = ensureAgentQuestion(message.question) ?? message.question;
    return (
      <div className="msg">
        <div className={`msg-avatar agent-${agentId}`}>{initial}</div>
        <div className="msg-body">
          <div className="msg-head">
            <span className="msg-name">{name}</span>
            <span className="msg-role">{role}</span>
            <span className="msg-time">{formatMessageTime(message.created_at)}</span>
          </div>
          <QuestionOfferCard question={q} agentName={name} />
        </div>
      </div>
    );
  }

  if (message.question_answer) {
    return (
      <div className="msg msg-user">
        <div className="msg-avatar">{initial}</div>
        <div className="msg-body">
          <div className="msg-head">
            <span className="msg-name">你</span>
            <span className="msg-time">{formatMessageTime(message.created_at)}</span>
          </div>
          <QuestionAnswerCard record={message.question_answer} />
        </div>
      </div>
    );
  }

  const recovered =
    !isUser && message.content ? recoverQuestionFromText(message.content) : null;
  if (recovered) {
    return (
      <div className="msg">
        <div className={`msg-avatar agent-${agentId}`}>{initial}</div>
        <div className="msg-body">
          <div className="msg-head">
            <span className="msg-name">{name}</span>
            <span className="msg-role">{role}</span>
            <span className="msg-time">{formatMessageTime(message.created_at)}</span>
          </div>
          <QuestionOfferCard question={recovered} agentName={name} />
        </div>
      </div>
    );
  }

  const answerDump = isUser && message.content ? tryParseAnswerDump(message.content) : null;
  if (answerDump) {
    return (
      <div className="msg msg-user">
        <div className="msg-avatar">{initial}</div>
        <div className="msg-body">
          <div className="msg-head">
            <span className="msg-name">你</span>
            <span className="msg-time">{formatMessageTime(message.created_at)}</span>
          </div>
          <QuestionAnswerCard record={answerDump} />
        </div>
      </div>
    );
  }

  const isLegacyAnswer = isUser && (message.content ?? '').startsWith('[反问回答]');
  const isLegacySkip = isUser && (message.content ?? '').startsWith('[跳过反问]');

  return (
    <div className={`msg ${isUser ? 'msg-user' : ''}`}>
      <div className={`msg-avatar ${isUser ? '' : `agent-${agentId}`}`}>{initial}</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">{isUser ? '你' : name}</span>
          {!isUser && <span className="msg-role">{role}</span>}
          <span className="msg-time">{formatMessageTime(message.created_at)}</span>
        </div>
        <div
          className={`msg-content ${isLegacyAnswer || isLegacySkip ? 'msg-content--qa-legacy' : ''}`}
        >
          {message.content && <MarkdownRenderer content={message.content} />}
        </div>
      </div>
    </div>
  );
}
