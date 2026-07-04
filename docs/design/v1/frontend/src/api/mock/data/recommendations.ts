import type { AgentId, RecommendedProject } from '@/api/types';
import { MOCK_PROJECTS } from './projects';

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

/** 构建 Mock 推荐列表（按 stars 降序，附带推荐理由） */
export function buildMockRecommendedProjects(limit = 5): RecommendedProject[] {
  return [...MOCK_PROJECTS]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, limit)
    .map((p) => {
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
}
