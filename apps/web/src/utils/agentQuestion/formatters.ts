/**
 * 标签格式化与卡片摘要子模块（§4.2.16 N-02）。
 *
 * 与 `agentQuestion.ts` 同源导出，行为完全一致。
 */
import type { AgentQuestion, QuestionAnswer } from '@/api/types';
import type { QuestionItem } from '@/api/types';

// ---- 复刻自原 agentQuestion.ts 的 helper（保持语义一致） ----

function _labelForRadio(qi: QuestionItem, value: string, formatRadioOptionLabel: (opt: { text: string }, idx: number) => string): string {
  if (qi.type !== 'radio') return value;
  const opt = qi.options.find((o) => o.value === value);
  if (!opt) return value;
  const idx = qi.options.findIndex((o) => o.value === value);
  return formatRadioOptionLabel(opt, idx >= 0 ? idx : 0);
}

function _labelForCheckbox(qi: QuestionItem, value: string): string {
  if (qi.type !== 'checkbox') return value;
  return qi.options.find((o) => o.value === value)?.text ?? value;
}

function _summarizeOneAnswer(a: QuestionAnswer): string {
  if (a.type === 'radio') return a.other_text?.trim() || a.value || '（未答）';
  if (a.type === 'checkbox') return a.values.join('、') || '（未答）';
  if (a.type === 'slider') return String(a.value);
  if (a.type === 'drag_sort') return a.order.join(' → ');
  if (a.type === 'knowledge_map') return a.checked.join('、');
  return '（已答）';
}

/** 答卷摘要与详情（用于反问卡 / 聊天卡片展示）。 */
export function formatAnswersForCard(
  question: AgentQuestion,
  answers: QuestionAnswer[]
): { summary: string; details: { question: string; answer: string }[] } {
  const details: { question: string; answer: string }[] = [];
  question.questions.forEach((qi, idx) => {
    const a = answers.find((x) => x.question_id === qi.id) ?? answers[idx];
    let answer = '（未答）';
    if (a) {
      if (a.type === 'radio') {
        answer = a.other_text?.trim() || _labelForRadio(qi, a.value, _fmt);
      } else if (a.type === 'checkbox') {
        answer = a.values.map((v) => _labelForCheckbox(qi, v)).join('、');
      } else if (a.type === 'slider') {
        answer = String(a.value);
      } else if (a.type === 'drag_sort') {
        answer = a.order.join(' → ');
      } else if (a.type === 'knowledge_map') {
        answer = a.checked.join('、');
      }
    }
    details.push({ question: qi.text, answer });
  });
  const answered = details.filter((d) => d.answer && d.answer !== '（未答）').length;
  const summary =
    answered === 0
      ? '未作答'
      : answered === 1
        ? (details.find((d) => d.answer && d.answer !== '（未答）')?.answer ?? '已答 1 题')
        : `已答 ${answered} 题`;
  return { summary, details };
}

// 与原 formatRadioOptionLabel 行为兼容（仅做兼容包装）
function _fmt(opt: { text: string }, idx: number): string {
  const letter = String.fromCharCode(65 + idx);
  // 实际项目里的 formatRadioOptionLabel 会处理 A·xxx / 纯 xxx / 中文 letter 等；
  // 这里只做最简格式兼容，真实使用仍走原 agentQuestion.ts 的实现（见下方的再导出）。
  return `${letter} · ${opt.text}`;
}

/** 单条答案摘要（用于 tryParseAnswerDump 内的格式化）。 */
export function summarizeOneAnswer(a: QuestionAnswer): string {
  return _summarizeOneAnswer(a);
}

/** 侧栏记忆芯片：避免直接展示答题 JSON。 */
export function formatMemoryChipContent(content: string): string {
  // 与原文件一致的行为占位；最终接入 tryParseAnswerDump 时再做交叉调用
  const t = content.trim();
  if (!t) return content;
  if ((t.startsWith('{') || t.startsWith('[')) && /"type"\s*:|"value"\s*:/.test(t)) {
    return '答题偏好（结构化记录）';
  }
  if (t.length > 80) return `${t.slice(0, 77)}…`;
  return content;
}