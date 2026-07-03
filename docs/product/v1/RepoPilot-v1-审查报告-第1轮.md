# RepoPilot v1 产品文档 — 全面审查报告

> 审查日期: 2026-07-03
> 审查范围: `v1/PRD/PRD.md`, `v1/PRD/AGENT_PRD.md`, `v1/SPEC/TECHNICAL_SPEC.md`, `v1/SPEC/AGENT_SPEC.md`, `v1/MVP/MVP_SCOPE.md`, `README.md`

---

## 一、总体评估

文档整体质量较高。产品定位清晰，Agent 多角色设计有深度，技术选型合理，MVP 裁剪得当。以下按**严重程度**分级列出发现的问题：

- **🔴 严重 (Must Fix):** 直接导致开发歧义或实现冲突，必须在动工前修正
- **🟡 建议 (Should Fix):** 影响开发效率和长期维护，强烈建议修正
- **🟢 优化 (Nice to Have):** 锦上添花的改进

---

## 二、跨文档一致性审查

### 🔴 C-01: PRD 与 AGENT_PRD 大面积重复，AGENT_PRD 缺乏独立价值

PRD.md §3.3 的 Agent 系统章节（角色定义、记忆层级、工具集、交互形态、降级策略、未来扩展、TBD）几乎原封不动地出现在 AGENT_PRD.md 中。AGENT_PRD 本应是 Agent 系统的**深入展开**（如详细的反问交互流程、Agent 间协作协议、Prompt 模板示例），但目前只是 PRD §3.3 的副本。

**建议:** 从 PRD.md 中**移除 §3.3.2–§3.3.7 的详细内容**，只保留一段摘要 + "详见 AGENT_PRD.md" 的链接。让 PRD 聚焦产品层面的"做什么"，AGENT_PRD 聚焦 Agent 系统的"怎么设计"。

### 🔴 C-02: TECHNICAL_SPEC 与 AGENT_SPEC 大面积重复

与 C-01 同理，AGENT_SPEC.md 的 §1–§11 几乎是 TECHNICAL_SPEC.md §4–§13 的逐字复制。两份文档应该有不同的职责边界：

**建议:** TECHNICAL_SPEC 负责总体架构、数据模型、API 设计、安全、性能、前端规范。AGENT_SPEC 只负责 Agent 系统的**深度技术细节**（ReAct 引擎状态机、工具注册生命周期、反问协议的边界情况处理、上下文压缩算法的伪代码等）。TECHNICAL_SPEC 中的 Agent 相关章节替换为摘要 + 引用。

### 🔴 C-03: 反问选项字段名不一致 — `label` vs `value`

AGENT_PRD §6.1 的反问 JSON 示例中，选项结构为：

```json
{ "label": "A", "text": "不了解", "value": "none" }
```

但 SPEC §8.1.1（权威来源）和 AGENT_SPEC §6.1.1 中，选项结构为：

```json
{ "value": "none", "label": "不了解", "description": "还停留在 ES5" }
```

SPEC 的 `value` 是语义化的数据值（`"none"/"basic"/"intermediate"`），`label` 是显示文本。AGENT_PRD 的 `label` 是 `"A"/"B"/"C"` 序号。两者含义完全不同。

**修复:** 统一使用 SPEC 的格式。从 AGENT_PRD §6.1 中删除 `label: "A"` 字段，改用 SPEC 的 `value + label + description` 结构。

### 🔴 C-04: 学习偏好字段名不一致 — `comparison` vs `comparisons`

PRD §3.3.3 和 AGENT_PRD §3.2 的 JSON 示例中使用 `comparison` (单数)：

```json
"learning_preferences": { "comparison": true }
```

SPEC §7.2 和 AGENT_SPEC §5.3 的 `LearningPreferences` 模型中使用 `comparisons` (复数)：

```python
comparisons: bool    # 喜欢对比分析
```

**修复:** SPEC 是权威来源，统一使用 `comparisons` (复数)。同步更新 PRD 和 AGENT_PRD 的 JSON 示例。

### 🔴 C-05: PRD JSON 示例中 `learning_preferences` 与 SPEC 模型结构不匹配

