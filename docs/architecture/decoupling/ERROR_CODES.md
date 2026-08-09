# 报错码表（Error Code Registry）

> 维护说明：本表与 `apps/web/src/utils/errorCodes.ts` 必须同步。新增码时两处都改。
>
> 用户可凭码查此表定位排查；开发者据码判断故障域。

## 命名规范

`<域>_<原因>`，全大写下划线。域前缀：`AGENT` / `GRAPH` / `PROJECT` / `NOTE` / `AUTH` / `SYSTEM` / `LLM` / `GITHUB` / `MODULE`。

## 错误码表

| 码 | HTTP | 严重度 | 标题 | 排查提示 |
|----|------|--------|------|---------|
| `MODULE_LOAD_FAILED` | 503 | error | 模块加载失败 | 某后端模块 import 异常；查 `/health` 看哪个模块 loaded=false；查后端日志 traceback |
| `AGENT_MODULE_DOWN` | 503 | error | Agent 模块未就绪 | agent 域加载失败；查日志确认 agent_core/agent_service import 报错；常见 litellm 缺失 |
| `AGENT_LLM_UNAVAILABLE` | 503 | warning | Agent LLM 不可用 | 未配置 LLM API Key 或连接失败；去设置页配置 Key；检查 llm_api_base |
| `AGENT_ANALYZE_FAILED` | 200(SSE) | error | 项目分析失败 | stream_analyze 异常；查后端日志；常见 HubService 调度失败或 LLM 超时 |
| `AGENT_CHAT_FAILED` | 200(SSE) | error | 对话失败 | stream_chat 异常；查 HubService 日志 |
| `AGENT_IMPORT_ASSIST_FAILED` | 200(SSE) | warning | 导入助手失败 | stream_import_assist 异常；已有规则降级，仍失败查日志 |
| `AGENT_TRENDING_FAILED` | 200(SSE) | error | 趋势扫描失败 | stream_trending_scout 异常；GitHub API 限流或 LLM 失败 |
| `AGENT_CLASSIFY_FAILED` | 200(SSE) | error | 分类失败 | stream_classify_project 异常；查 HubService |
| `AGENT_NOTE_FAILED` | 200(SSE) | error | 笔记生成失败 | stream_generate_note 异常 |
| `GRAPH_MODULE_DOWN` | 503 | warning | 图谱模块未就绪 | graph 域加载失败；不影响项目/笔记 |
| `GRAPH_NOT_INDEXED` | 409 | info | 项目尚未索引 | L1 图谱需先触发索引；见 `docs/architecture/graph/` |
| `PROJECT_NOT_FOUND` | 404 | error | 项目不存在 | project_id 错误或不属于当前用户 |
| `NOTE_NOT_FOUND` | 404 | error | 笔记不存在 | note_id 错误 |
| `VALIDATION_ERROR` | 422 | warning | 参数校验失败 | 请求体不符合 schema；查 detail 字段 |
| `RATE_LIMITED` | 429 | warning | 请求过于频繁 | 触发限流；稍后重试 |
| `GITHUB_API_RATE_LIMIT` | 502 | warning | GitHub API 限流 | 匿名请求超额；配置 GitHub PAT 提升配额 |
| `GITHUB_PAT_INVALID` | 400 | error | GitHub PAT 无效 | PAT 过期或无权限；重新绑定 |
| `LLM_KEY_MISSING` | 400 | warning | 未配置 LLM Key | 去设置页配置 API Key |
| `LLM_DECRYPT_FAILED` | 500 | error | LLM Key 解密失败 | SECRET_KEY 变更致历史密文无法解密；重新配置 Key |
| `SYSTEM_SECRET_KEY_WEAK` | 500 | error | 密钥强度不足 | SECRET_KEY < 32 字节；生成强随机密钥 |

## 响应格式

所有业务错误统一返回：

```json
{
  "detail": {
    "code": "AGENT_LLM_UNAVAILABLE",
    "message": "Agent LLM 不可用：未配置 API Key",
    "module": "agent"
  }
}
```

SSE 流内错误事件：

```
event: error
data: {"code": "AGENT_ANALYZE_FAILED", "message": "分析失败: ..."}
```
