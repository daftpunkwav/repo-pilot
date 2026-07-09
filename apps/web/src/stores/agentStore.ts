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

  skipQuestion: () => set({ pendingQuestion: null }),

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
    try {
      for await (const event of stream) {
        switch (event.event) {
          case 'text_delta': {
            const delta = asSSETextDelta(event.data);
            set((state) => ({
              streamingContent: state.streamingContent + delta.content,
            }));
            break;
          }
          case 'thinking': {
            const thinking = asSSEThinking(event.data);
            set((state) => ({
              thinkingBuffer: state.thinkingBuffer + thinking.content,
            }));
            break;
          }
          case 'tool_call': {
            const toolCall = asSSEToolCall(event.data);
            set((state) => {
              const newMap = new Map(state.toolCalls);
              newMap.set(toolCall.call_id, {
                name: toolCall.name,
                args: toolCall.args,
              });
              return { toolCalls: newMap };
            });
            break;
          }
          case 'tool_result': {
            const toolResult = asSSEToolResult(event.data);
            set((state) => {
              const newMap = new Map(state.toolCalls);
              const existing = newMap.get(toolResult.call_id);
              if (existing) {
                newMap.set(toolResult.call_id, {
                  ...existing,
                  result: toolResult.result,
                });
              }
              return { toolCalls: newMap };
            });
            break;
          }
          case 'question': {
            const question = event.data as unknown as AgentQuestion;
            set({ pendingQuestion: question, streaming: false });
            break;
          }
          case 'agent_switch': {
            const switchData = asSSEAgentSwitch(event.data);
            set({ activeAgent: switchData.to });
            break;
          }
          case 'done': {
            const { streamingContent, currentSessionId, activeAgent } = get();
            if (!currentSessionId) break;
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
            }));
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        set({ streaming: false });
        return;
      }
      set({ error: '连接中断，请重试', streaming: false });
    }
  },
}));
