import type { ProjectProgress } from '@/api/types';
import { AGENT_CATALOG } from '@/constants/agentCatalog';

export type { AgentDefinition } from '@/constants/agentCatalog';
export { AGENT_CATALOG } from '@/constants/agentCatalog';

/** 与原型 app-shell.js PROGRESS_MAP 对齐 */
export const PROGRESS_LABELS: Record<ProjectProgress, string> = {
  none: '待开始',
  learning: '学习中',
  learned: '已学习',
  mastered: '已掌握',
};

export function progressLabel(p: ProjectProgress | string | undefined): string {
  if (!p) return '-';
  return PROGRESS_LABELS[p as ProjectProgress] ?? p;
}

const CATEGORY_MAP: Record<string, string> = {
  cat_frontend: 'Web 前端',
  cat_backend: 'Web 后端',
  cat_ai: 'AI / 机器学习',
  cat_data: '数据科学',
  cat_devops: 'DevOps / 运维',
  cat_mobile: '移动开发',
  cat_desktop: '桌面应用',
  cat_game: '游戏开发',
  cat_security: '安全',
  cat_tools: '工具 / 库',
  cat_learning: '学习资源',
  cat_other: '其他',
};

export function categoryLabel(id: string | undefined | null): string {
  if (!id) return '-';
  return CATEGORY_MAP[id] ?? id;
}

export const AGENT_INITIALS: Record<string, string> = {
  hub: 'H',
  scout: 'S',
  mentor: 'M',
  navigator: 'N',
  curator: 'C',
  scribe: 'S',
};

export const AGENT_TAG_CLASS: Record<string, string> = {
  hub: 'agent-tag-hub',
  scout: 'agent-tag-scout',
  mentor: 'agent-tag-mentor',
  navigator: 'agent-tag-navigator',
  curator: 'agent-tag-curator',
  scribe: 'agent-tag-scribe',
};

export const AGENT_ROLE_LABELS: Record<string, string> = {
  hub: '对话管家',
  scout: '快速分析',
  mentor: '深度讲解',
  navigator: '学习规划',
  curator: '分类管家',
  scribe: '笔记助手',
};

/** @deprecated 请优先使用 AGENT_CATALOG；保留兼容字段 desc */
export const AGENT_CARDS = AGENT_CATALOG.map((a) => ({
  id: a.id,
  name: a.name,
  desc: a.tagline,
  intro: a.intro,
  color: a.color,
}));
