/**
 * OpenAPI components.schemas 友好别名（与后端契约对齐，并对前端常用字段做合理收紧/放宽）。
 * generate 脚本勿覆盖本文件。
 */
import type { components } from './generated';

export type Schemas = components['schemas'];

export type ActivityItem = Schemas['ActivityItemOut'];
export type AgentChatBody = Schemas['AgentChatBody'];
export type AgentChatRequest = Schemas['AgentChatRequest'];
export type AgentGuideline = Schemas['AgentGuidelineOut'];
export type AgentLlmConfig = Schemas['AgentLlmConfigOut'];
/** 原始 API 消息；前端气泡请用 apps/web AgentMessage */
export type AgentMessageOut = Schemas['AgentMessageOut'];
export type AgentPermissions = Schemas['AgentPermissionsOut'];
export type AgentPermissionsUpdate = Schemas['AgentPermissionsUpdate'];
export type AgentProfile = Schemas['AgentProfileOut'];
export type AgentQuestionAnswer = Schemas['AgentQuestionAnswer'];
export type AgentSessionDetail = Schemas['AgentSessionDetailOut'];
export type AgentSession = Omit<Schemas['AgentSessionOut'], 'source'> & {
  source?: string;
};
export type AnalyzeBody = Schemas['AnalyzeBody'];
export type ApiKey = Schemas['ApiKeyOut'];
export type ApiKeyIn = Schemas['ApiKeyIn'];
export type BindGithubBody = Schemas['BindGithubBody'];
export type Category = Schemas['CategoryOut'];
export type CategoryCreate = Schemas['CategoryCreate'];
export type CategoryUpdate = Schemas['CategoryUpdate'];
export type ClassifyBody = Schemas['ClassifyBody'];
export type ContextWindowSegment = Schemas['ContextWindowSegmentOut'];
export type ContextWindowStats = Omit<
  Schemas['ContextWindowStatsOut'],
  'segments'
> & {
  segments: ContextWindowSegment[];
};
export type GithubAccount = Schemas['GithubAccountOut'];
export type GitHubAccount = GithubAccount;
export type Goal = Schemas['GoalOut'];
export type GraphGuideBody = Schemas['GraphGuideBody'];
export type ImportAssistBody = Schemas['ImportAssistBody'];
export type ImportProjectsBody = Schemas['ImportProjectsBody'];
export type ImportRepoItem = Schemas['ImportRepoItem'];
export type ImportResult = Schemas['ImportResult'];
export type LlmTestIn = Schemas['LlmTestIn'];
export type LlmTestResult = Schemas['LlmTestOut'];
export type MemoryItem = Schemas['MemoryItemOut'];
export type MemoryProposal = Schemas['MemoryProposalOut'];

export type Note = Omit<
  Schemas['NoteOut'],
  'content' | 'created_at' | 'updated_at'
> & {
  content: string;
  created_at: string;
  updated_at: string;
};
export type NoteCreate = Schemas['NoteCreate'];
export type NoteUpdate = Schemas['NoteUpdate'];
export type NoteGenerateBody = Schemas['NoteGenerateBody'];
export type OverviewRecentNote = Schemas['OverviewRecentNoteOut'];
export type ProgressUpdate = Schemas['ProgressUpdateOut'];

/** 项目：契约 + mock 兼容字段 */
export type Project = Schemas['ProjectOut'] & {
  readme?: string;
  readme_fetched_at?: string;
};
/** 创建项目：仅 name/url 必填（其余有后端默认值） */
export type ProjectCreate = {
  name: string;
  url: string;
  description?: string | null;
  category_id?: string | null;
  tags?: string[];
  stars?: number;
  language?: string | null;
  progress?: Schemas['ProjectOut']['progress'];
  source?: Schemas['ProjectOut']['source'];
};
export type ProjectUpdate = Schemas['ProjectUpdate'];
export type ProjectReadme = Schemas['ProjectReadmeOut'];
export type ProjectStats = Schemas['ProjectStats'];
export type RecommendedProject = Omit<
  Schemas['RecommendedProjectOut'],
  'recommended_by'
> & {
  recommended_by:
    | 'hub'
    | 'scout'
    | 'mentor'
    | 'navigator'
    | 'curator'
    | 'scribe'
    | 'atlas';
};
export type SessionUpdateBody = Schemas['SessionUpdateBody'];
export type SetProjectTagsBody = Schemas['SetProjectTagsBody'];
export type SetProjectTagsResult = Schemas['SetProjectTagsOut'];

export type Settings = Omit<
  Schemas['SettingsOut'],
  | 'llm_available_models'
  | 'agent_llm_configs'
  | 'agent_guidelines'
  | 'llm_api_base'
  | 'agent_code_of_conduct'
> & {
  llm_available_models: string[];
  agent_llm_configs: AgentLlmConfig[];
  agent_guidelines: AgentGuideline[];
  llm_api_base: string | null;
  agent_code_of_conduct: string;
};
export type SettingsUpdate = Schemas['SettingsUpdate'];
export type StarRepo = Schemas['StarRepoOut'];
export type StarsList = Omit<Schemas['StarsListOut'], 'cache_ttl_hours'> & {
  cache_ttl_hours?: number;
};
export type Tag = Schemas['TagOut'];
export type TagCreate = Schemas['TagCreate'];

export type TrendingRepo = Schemas['TrendingRepoOut'];
export type TrendingScoutBody = Schemas['TrendingScoutBody'];
export type User = Schemas['UserOut'];
export type UserProfile = Schemas['UserProfileOut'];
export type UserProfileUpdate = Schemas['UserProfileUpdate'];
export type LearnerIdentity = Schemas['LearnerIdentityOut'];
export type LearnerIdentityUpdate = Schemas['LearnerIdentityUpdate'];

export type ProjectProgress = Project['progress'];
export type ProjectSource = Project['source'];

export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type ApiResponse<T> = {
  data: T;
  meta: {
    ts: number;
    page?: number;
    page_size?: number;
    total?: number;
  };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};
