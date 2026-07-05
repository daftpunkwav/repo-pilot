# 审查门禁（Review Gates）

> 每个 Phase 完成后执行对应 Gate。**全部通过** 后方可进入下一 Phase。  
> 终检（Gate F）在 Phase 9 通过后执行，通过后再编写 `API_CONTRACT.md`。

---

## 通用检查项（每个 Gate 都需过）

| # | 检查 |
|---|------|
| C-01 | `tsc --noEmit` 无错误 |
| C-02 | `eslint` 本 Phase 改动文件无 error |
| C-03 | 无 `any`、无 `@ts-ignore`（除非 `@ts-expect-error` + 注释） |
| C-04 | 新组件使用 `design-system.css` 类名，未引入 Tailwind |
| C-05 | 数据请求经 `getApi()` / react-query，不硬编码 Mock 数据在组件内 |
| C-06 | 加载/空/错误三态齐全 |
| C-07 | 新增交互有 `data-testid`（供 E2E） |

---

## Gate 0 — 基础架构

参见 [00-FOUNDATION.md §5](./00-FOUNDATION.md)。

---

## Gate 1 — 登录注册

参见 [01-AUTH.md §7](./01-AUTH.md)。

**安全抽查：**

- [ ] 密码字段 `autocomplete` 合理
- [ ] 登录失败不泄露用户是否存在（统一文案）

---

## Gate 2 — 总览

参见 [02-OVERVIEW.md §7](./02-OVERVIEW.md)。

---

## Gate 3 — 项目库

参见 [03-PROJECTS.md §7](./03-PROJECTS.md)。

**安全抽查：**

- [ ] URL 导入校验 GitHub URL 正则
- [ ] 外链 `rel="noopener noreferrer"`

---

## Gate 4 — 项目详情

参见 [04-PROJECT-DETAIL.md §6](./04-PROJECT-DETAIL.md)。

**安全抽查：**

- [ ] README Markdown 不渲染 raw HTML
- [ ] 删除项目有 ConfirmDialog

---

## Gate 5 — Agent Chat

参见 [05-AGENT.md §7](./05-AGENT.md)。

**安全抽查：**

- [ ] Agent 回复 Markdown 同 README 策略
- [ ] 反问提交 disabled 防重复

**性能抽查：**

- [ ] 流式渲染不阻塞主线程（50ms 批量）

---

## Gate 6 — 图谱

参见 [06-GRAPH.md §7](./06-GRAPH.md)。

**性能抽查：**

- [ ] 100 节点渲染 <2s（Chrome Performance 粗测）
- [ ] 路由离开 cleanup D3

---

## Gate 7 — 笔记

参见 [07-NOTES.md §6](./07-NOTES.md)。

---

## Gate 8 — 设置

参见 [08-SETTINGS.md §6](./08-SETTINGS.md)。

**安全抽查：**

- [ ] API Key / PAT 输入 type=password
- [ ] 设置页不 log 敏感字段

---

## Gate 9 — 个人资料

参见 [09-PROFILE.md §6](./09-PROFILE.md)。

**安全抽查：**

- [ ] 改密后强制重新登录
- [ ] avatar_url 仅允许 `http(s):` URL（前端校验）

---

## Gate F — 终检（全部页面完成后）

### F.1 功能完整性

| # | 检查 | MVP |
|---|------|-----|
| F-01 | 注册→登录→总览→导入→详情→笔记→图谱→Agent 手动走通 | AC-01~AC-12 |
| F-02 | 无 LLM Key 时非 AI 功能正常，Agent 有引导 | AC-14 |
| F-03 | 侧栏 6 项 + Profile 菜单入口正确 | ROUTES-AND-NAV |
| F-04 | 面包屑与路由一致 | — |

### F.2 测试

| # | 检查 |
|---|------|
| F-05 | `vitest run` Store + validators 覆盖率 ≥60% |
| F-06 | Playwright 5 条 happy path 全绿（FRONTEND_SPEC §11.2） |
| F-07 | `npm run build` 成功 |

### F.3 安全审查

| # | 检查 | 参考 |
|---|------|------|
| F-S1 | 全站无 `dangerouslySetInnerHTML` | FRONTEND_SPEC §9.3 |
| F-S2 | Token key 为 `rp_token` / `rp_refresh` | §9.1 |
| F-S3 | 登出清除 localStorage token | — |
| F-S4 | 用户输入经 React 转义或 markdown 安全渲染 | — |
| F-S5 | GitHub URL 校验在导入/创建路径均存在 | §9.4 |

### F.4 现代性审查

| # | 检查 |
|---|------|
| F-M1 | react-query 管理服务端状态，Zustand 仅客户端状态 |
| F-M2 | 路由级 lazy load（Graph/Agent 分包） |
| F-M3 | TypeScript strict 全开 |
| F-M4 | 函数组件 + Hooks only |

### F.5 性能审查

| # | 目标 |
|---|------|
| F-P1 | Lighthouse Performance ≥80（生产 build preview） |
| F-P2 | 初始包 gzip <300KB（不含 D3 懒加载 chunk 可单独） |
| F-P3 | 项目列表 100 条渲染 <500ms |
| F-P4 | 搜索输入防抖 300ms |

### F.6 可维护性审查

| # | 检查 |
|---|------|
| F-X1 | `api/types.ts` 为唯一 API 类型源 |
| F-X2 | Mock/Real 共享 `IApiClient` |
| F-X3 | 单组件文件 <300 行（超出已拆分） |
| F-X4 | 无死代码（`docs/design/v1/frontend` 内未使用文件已删除；迁入 `apps/web` 时同步清理） |

### F.7 终检通过后

1. 从 `src/api/types.ts` + `MockApiClient` 生成 **`docs/design/v1/API_CONTRACT.md`**
2. 标注与 `product/v1` 差异项（如 `listTrending`、`listAllNotes`）
3. 提交 PR，附 Gate F 检查表截图/日志

---

## 审查记录模板

```markdown
## Phase N 审查 — YYYY-MM-DD

- 审查人：
- Gate：N
- 结果：通过 / 不通过

### 未通过项
- [ ] Gx-xx: 描述

### 备注
```

将记录存于 `docs/design/v1/process/reviews/`（可选，审查时创建）。