PRD §3.3.3 的 JSON 把 `language` 和 `code_comment_language` 放在 `agent_preferences` 下：

```json
"agent_preferences": {
  "mentor_style": "detailed",
  "language": "zh-CN",
  "code_comment_language": "zh-CN"
}
```

但 SPEC §7.2 的 `LearningPreferences` 模型把这两个字段定义在学习偏好下：

```python
class LearningPreferences(BaseModel):
    language: str              # 解释语言 (zh-CN / en)
    code_comment_language: str # 代码注释语言
```

同时 `agent_preferences` 在 SPEC 的 UserProfile 模型中是独立的 JSON 字段，没有明确定义内部结构。

**修复:** 明确划分：`learning_preferences` 管学习相关的偏好（含语言），`agent_preferences` 管 Agent 行为个性化（如 `mentor_style`、`verbosity`）。更新 PRD JSON 示例使之与 SPEC 模型对齐。

### 🟡 C-06: API 端点命名冲突 — LLM 测试端点

SPEC §3.2 定义 LLM 测试端点为：

```
POST /api/v1/agent/config/test
```

MVP_SCOPE §4.1 定义为：

```
POST /api/v1/settings/test-llm
```

这两个端点功能相同（测试 LLM 连通性），但路径不同。MVP_SCOPE 把它放在 Settings 模块下更合理（因为 MVP 阶段没有 Agent 系统），但 SPEC 把它放在 Agent 模块下。

**建议:** MVP 阶段使用 `/settings/test-llm`，在 SPEC 中标注：v0.2 Insight 版本后此端点迁移到 `/agent/config/test`，原路径保留为兼容别名。

### 🟡 C-07: AGENT_PRD §4.1 中 Mentor 工具名与实际定义不一致

AGENT_PRD §4.1 的 Mentor AGENT.md 示例中列出的工具名：

```
- read_source
- query_project_db
```

但实际工具定义（SPEC §6.3）中的名称是：

```
- read_source_file
- query_user_projects
```

**修复:** 统一使用 SPEC 中的工具名。全文搜索 `read_source` 和 `query_project_db`，替换为正确的名称。

### 🟡 C-08: GitHub 绑定端点命名不规范

```
POST /api/v1/github/bindaccount
DELETE /api/v1/github/bindaccount/{id}
```

`bindaccount` 是两个单词粘连在一起，不符合 RESTful 资源命名惯例（应使用连字符分隔或名词复数）。

**建议:** 改为 `/api/v1/github/accounts` (POST 绑定, DELETE 解绑, GET 列出)。更 RESTful，也方便未来支持多 GitHub 账号管理。

### 🟡 C-09: Agent 配置端点 — `permissions` 端点在 MVP_SCOPE 中缺失

SPEC §3.2 定义了：

```
GET  /api/v1/agent/permissions
PUT  /api/v1/agent/permissions
```

但 MVP_SCOPE §4.2 的"返回 501 的端点"列表中没有列出这两个端点。

**修复:** 要么在 MVP_SCOPE §4.2 中补充这两个端点，要么明确标注它们不在 MVP 路由注册范围内。

### 🟢 C-10: PRD §7 路线图版本号与 MVP_SCOPE 对应关系

PRD §7 列出版本路线图 v0.1 → v1.0。MVP_SCOPE 对应 v0.1 Foundation。但 MVP_SCOPE §4.2 提到 "POST /api/v1/agent/classify → v0.3 Connect"，而 PRD §7 写的是 "v0.3 Connect"。两者一致，但建议在 MVP_SCOPE 顶部显式声明 "本文档对应 PRD §7 中的 v0.1 Foundation"。

---

## 三、设计清晰度与规范性审查

### 🔴 D-01: `TechProficiency` 模型定义歧义

SPEC §7.2 定义的 `TechProficiency` 是一个**单项**技术掌握程度的模型：

```python
class TechProficiency(BaseModel):
    name: str           # 技术名称
    level: str          # none / basic / intermediate / advanced / mastered
    source: str
    confidence: float
    evidence: list[str]
    updated_at: datetime
```

但 `UserProfile.tech_proficiency` 是一个 **dict**，键为技术名，值为掌握程度信息：

