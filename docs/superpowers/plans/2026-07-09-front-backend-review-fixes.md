# Front/Backend 全面审查修复计划

## 目标

对 RepoPilot 的 front（`apps/web`、`packages/ui`、`packages/types`）与 backend（`services/api`、`services/mcp`、`packages/py-shared`、`packages/contracts`）进行安全、现代化、规范、可维护、可拓展审查，修复发现的 Critical / High 级别问题，确保功能与业务逻辑正确，最终提交并推送到三个远端仓库。

## 范围

- **包含**：`apps/web/`、`packages/ui/`、`packages/types/`、`services/api/`、`services/mcp/`、`packages/py-shared/`、`packages/contracts/`
- **不包含**：`services/agent/`、`archive/`、其它未明确模块

## 当前基线

- 已在分支 `review/front-backend-fixes`
- 已提交第一批 settings 相关修复：`fix(settings): 统一 agent_llm_configs 为列表，集成 SQLite schema 同步，优化前端错误解析`
- 三个远端已配置：`origin`(GitLab)、`github`(GitHub)、`gitee`(Gitee)
- committer：`daftpunkwav`，邮箱：`daftpunk.wav@outlook.com`

## 发现的主要问题

### Backend Critical

1. `services/api/backend/config.py` 中 `SECRET_KEY` 使用硬编码弱默认值 `"change-me-in-production"`。
2. `services/api/backend/api/agent.py` 的 `/question` 与 `/analyze/{project_id}` 未加 `Depends(get_current_user)`。
3. `services/api/backend/services/auth_service.py` 的 refresh token 不轮换，可无限重放。
4. 修改密码后已签发 token 仍然有效。

### Frontend Critical

1. `apps/web/src/pages/SettingsPage.tsx` 中 LLM API Key 保存逻辑错误，真实 Key 未发送到后端。
2. `apps/web/src/pages/ProfilePage.tsx` 中头像 URL 未校验，存在 XSS 向量。
3. `apps/web/src/components/graph/ForceGraph.tsx` 在节点高亮/选中时完全重新初始化 D3 simulation。

### Backend High

1. 认证端点（register/login/refresh）无速率限制。
2. `HTTPBearer` 缺失 token 时返回 403 而非 401。
3. `UserLogin` 未校验密码长度；`ImportRepoItem.url`、`llm_api_base` 等字段缺少 URL 安全校验。

### Frontend High

1. `apps/web/src/api/real/http.ts` 并发 401 可能触发多次 refresh，无 single-flight。
2. SSE 接口未透传 `AbortSignal`，页面切换后底层 fetch 仍在运行。
3. `GraphControls` 按钮为占位，点击无响应。
4. `QuestionPanel` 未校验必填项即可提交。
5. `AgentContextSidebar` 使用 `window.prompt` 收集输入。

## 修复任务

### Task 1: Backend — 强制从环境变量读取 JWT 密钥并校验长度

**文件：**
- `services/api/backend/config.py`
- `services/api/backend/core/security.py`（可选校验调用）
- `services/api/backend/main.py`（启动校验）

**变更：**
- `Settings.secret_key` 删除默认值，使用 `Field(...)` 强制从环境变量读取。
- 启动时校验密钥长度 ≥ 32 字节，否则抛出 `ValueError` 阻止启动。
- 测试环境通过 `.env.test` 或 pytest fixture 注入合法密钥。

**验证：**
- 未设置 `SECRET_KEY` 时服务无法启动。
- 设置短密钥时启动失败。
- pytest 全部通过。

### Task 2: Backend — 为 agent 未认证接口补全鉴权

**文件：**
- `services/api/backend/api/agent.py`
- `services/api/backend/services/agent_service.py`（如需 user_id）

**变更：**
- `/question` 与 `/analyze/{project_id}` 增加 `current_user: User = Depends(get_current_user)`。
- `/analyze/{project_id}` 校验 `project_id` 属于当前用户。

**验证：**
- 未携带 token 访问返回 401。
- 访问他人项目返回 403。
- 相关测试通过。

### Task 3: Backend — 实现 refresh token 轮换与重放检测

**文件：**
- `services/api/backend/services/auth_service.py`
- `services/api/backend/api/auth.py`（refresh 端点返回新 token）
- `services/api/backend/core/security.py`（refresh token 创建）

**变更：**
- `rotate_refresh_token` 成功后生成新 refresh token，旧 token 标记为 `revoked`。
- 使用过的旧 refresh token 再次出现时，视为重放，撤销该 token family（可选）。
- refresh 端点返回新的 refresh token。

**验证：**
- 同一 refresh token 使用两次后第二次失败。
- 相关测试通过。

### Task 4: Backend — 修改密码后撤销用户 refresh token

**文件：**
- `services/api/backend/api/auth.py`
- `services/api/backend/services/auth_service.py`

**变更：**
- `update_password` 成功后撤销该用户所有未过期 refresh token。
- 可选：JWT payload 加入 `token_issued_at`，`get_current_user` 校验不早于密码修改时间。

**验证：**
- 修改密码后旧 refresh token 无法刷新。
- 相关测试通过。

### Task 5: Backend — 为认证端点添加速率限制

**文件：**
- `services/api/backend/main.py`
- `services/api/backend/api/auth.py`
- `pyproject.toml`（新增依赖）

**变更：**
- 引入 `slowapi` 或基于内存的限流中间件。
- `login` 按 IP/用户名限流（如 5 次/分钟）。
- `register` 按 IP 限流。
- `refresh` 按 IP 限流。

**验证：**
- 超过限流阈值返回 429。
- pytest 通过（注意测试环境放宽限制）。

### Task 6: Backend — 缺失 token 时返回 401 而非 403

