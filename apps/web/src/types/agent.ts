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

export interface AgentQuestion {
  question_id: string;
  agent_id: string;
  intro: { type: string; content: string };
  questions: Array<{
    id: string;
    text: string;
    type: "radio" | "checkbox" | "slider" | "drag_sort" | "knowledge_map";
    options?: Array<{ label?: string; text: string; value: string }>;
    allow_other?: boolean;
  }>;
  actions: {
    submit: { text: string; style: string };
    skip: { text: string; style: string };
  };
}
