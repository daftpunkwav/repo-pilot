# RepoPilot Web（`@repopilot/web`）

React 19 + Vite 7 + TypeScript 前端，默认使用 `MockApiClient`（`VITE_USE_MOCK=true`）。

> **来源：** 自 `docs/design/v1/frontend/` 审查通过后迁入。设计归档与流程文档仍保留在 `docs/design/v1/`。

## 快速开始

```bash
# 仓库根目录
npm install
npm run dev:web
```

或在当前目录：

```bash
cd apps/web
npm install --include=dev
npm run dev
```

- 地址：http://localhost:5173
- Mock 账号：`zhang.jie` / `demo1234`

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run test` | Vitest 单元测试 |
| `npm run test:e2e` | Playwright E2E |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 检查 |

## 文档

- 设计规格：`docs/design/v1/FRONTEND_SPEC.md`
- API 契约：`docs/design/v1/process/frontend-api-contract.md`
- 路径对照：`docs/architecture/PATH_MAPPING.md`

> **副本说明：** `apps/web/docs/` 下 4 个文件（`liquid-glass.md`、`REVIEW_FIXES.md`、`REVIEW_REPORT.md`、`REVIEW_REPORT_V2.md`）为 `docs/design/v1/frontend/docs/` 同名文件的**字节级副本**（SHA256 完全一致），保留为向后兼容。**权威源在 `docs/design/v1/frontend/docs/`**。
