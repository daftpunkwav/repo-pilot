/**
 * Agent 反问/测验：归一化、兜底选项、从正文 JSON/Markdown 识别题目
 */
import type {
  AgentQuestion,
  AgentMessage,
  QuestionAnswer,
  QuestionAnswerRecord,
  QuestionItem,
  RadioOption,
} from '@/api/types';

const LEVEL_OPTS: RadioOption[] = [
  { value: 'beginner', label: '初学 · 刚接触' },
  { value: 'intermediate', label: '了解 · 能读简单代码' },
  { value: 'advanced', label: '掌握 · 能独立改功能' },
  { value: 'expert', label: '精通 · 能讲架构与设计' },
];

const LANG_OPTS: RadioOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript / JavaScript' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C / C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'other', label: '其他（可在下方补充）' },
];

const GOAL_OPTS: RadioOption[] = [
  { value: 'overview', label: '快速了解某个项目' },
  { value: 'learn', label: '系统学习 / 跟读源码' },
  { value: 'agent_dev', label: '学习 Agent / AI 应用开发' },
  { value: 'path', label: '规划学习路径' },
  { value: 'compare', label: '对比多个项目' },
];

/** 无意义的占位选项（解析失败时的假 ABCD） */
export function isPlaceholderOptions(opts: RadioOption[]): boolean {
  if (opts.length < 2) return false;
  const placeholders = opts.filter((o) =>
    /^选项\s*[A-Da-d]$/u.test((o.label || o.value || '').trim())
  );
  return placeholders.length >= Math.min(2, opts.length);
}

function defaultOptionsFor(prompt: string, id: string): RadioOption[] {
  const key = `${id} ${prompt}`.toLowerCase();
  if (/水平|level|掌握|熟练|程度|阶段/.test(key)) return LEVEL_OPTS;
  if (/语言|language|tech|技术栈|熟悉|常用/.test(key)) return LANG_OPTS;
  if (/想做|目标|goal|这次|目的|来这里|主要想/.test(key)) return GOAL_OPTS;
  // 测验类不再返回假「选项 A」——交由调用方改文本题或从题干解析
  return [];
}

/** 检测是否被错误地按字符拆开（如 "ría" → r/í/a）；合法 A–D 题号不算 */
function looksLikeCharSplit(opts: RadioOption[]): boolean {
  if (opts.length < 2) return false;
  const allLetterKeys = opts.every((o) =>
    /^[A-Da-d]$/.test((o.label || o.value).trim())
  );
  if (allLetterKeys && opts.length <= 8) return false;
  const short = opts.filter((o) => (o.label || o.value).trim().length <= 1);
  return short.length >= Math.ceil(opts.length * 0.6);
}

/** 去掉选项文案上已有的 A. / B、 等题号前缀，避免 UI 再拼一次 */
export function stripOptionLetterPrefix(label: string): string {
  const t = label.trim();
  const stripped = t.replace(/^[A-Da-d][.、)）：:]\s*/u, '').trim();
  return stripped || t;
}

/** 展示用：统一成「A. 文案」，不重复字母 */
export function formatRadioOptionLabel(
  option: { value: string; label?: string },
  index: number
): string {
  const letter = /^[A-Da-d]$/.test(option.value)
    ? option.value.toUpperCase()
    : String.fromCharCode(65 + (index % 26));
  const body = stripOptionLetterPrefix(option.label || option.value);
  if (!body) return letter;
  if (body.toUpperCase() === letter) return letter;
  return `${letter}. ${body}`;
}

/** 清理题干中泄漏的 markdown fence / 空白 */
export function cleanQuestionText(text: string): string {
  let t = String(text ?? '').trim();
  t = t.replace(/^```(?:[\w+-]*)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  t = t.replace(/^`{1,3}\s*/, '').replace(/\s*`{1,3}$/, '').trim();
  if (!t || /^`{1,3}$/.test(t)) return '（题目文本缺失）';
  return t;
}

