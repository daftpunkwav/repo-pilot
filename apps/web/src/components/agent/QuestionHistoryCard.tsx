import { useState } from 'react';
import type { AgentMessage, AgentQuestion, QuestionAnswerRecord } from '@/api/types';
import { isExamQuestion, questionTitle } from '@/utils/agentQuestion';
import { QuestionPanel } from './QuestionPanel';

/** 对话历史中的反问卡片：摘要 + 点击展开详情 */
export function QuestionOfferCard({
  question,
  agentName,
}: {
  question: AgentQuestion;
  agentName?: string;
}) {
  const [open, setOpen] = useState(false);
  const title = questionTitle(question);
  const n = question.questions.length;
  const exam = isExamQuestion(question);

  return (
    <>
      <button type="button" className="qa-card qa-card--offer" onClick={() => setOpen(true)}>
        <span className="qa-card__badge">{exam ? '测验' : '反问'}</span>
        <span className="qa-card__title">{title}</span>
        <span className="qa-card__meta">
          {n} 题 · {agentName ?? 'Agent'} · 点击查看题目
        </span>
      </button>
      {open && (
        <div className="question-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="question-modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="question-modal__head">
              <span className="question-modal__badge">{exam ? '测验详情' : '反问详情'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
            <ul className="qa-detail-list">
              {question.questions.map((q, i) => (
                <li key={q.id} className="qa-detail-item">
                  <strong className="qa-detail-item__q">
                    {i + 1}. {q.text}
                  </strong>
                  {q.type === 'radio' && (
                    <div className="qa-detail-opts">
                      {q.options.map((o, oi) => (
                        <span key={o.value}>
                          {String.fromCharCode(65 + oi)}. {o.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.type === 'checkbox' && (
                    <div className="qa-detail-opts">
                      {q.options.map((o) => (
                        <span key={o.value}>{o.text}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

/** 用户答题结果卡片 */
export function QuestionAnswerCard({ record }: { record: QuestionAnswerRecord }) {
  const [open, setOpen] = useState(false);
  const title = questionTitle(record.question);

  return (
    <>
      <button type="button" className="qa-card qa-card--answer" onClick={() => setOpen(true)}>
        <span className="qa-card__badge">{record.skipped ? '已跳过' : '已回答'}</span>
        <span className="qa-card__title">{title}</span>
        <span className="qa-card__meta">
          {record.skipped ? '点击查看题目' : record.summary}
        </span>
      </button>
      {open && (
        <div className="question-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="question-modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="question-modal__head">
              <span className="question-modal__badge">回答详情</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
            <ul className="qa-detail-list">
              {record.details.map((d, i) => (
                <li key={`${d.question}-${i}`} className="qa-detail-item">
                  <strong className="qa-detail-item__q">
                    {i + 1}. {d.question}
                  </strong>
                  <p className="qa-detail-item__a">{record.skipped ? '（跳过）' : d.answer}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

/** 从消息内容恢复历史反问/回答展示 */
export function hydrateMessageVisual(message: AgentMessage): AgentMessage {
  if (message.question || message.question_answer) return message;
  return message;
}

/** 活动弹窗包装 */
export function LiveQuestionModal({
  question,
  agentLabel,
  onSubmit,
  onSkip,
}: {
  question: AgentQuestion;
  agentLabel: string;
  onSubmit: Parameters<typeof QuestionPanel>[0]['onSubmit'];
  onSkip?: () => void;
}) {
  const exam = isExamQuestion(question);
  return (
    <div className="question-modal-backdrop" data-testid="question-modal">
      <div className="question-modal question-modal--live">
        <div className="question-modal__head">
          <span className="question-modal__badge">{exam ? '测验' : '请回答'}</span>
          <span className="question-modal__agent">{agentLabel}</span>
        </div>
        <QuestionPanel question={question} onSubmit={onSubmit} onSkip={onSkip} />
      </div>
    </div>
  );
}
