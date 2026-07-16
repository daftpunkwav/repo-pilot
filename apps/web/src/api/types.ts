// ========================================
// 统一响应
// ========================================

export interface ApiResponse<T> {
  data: T;
  meta: {
    ts: number;
    page?: number;
    page_size?: number;
    total?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

// ========================================
// 分页
// ========================================

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ========================================
// User
// ========================================

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  github_login?: string;
  github_bound: boolean;
  created_at: string;
}

// ========================================
// Auth
// ========================================

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// ========================================
// GitHub
// ========================================

export interface GitHubAccount {
  id: string;
  username: string;
  avatar_url?: string;
  bound_at: string;
}

export interface StarRepo {
  owner: string;
  repo: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  already_imported: boolean;
}

export interface ImportResult {
  succeeded: number;
  failed: number;
  summary: string;
  errors?: Array<{ repo: string; reason: string }>;
}

// ========================================
// Project
// ========================================

export type ProjectProgress = 'none' | 'learning' | 'learned' | 'mastered';
export type ProjectSource = 'github' | 'manual';

export interface Project {
  id: string;
  name: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  category_id?: string;
  progress: ProjectProgress;
  tags: string[];
  source: ProjectSource;
  imported_at: string;
  updated_at?: string;
  readme?: string;
  readme_fetched_at?: string;
}

export interface CreateProjectInput {
  name: string;
  url: string;
  description?: string;
  category_id?: string;
  tags?: string[];
}

export interface ProjectListParams {
  search?: string;
  category_id?: string;
  language?: string;
  progress?: ProjectProgress;
  tag_id?: string;
  sort_by?: 'name' | 'stars' | 'imported_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface ProjectStats {
  total: number;
  by_progress: Record<ProjectProgress, number>;
  by_category: Record<string, number>;
  by_language: Record<string, number>;
}

// ========================================
// Category & Tag
// ========================================

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  is_preset: boolean;
}

export interface Tag {
  id: string;
  name: string;
  count: number;
}

// ========================================
// Note
// ========================================

export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ========================================
// Graph
// ========================================

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  name: string;
  language?: string;
  stars: number;
  category_id?: string;
  progress?: ProjectProgress;
}

export interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

// ========================================
// Overview 扩展
// ========================================

export type TrendingPeriod = 'daily' | 'weekly' | 'monthly';

export interface TrendingRepo {
  owner: string;
  repo: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  stars_today?: number;
  rank?: number;
}

/** Scout 总览 trending 悬停介绍（SSE 流式） */
export interface TrendingScoutIntroParams {
  owner: string;
  repo: string;
  period?: TrendingPeriod;
}

export interface ActivityItem {
  id: string;
  type: 'import' | 'note' | 'agent' | 'progress';
  title: string;
  description: string;
  created_at: string;
  project_id?: string;
}

// ========================================
// Agent
// ========================================

export type AgentId =
  | 'hub'
  | 'scout'
  | 'mentor'
  | 'navigator'
  | 'curator'
  | 'scribe'
  | 'atlas';

/** Agent 个性化推荐项目（总览「为你推荐」） */
export interface RecommendedProject {
  id: string;
  project_id: string;
  name: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  /** Agent 推荐理由，悬停展示 */
  reason: string;
  recommended_by: AgentId;
}

/** 总览最近笔记（含项目名称，便于列表展示） */
export interface OverviewRecentNote {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  updated_at: string;
}
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface AgentSession {
  id: string;
  title: string;
  agent: AgentId;
  updated_at: string;
  unread: boolean;
  project_id?: string | null;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  agent: AgentId;
  role: MessageRole;
  content?: string;
  tool_call?: ToolCallData;
  question?: AgentQuestion;
  created_at: string;
}

export interface ToolCallData {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  description: string;
  avatar_emoji: string;
  capabilities: string[];
}

export interface AgentPermissions {
  allow_web_search: boolean;
  allow_github_api: boolean;
  allow_file_write: boolean;
  max_iterations: number;
  max_tokens_per_turn: number;
}

// ========================================
// 反问系统
// ========================================

