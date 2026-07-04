import type { AgentMessage, AgentProfile, AgentSession } from '@/api/types';

export const MOCK_AGENT_SESSIONS: AgentSession[] = [
  {
    id: 'sess_001',
    title: 'Flask vs FastAPI 对比分析',
    agent: 'mentor',
    updated_at: '2026-07-04T14:23:00Z',
    unread: true,
  },
  {
    id: 'sess_002',
    title: 'Next.js 学习路径规划',
    agent: 'navigator',
    updated_at: '2026-07-04T12:15:00Z',
    unread: false,
  },
  {
    id: 'sess_003',
    title: 'React 速览',
    agent: 'scout',
    updated_at: '2026-07-03T18:40:00Z',
    unread: false,
  },
];

export const MOCK_AGENT_MESSAGES: Record<string, AgentMessage[]> = {
  sess_001: [
    {
      id: 'msg_001_1',
      session_id: 'sess_001',
      agent: 'mentor',
      role: 'user',
      content: '帮我对比 Flask 和 FastAPI 的适用场景',
      created_at: '2026-07-04T14:20:00Z',
    },
    {
      id: 'msg_001_2',
      session_id: 'sess_001',
      agent: 'mentor',
      role: 'assistant',
      content:
        'Flask 适合轻量同步 API；FastAPI 适合需要高性能异步与自动 OpenAPI 文档的场景。',
      created_at: '2026-07-04T14:21:00Z',
    },
  ],
  sess_002: [
    {
      id: 'msg_002_1',
      session_id: 'sess_002',
      agent: 'navigator',
      role: 'user',
      content: '我想系统学习 Next.js，请规划路径',
      created_at: '2026-07-04T12:10:00Z',
    },
  ],
  sess_003: [],
};

export const MOCK_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'hub',
    name: 'Hub',
    description: '总调度 Agent，协调其他专业 Agent',
    avatar_emoji: '🎯',
    capabilities: ['路由', '任务分解', '多 Agent 协调'],
  },
  {
    id: 'scout',
    name: 'Scout',
    description: '快速扫描项目，生成技术概览',
    avatar_emoji: '🔭',
    capabilities: ['README 分析', '技术栈识别', '依赖图谱'],
  },
  {
    id: 'mentor',
    name: 'Mentor',
    description: '深度教学与概念讲解',
    avatar_emoji: '📚',
    capabilities: ['概念讲解', '对比分析', '练习题'],
  },
  {
    id: 'navigator',
    name: 'Navigator',
    description: '学习路径规划与进度追踪',
    avatar_emoji: '🧭',
    capabilities: ['路径规划', '里程碑', '进度建议'],
  },
  {
    id: 'curator',
    name: 'Curator',
    description: '项目库整理与分类建议',
    avatar_emoji: '🗂️',
    capabilities: ['分类', '标签', '去重'],
  },
  {
    id: 'scribe',
    name: 'Scribe',
    description: '笔记生成与知识整理',
    avatar_emoji: '✍️',
    capabilities: ['笔记大纲', '摘要', '知识卡片'],
  },
];