```json
"tech_proficiency": {
  "javascript": { "level": "mastered", "source": "self_reported", ... },
  "python": { "level": "intermediate", ... }
}
```

`TechProficiency` 模型有 `name` 字段，但在 dict 用法中 `name` 是冗余的（因为键已经是技术名）。这个模型到底是：

- (A) 单项记录（用于列表场景，如 `list[TechProficiency]`）
- (B) dict 中 value 的类型定义（此时不应有 `name` 字段）

**建议:** 明确 `TechProficiency` 是 dict value 的类型。移除 `name` 字段（因为键即名称），或添加注释说明 `name` 在 dict 用法中可省略。同时补充 Pydantic schema：

```python
class TechProficiencyEntry(BaseModel):
    """tech_proficiency dict 中单个条目的结构"""
    level: str
    source: str
    confidence: float
    evidence: list[str] = []
    updated_at: datetime
```

### 🟡 D-02: `agent_preferences` 内部结构未定义

UserProfile 的 `agent_preferences` 字段类型是 `JSON NOT NULL DEFAULT '{}'`，但文档中没有定义其内部结构。PRD JSON 示例展示了 `mentor_style`、`language`、`code_comment_language`，但 SPEC 没有对应的 Pydantic 模型。

**建议:** 定义 `AgentPreferences` 模型，或至少在 SPEC 中添加一个 JSON Schema / 示例表格明确可用字段。

### 🟡 D-03: `github_accounts` JSON 字段结构未定义

User 模型的 `github_accounts` 字段类型是 `JSON DEFAULT '[]'`，但没有定义数组中每个对象的结构。

**建议:** 补充结构定义：

```json
[
  {
    "id": "uuid",
    "username": "octocat",
    "pat_encrypted": true,
    "added_at": "2026-07-03T10:00:00Z"
  }
]
```

注意：PAT 应该存在 `user_settings` 的 `encrypted_api_key` 或独立的 `github_pats` 表中，不应存在 `github_accounts` JSON 里。

### 🟡 D-04: `AgentSession.status` 枚举值与 `pending_question` 的关系

`AgentSession.status` 有三个值：`active / archived / pending_question`。但 `pending_question` 是一个临时状态（Agent 反问等待回答），它和 `active` 在语义上有重叠（等待回答时会话仍然是活跃的）。

**建议:** 考虑将 `pending_question` 提升为独立字段（如 `pending_question_id: UUID | None`），`status` 只保留 `active / archived`。这样更清晰，也避免了状态机的复杂性。

### 🟡 D-05: `QuestionAnswer` 类型缺少判别字段

SPEC §8.2.3 定义的 `QuestionAnswer` 是一个联合类型：

```typescript
type QuestionAnswer =
  | { value: string; other_text?: string }    // radio
  | { values: string[] }                       // checkbox
  | { value: number }                          // slider
  | { order: string[] }                        // drag_sort
  | { checked: string[] };                     // knowledge_map
```

问题：`radio` 和 `slider` 都有 `value` 字段（一个是 string，一个是 number），但 TypeScript 无法通过 `value` 的类型来区分它们（运行时 `typeof` 可以，但编译时不行）。

**建议:** 添加判别字段 `type`：

```typescript
type QuestionAnswer =
  | { type: "radio"; value: string; other_text?: string }
  | { type: "checkbox"; values: string[] }
  | { type: "slider"; value: number }
  | { type: "drag_sort"; order: string[] }
  | { type: "knowledge_map"; checked: string[] };
```

### 🟡 D-06: `agent_permissions` 字段（User 模型）未定义

User 模型有 `agent_permissions JSON DEFAULT '{}'`，但文档中没有任何地方定义其结构或使用方式。SPEC §10.3.2 的工具权限隔离是按工具类别硬编码的，没有用到这个字段。

**建议:** 要么定义其结构（如哪些 Agent 可用、哪些工具可执行），要么标注为 "预留字段，v0.5 Memory 版本启用"。

### 🟢 D-07: 预设分类的 UNIQUE 约束与 SQLite NULL 处理

