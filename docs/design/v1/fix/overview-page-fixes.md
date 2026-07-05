# 总览页审查修复报告

> 分支：`fix/overview-production-readiness`  
> 基于：[overview-page-review.md](../review/overview-page-review.md)  
> 日期：2026-07-05

---

## 修复摘要

| 状态 | 数量 |
|------|------|
| 已修复 | 6 项 |
| 文档补全 | 2 份 |
| 留待后端/后续迭代 | 见下文 |

构建验证：`npm run build` ✅

---

## 逐项修复

| 审查 ID | 问题 | 修复 | Commit |
|---------|------|------|--------|
| O-SEC-01 | Mentor 周报 XSS | 移除 `dangerouslySetInnerHTML`，改纯文本渲染 | `8e1f128` |
| O-FUNC-01/02 | mutation 后总览缓存不失效 | 新增 `invalidateOverviewQueries`，接入 note/project hooks | `e0e9f1e` |
| O-FUNC-03 | Mock 活动列表静态 | `MockApiClient` 可变 `activities[]`，import/note/progress 追加 | `0d497c5` |
| O-FUNC-04 | 活动链接全部 `/agent` | `activityItemHref()` 按 type 深链 | `61da1ed` |
| — | 最近笔记链接不精确 | 跳转 `/projects/:project_id` | `61da1ed` |
| O-FUNC-05 | Scout 流无错误处理 | 捕获异常 + 处理 SSE `error` 事件 | `1f49771` |
| API 文档缺口 | 交接契约缺总览 | `frontend-api-contract.md` §7 | `6ea6bcf` |

---

## 九问修复后状态

| # | 能力 | 前端现状 | 仍需后端 |
|---|------|----------|----------|
| 1 | Mentor LLM 周报 | 安全渲染就绪；Mock 仍静态 | LLM Job 写 `history_summary` |
| 2 | 最近活动更新 | Mock 动态 + invalidate ✅ | 持久化 Activity Feed |
| 3 | Agent 推荐 + 后端刷新策略 | invalidate 就绪；文档明确**不由用户手动刷新** | 推荐服务 + `generated_at` |
| 4 | Scout LLM 悬停介绍 | SSE 契约 + error 兜底 ✅ | Real SSE endpoint + 限流 |
| 5 | 分类总览更新 | 进度条随 `getProjectStats` 更新 ✅ | 若需 category 视图需产品确认 |
| 6 | 最近笔记更新 | Mock 动态 + invalidate ✅ | Real DB |
| 7 | GitHub 热门 | 接口就绪 | Trending 数据源 |
| 8 | API 规范 | 契约已补 | Real HTTP Client |
| 9 | 安全/维护 | XSS 已修 | Real Client、Markdown sanitize |

---

## 未在本分支修复（刻意保留）

| ID | 原因 |
|----|------|
| O-FUNC-06 Real API Client | 工作量大，需独立 PR 对接后端 |
| O-BE-01~04 LLM / GitHub 真源 | 后端职责 |
| O-UX-01~06 规格 gap | 视觉已验收，Phase 2 后续迭代 |
| O-SEC-02 Token refresh | 全站 auth 改造，超出总览范围 |
| O-SEC-03 Markdown sanitize | Agent 页范围，非总览阻塞 |

---

## 新增/修改文件

```
docs/design/v1/review/overview-page-review.md          审查报告
docs/design/v1/fix/overview-page-fixes.md              本文件
docs/design/v1/process/frontend-api-contract.md          §7 总览接口
frontend/src/utils/invalidateOverview.ts               缓存失效工具
frontend/src/utils/overviewLinks.ts                    活动深链
frontend/src/hooks/useNotes.ts                         invalidate 接入
frontend/src/hooks/useProjects.ts                      invalidate 接入
frontend/src/hooks/useTrendingScoutSpot.ts             error 兜底
frontend/src/pages/OverviewPage.tsx                      XSS + 深链
frontend/src/api/mock/index.ts                         可变 Activity Feed
```

---

## 合并建议

1. Review PR：`fix/overview-production-readiness` → `main`
2. 后端优先：`RealApiClient` + 总览 REST/SSE 路径与契约对齐
3. 下一迭代：Mentor Markdown 渲染（接 sanitize）、推荐 `generated_at` 字段、Trending 真源