/** 从多行文本解析 A/B/C/D 选项 */
export function parseLetterOptions(text: string): RadioOption[] {
  const out: RadioOption[] = [];
  const re =
    /(?:^|\n)\s*(?:[-*•]\s*)?(?:\*\*)?([A-Da-d])(?:\*\*)?[.、)）：:]\s*(.+?)(?=(?:\n\s*(?:[-*•]\s*)?(?:\*\*)?[A-Da-d](?:\*\*)?[.、)）：:])|\n\n|$)/gs;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(text)) !== null) {
    const letter = m[1]!.toUpperCase();
    const label = stripOptionLetterPrefix(m[2]!.replace(/\*\*/g, '').trim());
    if (!label || seen.has(letter)) continue;
    seen.add(letter);
    out.push({ value: letter, label });
  }
  return out;
}

/** 从任意模型输出形态抽出可读选项 */
export function cleanOptions(raw: unknown, prompt = '', id = ''): RadioOption[] {
  let list: unknown[] = [];

  if (typeof raw === 'string') {
    const t = raw.trim();
    // 优先按 A/B/C 行解析
    const letterOpts = parseLetterOptions(t);
    if (letterOpts.length >= 2) {
      return letterOpts;
    }
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = t.split(/[,，;；|]/).map((s) => s.trim()).filter(Boolean);
      }
    } else if (t.includes('\n')) {
      list = t.split(/\n/).map((s) => s.trim()).filter(Boolean);
    } else if (t) {
      // 无分隔的整句：当作单一候选，后面用兜底补齐
      list = t.split(/[,，;；|]/).map((s) => s.trim()).filter(Boolean);
    }
  } else if (Array.isArray(raw)) {
    // 防护：字符串被展开成字符数组；保留合法 ['A','B','C']
    if (
      raw.length >= 2 &&
      raw.every((x) => typeof x === 'string' && (x as string).length <= 1) &&
      !raw.every((x) => typeof x === 'string' && /^[A-Da-d]$/.test(x as string))
    ) {
      list = [];
    } else {
      list = raw;
    }
  } else if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw as Record<string, unknown>);
    // 防护：{"0":"r","1":"í","2":"a"} 字符索引对象
    if (
      entries.length >= 2 &&
      entries.every(
        ([k, v]) => /^\d+$/.test(k) && typeof v === 'string' && (v as string).length <= 1
      )
    ) {
      list = [];
    } else {
      list = entries.map(([k, v]) => {
        if (v && typeof v === 'object') return v;
        return { value: k, label: String(v ?? k) };
      });
    }
  }

  const out: RadioOption[] = [];
  for (const o of list) {
    if (o == null) continue;
    if (typeof o === 'string' || typeof o === 'number') {
      const s = String(o).trim();
      if (!s) continue;
      const m = s.match(/^([A-Da-d])[.、)）：:\s]+\s*(.+)$/);
      if (m?.[1] && m[2]) {
        out.push({
          value: m[1].toUpperCase(),
          label: stripOptionLetterPrefix(m[2].trim()),
        });
      } else {
        out.push({ value: s, label: stripOptionLetterPrefix(s) });
      }
      continue;
    }
    if (typeof o === 'object') {
      // 嵌套数组 ["A", "描述"] 
      if (Array.isArray(o)) {
        if (o.length >= 2) {
          const letter = String(o[0]).trim();
          const label = stripOptionLetterPrefix(String(o[1]).trim());
          if (label) {
            out.push({
              value: /^[A-Da-d]$/.test(letter) ? letter.toUpperCase() : letter,
              label,
            });
          }
        }
        continue;
      }
      const obj = o as Record<string, unknown>;
      let label = String(
        obj.label ??
          obj.text ??
          obj.name ??
          obj.content ??
          obj.desc ??
          obj.description ??
          obj.answer ??
          obj.option ??
          obj.choice ??
          obj.body ??
          ''
      ).trim();
      let value = String(obj.value ?? obj.id ?? obj.key ?? '').trim();
      // 仅有 A–D 题号时，尝试把 description 提成正文
      if (
        (!label || (/^[A-Da-d]$/.test(label) && label === value)) &&
        obj.description
      ) {
        label = String(obj.description).trim();
      }
      if (!label && !value) {
        const entries = Object.entries(obj).filter(
          ([k]) => !['correct', 'is_correct', 'score'].includes(k)
        );
        if (entries.length === 1 && entries[0]) {
          value = entries[0][0];
          label = String(entries[0][1] ?? '').trim();
        } else if (
          entries.length >= 1 &&
          entries.every(([k]) => /^[A-Da-d]$/i.test(k))
        ) {
          // {"A":"文案"} 单键对象
          const [k, v] = entries[0]!;
          value = k.toUpperCase();
          label = String(v ?? '').trim();
        }
      }
      if (!label && value) label = value;
      if (!value && label) value = label;
      if (!label && !value) continue;
      label = stripOptionLetterPrefix(label);
      // 丢弃无意义的单字符（除非只是 A/B/C/D 字母题号且无更好标签——仍太短则跳过）
      if (label.length <= 1 && !/^[A-Da-d]$/.test(label)) continue;
      // 纯题号无正文：跳过，留给题干解析 / 文本题兜底
      if (/^[A-Da-d]$/.test(label) && (!obj.description || label === value)) {
        continue;
      }
      const opt: RadioOption = { value, label };
      if (obj.description && String(obj.description) !== label) {
        opt.description = String(obj.description);
      }
      out.push(opt);
    }
  }

  if (looksLikeCharSplit(out) || out.length < 2 || isPlaceholderOptions(out)) {
    // 尝试从题干里抠 A/B/C
    const fromPrompt = parseLetterOptions(prompt);
    if (fromPrompt.length >= 2 && !isPlaceholderOptions(fromPrompt)) {
      return fromPrompt;
    }
    const defaults = defaultOptionsFor(prompt, id);
    if (defaults.length >= 2) return defaults;
    return out.length >= 2 && !isPlaceholderOptions(out) ? out : [];
  }
  return out;
}

