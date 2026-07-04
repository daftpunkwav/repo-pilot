import type { ActivityItem } from '@/api/types';

export const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act_001',
    type: 'import',
    title: '导入 supabase/supabase',
    description: '从 GitHub Stars 同步',
    created_at: '2026-07-04T12:00:00Z',
    project_id: 'p_supabase',
  },
  {
    id: 'act_002',
    type: 'note',
    title: '更新笔记「Vite 插件开发」',
    description: '在项目 vitejs/vite',
    created_at: '2026-07-04T14:00:00Z',
    project_id: 'p_vite',
  },
  {
    id: 'act_003',
    type: 'agent',
    title: '与 Mentor 对话',
    description: 'Flask vs FastAPI 对比分析',
    created_at: '2026-07-04T14:23:00Z',
  },
  {
    id: 'act_004',
    type: 'progress',
    title: 'react 标记为已掌握',
    description: 'facebook/react 学习进度更新',
    created_at: '2026-07-03T10:00:00Z',
    project_id: 'p_react',
  },
  {
    id: 'act_005',
    type: 'import',
    title: '批量导入 3 个项目',
    description: 'URL 粘贴导入',
    created_at: '2026-07-02T16:00:00Z',
  },
];