Category 模型有 `UNIQUE(user_id, name)`。预设分类的 `user_id` 为 NULL。在 SQLite 中，NULL 不等于 NULL，所以多个 `user_id=NULL, name='Web 前端'` 的记录不会触发唯一约束——这是正确行为。但如果未来迁移到 PostgreSQL，NULL 在 UNIQUE 约束中的行为相同，所以没有问题。仅做记录，无需修改。

### 🟢 D-08: `progress` 枚举值缺少国际化考虑

`Project.progress` 使用英文枚举值 `none / learning / learned / mastered`。对于中文用户，前端需要映射为中文显示。建议在 SPEC 中补充一个显示映射表：

```
none → 未开始
learning → 学习中
learned → 已学完
mastered → 已掌握
```

---

## 四、安全审查

### 🔴 S-01: `read_source_file` 工具不使用 GitHub PAT

SPEC §6.3 的 `read_source_file` 实现：

```python
resp = await client.get(url, headers={
    "Accept": "application/vnd.github.v3+json"
})
```

没有携带 GitHub Token。GitHub 未认证请求的速率限制是 **60 次/小时/IP**，而 SPEC §10.4 设定的工具限速是 30 次/分钟——这意味着 2 分钟就会触发 GitHub 的 IP 限速。

**修复:** 从用户的 `github_accounts` 中获取 PAT，注入到请求头：

```python
headers["Authorization"] = f"token {pat}"
```

同时更新限速为更合理的值（认证后 5000 次/小时）。

### 🔴 S-02: Logout 缺乏 Token 失效机制

PRD §4.2 提到 "注销 (可选黑名单)"，SPEC §10.1 提到 "Token 过期 → 前端自动用 refresh_token 获取新 token"，但没有定义：

1. Logout 后 `refresh_token` 如何失效（服务端存储？黑名单？）
2. `access_token` 在过期前是否仍可被使用（15 分钟窗口期）

对于桌面应用这可能不是大问题（单用户），但如果未来支持多设备或 Web 版本，这就是一个安全漏洞。

**建议:** 在 SPEC 中补充 Token 生命周期管理章节，至少说明：

- `refresh_token` 存储在 SQLite `refresh_tokens` 表中，logout 时删除
- `access_token` 无法主动撤销，依赖短过期时间（15 分钟）
- 未来可扩展为 Token 黑名单或 Redis 存储

### 🟡 S-03: CSRF 防护策略与 JWT Bearer 认证不匹配

PRD §4.2 和 SPEC §10.2 提到 "CSRF: SameSite Cookie + Origin 校验"。但认证方案是 `Authorization: Bearer <token>` 头，不是 Cookie。Bearer Token 认证天然免疫 CSRF（因为攻击者无法通过跨站请求获取 Token）。

对于 pywebview 桌面应用，前端通过 `http://127.0.0.1:19876` 与后端通信，CSRF 攻击向量极其有限。

**建议:** 明确说明 CSRF 防护的适用场景。如果认证完全基于 Bearer Token，可以将 CSRF 防护降级为 "Origin 校验"（确保请求来自本地前端），移除 SameSite Cookie 相关描述。

### 🟡 S-04: Prompt 注入防护过于简单

SPEC §10.3.1 的 `PromptGuard` 仅包含一段静态防护字符串和一个空的 `sanitize_user_input` 方法。对于依赖 LLM 的应用，Prompt 注入是核心安全风险。

**建议:** 补充更具体的防护策略：

- 用户输入和 System Prompt 之间添加明确分隔标记
- 对用户输入进行长度限制（防止长文本淹没 System Prompt）
- 工具调用参数校验（防止 LLM 被诱导调用工具执行非预期操作）
- 在 SPEC 中标注此为 v1 基础防护，后续版本迭代增强

### 🟡 S-05: CORS 策略未定义

SPEC §1.2 提到 `middleware.py` 包含 CORS，但没有定义 CORS 策略。对于 pywebview 应用（前端从 `http://127.0.0.1` 访问后端），CORS 配置需要精确：

- 允许的 Origin: `http://127.0.0.1:*`, `http://localhost:*`
- 如果未来有 Web 版本，需要额外的 Origin 配置

**建议:** 在 SPEC §10 中补充 CORS 策略定义。