export interface AgentQuestion {
  question_id: string;
  intro: { type: 'markdown'; content: string };
  questions: QuestionItem[];
  actions: {
    submit: { text: string; style: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' };
    skip?: { text: string; style: 'ghost' };
  };
  allow_skip: boolean;
  timeout: number | null;
}

export type QuestionItem =
  | RadioQuestion
  | CheckboxQuestion
  | SliderQuestion
  | DragSortQuestion
  | KnowledgeMapQuestion;

export interface RadioQuestion {
  id: string;
  text: string;
  type: 'radio';
  options: RadioOption[];
  allow_other?: boolean;
}

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface CheckboxQuestion {
  id: string;
  text: string;
  type: 'checkbox';
  options: CheckboxOption[];
}

export interface CheckboxOption {
  value: string;
  text: string;
}

export interface SliderQuestion {
  id: string;
  text: string;
  type: 'slider';
  min: number;
  max: number;
  labels?: Record<string, string>;
}

export interface DragSortQuestion {
  id: string;
  text: string;
  type: 'drag_sort';
  items: string[];
}

export interface KnowledgeMapQuestion {
  id: string;
  text: string;
  type: 'knowledge_map';
  tree: KnowledgeNode[];
}

export interface KnowledgeNode {
  id: string;
  label: string;
  children?: KnowledgeNode[];
}

export type QuestionAnswer =
  | { type: 'radio'; value: string; other_text?: string }
  | { type: 'checkbox'; values: string[] }
  | { type: 'slider'; value: number }
  | { type: 'drag_sort'; order: string[] }
  | { type: 'knowledge_map'; checked: string[] };

// ========================================
// SSE
// ========================================

export type SSEEventType =
  | 'text_delta'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'question'
  | 'agent_switch'
  | 'done'
  | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}

export interface SSETextDelta {
  content: string;
}

export interface SSEThinking {
  content: string;
}

export interface SSEToolCall {
  call_id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface SSEToolResult {
  call_id: string;
  result: unknown;
  duration_ms?: number;
}

export interface SSEAgentSwitch {
  from: AgentId;
  to: AgentId;
  reason: string;
}

export interface SSEDone {
  usage: { tokens: number; input_tokens?: number; output_tokens?: number };
  iterations: number;
}

export interface SSEError {
  code: string;
  message: string;
}

// ========================================
// Settings & User Profile
// ========================================

export type LlmApiFormat = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

/** Agent 回复语气 / 人格风格 */
export type AgentSpeakingStyle =
  | 'default'
  | 'warm'
  | 'sharp'
  | 'professional'
  | 'humorous'
  | 'concise'
  | 'mentor'
  | 'socratic';

/** 单个 Agent 的模型与风格覆盖 */
export interface AgentLlmConfig {
  agent_id: string;
  /** null 表示使用全局 llm_default_model */
  model_override: string | null;
  speaking_style: AgentSpeakingStyle;
}

export interface Settings {
  theme: 'dark' | 'light';
  font_scale: number;
  code_font: string;
  /** 供应商标识（预设 id 或 custom） */
  llm_provider: string;
  /** 供应商展示名称（可自定义） */
  llm_provider_display_name: string;
  /** 全局默认模型 */
  llm_default_model: string;
  /** 兼容旧字段：当前生效模型，与 llm_default_model 同步 */
  llm_model: string;
  llm_api_base: string | null;
  llm_api_format: LlmApiFormat;
  /** 当前供应商下可选模型列表（用户可增删） */
  llm_available_models: string[];
  llm_api_key_masked?: string;
  llm_configured: boolean;
  llm_last_test?: string;
  llm_latency_ms?: number;
  /** 各 Agent 独立模型与说话风格 */
  agent_llm_configs: AgentLlmConfig[];
}

export type ProficiencyLevel = 'none' | 'basic' | 'intermediate' | 'advanced' | 'mastered';
export type ProficiencySource = 'self_reported' | 'inferred' | 'assessed';

export interface TechProficiencyEntry {
  level: ProficiencyLevel;
  source: ProficiencySource;
  confidence: number;
  evidence: string[];
  updated_at: string;
}

export type LearningStyle = 'hands_on' | 'theoretical' | 'visual';
export type Verbosity = 'concise' | 'balanced' | 'detailed';

export interface LearningPreferences {
  style: LearningStyle;
  depth_first: boolean;
  verbosity: Verbosity;
  language: string;
}

export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Goal {
  title: string;
  deadline?: string;
  priority: number;
  status: GoalStatus;
}

export interface UserProfile {
  tech_proficiency: Record<string, TechProficiencyEntry>;
  learning_preferences: LearningPreferences;
  goals: Goal[];
  history_summary: string;
  /** Agent 维护的记忆条目（摘要 / 目标 / 技术栈 / 偏好） */
  memory_items?: MemoryItem[];
  extensions: Record<string, unknown>;
}

/** Agent 维护的用户记忆片段 */
export interface MemoryItem {
  id: string;
  category: 'summary' | 'goal' | 'tech' | 'preference';
  content: string;
  created_at: string;
  updated_at?: string;
}

/** LLM 上下文窗口用量（后端按会话维护） */
export interface ContextWindowSegment {
  label: string;
  tokens: number;
  kind: 'system' | 'skill' | 'memory' | 'tools' | 'messages' | 'other';
}

export interface ContextWindowStats {
  session_id: string | null;
  model: string;
  context_limit: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  segments: ContextWindowSegment[];
}

/** 导入助手对话上下文 */
export interface ImportAssistContext {
  mode: 'stars' | 'urls' | 'search';
  available_repo_keys?: string[];
  selected_repo_keys?: string[];
}