**文件：**
- `services/api/backend/api/deps.py`

**变更：**
- 自定义 `HTTPBearer` 子类，缺失 `Authorization` 头时抛 401。

**验证：**
- 未携带 token 访问受保护端点返回 401。
- 携带无效 token 返回 401。

### Task 7: Backend — 加强输入校验

**文件：**
- `services/api/backend/schemas/user.py`
- `services/api/backend/schemas/project.py`
- `services/api/backend/schemas/settings.py`
- `services/api/backend/schemas/note.py`
- `services/api/backend/schemas/category.py`

**变更：**
- `UserLogin.password` 增加 `min_length=8, max_length=128`。
- `ImportRepoItem.url` 使用 `HttpUrl` 并限制白名单。
- `SettingsUpdate.llm_api_base` 校验为公开 HTTPS URL，禁止私有 IP/localhost。
- `NoteCreate.title`、`CategoryCreate.name` 等增加 `max_length`。

**验证：**
- 对应 schema 测试通过。
- 非法输入返回 422。

### Task 8: Frontend — 修正 LLM API Key 保存逻辑

**文件：**
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/components/settings/LlmSettingsSection.tsx`
- `apps/web/src/api/types.ts`
- `services/api/backend/api/settings.py`（新增专用接口）

**变更：**
- 新增 `POST /api/v1/settings/api-key` 接口，仅接收并存储真实 Key，返回掩码。
- 前端输入真实 Key 时调用新接口，不再本地构造 `llm_api_key_masked`。
- `SettingsOut.llm_api_key_masked` 由后端返回。

**验证：**
- 保存 Key 后后端真实存储。
- 前端只展示掩码。

### Task 9: Frontend — 校验头像 URL 防止 XSS/SSRF

**文件：**
- `apps/web/src/pages/ProfilePage.tsx`
- `services/api/backend/schemas/user.py`（可选后端二次校验）

**变更：**
- 头像 URL 校验 scheme 必须为 `https:`，且域名在白名单内（如 `avatars.githubusercontent.com`）。
- 校验失败时给出用户提示，不提交。

**验证：**
- `javascript:`、`data:` 等 URL 被拒绝。
- 合法 GitHub 头像 URL 通过。

### Task 10: Frontend — 修复 ForceGraph hover/选中时全量重建

**文件：**
- `apps/web/src/components/graph/ForceGraph.tsx`

**变更：**
- 将 `selectedNodeId` / `highlightNodeId` 从重建 simulation 的 effect 依赖中移除。
- 仅通过 D3 selection 更新节点描边/填充样式。
- 清理 zoom 事件监听。

**验证：**
- hover/选中节点时 simulation 不重启。
- 图谱交互流畅。

### Task 11: Frontend — 实现 token refresh single-flight

**文件：**
- `apps/web/src/api/real/http.ts`

**变更：**
- 引入全局 refresh promise 锁，多个 401 请求共享同一个 refresh 调用。
- refresh 成功后统一重试队列中的请求。
- 统一错误为 `Error` 子类。

**验证：**
- 并发 401 只触发一次 refresh。
- 测试通过。

### Task 12: Frontend — SSE 接口透传 AbortSignal

**文件：**
- `apps/web/src/api/real/http.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/api/real/index.ts`
- 各消费端（`ProjectDetailPage.tsx`、`EmbedAgentChat.tsx`、`agentStore.ts`）

**变更：**
- `IApiClient` 的 SSE 方法增加 `signal?: AbortSignal`。
- `apiSSE` 将 signal 透传给 `fetch(..., { signal })`。
- 消费端在组件卸载或取消时调用 `controller.abort()`。

**验证：**
- 切换页面后底层 fetch 被取消。
- 服务端不再继续推送。

### Task 13: Frontend — 修复 GraphControls 占位按钮

**文件：**
- `apps/web/src/components/graph/GraphControls.tsx`
- `apps/web/src/components/graph/ForceGraph.tsx`（如需暴露 zoom 控制）

**变更：**
- 实现 zoom in/out（通过 D3 zoom transform）。
- 未实现的布局切换按钮禁用或隐藏。

**验证：**
- 按钮点击有响应。
- 未实现功能不显示为可点击。

### Task 14: Frontend — 修复 QuestionPanel 必填校验

**文件：**
- `apps/web/src/components/agent/QuestionPanel.tsx`

**变更：**
- 提交前遍历所有题目校验必填项。
- 对 radio/checkbox/knowledge_map 等类型做非空检查。
- 校验失败时阻止提交并提示。

**验证：**
- 未填必填项时无法提交。
- 填写完整后可正常提交。

### Task 15: Frontend — 替换 AgentContextSidebar 的 window.prompt

**文件：**
- `apps/web/src/components/agent/AgentContextSidebar.tsx`

**变更：**
- 将 `window.prompt` 改为组件内联受控表单（input/textarea）。
- 加入长度限制和内容校验。

**验证：**
- 添加/编辑 context 不再使用浏览器 prompt。
- 超长或空内容被阻止。

## 验证清单

- [ ] `pytest`（backend）全部通过
- [ ] `npm run test:web`（frontend）全部通过
- [ ] `npm run lint:web` 无错误
- [ ] `npm run typecheck:web` 通过
- [ ] `ruff check backend` 无错误
- [ ] 手动验证关键安全修复（401、refresh 轮换、LLM Key 保存）

## 提交与推送策略

- 每个 Task 完成后独立 commit，commit message 使用中文简述修复内容。
- commit author/committer：`daftpunkwav <daftpunk.wav@outlook.com>`
- 全部修复完成后，执行：
  ```bash
  git push origin review/front-backend-fixes
  git push github review/front-backend-fixes
  git push gitee review/front-backend-fixes
  ```