function isExamLike(prompt: string, qtype: string, title = ''): boolean {
  if (qtype === 'quiz') return true;
  // 仅明确「测验/考试」语义才标 exam；普通选择题澄清不算测验
  return /测验|考试|小测试|考考你|掌握度|第\s*\d+\s*题/.test(`${prompt} ${title}`);
}

function normalizeItem(
  raw: Record<string, unknown>,
  index: number,
  title = ''
): QuestionItem {
  const id = String(raw.id ?? `q_${index + 1}`);
  const prompt = cleanQuestionText(
    String(raw.prompt ?? raw.text ?? raw.question ?? '请选择')
  );
  const qtype = String(raw.type ?? 'single_choice').toLowerCase();
  const rawOpts = raw.options ?? raw.choices ?? raw.answers ?? [];
  const opts = cleanOptions(rawOpts, prompt, id);
  const exam = isExamLike(prompt, qtype, title);

  if (qtype === 'multi_choice' || qtype === 'checkbox') {
    if (opts.length < 2) {
      return {
        id,
        text: `${prompt}\n\n（选项未能解析，请直接填写）`,
        type: 'radio',
        options: [{ value: 'other', label: '自由填写（在下方输入）' }],
        allow_other: true,
      };
    }
    return {
      id,
      text: prompt,
      type: 'checkbox',
      options: opts.map((o) => ({ value: o.value, text: o.label })),
    };
  }
  if (qtype === 'scale' || qtype === 'slider') {
    return {
      id,
      text: prompt,
      type: 'slider',
      min: Number(raw.min ?? 0),
      max: Number(raw.max ?? 100),
      labels: (raw.labels as Record<string, string>) ?? { '0': '不懂', '100': '精通' },
    };
  }
  if (qtype === 'text' && !exam) {
    return {
      id,
      text: prompt,
      type: 'radio',
      options: [{ value: 'other', label: '自由填写（在下方输入）' }],
      allow_other: true,
    };
  }
  // 单选 / quiz：禁止假「选项 A」；解析失败则改为可填写
  if (opts.length < 2 || isPlaceholderOptions(opts)) {
    return {
      id,
      text: `${prompt}\n\n（选项未能解析，请直接填写你的答案）`,
      type: 'radio',
      options: [{ value: 'other', label: '自由填写（在下方输入）' }],
      allow_other: true,
      exam: false,
    };
  }
  return {
    id,
    text: prompt,
    type: 'radio',
    options: opts,
    allow_other: !exam,
    exam,
  };
}