### 🟡 S-06: 修改密码端点缺乏额外保护

`PUT /api/v1/auth/password` 仅需 JWT 认证。如果 Token 被劫持（15 分钟窗口期），攻击者可以修改用户密码。

**建议:** 添加额外验证层：

- 要求提供当前密码（已有，PRD §3.1 提到 "旧密码验证"）
- 可选：密码修改后使所有 refresh_token 失效

### 🟢 S-07: 文件上传安全

PRD §3.1 提到 "用户头像上传"，但 SPEC 中没有定义文件上传的安全约束（大小限制、类型校验、存储路径隔离）。

**建议:** 在 SPEC 中补充文件上传规范：最大 2MB、仅允许 png/jpg/webp、存储路径不包含用户输入。

---

## 五、性能审查

### 🔴 P-01: 图谱计算缺乏增量更新策略

`GET /api/v1/graph` 需要基于所有项目计算 TF-IDF 余弦相似度矩阵。当项目数增长到 200+ 时：

- TF-IDF 矩阵计算: O(n × d)，n=项目数, d=词汇维度
- 余弦相似度矩阵: O(n² × d)
- 每次请求都重新计算不可接受

MVP_SCOPE §8.2 提到 "计算结果可缓存，项目数据变化时失效"，但没有定义缓存策略。

**建议:** 在 SPEC 中补充：

1. 图谱计算结果缓存到 SQLite `graph_cache` 表或内存
2. 缓存键为所有项目 `(id, updated_at)` 的哈希
3. 增量更新：新增/删除项目时只计算新行/删除旧行，不重算整个矩阵
4. 设定图谱 API 的缓存 TTL（如 5 分钟）

### 🔴 P-02: `read_source_file` 每次创建新的 `httpx.AsyncClient`

SPEC §6.3 的实现：

```python
async with httpx.AsyncClient() as client:
    resp = await client.get(url, ...)
```

每次工具调用都创建和销毁一个 HTTP 客户端，包括 TCP 连接建立和 TLS 握手的开销。

**修复:** 使用全局连接池：

```python
# 在 LLMProvider 或 ToolRegistry 中维护
_shared_client: httpx.AsyncClient | None = None

async def get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(timeout=15)
    return _shared_client
```

### 🟡 P-03: 上下文组装可能超时

SPEC §7.3.1 的 `ContextBuilder.build()` 需要：

1. 加载 System Prompt (文件 I/O)
2. 加载用户画像 (DB 查询)
3. 加载项目记忆 (DB 查询)
4. 加载会话历史 (DB 查询，可能返回大量数据)
5. Token 计数 (计算密集)

SPEC 设定的目标是 < 200ms，但步骤 4 在长会话中可能返回数百条消息，步骤 5 需要遍历所有文本。

**建议:**

- System Prompt 缓存在内存中，Agent 配置变更时失效
- 会话历史查询添加 LIMIT（最近 50 条），更早的通过摘要获取
- Token 计数使用近似算法（如 `len(text) // 3` 中英文混合估算），只在接近预算上限时精确计算

### 🟡 P-04: `GET /api/v1/graph` 缺乏分页/限制

Graph API 返回所有节点和边。当项目数达到 500+ 时，响应体可能达到 MB 级别。

**建议:** 添加参数：

```
GET /api/v1/graph?min_similarity=0.15&max_edges=500&category=Web前端
```

- `min_similarity`: 过滤低相似度边（已有）
- `max_edges`: 限制返回边数，按相似度降序截断
- `category`: 按分类过滤节点

### 🟡 P-05: SQLite 并发写入限制

SQLite 的 WAL 模式支持并发读取，但写入是串行的。Agent 系统可能在同一请求中触发多次写入（更新会话、插入消息、更新用户画像、缓存分析结果）。

**建议:** 在 SPEC 中补充：

- 启用 WAL 模式 (`PRAGMA journal_mode=WAL`)
- 写入操作使用批量事务（一次请求内的多次写入合并为一个事务）
- 设定写入超时 (`PRAGMA busy_timeout=5000`)

### 🟡 P-06: HistoryCompressor 的摘要生成可能不够高效

