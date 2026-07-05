import type {
  ActivityItem,
  Note,
  Project,
  RecommendedProject,
  TrendingRepo,
} from '@/api/types';
import { MOCK_ACTIVITIES } from './activities';
import { MOCK_NOTES } from './notes';
import { MOCK_PROJECTS } from './projects';
import { buildMockRecommendedProjects } from './recommendations';
import { DEFAULT_USER_PROFILE } from './profile';
import { getTrendingRepos } from './trending';

export type OverviewMockRound = 1 | 2 | 3;

export const OVERVIEW_MOCK_ROUND_KEY = 'rp_overview_mock_round';

export interface OverviewScenarioSnapshot {
  round: OverviewMockRound;
  label: string;
  projects: Project[];
  notes: Note[];
  activities: ActivityItem[];
  historySummary: string;
  recommendations: RecommendedProject[];
  trendingWeekly: TrendingRepo[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Mock 相对时间：始终生成「X 前」的 ISO 时间（避免固定日期落在未来） */
function mockPastIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildRound1Projects(): Project[] {
  const projects = clone(MOCK_PROJECTS);
  // 明确进度分布，便于总览进度条展示
  const progressPlan: Array<[string, Project['progress']]> = [
    ['p_react', 'mastered'],
    ['p_vue', 'learned'],
    ['p_next', 'learning'],
    ['p_fastapi', 'learning'],
    ['p_flask', 'none'],
    ['p_tailwind', 'none'],
  ];
  for (const [id, progress] of progressPlan) {
    const p = projects.find((item) => item.id === id);
    if (p) p.progress = progress;
  }
  return projects;
}

function buildRound1(): OverviewScenarioSnapshot {
  const projects = buildRound1Projects();
  return {
    round: 1,
    label: '基线：完整总览数据',
    projects,
    notes: clone(MOCK_NOTES).sort(
      (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
    ).slice(0, 4),
    activities: clone(MOCK_ACTIVITIES).slice(0, 5),
    historySummary: DEFAULT_USER_PROFILE.history_summary ?? '本周学习了 React Hooks 与 FastAPI 异步编程。',
    recommendations: buildMockRecommendedProjects(projects, 5),
    trendingWeekly: clone(getTrendingRepos('weekly')),
  };
}

function buildRound2(base: OverviewScenarioSnapshot): OverviewScenarioSnapshot {
  const notes = clone(base.notes);
  const extraNotes: Note[] = [
    {
      id: 'n_round2_1',
      project_id: 'p_d3',
      title: 'D3 力导向图初探',
      content: '# D3 Force\n\n节点与边的基本布局。',
      created_at: mockPastIso(2.5),
      updated_at: mockPastIso(2),
    },
    {
      id: 'n_round2_2',
      project_id: 'p_supabase',
      title: 'Supabase Auth Hooks 速记',
      content: '# Auth Hooks\n\n登录回调与 JWT 自定义声明。',
      created_at: mockPastIso(4),
      updated_at: mockPastIso(3),
    },
  ];
  const mergedNotes = [...extraNotes, ...notes]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 6);

  const activities: ActivityItem[] = [
    {
      id: 'act_round2_1',
      type: 'note' as const,
      title: '创建笔记「D3 力导向图初探」',
      description: 'd3/d3',
      created_at: mockPastIso(2),
      project_id: 'p_d3',
    },
    {
      id: 'act_round2_2',
      type: 'import' as const,
      title: '导入 supabase/supabase',
      description: '成功导入 1 个，失败 0 个',
      created_at: mockPastIso(3),
      project_id: 'p_supabase',
    },
    ...clone(base.activities),
  ].slice(0, 7);

  return {
    ...base,
    round: 2,
    label: '增量：新增笔记与活动',
    notes: mergedNotes,
    activities,
    historySummary: base.historySummary,
    recommendations: base.recommendations,
    trendingWeekly: base.trendingWeekly,
  };
}

function buildRound3(base: OverviewScenarioSnapshot): OverviewScenarioSnapshot {
  const projects = clone(base.projects);
  const progressUpdates: Array<[string, Project['progress']]> = [
    ['p_flask', 'learning'],
    ['p_tailwind', 'learned'],
    ['p_fastapi', 'mastered'],
    ['p_next', 'mastered'],
  ];
  for (const [id, progress] of progressUpdates) {
    const p = projects.find((item) => item.id === id);
    if (p) p.progress = progress;
  }

  const recommendations: RecommendedProject[] = [
    {
      id: 'rec_r3_1',
      project_id: 'p_fastapi',
      name: 'tiangolo/fastapi',
      url: 'https://github.com/tiangolo/fastapi',
      description: 'Modern Python web framework.',
      language: 'Python',
      stars: 78000,
      reason: 'Mentor：你刚将 FastAPI 标记为已掌握，建议用一个小项目验证异步中间件理解。',
      recommended_by: 'mentor',
    },
    {
      id: 'rec_r3_2',
      project_id: 'p_d3',
      name: 'd3/d3',
      url: 'https://github.com/d3/d3',
      description: 'Data-driven documents.',
      language: 'JavaScript',
      stars: 108000,
      reason: 'Navigator：结合你新建的 D3 笔记，图谱页会更有体感。',
      recommended_by: 'navigator',
    },
    {
      id: 'rec_r3_3',
      project_id: 'p_supabase',
      name: 'supabase/supabase',
      url: 'https://github.com/supabase/supabase',
      description: 'Open source Firebase alternative.',
      language: 'TypeScript',
      stars: 71600,
      reason: 'Scout：刚导入 Supabase，适合对照 RLS 笔记做 30 分钟速览。',
      recommended_by: 'scout',
    },
    {
      id: 'rec_r3_4',
      project_id: 'p_react',
      name: 'facebook/react',
      url: 'https://github.com/facebook/react',
      description: 'A JavaScript library for building user interfaces.',
      language: 'JavaScript',
      stars: 220000,
      reason: 'Curator：React 已掌握，可转向并发特性源码阅读。',
      recommended_by: 'curator',
    },
    {
      id: 'rec_r3_5',
      project_id: 'p_vue',
      name: 'vuejs/core',
      url: 'https://github.com/vuejs/core',
      description: 'The Progressive JavaScript Framework.',
      language: 'TypeScript',
      stars: 46000,
      reason: 'Hub：对比 Vue 3 与 React 笔记，巩固框架选型思路。',
      recommended_by: 'hub',
    },
  ];

  const trendingWeekly: TrendingRepo[] = [
    {
      rank: 1,
      owner: 'anthropics',
      repo: 'claude-code',
      url: 'https://github.com/anthropics/claude-code',
      description: 'Anthropic CLI for Claude.',
      language: 'TypeScript',
      stars: 21000,
      stars_today: 2400,
    },
    {
      rank: 2,
      owner: 'denoland',
      repo: 'deno',
      url: 'https://github.com/denoland/deno',
      description: 'Modern JS/TS runtime.',
      language: 'Rust',
      stars: 95800,
      stars_today: 2100,
    },
    {
      rank: 3,
      owner: 'openai',
      repo: 'whisper',
      url: 'https://github.com/openai/whisper',
      description: 'Speech recognition.',
      language: 'Python',
      stars: 68900,
      stars_today: 1900,
    },
    {
      rank: 4,
      owner: 'electric-sql',
      repo: 'pglite',
      url: 'https://github.com/electric-sql/pglite',
      description: 'Postgres as WASM.',
      language: 'TypeScript',
      stars: 8200,
      stars_today: 1650,
    },
    {
      rank: 5,
      owner: 'langchain-ai',
      repo: 'langgraph',
      url: 'https://github.com/langchain-ai/langgraph',
      description: 'LLM state machines.',
      language: 'Python',
      stars: 5200,
      stars_today: 1500,
    },
    {
      rank: 6,
      owner: 'withastro',
      repo: 'astro',
      url: 'https://github.com/withastro/astro',
      description: 'Content-driven web framework.',
      language: 'TypeScript',
      stars: 46000,
      stars_today: 980,
    },
  ];

  return {
    ...base,
    round: 3,
    label: '后端刷新：推荐 / 进度 / 热门更新',
    projects,
    historySummary:
      '本周完成 FastAPI 进阶与 D3 入门笔记；Mentor 建议下一步深化 Supabase 与图谱可视化。',
    recommendations,
    trendingWeekly,
  };
}

export const OVERVIEW_SCENARIOS: Record<OverviewMockRound, OverviewScenarioSnapshot> = {
  get 1() {
    return buildRound1();
  },
  get 2() {
    return buildRound2(buildRound1());
  },
  get 3() {
    return buildRound3(buildRound2(buildRound1()));
  },
};

export function parseOverviewMockRound(value: string | null | undefined): OverviewMockRound {
  if (value === '2') return 2;
  if (value === '3') return 3;
  return 1;
}

export function readOverviewMockRound(): OverviewMockRound {
  if (typeof localStorage === 'undefined') return 1;
  return parseOverviewMockRound(localStorage.getItem(OVERVIEW_MOCK_ROUND_KEY));
}

export function persistOverviewMockRound(round: OverviewMockRound) {
  localStorage.setItem(OVERVIEW_MOCK_ROUND_KEY, String(round));
}

/** 从 URL ?mock_round= 读取并持久化（刷新后仍生效） */
export function syncOverviewMockRoundFromUrl(url: string = window.location.href) {
  const roundParam = new URL(url).searchParams.get('mock_round');
  if (roundParam === '1' || roundParam === '2' || roundParam === '3') {
    persistOverviewMockRound(parseOverviewMockRound(roundParam));
  }
}

export function getOverviewScenario(round: OverviewMockRound = readOverviewMockRound()) {
  return clone(OVERVIEW_SCENARIOS[round]);
}
