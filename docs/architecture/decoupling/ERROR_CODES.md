# 报错码表（Error Code Registry）

> **单一权威源**：本表。同步维护：
> - `apps/web/src/utils/errorCodes.ts`
> - `services/api/api_backend/core/error_codes.py`（常量）
>
> 用户可凭码查此表定位排查；开发者据码判断故障域。新增码时三处都改。

## 命名规范

`<域>_<原因>`，全大写下划线。

| 域前缀 | 含义 |
|--------|------|
| `MODULE` | 启动期模块挂载 |
| `AGENT` | Agent / Hub / 会话 / 调度 |
| `LLM` | 大模型配置与调用 |
| `GRAPH` | 代码图谱 |
| `PROJECT` | 项目库 |
| `NOTE` | 笔记 |
| `CATEGORY` | 分类 |
| `TAG` | 标签 |
| `GITHUB` | GitHub 绑定 / Stars / API |
| `PROFILE` | 学习者画像 / 记忆 |
| `SETTINGS` | 系统设置 |
| `SYSTEM` | 进程 / 密钥 / 内部 |
| `VALIDATION` | 请求校验（通用） |
| `RATE` | 限流 |

HTTP 列为典型状态；SSE 流内错误固定走 `event: error`，HTTP 仍为 200。

---

## 1. 模块 / 系统

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `MODULE_LOAD_FAILED` | 503 | error | 模块加载失败 | 某后端模块 import 异常；查 `/health` 的 `modules[].loaded`；查后端日志 traceback |
| `SYSTEM_SECRET_KEY_WEAK` | 500 | error | 密钥强度不足 | `SECRET_KEY` &lt; 32 字节；生成强随机密钥后重启 |
| `SYSTEM_INTERNAL_ERROR` | 500 | error | 内部错误 | 未分类异常；查后端日志完整 traceback |
| `RATE_LIMITED` | 429 | warning | 请求过于频繁 | 触发 slowapi 限流；稍后重试或调大 `RATE_LIMIT_*` |
| `VALIDATION_ERROR` | 422 | warning | 参数校验失败 | 请求体不符合 schema；查 `detail` / `details` 字段 |
| `API_ERROR` | * | error | 请求失败 | 前端兜底码：后端未返回结构化 code，或网络层失败 |

---

## 2. Agent

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `AGENT_MODULE_DOWN` | 503 | error | Agent 模块未就绪 | agent 域加载失败；常见 `agent_core` / litellm 缺失；查 `/health` |
| `AGENT_LLM_UNAVAILABLE` | 503 | warning | Agent LLM 不可用 | 未配置 Key、base 不可达或模型名错误；查设置页 |
| `AGENT_MISCONFIGURED` | 503 | error | Agent 进程配置错误 | 已设 `AGENT_BASE_URL` 但缺少 `agent_internal_token` |
| `AGENT_TOKEN_UNSET` | 503 | error | Agent 内部令牌未配置 | Agent runtime 未设置 `agent_internal_token` |
| `AGENT_UNAUTHORIZED` | 401 | error | Agent 内部鉴权失败 | API↔Agent 令牌不匹配 |
| `AGENT_PROXY_ERROR` | 502 | error | Agent 代理转发失败 | 无法连接 `AGENT_BASE_URL` 或上游非 2xx |
| `AGENT_SESSION_NOT_FOUND` | 404 | error | 会话不存在 | `session_id` 错误或已删除 |
| `AGENT_SESSION_PROJECT_DENIED` | 403 | error | 无法绑定项目到会话 | 项目不存在（本地单机多为 ID 错误） |
| `AGENT_INVALID_ID` | 400 | error | 未知或非法 Agent | `active_agent` / `agent_id` 不在注册表 |
| `AGENT_CHAT_FAILED` | 200(SSE) | error | 对话失败 | `stream_chat` 未捕获异常；查 Hub 日志 |
| `AGENT_ANALYZE_FAILED` | 200(SSE) | error | 项目分析失败 | `stream_analyze` 异常；Hub 调度或 LLM 超时 |
| `AGENT_IMPORT_ASSIST_FAILED` | 200(SSE) | warning | 导入助手失败 | `stream_import_assist` 异常；可改手动导入 |
| `AGENT_TRENDING_FAILED` | 200(SSE) | error | 趋势扫描失败 | `stream_trending_scout`；GitHub 限流或 LLM 失败 |
| `AGENT_CLASSIFY_FAILED` | 200(SSE) | error | 自动分类失败 | `stream_classify_project` 异常 |
| `AGENT_NOTE_FAILED` | 200(SSE) | error | 笔记生成失败 | `stream_generate_note` 异常 |
| `AGENT_DISPATCH_FAILED` | 200(SSE) | error | 专家调度失败 | Hub `dispatch_agent` 子任务失败 |
| `AGENT_TOOL_DENIED` | 403 | warning | 工具权限未开启 | 设置页关闭了对应 `agent_permissions` |
| `AGENT_TOOL_TIMEOUT` | 504 | warning | 工具执行超时 | 工具 `timeout_ms` 耗尽；查工具名与外部 API |
| `AGENT_TOOL_FAILED` | 200(SSE) | error | 工具执行失败 | 工具 handler 抛错；查 tool 返回与日志 |

