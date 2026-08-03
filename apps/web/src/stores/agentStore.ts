import { create } from 'zustand';
import type {
  AgentId,
  AgentMessage,
  AgentQuestion,
  AgentSession,
  QuestionAnswer,
  SSEEvent,
} from '@/api/types';
import { getApi } from '@/api/client';
import {
  asSSEAgentSwitch,
  asSSEError,
  asSSESubagentDone,
  asSSESubagentStart,
  asSSEToolCall,
  asSSEToolResult,
  asSSETextDelta,
  asSSEThinking,
} from '@/utils/sse-helpers';
import {
  ensureAgentQuestion,
  formatAnswersForCard,
  hydrateAgentMessages,
  isAskUserShapedText,
  questionTitle,
  recoverQuestionFromText,
} from '@/utils/agentQuestion';
import { persistableThinking } from '@/components/agent/StreamRenderer';
import { ensureSessionProjectsFromMessage } from '@/utils/sessionProjectBind';
import { isStreamSessionActive } from '@/utils/streamSessionGuard';
import { displaySwitchReason } from '@/utils/agentSwitchDisplay';
import { snapshotSubagents, snapshotToolCalls } from '@/utils/runTrace';

interface ToolCallEntry {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface SubagentProgress {
  agentId: AgentId;
  task?: string;
  reason?: string;
  status: 'running' | 'ok' | 'question' | 'error';
}

interface AgentState {
  sessions: AgentSession[];
  currentSessionId: string | null;
  messages: AgentMessage[];
  activeAgent: AgentId;
  streaming: boolean;
  streamingContent: string;
  thinkingBuffer: string;
  pendingQuestion: AgentQuestion | null;
  toolCalls: Map<string, ToolCallEntry>;
  /** Hub 汇总模式下的静默 Subagent 进度（不改 activeAgent） */
  subagents: SubagentProgress[];
  error: string | null;
  streamAbortController: AbortController | null;
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  answerQuestion: (answers: QuestionAnswer[], skipped?: boolean) => Promise<void>;
  skipQuestion: () => void;
  setActiveAgent: (agent: AgentId) => void;
  clearError: () => void;
  processSSEStream: (stream: AsyncGenerator<SSEEvent>) => Promise<void>;
  resetStreamState: () => void;
  cancelStream: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  activeAgent: 'hub',
  streaming: false,
  streamingContent: '',
  thinkingBuffer: '',
  pendingQuestion: null,
  toolCalls: new Map(),
  subagents: [],
  error: null,
  streamAbortController: null,

  loadSessions: async () => {
    const api = getApi();
    const response = await api.listAgentSessions();
    set({ sessions: response.data });
  },

  switchSession: async (sessionId) => {
    // 同会话流式进行中禁止用 DB 覆盖，否则会冲掉尚未落库完的 thinking / 半截正文
    const prev = get();
    if (prev.streaming && prev.currentSessionId === sessionId) {
      return;
    }

    // 切走正在生成的会话：先中断旧流，避免尾巴写入新会话
    if (prev.streaming && prev.currentSessionId !== sessionId) {
      get().cancelStream();
    }

    const api = getApi();
    const response = await api.getAgentSession(sessionId);
    const messages = hydrateAgentMessages(response.data.messages ?? []);
    // 若会话仍挂起反问（最后一条 assistant 带 question），恢复弹窗
    const lastQ = [...messages].reverse().find((m) => m.question);
    const lastAns = [...messages].reverse().find((m) => m.question_answer);
    const pending =
      lastQ?.question &&
      (!lastAns ||
        new Date(lastQ.created_at).getTime() > new Date(lastAns.created_at).getTime())
        ? ensureAgentQuestion(lastQ.question)
        : null;
    set({
      currentSessionId: sessionId,
      messages,
      activeAgent: response.data.agent,
      pendingQuestion: pending,
      streaming: false,
      streamingContent: '',
      thinkingBuffer: '',
      toolCalls: new Map(),
      subagents: [],
    });
  },

