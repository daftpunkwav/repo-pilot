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

interface ToolCallEntry {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
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
  error: null,
  streamAbortController: null,

  loadSessions: async () => {
    const api = getApi();
    const response = await api.listAgentSessions();
    set({ sessions: response.data });
  },

  switchSession: async (sessionId) => {
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
    });
  },

  createSession: async () => {
    const api = getApi();
    const response = await api.createAgentSession();
    const newSession = response.data;
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
      messages: [],
      activeAgent: 'hub',
      pendingQuestion: null,
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
    }));

    const controller = new AbortController();
    set({ streamAbortController: controller });

    const api = getApi();
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
    }),

  cancelStream: () => {
    const { streamAbortController } = get();
    if (streamAbortController) {
      streamAbortController.abort();
      set({ streamAbortController: null, streaming: false });
    }
  },

  processSSEStream: async (stream) => {
    // 多 Agent 编排会多次发出 done；正文只在流结束时落盘一次，避免重复气泡
    let sawQuestion = false;

    const buildOffer = (normalized: AgentQuestion): AgentMessage => ({
      id: `msg_q_${normalized.question_id}`,
      session_id: get().currentSessionId ?? '',
      agent: get().activeAgent,
      role: 'assistant',
      content: `发起反问：${questionTitle(normalized)}`,
      question: normalized,
      created_at: new Date().toISOString(),
    });

    /** 反问到来前，先把已流式输出的正文落成历史消息，避免“模型丢失内容” */
    const withFlushedPrior = (
      state: { messages: AgentMessage[]; streamingContent: string; activeAgent: AgentId; currentSessionId: string | null },
      offer: AgentMessage
    ): AgentMessage[] => {
      const base = state.messages.filter((m) => m.id !== offer.id);
      const prior = state.streamingContent.trim();
      if (prior && !isAskUserShapedText(prior)) {
        base.push({
          id: `msg_pre_${Date.now()}`,
          session_id: state.currentSessionId ?? '',
          agent: state.activeAgent,
          role: 'assistant',
          content: prior,
          created_at: new Date().toISOString(),
        });
      }
      base.push(offer);
      return base;
    };

    try {
      for await (const event of stream) {
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
              messages: withFlushedPrior(
                { ...state, currentSessionId: get().currentSessionId },
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

            // 模型有时把 ask_user 参数放在 tool_call 里但不触发 question 事件 —— 兜底弹出
            if (name === 'ask_user') {
              const normalized = ensureAgentQuestion(
                { ...args, title: args.title ?? '请回答以下问题' },
                get().activeAgent
              );
              if (normalized) {
                sawQuestion = true;
                const offerMsg = buildOffer(normalized);
                set((state) => ({
                  pendingQuestion: normalized,
                  streaming: false,
                  streamingContent: '',
                  thinkingBuffer: '',
                  toolCalls: new Map(),
                  messages: withFlushedPrior(
                    { ...state, currentSessionId: get().currentSessionId },
                    offerMsg
                  ),
                }));
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
              const sid = get().currentSessionId;
              if (sid) {
                set((state) => ({
                  sessions: state.sessions.map((s) =>
                    s.id === sid
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
            const switchData = asSSEAgentSwitch(event.data);
            const raw = event.data as Record<string, unknown>;
            const next =
              switchData.to ||
              (typeof raw.agent_id === 'string' ? raw.agent_id : null) ||
              get().activeAgent;
            // 切换 Agent 时插入分隔，不拆成两条完整回复
            set((state) => ({
              activeAgent: next as AgentId,
              streamingContent: state.streamingContent
                ? `${state.streamingContent}\n\n`
                : state.streamingContent,
            }));
            break;
          }
          case 'session_projects': {
            const raw = event.data as Record<string, unknown>;
            const ids = Array.isArray(raw.project_ids)
              ? raw.project_ids.map(String)
              : [];
            const sid = get().currentSessionId;
            if (sid) {
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sid
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
            const errData = asSSEError(event.data);
            set({ error: errData.message, streaming: false });
            break;
          }
          default:
            break;
        }
      }

      // 流自然结束后统一落一条 assistant 消息
      if (!sawQuestion) {
        const { streamingContent, currentSessionId, activeAgent, error } = get();
        if (currentSessionId && streamingContent.trim() && !error) {
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
                  session_id: currentSessionId,
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
                streamAbortController: null,
              };
            });
          } else {
            const assistantMsg: AgentMessage = {
              id: `msg_${Date.now()}`,
              session_id: currentSessionId,
              agent: activeAgent,
              role: 'assistant',
              content: streamingContent,
              created_at: new Date().toISOString(),
            };
            set((state) => ({
              messages: [...state.messages, assistantMsg],
              streaming: false,
              streamingContent: '',
              thinkingBuffer: '',
              toolCalls: new Map(),
              streamAbortController: null,
            }));
          }
        } else {
          set({
            streaming: false,
            streamAbortController: null,
            toolCalls: new Map(),
          });
        }
      } else {
        // 反问挂起：确保不残留流状态；正文已在 question 分支落库
        set({
          streaming: false,
          streamingContent: '',
          thinkingBuffer: '',
          toolCalls: new Map(),
          streamAbortController: null,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 被新流抢占时不要清 pendingQuestion；只停 streaming
        set({ streaming: false, streamAbortController: null });
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
