import type { AgentId, Project, RecommendedProject } from '@/api/types';

/** 各项目的 Agent 推荐理由（Mock；后端可按用户画像动态生成） */
const REASON_BY_PROJECT: Record<string, { reason: string; recommended_by: AgentId }> = {
  p_react: {
    reason: '你近期笔记与 React Hooks 相关，Mentor 认为巩固核心库有助于深化前端体系。',
    recommended_by: 'mentor',
  },
  p_next: {
    reason: 'Navigator 发现你正在学习 React，Next.js 是全栈延伸的自然下一步。',
    recommended_by: 'navigator',
  },
  p_fastapi: {
    reason: '本周总结提到 FastAPI 异步编程，Scout 建议对照 Flask 源码理解性能差异。',
    recommended_by: 'scout',
  },
  p_vue: {
    reason: 'Curator 根据你的前端标签与阅读历史，推荐对比 Vue 3 组合式 API 与 React。',
    recommended_by: 'curator',
  },
  p_d3: {
    reason: 'Hub 注意到你查看过图谱页，D3 可强化数据可视化与项目关系理解。',
    recommended_by: 'hub',
  },
  p_supabase: {
    reason: '你刚导入 Supabase，Scribe 建议同步阅读官方示例以建立后端即服务认知。',
    recommended_by: 'scribe',
  },
  p_vite: {
    reason: 'Mentor 根据你笔记「Vite 插件开发」，推荐深入构建工具链源码。',
    recommended_by: 'mentor',
  },
  p_tailwind: {
    reason: 'Curator 发现你前端项目集中使用 utility-first 风格，Tailwind 值得系统学习。',
    recommended_by: 'curator',
  },
};

const DEFAULT_REASON: { reason: string; recommended_by: AgentId } = {
  reason: 'Hub 根据你的学习进度与 Stars 库匹配度生成此推荐。',
  recommended_by: 'hub',
};

/** 无用户项目时的兜底推荐（模拟后端 Agent 推 GitHub 热门） */
const FALLBACK_TRENDING_REPOS: Array<
  RecommendedProject & { recommended_by: AgentId }
> = [
  {
    id: 'rec_fb_deno',
    project_id: 'p_ext_deno',
    name: 'denoland/deno',
    url: 'https://github.com/denoland/deno',
    description: 'A modern runtime for JavaScript and TypeScript.',
    language: 'Rust',
    stars: 95800,
    reason: 'Scout：GitHub 本周 trending 榜首，适合快速了解现代 TS 运行时。',
    recommended_by: 'scout',
  },
  {
    id: 'rec_fb_whisper',
    project_id: 'p_ext_whisper',
    name: 'openai/whisper',
    url: 'https://github.com/openai/whisper',
    description: 'Robust Speech Recognition.',
    language: 'Python',
    stars: 68900,
    reason: 'Mentor：语音转文本经典项目，Python 生态入门友好。',
    recommended_by: 'mentor',
  },
  {
    id: 'rec_fb_astro',
    project_id: 'p_ext_astro',
    name: 'withastro/astro',
    url: 'https://github.com/withastro/astro',
    description: 'The web framework for content-driven websites.',
    language: 'TypeScript',
    stars: 46000,
    reason: 'Navigator：若计划内容站点，Astro 值得放入学习路线。',
    recommended_by: 'navigator',
  },
  {
    id: 'rec_fb_llama',
    project_id: 'p_ext_llama',
    name: 'ggerganov/llama.cpp',
    url: 'https://github.com/ggerganov/llama.cpp',
    description: 'LLM inference in C/C++',
    language: 'C++',
    stars: 66500,
    reason: 'Hub：本地 LLM 推理热门仓库，可拓展 AI 工具链视野。',
    recommended_by: 'hub',
  },
  {
    id: 'rec_fb_pglite',
    project_id: 'p_ext_pglite',
    name: 'electric-sql/pglite',
    url: 'https://github.com/electric-sql/pglite',
    description: 'Lightweight Postgres as WASM.',
    language: 'TypeScript',
    stars: 7400,
    reason: 'Curator：边缘 WASM 数据库新趋势，适合作为拓展阅读。',
    recommended_by: 'curator',
  },
];

/** 构建 Mock 推荐列表（按 stars 降序；不足 limit 时用热门仓库补齐） */
export function buildMockRecommendedProjects(projects: Project[], limit = 5): RecommendedProject[] {
  const sorted = [...projects].sort((a, b) => b.stars - a.stars);
  const picked: RecommendedProject[] = sorted.slice(0, limit).map((p) => {
    const meta = REASON_BY_PROJECT[p.id] ?? DEFAULT_REASON;
    return {
      id: `rec_${p.id}`,
      project_id: p.id,
      name: p.name,
      url: p.url,
      description: p.description,
      language: p.language,
      stars: p.stars,
      reason: meta.reason,
      recommended_by: meta.recommended_by,
    };
  });

  let fallbackIndex = 0;
  while (picked.length < limit && fallbackIndex < FALLBACK_TRENDING_REPOS.length) {
    const fb = FALLBACK_TRENDING_REPOS[fallbackIndex]!;
    fallbackIndex += 1;
    if (picked.some((item) => item.name === fb.name)) continue;
    picked.push({
      id: `rec_fb_${fallbackIndex}`,
      project_id: fb.project_id,
      name: fb.name,
      url: fb.url,
      description: fb.description,
      language: fb.language,
      stars: fb.stars,
      reason: fb.reason,
      recommended_by: fb.recommended_by,
    });
  }

  return picked.slice(0, limit);
}