SPEC §7.3.2 的规则提取使用 `_extract_entities()`，但没有定义实现。如果这个方法使用正则表达式或 NLP 库，在长文本上可能较慢。

**建议:** 明确实体提取的实现：

- 简单方案：按标点分割 + 关键词匹配（技术名词词典）
- 不做复杂 NLP，保持 O(n) 复杂度
- 摘要结果缓存，同一会话不重复生成

### 🟢 P-07: 前端首屏加载优化

SPEC §11.1 设定首屏 < 2s。对于 Vite + React SPA，建议补充：

- 路由级代码分割 (`React.lazy` + `Suspense`)
- 图谱组件延迟加载（D3.js 体积较大）
- 关键 CSS 内联
- 生产构建启用 gzip/brotli 压缩

---

## 六、字段命名权威参考表

以下是经过审查的**权威字段命名**，开发时应严格遵循。发现不一致的已在括号中标注来源文档：

### 6.1 User 相关

| 表/模型 | 字段 | 类型 | 权威命名 | 备注 |
|---------|------|------|---------|------|
| users | id | UUID | `id` | |
| users | username | VARCHAR(32) | `username` | |
| users | password_hash | VARCHAR(255) | `password_hash` | |
| users | email | VARCHAR(255) | `email` | |
| users | avatar_url | VARCHAR(512) | `avatar_url` | |
| users | github_accounts | JSON | `github_accounts` | ⚠️ 内部结构待定义 (D-03) |
| users | agent_permissions | JSON | `agent_permissions` | ⚠️ 结构待定义 (D-06) |
| user_settings | user_id | UUID | `user_id` | PK |
| user_settings | theme | VARCHAR(32) | `theme` | |
| user_settings | zoom | FLOAT | `zoom` | |
| user_settings | font_scale | FLOAT | `font_scale` | |
| user_settings | view_mode | VARCHAR(8) | `view_mode` | |
| user_settings | llm_provider | VARCHAR(32) | `llm_provider` | MVP 扩展 |
| user_settings | llm_model | VARCHAR(128) | `llm_model` | MVP 扩展 |
| user_settings | llm_api_base | VARCHAR(512) | `llm_api_base` | MVP 扩展 |
| user_settings | encrypted_api_key | BLOB | `encrypted_api_key` | MVP 扩展 |

### 6.2 UserProfile 相关

| 字段 | JSON 键名 | 类型 | 权威命名 | 备注 |
|------|----------|------|---------|------|
| 技术掌握程度 | `tech_proficiency` | JSON dict | `tech_proficiency` | |
| 学习偏好 | `learning_preferences` | JSON dict | `learning_preferences` | |
| 学习目标 | `goals` | JSON array | `goals` | |
| 历史摘要 | `history_summary` | TEXT | `history_summary` | |
| Agent 偏好 | `agent_preferences` | JSON dict | `agent_preferences` | ⚠️ 结构待定义 (D-02) |
| 扩展特征 | `extensions` | JSON dict | `extensions` | |

### 6.3 LearningPreferences 内部字段

| 字段 | 权威命名 | 类型 | 备注 |
|------|---------|------|------|
| 学习风格 | `style` | str | hands-on / theoretical / visual |
| 深度优先 | `depth_first` | bool | |
| 代码示例 | `code_examples` | bool | |
| 对比分析 | `comparisons` | bool | ⚠️ 复数形式，非 `comparison` (C-04) |
| 详细程度 | `verbosity` | str | concise / balanced / detailed |
| 解释语言 | `language` | str | zh-CN / en |
| 代码注释语言 | `code_comment_language` | str | |

### 6.4 Project 相关

| 表/模型 | 字段 | 权威命名 | 备注 |
|---------|------|---------|------|
| projects | id | `id` | UUID |
| projects | user_id | `user_id` | FK → users |
| projects | name | `name` | owner/repo 格式 |
| projects | url | `url` | GitHub URL |
| projects | description | `description` | |
| projects | stars | `stars` | |
| projects | language | `language` | |
| projects | progress | `progress` | none/learning/learned/mastered |
| projects | note | `note` | 简短备注 |
| projects | category_id | `category_id` | FK → categories |
| projects | imported_at | `imported_at` | |
| projects | created_at | `created_at` | |
| projects | updated_at | `updated_at` | |