/** 将后端 AgentQuestion 或原始 ask_user 参数统一成可渲染结构 */
export function ensureAgentQuestion(raw: unknown, _agentId = 'hub'): AgentQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // 已是前端结构
  if (Array.isArray(obj.questions) && obj.question_id) {
    const q = obj as unknown as AgentQuestion;
    const title = questionTitle(q);
    const generic = new Set(['请回答以下问题', '请选择', '请选择最符合的一项', '']);
    return {
      ...q,
      questions: q.questions.map((item) => {
        if (item.type === 'radio') {
          const opts = cleanOptions(item.options, item.text, item.id);
          const exam =
            typeof item.exam === 'boolean'
              ? item.exam
              : isExamLike(item.text, 'single_choice', title);
          if (opts.length < 2 || isPlaceholderOptions(opts)) {
            return {
              ...item,
              text: cleanQuestionText(
                /选项未能解析/.test(item.text)
                  ? item.text
                  : `${item.text}\n\n（选项未能解析，请直接填写你的答案）`
              ),
              options: [{ value: 'other', label: '自由填写（在下方输入）' }],
              exam: false,
              allow_other: true,
            };
          }
          let text = cleanQuestionText(item.text);
          if (generic.has(text.trim()) || text.trim() === title.trim()) {
            const labels = opts.map((o) => o.label).join(' ');
            if (/初学|了解|掌握|精通/.test(labels)) {
              text = '你的编程 / 技术掌握水平大致处于哪个阶段？';
            } else if (/Python|TypeScript|Go|Rust/.test(labels)) {
              text = '你更熟悉 / 想用哪一类技术栈？';
            } else {
              text = '请选择最符合你情况的一项：';
            }
          }
          return {
            ...item,
            text,
            options: opts,
            exam,
            allow_other: exam ? false : item.allow_other,
          };
        }
        if (item.type === 'checkbox') {
          const opts = cleanOptions(
            item.options.map((o) => ({ value: o.value, label: o.text })),
            item.text,
            item.id
          );
          return {
            ...item,
            text: cleanQuestionText(item.text),
            options: opts.map((o) => ({ value: o.value, text: o.label })),
          };
        }
        return { ...item, text: cleanQuestionText(item.text) };
      }),
    };
  }

  // 原始 ask_user：{ title, items, allow_skip }
  const items = obj.items;
  if (!Array.isArray(items) && !obj.title) return null;

  const title = String(obj.title ?? '请回答以下问题');
  const list = Array.isArray(items) ? items : [];
  const questions = list
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((it, i) => normalizeItem(it, i, title));

  if (questions.length === 0) {
    questions.push({
      id: 'default',
      text: '你的编程 / 技术掌握水平大致处于哪个阶段？',
      type: 'radio',
      options: LEVEL_OPTS,
      allow_other: true,
    });
  } else {
    const generic = new Set(['请回答以下问题', '请选择', '请选择最符合的一项', '']);
    for (const q of questions) {
      const text = (q.text || '').trim();
      if (text && !generic.has(text) && text !== title.trim()) continue;
      const labels =
        q.type === 'radio'
          ? q.options.map((o) => o.label).join(' ')
          : q.type === 'checkbox'
            ? q.options.map((o) => o.text).join(' ')
            : '';
      if (/初学|了解|掌握|精通/.test(labels)) {
        q.text = '你的编程 / 技术掌握水平大致处于哪个阶段？';
      } else if (/Python|TypeScript|Go|Rust/.test(labels)) {
        q.text = '你更熟悉 / 想用哪一类技术栈？';
      } else if (generic.has(text) || text === title.trim()) {
        q.text = '请选择最符合你情况的一项：';
      }
    }
  }

  const allowSkip = obj.allow_skip !== false;
  return {
    question_id: String(obj.question_id ?? `q_${Date.now()}`),
    intro: { type: 'markdown', content: `**${title}**` },
    questions,
    actions: {
      submit: { text: '提交', style: 'primary' },
      skip: allowSkip ? { text: '跳过', style: 'ghost' } : undefined,
    },
    allow_skip: allowSkip,
    timeout: null,
  };
}

