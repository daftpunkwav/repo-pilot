/**
 * API 客户端域分组（§4.2.17）。
 *
 * RealApiClient 按业务域拆分到以下模块：
 *   - auth.ts: register / login / logout / refresh / me / changePassword / profile / githubAccounts
 *   - projects.ts: importProjects / listProjects / getProject / create / update / delete / stats / export / categories / tags
 *   - notes.ts: listNotes / listAllNotes / getNote / createNote / updateNote / deleteNote
 *   - graph.ts: getGraph
 *   - settings.ts: getSettings / updateSettings / saveLlmApiKey / testLLM
 *   - overview.ts: listActivities / listOverviewRecentNotes / listRecommendedProjects / listTrending / streamTrendingScoutIntro
 *   - agent.ts: listAgentSessions / getAgentSession / createAgentSession / deleteAgentSession / updateAgentSession / getAgentProfiles / chatAgent / answerQuestion / analyzeProject / generateNote / getContextWindow / importAssistChat / graphGuideChat / userProfile / memory / permissions
 *
 * 完整实现仍在 `index.ts`（589 行）；本目录作为后续 PR 的拆分目标占位。
 */
export {};