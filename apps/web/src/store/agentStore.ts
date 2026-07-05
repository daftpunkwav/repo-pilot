import { create } from "zustand";

export interface AgentSession {
  id: string;
  title: string;
  project_id?: string;
  active_agent: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  agent_id?: string;
  content: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

interface AgentState {
  sessions: AgentSession[];
  currentSessionId: string | null;
  messages: AgentMessage[];
  isLoading: boolean;
  error: string | null;
  setSessions: (sessions: AgentSession[]) => void;
  setCurrentSession: (id: string | null) => void;
  appendMessage: (message: AgentMessage) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId, messages: [] }),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