/** 从助手正文中提取 ask_user JSON（模型未走工具时的兜底） */
export function extractAskUserFromText(text: string): AgentQuestion | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && /"items"\s*:|"questions"\s*:/.test(trimmed)) {
    try {
      return ensureAgentQuestion(JSON.parse(trimmed));
    } catch {
      /* continue */
    }
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    try {
      const q = ensureAgentQuestion(JSON.parse(fence[1].trim()));
      if (q) return q;
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    if (/"items"\s*:/.test(slice) || /"questions"\s*:/.test(slice)) {
      try {
        return ensureAgentQuestion(JSON.parse(slice));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * 从 Markdown 正文识别「请选 A/B/C/D」式出题，转为交互弹窗。
 * 覆盖模型不调用 ask_user、直接在气泡里出题的情况。
 */
export function extractMarkdownQuiz(text: string): AgentQuestion | null {
  if (!text || text.length < 20) return null;
  const opts = parseLetterOptions(text);
  if (opts.length < 2) return null;

  // 需要有「题目」语气或明确要求作答
  const looksLikeQuiz =
    /第\s*\d+\s*题|题目[：:]|请直接选|请选择|选出|测验|小测试|正确答案|选项/.test(text) ||
    (/[A-D][.、)]/.test(text) && /[A-D][.、)]/.test(text.split('\n').slice(1).join('\n')));
  if (!looksLikeQuiz) return null;

  // 抽取题干：优先「题目：」后内容，否则取选项前最后一段非空行
  let prompt = '';
  const topic = text.match(/题目[：:]\s*(.+?)(?=\n|$)/);
  if (topic?.[1]) {
    prompt = topic[1].replace(/\*\*/g, '').trim();
  }
  if (!prompt) {
    const beforeOpts = text.split(/\n\s*(?:[-*•]\s*)?(?:\*\*)?[A-Da-d]/)[0] ?? text;
    const lines = beforeOpts
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l && !/^[-—–]{2,}$/.test(l));
    prompt = lines[lines.length - 1] || '请选择正确答案';
  }

  const titleMatch = text.match(/(?:第\s*\d+\s*题\s*\/\s*\d+[：:]\s*)?([^\n]{4,40})/);
  const title =
    (text.match(/第\s*\d+\s*题\s*\/\s*\d+[：:]?\s*[^\n]*/)?.[0] ||
      titleMatch?.[1] ||
      '测验题').replace(/\*\*/g, '').trim();

  return ensureAgentQuestion({
    title,
    allow_skip: true,
    items: [
      {
        id: 'md_q1',
        type: 'quiz',
        prompt,
        options: opts.map((o) => ({ value: o.value, label: o.label })),
      },
    ],
  });
}

/** 任意正文 → 结构化反问（JSON 优先，其次 Markdown 选择题） */
export function recoverQuestionFromText(text: string): AgentQuestion | null {
  return extractAskUserFromText(text) ?? extractMarkdownQuiz(text);
}

export function isAskUserShapedText(text: string): boolean {
  return recoverQuestionFromText(text) !== null;
}

export function questionTitle(q: AgentQuestion): string {
  return (q.intro?.content ?? '结构化反问').replace(/\*\*/g, '').trim() || '结构化反问';
}

export function formatAnswersForCard(
  question: AgentQuestion,
  answers: QuestionAnswer[]
): { summary: string; details: { question: string; answer: string }[] } {
  const details: { question: string; answer: string }[] = [];
  question.questions.forEach((qi, idx) => {
    const a = answers.find((x) => x.question_id === qi.id) ?? answers[idx];
    let answer = '（未答）';
    if (a) {
      if (a.type === 'radio') answer = a.other_text?.trim() || labelForRadio(qi, a.value);
      else if (a.type === 'checkbox') answer = a.values.map((v) => labelForCheckbox(qi, v)).join('、');
      else if (a.type === 'slider') answer = String(a.value);
      else if (a.type === 'drag_sort') answer = a.order.join(' → ');
      else if (a.type === 'knowledge_map') answer = a.checked.join('、');
    }
    details.push({ question: qi.text, answer });
  });
  // 卡片摘要保持短；完整选项进详情，避免一行挤满 A·B·C
  const answered = details.filter((d) => d.answer && d.answer !== '（未答）').length;
  const summary =
    answered === 0
      ? '未作答'
      : answered === 1
        ? details.find((d) => d.answer && d.answer !== '（未答）')?.answer ?? `已答 1 题`
        : `已答 ${answered} 题`;
  return { summary, details };
}

function labelForRadio(qi: QuestionItem, value: string): string {
  if (qi.type !== 'radio') return value;
  const opt = qi.options.find((o) => o.value === value);
  if (!opt) return value;
  const idx = qi.options.findIndex((o) => o.value === value);
  return formatRadioOptionLabel(opt, idx >= 0 ? idx : 0);
}

function labelForCheckbox(qi: QuestionItem, value: string): string {
  if (qi.type !== 'checkbox') return value;
  return qi.options.find((o) => o.value === value)?.text ?? value;
}

export function isExamQuestion(q: AgentQuestion): boolean {
  return q.questions.some((item) => item.type === 'radio' && item.exam);
}

/** 将会话 API 消息水合为可渲染的 question / question_answer 卡片 */
export function hydrateAgentMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.map((m) => {
    if (m.question) {
      return { ...m, question: ensureAgentQuestion(m.question) ?? m.question };
    }
    if (m.question_answer?.question) {
      const q = ensureAgentQuestion(m.question_answer.question) ?? m.question_answer.question;
      return { ...m, question_answer: { ...m.question_answer, question: q } };
    }
    if (m.role === 'assistant' && m.content) {
      const recovered = recoverQuestionFromText(m.content);
      if (recovered) {
        return {
          ...m,
          question: recovered,
          content: `发起反问：${questionTitle(recovered)}`,
        };
      }
    }
    if (m.role === 'user' && m.content) {
      const ans = tryParseAnswerDump(m.content);
      if (ans) return { ...m, question_answer: ans, content: `[反问回答] ${ans.summary}` };
    }
    return m;
  });
}