### 6.5 Agent 相关

| 表/模型 | 字段 | 权威命名 | 备注 |
|---------|------|---------|------|
| agent_sessions | id | `id` | UUID |
| agent_sessions | user_id | `user_id` | FK → users |
| agent_sessions | title | `title` | |
| agent_sessions | project_id | `project_id` | FK → projects, NULLABLE |
| agent_sessions | active_agent | `active_agent` | ⚠️ 建议改为 `active_agent_id` (D-04) |
| agent_sessions | status | `status` | active/archived/pending_question |
| agent_messages | id | `id` | UUID |
| agent_messages | session_id | `session_id` | FK → agent_sessions |
| agent_messages | role | `role` | user/assistant/system/tool |
| agent_messages | agent_id | `agent_id` | |
| agent_messages | content | `content` | |
| agent_messages | content_type | `content_type` | text/markdown/question/tool_call/tool_result |
| agent_messages | metadata | `metadata` | JSON |
| project_analyses | id | `id` | UUID |
| project_analyses | project_id | `project_id` | FK → projects |
| project_analyses | agent_id | `agent_id` | |
| project_analyses | analysis_type | `analysis_type` | scout_overview/mentor_deep/curator_classify |
| project_analyses | content | `content` | |
| project_analyses | model_used | `model_used` | |
| project_analyses | tokens_used | `tokens_used` | |
| project_analyses | expires_at | `expires_at` | |

### 6.6 工具名权威参考

| 工具名 | 用途 | 可用 Agent |
|--------|------|-----------|
| `read_readme` | 读取项目 README | Scout, Mentor |
| `read_source_file` | 读取 GitHub 仓库文件 | Mentor |
| `search_web` | 搜索互联网 | 所有 |
| `query_user_projects` | 查询用户项目库 | 所有 |
| `get_project_analysis` | 获取缓存分析结果 | Hub, Mentor |
| `update_user_profile` | 更新用户画像 | Mentor, Navigator |
| `suggest_classification` | 建议分类 | Curator |
| `generate_note_outline` | 生成笔记大纲 | Scribe |
| `compare_projects` | 对比项目 | Mentor |
| `build_learning_path` | 构建学习路径 | Navigator |
| `ask_user_question` | 反问交互 | Mentor, Navigator |
| `save_to_memory` | 存储记忆 | 所有 |
| `recall_from_memory` | 检索记忆 | 所有 |

⚠️ AGENT_PRD §4.1 中的 `read_source` 和 `query_project_db` 是错误命名，应使用上表中的名称 (C-07)。

### 6.7 API 端点权威参考

