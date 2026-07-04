import type { MemoryItem, UserProfile } from '@/api/types';

export const DEFAULT_MEMORY_ITEMS: MemoryItem[] = [
  {
    id: 'mem_001',
    category: 'summary',
    content: '偏好对比式学习，喜欢结合代码示例理解框架差异。',
    created_at: '2026-07-01T10:00:00Z',
  },
  {
    id: 'mem_002',
    category: 'goal',
    content: '3 个月内成为全栈开发者（2026-10）',
    created_at: '2026-06-15T08:00:00Z',
  },
  {
    id: 'mem_003',
    category: 'tech',
    content: 'JavaScript 精通 · Python 入门 · React 学习中',
    created_at: '2026-07-02T12:00:00Z',
  },
  {
    id: 'mem_004',
    category: 'preference',
    content: '中文讲解 · 代码示例 · 对比式学习',
    created_at: '2026-07-03T09:00:00Z',
  },
];

export const DEFAULT_USER_PROFILE: UserProfile = {
  tech_proficiency: {
    JavaScript: {
      level: 'advanced',
      source: 'self_reported',
      confidence: 0.9,
      evidence: ['多个前端项目笔记'],
      updated_at: '2026-07-01T00:00:00Z',
    },
    Python: {
      level: 'basic',
      source: 'inferred',
      confidence: 0.6,
      evidence: ['Flask/FastAPI 对话'],
      updated_at: '2026-07-04T00:00:00Z',
    },
  },
  learning_preferences: {
    style: 'hands_on',
    depth_first: true,
    verbosity: 'balanced',
    language: 'zh-CN',
  },
  goals: [
    {
      title: '掌握 React 18 并发特性',
      deadline: '2026-08-01',
      priority: 1,
      status: 'active',
    },
    {
      title: '完成 5 个后端项目实战',
      deadline: '2026-10-01',
      priority: 2,
      status: 'active',
    },
  ],
  history_summary: '本周学习了 React Hooks 与 FastAPI 异步编程。',
  memory_items: DEFAULT_MEMORY_ITEMS,
  extensions: {},
};
