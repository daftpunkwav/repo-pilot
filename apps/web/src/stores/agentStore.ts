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
  answerQuestion: (answers: QuestionAnswer[]) => Promise<void>;
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
    set({
      currentSessionId: sessionId,
      messages: response.data.messages,
      activeAgent: response.data.agent,
      pendingQuestion: null,
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
        const first = sessions[0];
        updates.currentSessionId = first?.id ?? null;
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

  answerQuestion: async (answers) => {
    const { currentSessionId, pendingQuestion } = get();
    if (!currentSessionId || !pendingQuestion) return;

    get().cancelStream();

    set({
      pendingQuestion: null,
      streaming: true,
      streamingContent: '',
    });

    const controller = new AbortController();
    set({ streamAbortController: controller });

    const api = getApi();
    const stream = api.answerQuestion(
      currentSessionId,
      pendingQuestion.question_id,
      answers,
      controller.signal
    );
    await get().processSSEStream(stream);
  },

  skipQuestion: () => {
    const { currentSessionId, pendingQuestion } = get();
    if (!currentSessionId || !pendingQuestion) {
      set({ pendingQuestion: null });
      return;
    }
    void (async () => {
      get().cancelStream();
      set({
        pendingQuestion: null,
        streaming: true,
        streamingContent: '',
      });
      const controller = new AbortController();
      set({ streamAbortController: controller });
      const api = getApi();
      const stream = api.answerQuestion(
        currentSessionId,
        pendingQuestion.question_id,
        [],
        controller.signal,
        true
      );
      await get().processSSEStream(stream);
    })();
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
          case 'tool_call': {
            const toolCall = asSSEToolCall(event.data);
            const raw = event.data as Record<string, unknown>;
            const callId =
              toolCall.call_id ||
              (typeof raw.id === 'string' ? raw.id : `tc_${Date.now()}`);
            set((state) => {
              const newMap = new Map(state.toolCalls);
              newMap.set(callId, {
                name: toolCall.name || String(raw.name ?? 'tool'),
                args: (toolCall.args ||
                  (raw.args as Record<string, unknown>) ||
                  {}) as Record<string, unknown>,
              });
              return { toolCalls: newMap };
            });
            break;
          }
          case 'tool_result': {
            const toolResult = asSSEToolResult(event.data);
            const raw = event.data as Record<string, unknown>;
            const callId =
              toolResult.call_id || (typeof raw.id === 'string' ? raw.id : '');
            set((state) => {
              const newMap = new Map(state.toolCalls);
              const existing = callId ? newMap.get(callId) : undefined;
              if (existing && callId) {
                newMap.set(callId, {
                  ...existing,
                  result: toolResult.result ?? raw.result ?? raw.preview,
                });
              } else if (callId) {
                newMap.set(callId, {
                  name: String(raw.name ?? 'tool'),
                  args: {},
                  result: toolResult.result ?? raw.result ?? raw.preview,
                });
              }
              return { toolCalls: newMap };
            });
            break;
          }
          case 'question': {
            const question = event.data as unknown as AgentQuestion;
            sawQuestion = true;
            set({ pendingQuestion: question, streaming: false });
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
        } else {
          set({
            streaming: false,
            streamAbortController: null,
            toolCalls: new Map(),
          });
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
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