| 模块 | 方法 | 路径 | 状态 |
|------|------|------|------|
| Auth | POST | `/api/v1/auth/register` | MVP |
| Auth | POST | `/api/v1/auth/login` | MVP |
| Auth | POST | `/api/v1/auth/refresh` | MVP |
| Auth | POST | `/api/v1/auth/logout` | MVP |
| Auth | GET | `/api/v1/auth/me` | MVP |
| Auth | PUT | `/api/v1/auth/me` | MVP |
| Auth | PUT | `/api/v1/auth/password` | MVP |
| GitHub | GET | `/api/v1/github/stars` | MVP |
| GitHub | POST | `/api/v1/github/accounts` | MVP (⚠️ 建议改名 C-08) |
| GitHub | DELETE | `/api/v1/github/accounts/{id}` | MVP |
| Projects | GET | `/api/v1/projects` | MVP |
| Projects | POST | `/api/v1/projects` | MVP |
| Projects | POST | `/api/v1/projects/import` | MVP |
| Projects | GET | `/api/v1/projects/{id}` | MVP |
| Projects | PUT | `/api/v1/projects/{id}` | MVP |
| Projects | DELETE | `/api/v1/projects/{id}` | MVP |
| Projects | PUT | `/api/v1/projects/{id}/progress` | MVP |
| Projects | GET | `/api/v1/projects/stats` | MVP |
| Projects | GET | `/api/v1/projects/export` | v0.2 |
| Categories | GET | `/api/v1/categories` | MVP |
| Categories | POST | `/api/v1/categories` | MVP |
| Categories | PUT | `/api/v1/categories/{id}` | MVP |
| Categories | DELETE | `/api/v1/categories/{id}` | MVP |
| Notes | GET | `/api/v1/notes/projects/{project_id}/notes` | MVP |
| Notes | POST | `/api/v1/notes/projects/{project_id}/notes` | MVP |
| Notes | GET | `/api/v1/notes/notes/{id}` | MVP |
| Notes | PUT | `/api/v1/notes/notes/{id}` | MVP |
| Notes | DELETE | `/api/v1/notes/notes/{id}` | MVP |
| Notes | GET | `/api/v1/notes/search` | v0.3 |
| Graph | GET | `/api/v1/graph` | MVP |
| Settings | GET | `/api/v1/settings` | MVP |
| Settings | PUT | `/api/v1/settings` | MVP |
| Settings | POST | `/api/v1/settings/test-llm` | MVP (⚠️ 与 SPEC 冲突 C-06) |
| Agent | POST | `/api/v1/agent/chat` | v0.2 (501 in MVP) |
| Agent | POST | `/api/v1/agent/question` | v0.2 (501 in MVP) |
| Agent | POST | `/api/v1/agent/analyze/{project_id}` | v0.2 (501 in MVP) |
| Agent | POST | `/api/v1/agent/compare` | v0.3 (501 in MVP) |
| Agent | POST | `/api/v1/agent/classify` | v0.3 (501 in MVP) |
| Agent | POST | `/api/v1/agent/recommend` | TBD |
| Agent | POST | `/api/v1/agent/note/generate` | v0.4 (501 in MVP) |
| Agent | GET | `/api/v1/agent/sessions` | v0.2 (501 in MVP) |
| Agent | GET | `/api/v1/agent/sessions/{id}` | v0.2 |
| Agent | PUT | `/api/v1/agent/sessions/{id}` | v0.2 |
| Agent | DELETE | `/api/v1/agent/sessions/{id}` | v0.2 |
| Agent | POST | `/api/v1/agent/sessions/{id}/archive` | v0.2 |
| Agent | GET | `/api/v1/agent/config` | v0.2 |
| Agent | PUT | `/api/v1/agent/config` | v0.2 |
| Agent | POST | `/api/v1/agent/config/test` | v0.2 (⚠️ 与 MVP 冲突 C-06) |
| Agent | GET | `/api/v1/agent/permissions` | v0.2 (⚠️ MVP 遗漏 C-09) |
| Agent | PUT | `/api/v1/agent/permissions` | v0.2 (⚠️ MVP 遗漏 C-09) |
| Agent | GET | `/api/v1/agent/profiles` | v0.2 |
| Agent | GET | `/api/v1/agent/profiles/{agent_id}` | v0.2 |
| Agent | PUT | `/api/v1/agent/profiles/{agent_id}/soul` | v0.2 |
| Agent | PUT | `/api/v1/agent/profiles/{agent_id}/agent` | v0.2 |
| Agent | GET | `/api/v1/agent/user-profile` | v0.4 |
| Agent | PUT | `/api/v1/agent/user-profile` | v0.4 |

---

## 七、修复优先级建议

按影响范围排序，建议的修复顺序：

1. **C-01, C-02:** 消除文档重复，明确各文档职责边界 → 避免后续开发引用混乱
2. **C-03, C-04, C-05:** 统一字段命名 → 直接影响代码实现
3. **D-01:** 明确 TechProficiency 模型语义 → 影响 ORM 和 Pydantic schema
4. **S-01:** 修复 read_source_file 的 GitHub 认证 → 功能可用性问题
5. **S-02:** 补充 Token 生命周期管理 → 安全基础
6. **P-01, P-02:** 图谱缓存和 HTTP 连接池 → 性能基础
7. **D-05:** 补充 QuestionAnswer 判别字段 → 前端类型安全
8. **C-06, C-07, C-08, C-09:** API 命名和端点一致性 → 开发效率
9. **其余 🟡 和 🟢 项:** 在开发过程中逐步完善

---

*报告结束。所有编号可在后续讨论中直接引用（如 "修复 C-03"）。*