---

## 3. LLM

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `LLM_KEY_MISSING` | 400 | warning | 未配置 LLM Key | 设置页保存 API Key；或环境变量 `LLM_API_KEY` |
| `LLM_DECRYPT_FAILED` | 500 | error | LLM Key 解密失败 | `SECRET_KEY` / `SECRETS_ENCRYPTION_KEY` 变更；重新保存 Key |
| `LLM_REQUEST_FAILED` | 200(SSE)/502 | error | LLM 请求失败 | 上游 4xx/5xx、超时、模型不存在；查 LiteLLM 日志与 `llm_api_base` |
| `LLM_TIMEOUT` | 504 | warning | LLM 超时 | 增大超时或换更快模型 |
| `LLM_RATE_LIMITED` | 429 | warning | LLM 上游限流 | 供应商配额用尽；稍后重试或换 Key |
| `LLM_USAGE_MODULE_DOWN` | 503 | warning | LLM 用量模块未就绪 | llm_usage 域加载失败；用量统计不可用；查 `/health` |

---

## 4. 图谱

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `GRAPH_MODULE_DOWN` | 503 | warning | 图谱模块未就绪 | graph 域加载失败；不影响项目/笔记 |
| `GRAPH_L1_MODULE_DOWN` | 503 | error | 图谱 L1 模块未就绪 | L1（索引/引擎）路由加载失败；查 `/health` 与 `graph_l1` |
| `GRAPH_ENGINE_UNAVAILABLE` | 503 | error | 图谱引擎不可用 | 进程内 `rp_graph` 异常，或 sidecar `RP_GRAPH_ENGINE_URL` 不可达；查引擎进程与 `RP_GRAPH_ALLOWED_ROOT` |
| `GRAPH_NOT_INDEXED` | 409 | info | 项目尚未索引 | 先触发索引；见 `docs/architecture/graph/` |
| `GRAPH_INDEX_FAILED` | 500 | error | 图谱索引失败 | 索引管线异常；查索引日志 |
| `GRAPH_QUERY_FAILED` | 500 | error | 图谱查询失败 | 相似度/邻居查询异常 |

---