/** 把泄漏到聊天/偏好里的答案 JSON 收成可读摘要 */
export function tryParseAnswerDump(text: string): QuestionAnswerRecord | null {
  const raw = text.replace(/^\[反问回答\]\s*/, '').trim();
  if (!raw.startsWith('{') && !raw.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const answers: QuestionAnswer[] = [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object' && 'type' in (item as object)) {
          answers.push(item as QuestionAnswer);
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'type' in (v as object)) {
          answers.push({
            ...(v as QuestionAnswer),
            question_id: (v as QuestionAnswer).question_id ?? k,
          });
        } else if (typeof v === 'string' || typeof v === 'number') {
          answers.push({ type: 'radio', value: String(v), question_id: k });
        }
      }
    }
    if (answers.length === 0) return null;
    const details = answers.map((a, i) => ({
      question: `第 ${i + 1} 题`,
      answer: summarizeOneAnswer(a),
    }));
    const summary =
      details.length <= 3
        ? details.map((d) => d.answer).join(' · ')
        : `已回答 ${details.length} 题`;
    return {
      question: {
        question_id: 'recovered',
        intro: { type: 'markdown', content: '历史回答' },
        questions: answers.map((a, i) => ({
          id: a.question_id ?? `q_${i}`,
          text: `第 ${i + 1} 题`,
          type: 'radio' as const,
          options: [],
        })),
        actions: { submit: { text: '提交', style: 'primary' } },
        allow_skip: true,
        timeout: null,
      },
      answers,
      summary,
      details,
    };
  } catch {
    return null;
  }
}

function summarizeOneAnswer(a: QuestionAnswer): string {
  if (a.type === 'radio') return a.other_text?.trim() || a.value || '（未答）';
  if (a.type === 'checkbox') return a.values.join('、') || '（未答）';
  if (a.type === 'slider') return String(a.value);
  if (a.type === 'drag_sort') return a.order.join(' → ');
  if (a.type === 'knowledge_map') return a.checked.join('、');
  return '（已答）';
}

/** 侧栏记忆芯片：避免直接展示答题 JSON */
export function formatMemoryChipContent(content: string): string {
  const t = content.trim();
  if (!t) return content;
  if ((t.startsWith('{') || t.startsWith('[')) && /"type"\s*:|"value"\s*:/.test(t)) {
    const recovered = tryParseAnswerDump(t);
    if (recovered) return `答题偏好 · ${recovered.summary}`;
    return '学习偏好（结构化记录）';
  }
  if (t.length > 80) return `${t.slice(0, 77)}…`;
  return content;
}
