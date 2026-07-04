import type {
  AgentId,
  AgentQuestion,
  SSEEvent,
  SSEEventType,
} from '@/api/types';

const CHAR_DELAY_MS = 18;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 逐字 yield text_delta，使用 content 字段 */
export async function* streamText(
  text: string,
  charDelay = CHAR_DELAY_MS
): AsyncGenerator<SSEEvent> {
  for (const ch of text) {
    await sleep(charDelay);
    yield { event: 'text_delta', data: { content: ch } };
  }
}

export async function* yieldEvent(
  event: SSEEventType,
  data: Record<string, unknown>,
  delayMs = 100
): AsyncGenerator<SSEEvent> {
  await sleep(delayMs);
  yield { event, data };
}

/** 纯文本回复场景 */
export async function* mockTextReply(message: string): AsyncGenerator<SSEEvent> {
  const reply = `收到你的消息：「${message}」。这是 Mock Agent 的流式回复，演示 SSE text_delta 逐字输出。`;
  yield* streamText(reply);
  yield {
    event: 'done',
    data: { usage: { tokens: reply.length }, iterations: 1 },
  };
}

/** 带工具调用的回复场景 */
export async function* mockToolCallReply(): AsyncGenerator<SSEEvent> {
  yield {
    event: 'thinking',
    data: { content: '正在检索项目库…' },
  };
  await sleep(300);
  yield {
    event: 'tool_call',
    data: {
      call_id: 'tc_001',
      name: 'search_projects',
      args: { query: 'react', limit: 5 },
    },
  };
  await sleep(400);
  yield {
    event: 'tool_result',
    data: {
      call_id: 'tc_001',
      result: { count: 3, projects: ['facebook/react', 'vercel/next.js'] },
      duration_ms: 320,
    },
  };
  yield* streamText('根据检索结果，你的项目库中有 3 个 React 相关仓库。');
  yield {
    event: 'done',
    data: { usage: { tokens: 120 }, iterations: 2 },
  };
}

/** 带反问面板的回复场景 */
export async function* mockQuestionReply(): AsyncGenerator<SSEEvent> {
  yield* streamText('在继续之前，我需要了解你的学习目标：\n\n');
  const question: AgentQuestion = {
    question_id: `q_${Date.now()}`,
    intro: { type: 'markdown', content: '请回答以下问题，以便我定制学习建议。' },
    questions: [
      {
        id: 'q_goal',
        text: '你的主要学习目标是什么？',
        type: 'radio',
        options: [
          { value: 'job', label: '求职准备' },
          { value: 'side', label: '副业项目' },
          { value: 'curiosity', label: '兴趣探索' },
        ],
        allow_other: true,
      },
      {
        id: 'q_topics',
        text: '你感兴趣的技术领域（多选）',
        type: 'checkbox',
        options: [
          { value: 'frontend', text: '前端' },
          { value: 'backend', text: '后端' },
          { value: 'ai', text: 'AI / ML' },
          { value: 'devops', text: 'DevOps' },
        ],
      },
    ],
    actions: {
      submit: { text: '提交', style: 'primary' },
      skip: { text: '跳过', style: 'ghost' },
    },
    allow_skip: true,
    timeout: null,
  };
  yield { event: 'question', data: question as unknown as Record<string, unknown> };
}

/** 反问提交后的继续流 */
export async function* mockAfterQuestionAnswer(): AsyncGenerator<SSEEvent> {
  yield* streamText('感谢你的回答！我将根据你的选择制定个性化学习路径。');
  yield {
    event: 'done',
    data: { usage: { tokens: 80 }, iterations: 1 },
  };
}

/** Scout 项目分析流 */
export async function* mockProjectAnalysis(
  projectName: string,
  agent: AgentId = 'scout'
): AsyncGenerator<SSEEvent> {
  yield {
    event: 'thinking',
    data: { content: `正在分析 ${projectName}…` },
  };
  await sleep(400);
  const analysis = `# ${projectName} 技术概览\n\n## 核心特点\n\n- 活跃社区与完善文档\n- 适合${agent === 'scout' ? '快速入门' : '深度学习'}\n\n## 建议下一步\n\n1. 阅读 README 核心章节\n2. 运行示例项目\n3. 记录学习笔记`;
  yield* streamText(analysis, 12);
  yield {
    event: 'done',
    data: { usage: { tokens: analysis.length }, iterations: 1 },
  };
}

/** 根据消息内容选择 Mock 场景 */
export function selectChatScenario(message: string): () => AsyncGenerator<SSEEvent> {
  const lower = message.toLowerCase();
  if (lower.includes('tool') || lower.includes('工具')) {
    return mockToolCallReply;
  }
  if (lower.includes('question') || lower.includes('反问') || lower.includes('学习')) {
    return mockQuestionReply;
  }
  return () => mockTextReply(message);
}