  createSession: async () => {
    if (get().streaming) {
      get().cancelStream();
    }
    const api = getApi();
    const response = await api.createAgentSession();
    const newSession = response.data;
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
      messages: [],
      activeAgent: 'hub',
      pendingQuestion: null,
      streaming: false,
      streamingContent: '',
      thinkingBuffer: '',
      toolCalls: new Map(),
      subagents: [],
    }));
  },

  deleteSession: async (sessionId) => {
    const api = getApi();
    await api.deleteAgentSession(sessionId);
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      const updates: Partial<AgentState> = { sessions };
      if (state.currentSessionId === sessionId) {
        // 优先切到用户主动对话，而非快速分析记录
        const preferred =
          sessions.find((s) => s.source !== 'analyze') ?? sessions[0];
        updates.currentSessionId = preferred?.id ?? null;
        updates.messages = [];
      }
      return updates;
    });
  },

  sendMessage: async (message) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    // 取消仍在进行的旧流
    get().cancelStream();

    const userMsg: AgentMessage = {
      id: `temp_${Date.now()}`,
      session_id: currentSessionId,
      agent: get().activeAgent,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      streaming: true,
      streamingContent: '',
      thinkingBuffer: '',
      error: null,
      toolCalls: new Map(),
      subagents: [],
    }));

    const api = getApi();

    // 提及仓库时先导入并绑定，再开聊，保证本轮已有项目上下文
    try {
      const sess = get().sessions.find((s) => s.id === currentSessionId);
      const currentIds =
        sess?.project_ids?.length
          ? sess.project_ids.map(String)
          : sess?.project_id
            ? [String(sess.project_id)]
            : [];
      const nextIds = await ensureSessionProjectsFromMessage(
        api,
        currentSessionId,
        message,
        currentIds
      );
      if (nextIds) {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  project_ids: nextIds,
                  project_id: nextIds[0] ?? null,
                }
              : s
          ),
        }));
      }
    } catch {
      // 绑定失败不阻断对话
    }

    const controller = new AbortController();
    set({ streamAbortController: controller });

    const stream = api.chatAgent(currentSessionId, message, controller.signal);
    await get().processSSEStream(stream);
  },

  answerQuestion: async (answers, skipped = false) => {
    const { currentSessionId, pendingQuestion } = get();
    if (!currentSessionId || !pendingQuestion) return;

    get().cancelStream();

    const isSkip = skipped || answers.length === 0;
    const q = ensureAgentQuestion(pendingQuestion) ?? pendingQuestion;
    const formatted = formatAnswersForCard(q, isSkip ? [] : answers);

    const userMsg: AgentMessage = {
      id: `msg_ans_${Date.now()}`,
      session_id: currentSessionId,
      agent: 'hub',
      role: 'user',
      content: isSkip ? '[跳过反问]' : `[反问回答] ${formatted.summary}`,
      question_answer: {
        question: q,
        answers: isSkip ? [] : answers,
        skipped: isSkip,
        summary: formatted.summary,
        details: formatted.details,
      },
      created_at: new Date().toISOString(),
    };

    set({
      pendingQuestion: null,
      streaming: true,
      streamingContent: '',
      thinkingBuffer: '',
      toolCalls: new Map(),
      subagents: [],
      messages: [...get().messages, userMsg],
    });

    const controller = new AbortController();
    set({ streamAbortController: controller });

    const api = getApi();
    const stream = api.answerQuestion(
      currentSessionId,
      pendingQuestion.question_id,
      isSkip ? [] : answers,
      controller.signal,
      isSkip
    );
    await get().processSSEStream(stream);
  },

  skipQuestion: () => {
    const { currentSessionId, pendingQuestion } = get();
    if (!currentSessionId || !pendingQuestion) {
      set({ pendingQuestion: null });
      return;
    }
    void get().answerQuestion([], true);
  },

  /** 仅用于 SSE 调度同步；UI 不再提供手动切换。 */
  setActiveAgent: (agent) => set({ activeAgent: agent }),

  clearError: () => set({ error: null }),

  resetStreamState: () =>
    set({
      streaming: false,
      streamingContent: '',
      thinkingBuffer: '',
      pendingQuestion: null,
      toolCalls: new Map(),
      subagents: [],
    }),

  cancelStream: () => {
    const { streamAbortController } = get();
    if (streamAbortController) {
      streamAbortController.abort();
      set({ streamAbortController: null });
    }
  },

  processSSEStream: async (stream) => {
    // 多 Agent 编排会多次发出 done；正文只在流结束时落盘一次，避免重复气泡
    let sawQuestion = false;
    const originSessionId = get().currentSessionId;
    const stillOnOrigin = () =>
      isStreamSessionActive(originSessionId, get().currentSessionId);

    const buildOffer = (normalized: AgentQuestion): AgentMessage => ({
      id: `msg_q_${normalized.question_id}`,
      session_id: originSessionId ?? '',
      agent: get().activeAgent,
      role: 'assistant',
      content: `发起反问：${questionTitle(normalized)}`,
      question: normalized,
      created_at: new Date().toISOString(),
    });

    /** 反问到来前，先把已流式输出的正文/思考落成历史消息 */
    const withFlushedPrior = (
      state: {
        messages: AgentMessage[];
        streamingContent: string;
        thinkingBuffer: string;
        activeAgent: AgentId;
        currentSessionId: string | null;
      },
      offer: AgentMessage
    ): AgentMessage[] => {
      const base = state.messages.filter((m) => m.id !== offer.id);
      const prior = state.streamingContent.trim();
      const priorThink = persistableThinking(state.thinkingBuffer);
      if ((prior && !isAskUserShapedText(prior)) || priorThink) {
        base.push({
          id: `msg_pre_${Date.now()}`,
          session_id: originSessionId ?? '',
          agent: state.activeAgent,
          role: 'assistant',
          content: prior && !isAskUserShapedText(prior) ? prior : undefined,
          ...(priorThink ? { thinking: priorThink } : {}),
          created_at: new Date().toISOString(),
        });
      }
      base.push(offer);
      return base;
    };

    try {
      for await (const event of stream) {
        if (!stillOnOrigin()) {
          break;
        }
        switch (event.event) {
          case 'text_delta': {
            const delta = asSSETextDelta(event.data);
            const piece = delta.content ?? '';
            if (!piece) break;
            set((state) => ({
              streamingContent: state.streamingContent + piece,
            }));
            break;
          }
          case 'thinking': {
            const thinking = asSSEThinking(event.data);
            set((state) => ({
              thinkingBuffer: state.thinkingBuffer + (thinking.content ?? ''),
            }));
            break;
          }
          case 'question': {
            if (!stillOnOrigin()) break;
            const normalized = ensureAgentQuestion(event.data, get().activeAgent);
            if (!normalized) break;
            sawQuestion = true;
            const offerMsg = buildOffer(normalized);
            set((state) => ({
              pendingQuestion: normalized,
              streaming: false,
              streamingContent: '',
              thinkingBuffer: '',
              toolCalls: new Map(),
              subagents: [],
              messages: withFlushedPrior(
                { ...state, currentSessionId: originSessionId },
                offerMsg
              ),
            }));
            break;
          }
          case 'tool_call': {
            const toolCall = asSSEToolCall(event.data);
            const raw = event.data as Record<string, unknown>;
            const callId =
              toolCall.call_id ||
              (typeof raw.id === 'string' ? raw.id : `tc_${Date.now()}`);
            const name = toolCall.name || String(raw.name ?? 'tool');
            const args = (toolCall.args ||
              (raw.args as Record<string, unknown>) ||
              {}) as Record<string, unknown>;

            // ask_user：只挂起弹窗，等 question 事件再写入历史卡，避免临时 id 与正式 UUID 双卡
            if (name === 'ask_user') {
              const normalized = ensureAgentQuestion(
                { ...args, title: args.title ?? '请回答以下问题' },
                get().activeAgent
              );
              if (normalized) {
                if (!stillOnOrigin()) break;
                sawQuestion = true;
                set((state) => {
                  const msgs = [...state.messages];
                  const prior = state.streamingContent.trim();
                  const priorThink = persistableThinking(state.thinkingBuffer);
                  if ((prior && !isAskUserShapedText(prior)) || priorThink) {
                    msgs.push({
                      id: `msg_pre_${Date.now()}`,
                      session_id: originSessionId ?? '',
                      agent: state.activeAgent,
                      role: 'assistant',
                      content: prior && !isAskUserShapedText(prior) ? prior : undefined,
                      ...(priorThink ? { thinking: priorThink } : {}),
                      created_at: new Date().toISOString(),
                    });
                  }
                  return {
                    pendingQuestion: normalized,
                    streaming: false,
                    streamingContent: '',
                    thinkingBuffer: '',
                    toolCalls: new Map(),
                    messages: msgs,
                  };
                });
                break;
              }
            }

            set((state) => {
              const newMap = new Map(state.toolCalls);
              newMap.set(callId, { name, args });
              return { toolCalls: newMap };
            });
            break;
          }
          case 'tool_result': {
            if (!stillOnOrigin()) break;
            const toolResult = asSSEToolResult(event.data);
            const raw = event.data as Record<string, unknown>;
            const callId =
              toolResult.call_id || (typeof raw.id === 'string' ? raw.id : '');
            const resultPayload = toolResult.result ?? raw.result ?? raw.preview;
            set((state) => {
              const newMap = new Map(state.toolCalls);
              const existing = callId ? newMap.get(callId) : undefined;
              if (existing && callId) {
                newMap.set(callId, {
                  ...existing,
                  result: resultPayload,
                });
              } else if (callId) {
                newMap.set(callId, {
                  name: String(raw.name ?? 'tool'),
                  args: {},
                  result: resultPayload,
                });
              }
              return { toolCalls: newMap };
            });
            // Hub 绑定项目后同步会话列表中的 project_ids
            const resultObj =
              resultPayload && typeof resultPayload === 'object'
                ? (resultPayload as Record<string, unknown>)
                : null;
            if (resultObj?.__session_projects__ && Array.isArray(resultObj.project_ids)) {
              const ids = resultObj.project_ids.map(String);
              if (originSessionId) {
                set((state) => ({
                  sessions: state.sessions.map((s) =>
                    s.id === originSessionId
                      ? {
                          ...s,
                          project_ids: ids,
                          project_id: ids[0] ?? null,
                        }
                      : s
                  ),
                }));
              }
            }
            break;
          }
          case 'agent_switch': {
            if (!stillOnOrigin()) break;
            const switchData = asSSEAgentSwitch(event.data);
            const raw = event.data as Record<string, unknown>;
            const next = (switchData.to ||
              (typeof raw.agent_id === 'string' ? raw.agent_id : null) ||
              get().activeAgent) as AgentId;
            const from = (switchData.from ||
              (typeof raw.from === 'string' ? raw.from : get().activeAgent) ||
              'hub') as AgentId;
            const reason =
              switchData.reason ||
              (typeof raw.reason === 'string' ? raw.reason : undefined);
            const sid = originSessionId ?? '';
            // 在 set 外读取缓冲，切换归属用 from（正在结束的 Agent），避免 activeAgent 不同步
            const snap = get();
            const prior = snap.streamingContent.trim();
            const priorThink = persistableThinking(snap.thinkingBuffer);
            const flushAgent = (from || snap.activeAgent) as AgentId;
            const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            set((state) => {
              const msgs = [...state.messages];
              // 仅状态行、无正文时不落气泡，避免 Hub 调度后留下空气泡
              const keepThink = Boolean(priorThink);
              // 有思考无正文时，用短切换说明作正文，避免「只有思考过程」空壳
              const body =
                prior ||
                (keepThink && reason?.trim()
                  ? displaySwitchReason(reason, next, 96)
                  : '');
              if (body || keepThink) {
                msgs.push({
                  id: `msg_${stamp}_pre_switch`,
                  session_id: sid,
                  agent: flushAgent,
                  role: 'assistant',
                  content: body || undefined,
                  ...(keepThink ? { thinking: priorThink } : {}),
                  created_at: new Date().toISOString(),
                });
              }
              if (from !== next) {
                msgs.push({
                  id: `msg_switch_${stamp}`,
                  session_id: sid,
                  agent: next,
                  role: 'assistant',
                  content: '',
                  agent_switch: {
                    from,
                    to: next,
                    reason,
                  },
                  created_at: new Date().toISOString(),
                });
              }
              return {
                activeAgent: next,
                messages: msgs,
                streamingContent: '',
                thinkingBuffer: '',
                toolCalls: new Map(),
                subagents: [],
              };
            });
            break;
          }
          case 'subagent_start': {
            if (!stillOnOrigin()) break;
            const data = asSSESubagentStart(event.data);
            const raw = event.data as Record<string, unknown>;
            const agentId = (data.agent_id ||
              (typeof raw.agent_id === 'string' ? raw.agent_id : 'scout')) as AgentId;
            set((state) => {
              const rest = state.subagents.filter((s) => s.agentId !== agentId);
              return {
                subagents: [
                  ...rest,
                  {
                    agentId,
                    task: data.task || (typeof raw.task === 'string' ? raw.task : undefined),
                    reason:
                      data.reason ||
                      (typeof raw.reason === 'string' ? raw.reason : undefined),
                    status: 'running' as const,
                  },
                ],
              };
            });
            break;
          }
          case 'subagent_done': {
            if (!stillOnOrigin()) break;
            const data = asSSESubagentDone(event.data);
            const raw = event.data as Record<string, unknown>;
            const agentId = (data.agent_id ||
              (typeof raw.agent_id === 'string' ? raw.agent_id : '')) as AgentId;
            const statusRaw = data.status || (typeof raw.status === 'string' ? raw.status : 'ok');
            const status =
              statusRaw === 'question' || statusRaw === 'error'
                ? statusRaw
                : 'ok';
            set((state) => ({
              subagents: state.subagents.map((s) =>
                s.agentId === agentId
                  ? { ...s, status: status as SubagentProgress['status'] }
                  : s
              ),
            }));
            break;
          }
          case 'session_projects': {
            if (!stillOnOrigin()) break;
            const raw = event.data as Record<string, unknown>;
            const ids = Array.isArray(raw.project_ids)
              ? raw.project_ids.map(String)
              : [];
            if (originSessionId) {
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === originSessionId
                    ? { ...s, project_ids: ids, project_id: ids[0] ?? null }
                    : s
                ),
              }));
            }
            break;
          }
          case 'done': {
            // 仅作中间信号：不在此处 push messages（防止多次 done 重复）
            break;
          }
          case 'error': {
            if (!stillOnOrigin()) break;
            const errData = asSSEError(event.data);
            set({ error: errData.message, streaming: false });
            break;
          }
          default:
            break;
        }
      }

      // 已切走会话：不写消息，只清本流控制器（避免污染新会话）
      if (!stillOnOrigin()) {
        set((state) => ({
          streamAbortController: null,
          ...(state.currentSessionId === originSessionId
            ? {
                streaming: false,
                streamingContent: '',
                thinkingBuffer: '',
                toolCalls: new Map(),
                subagents: [],
              }
            : {}),
        }));
        return;
      }

      // 流自然结束后统一落一条 assistant 消息
      if (!sawQuestion) {
        const { streamingContent, activeAgent, error } = get();
        if (originSessionId && streamingContent.trim() && !error) {
          // 模型把 ask_user 写成正文 JSON，或直接 Markdown 出题时，转成弹窗
          const recovered = recoverQuestionFromText(streamingContent);
          if (recovered) {
            const offerMsg = buildOffer(recovered);
            // JSON 前的说明文字保留；纯 Markdown 出题则整段用卡片替代，避免重复
            const trimmed = streamingContent.trim();
            const fromJson = trimmed.includes('{') && /"items"\s*:|"questions"\s*:/.test(trimmed);
            const jsonStart = trimmed.indexOf('{');
            const preamble =
              fromJson && jsonStart > 0 ? trimmed.slice(0, jsonStart).trim() : '';
            set((state) => {
              const msgs = [...state.messages.filter((m) => m.id !== offerMsg.id)];
              if (preamble && !isAskUserShapedText(preamble)) {
                msgs.push({
                  id: `msg_pre_${Date.now()}`,
                  session_id: originSessionId,
                  agent: activeAgent,
                  role: 'assistant',
                  content: preamble,
                  created_at: new Date().toISOString(),
                });
              }
              msgs.push(offerMsg);
              return {
                pendingQuestion: recovered,
                messages: msgs,
                streaming: false,
                streamingContent: '',
                thinkingBuffer: '',
                toolCalls: new Map(),
                subagents: [],
                streamAbortController: null,
              };
            });
          } else {
            const snap = get();
            const thinking = persistableThinking(snap.thinkingBuffer);
            const tool_calls = snapshotToolCalls(snap.toolCalls);
            const subagents = snapshotSubagents(snap.subagents, snap.thinkingBuffer);
            const assistantMsg: AgentMessage = {
              id: `msg_${Date.now()}`,
              session_id: originSessionId,
              agent: activeAgent,
              role: 'assistant',
              content: streamingContent,
              ...(thinking ? { thinking } : {}),
              ...(tool_calls.length ? { tool_calls } : {}),
              ...(subagents.length ? { subagents } : {}),
              created_at: new Date().toISOString(),
            };
            set((state) => ({
              messages: [...state.messages, assistantMsg],
              streaming: false,
              streamingContent: '',
              thinkingBuffer: '',
              toolCalls: new Map(),
              subagents: [],
              streamAbortController: null,
            }));
          }
        } else {
          set({
            streaming: false,
            streamAbortController: null,
            toolCalls: new Map(),
            subagents: [],
          });
        }
      } else {
        // 反问挂起：确保不残留流状态；正文已在 question 分支落库
        set({
          streaming: false,
          streamingContent: '',
          thinkingBuffer: '',
          toolCalls: new Map(),
          subagents: [],
          streamAbortController: null,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 已切走会话：不把半截正文写进新会话
        if (!stillOnOrigin()) {
          set({ streamAbortController: null });
          return;
        }
        // 中断时把半截正文落成气泡，避免「生成中」消失后内容全丢
        const {
          streamingContent,
          thinkingBuffer,
          activeAgent,
          pendingQuestion,
        } = get();
        const prior = streamingContent.trim();
        const priorThink = persistableThinking(thinkingBuffer);
        if (originSessionId && (prior || priorThink) && !pendingQuestion) {
          const snap = get();
          const tool_calls = snapshotToolCalls(snap.toolCalls);
          const subagents = snapshotSubagents(snap.subagents, thinkingBuffer);
          const assistantMsg: AgentMessage = {
            id: `msg_${Date.now()}_aborted`,
            session_id: originSessionId,
            agent: activeAgent,
            role: 'assistant',
            content: prior
              ? `${prior}\n\n*(已中断)*`
              : '*(已中断)*',
            ...(priorThink ? { thinking: priorThink } : {}),
            ...(tool_calls.length ? { tool_calls } : {}),
            ...(subagents.length ? { subagents } : {}),
            created_at: new Date().toISOString(),
          };
          set((state) => ({
            messages: [...state.messages, assistantMsg],
            streaming: false,
            streamingContent: '',
            thinkingBuffer: '',
            toolCalls: new Map(),
            subagents: [],
            streamAbortController: null,
          }));
        } else {
          // 被新流抢占且无半截正文：只停 streaming，保留 pendingQuestion
          set({ streaming: false, streamAbortController: null });
        }
        return;
      }
      if (!stillOnOrigin()) {
        set({ streamAbortController: null });
        return;
      }
      set({
        error: '连接中断，请重试',
        streaming: false,
        streamAbortController: null,
      });
    }
  },
}));
