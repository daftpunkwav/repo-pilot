import type { ProjectProgress } from '@/api/types';

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

export const AGENT_CARDS = [
  { id: 'hub', name: 'Hub', desc: '对话管家', color: 'linear-gradient(135deg,#4a3aff,#9d4edd)' },
  { id: 'scout', name: 'Scout', desc: '快速分析', color: 'linear-gradient(135deg,#ff9f0a,#ff6f00)' },
  { id: 'mentor', name: 'Mentor', desc: '深度讲解', color: 'linear-gradient(135deg,#9d4edd,#c879ff)' },
  { id: 'navigator', name: 'Navigator', desc: '学习规划', color: 'linear-gradient(135deg,#00b8d4,#00d4aa)' },
  { id: 'curator', name: 'Curator', desc: '分类管家', color: 'linear-gradient(135deg,#34c759,#30d158)' },
  { id: 'scribe', name: 'Scribe', desc: '笔记助手', color: 'linear-gradient(135deg,#ff375f,#ff6b8a)' },
] as const;