## 5. 项目 / 笔记 / 分类 / 标签

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `PROJECT_NOT_FOUND` | 404 | error | 项目不存在 | `project_id` 错误或已删除 |
| `PROJECT_URL_INVALID` | 400 | warning | 仓库 URL 无效 | 须为 `https://github.com/owner/repo` |
| `PROJECT_URL_DUPLICATE` | 409 | warning | 仓库已导入 | 同一 URL 全局唯一 |
| `PROJECT_IMPORT_FAILED` | 500 | error | 批量导入失败 | 部分或全部导入失败；查 `errors[]` |
| `NOTE_NOT_FOUND` | 404 | error | 笔记不存在 | `note_id` 错误 |
| `CATEGORY_NOT_FOUND` | 404 | error | 分类不存在 | `category_id` 错误 |
| `CATEGORY_PRESET_IMMUTABLE` | 403 | warning | 预设分类不可改 | 预设分类禁止重命名/删除 |
| `CATEGORY_NAME_DUPLICATE` | 409 | warning | 分类名重复 | 换名称 |
| `TAG_NOT_FOUND` | 404 | error | 标签不存在 | `tag_id` 错误 |
| `TAG_NAME_DUPLICATE` | 409 | warning | 标签名重复 | 换名称 |

---

## 6. GitHub

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `GITHUB_NOT_BOUND` | 400 | warning | 未绑定 GitHub | 设置页绑定账号，或 Stars 请求传 `username` |
| `GITHUB_ACCOUNT_NOT_FOUND` | 404 | error | GitHub 账号记录不存在 | 解绑 ID 错误 |
| `GITHUB_PAT_INVALID` | 400 | error | GitHub PAT 无效 | PAT 过期/权限不足；重新绑定 |
| `GITHUB_AUTH_FAILED` | 400 | error | GitHub 鉴权失败 | 同 PAT 无效或 `/user` 探测失败（兼容旧码，优先用 `GITHUB_PAT_INVALID`） |
| `GITHUB_API_RATE_LIMIT` | 502 | warning | GitHub API 限流 | 匿名超额；配置 PAT 提升配额 |
| `GITHUB_API_FAILED` | 502 | error | GitHub API 调用失败 | 非限流的上游错误；查状态码与响应体 |
| `GITHUB_STARS_FETCH_FAILED` | 502 | error | Stars 拉取失败 | 网络或 GitHub API 异常 |

---

## 7. 画像 / 设置

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `PROFILE_NOT_FOUND` | 404 | error | 学习者画像不存在 | 单例应自动创建；查 DB `user_profiles` |
| `MEMORY_PROPOSAL_NOT_FOUND` | 404 | error | 记忆提案不存在 | `proposal_id` 错误或已处理 |
| `SETTINGS_UPDATE_FAILED` | 500 | error | 设置保存失败 | 写 `app_state.settings_json` 异常 |
| `SETTINGS_LLM_BASE_INVALID` | 400 | warning | LLM API Base 不安全 | SSRF 拦截：非 https / 内网 / 解析到私网 |

---

## 响应格式

业务 HTTP 错误统一：

```json
{
  "detail": {
    "code": "AGENT_LLM_UNAVAILABLE",
    "message": "Agent LLM 不可用：未配置 API Key",
    "module": "agent"
  }
}
```

SSE 流内：

```
event: error
data: {"code": "AGENT_ANALYZE_FAILED", "message": "分析失败: ..."}
```

---

## 弃用 / 兼容

| 旧码 | 请改用 | 说明 |
|------|--------|------|
| `NOT_FOUND` | 资源专用 `*_NOT_FOUND` | 过宽，无法区分域 |
| `FORBIDDEN` | `PROJECT_NOT_FOUND` / `AGENT_SESSION_PROJECT_DENIED` | 本地单机几乎无多租户拒绝 |
| `UNAUTHORIZED`（业务 API） | — | 已无用户登录；仅 Agent 内部保留 `AGENT_UNAUTHORIZED` |
| `LLM_NOT_CONFIGURED` | `LLM_KEY_MISSING` | 对齐设置语义 |
| `LLM_ERROR` | `LLM_REQUEST_FAILED` | 更具体 |
| `DISPATCH_ERROR` | `AGENT_DISPATCH_FAILED` | 加域前缀 |
| `CONFLICT` | `PROJECT_URL_DUPLICATE` 等 | 按资源细化 |
| `GITHUB_AUTH_FAILED` | `GITHUB_PAT_INVALID` | 同义；两者均登记，新代码用后者 |
