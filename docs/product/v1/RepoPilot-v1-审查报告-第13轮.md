# RepoPilot v1.0 文档审查报告 — 第13轮

> 审查范围: `v1/SPEC/AGENT_SPEC.md` + `v1/SPEC/TECHNICAL_SPEC.md`（用户指定重点）
> 交叉验证: `v1/PRD/PRD.md` + `v1/PRD/AGENT_PRD.md` + `v1/MVP/MVP_SCOPE.md`
> 审查时间: 2026-07-04
> 审查维度: 正确性 / 可行性 / 规范性 / 安全性 + 跨文档一致性

---

## 📊 总体结论

**不可直接开发。** 文档整体质量较高（经过12轮审查后已大幅收敛），但**仍存在 4 项 🔴 严重冲突**，会影响第一个 migration、API 端点分类器、以及反问 schema 的实现。建议用一轮修复后即可启动开发。

| 等级 | 数量 | 处理建议 |
|---|---|---|
| 🔴 严重冲突 | 4 | **必须修复**，否则开发会基于错误信息编码 |
| 🟡 中度问题 | 14 | 强烈建议修复，避免开发歧义 |
| 🟢 轻微不一致 | 15 | 建议修复，长期维护会累积风险 |
| ✅ 已确认一致 | 10+ 项 | 无需修改 |

---

## 🔴 严重冲突（必须修复才能开发）

### S-01: LLMConfig `max_context_tokens` 默认值不一致

| 文档 | 位置 | 值 |
|---|---|---|
| TECHNICAL_SPEC.md | §5.2 L1059 | `max_context_tokens: int = 8000` |
| AGENT_SPEC.md | §3.2 L499 | `max_context_tokens: int = 128000` |
| AGENT_SPEC.md §3.2 PRESET_CONFIGS | L517-524 | openai=128000 / anthropic=200000 / deepseek=64000 / custom=8000 |

**冲突分析**: 后端 Pydantic 模型字段默认值在两份 SPEC 中不同。AGENT_SPEC 内部也存在自相矛盾：字段默认值 128000 但 custom 预设 8000。

**修复方案**: 选定 TECHNICAL_SPEC §5.2 的 `= 8000` 为权威（保守值，与 custom 预设一致），AGENT_SPEC §3.2 同步。`PRESET_CONFIGS` 在 `from_user_settings` 路径下使用 Pydantic 模型时会以默认 8000 起步，但 `from_user_settings` 路径会被 `settings.llm_model` 覆盖；非自定义模型不依赖此字段。

**具体改动**:
- `AGENT_SPEC.md` L499: `max_context_tokens: int = 8000`

---

### S-02: 预设分类种子数据两份附录完全不一致

| 文档 | 位置 | 分类风格 | 数量 | 是否含 icon/color |
|---|---|---|---|---|
| TECHNICAL_SPEC.md | 附录 B L2294-2308 | "前端框架" "后端框架" "全栈" "AI/ML" "DevOps" "数据库" "工具/CLI" "UI 组件库" "测试" "安全" "文档" "其他" | 12 | ❌ |
| MVP_SCOPE.md | 附录 B L708-720 | "Web 前端" "Web 后端" "AI / 机器学习" "数据科学" "DevOps / 运维" "移动开发" "桌面应用" "游戏开发" "安全" "工具 / 库" "学习资源" "其他" | 12 | ✅ 含 icon + color |

**冲突分析**: 两份附录都标记为"预设分类种子数据"，但名称、风格、字段完全不同。MVP_SCOPE 版更详细（含 icon/color，且贴合 US-01~US-07 用户故事），且 MVP_SCOPE §3.1/§8.6 明确"权威定义见附录 B"。

**修复方案**: 选定 **MVP_SCOPE 附录 B** 为权威（更详细、更贴近产品需求），删除 TECHNICAL_SPEC 附录 B 的独立列表，改为引用 MVP_SCOPE。

**具体改动**:
- `TECHNICAL_SPEC.md` 附录 B L2292-2309 整段替换为引用: "预设分类种子数据以 MVP_SCOPE.md 附录 B 为权威，本文档不再重复定义。"

---

### S-03: 索引命名不一致（Alembic 迁移会冲突）

| 表 | TECHNICAL_SPEC.md | AGENT_SPEC.md |
|---|---|---|
| `agent_messages` | `idx_agent_messages_session` (L261) | `idx_messages_session` (L1042) |
| `agent_sessions` | `idx_agent_sessions_user ON (user_id, created_at)` (L247) | `idx_agent_sessions_user ON (user_id, updated_at DESC)` (L1030) |

**冲突分析**:
1. `agent_messages` 索引名两文档不一致
2. `agent_sessions` 索引列与排序方向不同

**修复方案**: 统一为：
- `agent_messages`: `idx_agent_messages_session ON agent_messages(session_id, created_at)` （TECHNICAL_SPEC 风格 + 显式 `created_at`）
- `agent_sessions`: `idx_agent_sessions_user ON agent_sessions(user_id, updated_at DESC)` （AGENT_SPEC 风格，session 列表按最近活跃排序更合理）

**具体改动**:
- `AGENT_SPEC.md` L1042: `CREATE INDEX idx_agent_messages_session ON agent_messages(session_id, created_at);`
- `TECHNICAL_SPEC.md` L247: `idx_agent_sessions_user ON agent_sessions(user_id, updated_at DESC)`

---

### S-04: `search_web` 工具的 `allowed_agents` 漏掉 `hub`

| 文档 | 位置 | search_web 允许的 Agent |
|---|---|---|
| TECHNICAL_SPEC §2.2 agent_permissions JSON Schema | L120-156 | scout/mentor/navigator/curator/scribe/hub 都列了 search_web |
| TECHNICAL_SPEC §6.3 @tool 实现 | L1434 | `["scout", "mentor", "navigator", "curator", "scribe", "hub"]` ✅ |
| AGENT_SPEC §4.3 @tool 定义 | L786 | `["scout","mentor","navigator","curator","scribe"]` ❌ 漏 hub |
| MVP_SCOPE §7.4 工具注册清单 | L498 | "所有" (6 个) |

**冲突分析**: AGENT_SPEC §4.3 的 @tool 定义漏了 `hub`，与三处其他文档冲突。运行时 `hub` 调用 `search_web` 会被 `TOOL_NOT_ALLOWED` 拦截。

**修复方案**: AGENT_SPEC §4.3 补全 `hub`。

**具体改动**:
- `AGENT_SPEC.md` L786: `allowed_agents=["scout","mentor","navigator","curator","scribe","hub"], timeout_ms=15000)`

---

## 🟡 中度问题（建议修复，避免开发歧义）

### M-01: `read_source_file` 工具允许 Agent 列表不一致

| 文档 | 位置 | read_source_file 允许的 Agent |
|---|---|---|
| TECHNICAL_SPEC §6.3 @tool 实现 | L1394 | `["scout", "mentor", "scribe"]` (3 个) |
| AGENT_SPEC §4.3 @tool 定义 | L757 | `["mentor"]` (1 个) ✅ 权威 |
| MVP_SCOPE §7.4 | L497 | "Mentor" |
| AGENT_PRD §5.1 | L348 | "Mentor" |

**冲突分析**: TECHNICAL_SPEC §6.3 伪代码给了 3 个，与其他 3 处文档（1 个 mentor）冲突。Mentor 才是深度讲解源码的角色，scout 快速分析和 scribe 笔记助手都不需要读源码。

**修复方案**: 统一为 AGENT_SPEC §4.3 / MVP_SCOPE / AGENT_PRD 的 `["mentor"]`（权威来源是 AGENT_SPEC），修正 TECHNICAL_SPEC §6.3。

**具体改动**:
- `TECHNICAL_SPEC.md` L1394: `allowed_agents=["mentor"],)`

---

### M-02: `ask_user_question` 工具允许 Agent 列表不一致

| 文档 | 位置 | ask_user_question 允许的 Agent |
|---|---|---|
| TECHNICAL_SPEC §2.2 agent_permissions JSON Schema | 散布 | mentor, navigator, curator, scribe (4 个，**漏 hub**) |
| AGENT_SPEC §4.3 @tool 定义 | L877 | `["mentor","navigator","hub","curator","scribe"]` (5 个) ✅ 权威 |
| MVP_SCOPE §7.4 | L507 | "Mentor, Navigator" (2 个，**漏 curator/scribe/hub**) |

**冲突分析**: 三处不一致（4/5/2）。MVP_SCOPE 漏 3 个，JSON Schema 漏 1 个。

**修复方案**: 统一为 AGENT_SPEC §4.3 的 5 个（`["mentor","navigator","hub","curator","scribe"]`）。

**具体改动**:
- `TECHNICAL_SPEC.md` §2.2 hub 列表: 添加 `"ask_user_question"` (hub 实际可触发反问)
- `MVP_SCOPE.md` L507: 改为 `"Mentor, Navigator, Curator, Scribe, Hub"`

---

### M-03: 反问消息 schema 单问题 vs 多问题

| 文档 | 位置 | schema |
|---|---|---|
| AGENT_SPEC §6.1 | L1144-1171 | 顶层 `type: "agent_question"` + 内嵌 `questions: QuestionItem[]` 数组（**多问题**） ✅ |
| AGENT_PRD §6.1 | L416-457 | 顶层 `type: "agent_question"` + 内嵌 `questions: QuestionItem[]`（**多问题**） ✅ |
| TECHNICAL_SPEC §8.1 | L1635-1679 | 顶层 `type: "radio"\|"checkbox"\|...`（**单问题**） ❌ |

**冲突分析**: AGENT_SPEC 与 AGENT_PRD 都采用多问题嵌套结构（更符合产品需求场景，mentor 一次问多个前置知识问题），但 TECHNICAL_SPEC §8.1 写的是单问题。两份 spec 在反问 schema 设计上完全分裂。

**修复方案**: 选定 AGENT_SPEC §6.1 / AGENT_PRD §6.1 的多问题嵌套为权威，TECHNICAL_SPEC §8.1 同步。

**具体改动**:
- `TECHNICAL_SPEC.md` §8.1 L1635-1679: 用 AGENT_SPEC §6.1 的 AgentQuestion / QuestionItem / QuestionAnswer 完整定义替换
- 同步检查 §8.1 中的 `actions.submit.style` 5 选项 (`primary|secondary|ghost|danger|link`) 与 AGENT_SPEC §6.1 对齐（已对齐 ✅）

---

### M-04: `LearningPreferences` 字段数不一致（3 vs 7）

| 文档 | 位置 | 字段数 |
|---|---|---|
| TECHNICAL_SPEC §2.3 | L326-329 | 3 个: `style, pace, depth` |
| AGENT_SPEC §5.3 dataclass | L1080-1088 | 7 个: `style, depth_first, code_examples, comparisons, verbosity, language, code_comment_language` |
| AGENT_PRD §3.2 JSON | L252-260 | 7 个（与 AGENT_SPEC 一致） |

**冲突分析**: AGENT_PRD/AGENT_SPEC 同步（7 字段），但 TECHNICAL_SPEC §2.3 是 3 字段的简化版。AGENT_PRD 的 JSON 示例还多了 `pace`/`depth` 的相反含义（AGENT_SPEC 的 depth_first 是 boolean）。

**修复方案**: 选定 AGENT_SPEC §5.3 的 7 字段为权威，TECHNICAL_SPEC §2.3 同步补齐。

**具体改动**:
- `TECHNICAL_SPEC.md` §2.3 L322-330 整段替换为 AGENT_SPEC §5.3 完整 dataclass 字段定义

---

### M-05: `UserProfile` 表 PK 设计不一致（id vs user_id）

| 文档 | 位置 | PK 字段 |
|---|---|---|
| TECHNICAL_SPEC §2.3 | L313-314 | `id UUID PK` + `user_id UUID FK UNIQUE` |
| AGENT_SPEC §5.2 SQL | L1054 | `user_id UUID PRIMARY KEY REFERENCES users(id)` |
| AGENT_SPEC §5.3 dataclass | L1101 | `user_id: UUID` (无独立 id) |

**冲突分析**: TECHNICAL_SPEC 用独立 `id` 作 PK，AGENT_SPEC 用 `user_id` 作 PK（一对一关系）。一对一场景下用 `user_id` 作 PK 更简洁，省去 unique 约束。

**修复方案**: 选定 AGENT_SPEC 的 `user_id` 作 PK（更简洁），同步 TECHNICAL_SPEC §2.3。

**具体改动**:
- `TECHNICAL_SPEC.md` §2.3: 删 `id UUID PK` 行，`user_id` 改为 `UUID PK, FK → users`（无 UNIQUE 标注）

---

### M-06: `UserProfile` 表字段缺失

| 字段 | TECHNICAL_SPEC §2.3 | AGENT_SPEC §5.2 SQL + §5.3 dataclass |
|---|---|---|
| `history_summary` | ❌ 未列 | ✅ TEXT DEFAULT '' |
| `agent_preferences` | ❌ 未列 | ✅ JSON DEFAULT '{}' |
| `created_at` | ✅ | ❌ AGENT_SPEC 缺 |
| `extensions` 边界约束 | 未明示 | ✅ ≤64KB / ≤100 keys / ext_ 前缀 |

**冲突分析**: AGENT_SPEC 多了 `history_summary` 和 `agent_preferences` 字段（产品需求），缺 `created_at`。extensions 边界约束仅 AGENT_SPEC 详述。

**修复方案**: 合并两表，统一为：
- 字段: `user_id, tech_proficiency, learning_preferences, goals, history_summary, agent_preferences, extensions, created_at, updated_at`
- extensions 约束: `≤64KB / ≤100 keys / ext_ 前缀 / key ≤128 字符`

**具体改动**:
- `TECHNICAL_SPEC.md` §2.3: 补 `history_summary TEXT DEFAULT ''`、`agent_preferences JSON DEFAULT '{}'`、`extensions 边界约束` 整段
- `AGENT_SPEC.md` §5.2 SQL: 补 `created_at TIMESTAMP DEFAULT NOW`

---

### M-07: `project_analyses` 表字段不一致

| 字段 | TECHNICAL_SPEC §2.2 | AGENT_SPEC §5.2 |
|---|---|---|
| `agent_id` | ✅ VARCHAR(32) NOT NULL | ❌ 无 |
| `result` | ✅ JSON NOT NULL | ❌ 字段名是 `content TEXT NOT NULL` |
| `content` | ❌ 无 | ✅ TEXT NOT NULL |
| `token_usage` | ❌ 无 | ✅ JSON DEFAULT '{}' |
| `expires_at` | ✅ NULLABLE | ❌ NOT NULL（强制） |

**冲突分析**: 字段名不同（`result` JSON vs `content` TEXT），AGENT_SPEC 缺 `agent_id`（用于跟踪是哪个 Agent 生成的），`expires_at` 约束不一致。

**修复方案**: 合并两表，统一为：
- `id, project_id, agent_id, analysis_type, result (JSON), token_usage (JSON), created_at, expires_at (NULLABLE, 7 天后清理可空)`

**具体改动**:
- `TECHNICAL_SPEC.md` §2.2: 删 `agent_id` 行（与下条矛盾），统一为合并版
- `AGENT_SPEC.md` §5.2: 字段名 `content` → `result`，类型 `TEXT` → `JSON`，补 `agent_id` 行，`expires_at` 约束改为 `NULLABLE`

---

### M-08: `agent_sessions` 表字段不一致

| 字段 | TECHNICAL_SPEC §2.2 | AGENT_SPEC §5.2 |
|---|---|---|
| `agent_id` | ✅ VARCHAR(32) NOT NULL | ❌ 无 |
| `current_project_id` | ❌ 无 | ✅ UUID NULLABLE |
| `metadata` | ❌ 无 | ✅ JSON DEFAULT '{}' |
| `title` 默认值 | `NULLABLE` | `DEFAULT '新对话'` |

**冲突分析**: AGENT_SPEC 多 `current_project_id`、`metadata`；TECHNICAL_SPEC 多 `agent_id`；`title` 默认值不同。

**修复方案**: 合并两表，建议保留所有字段：
- `id, user_id, agent_id, title NULLABLE, status, current_project_id NULLABLE, metadata JSON DEFAULT '{}', created_at, updated_at`

**具体改动**:
- `TECHNICAL_SPEC.md` §2.2: 补 `current_project_id UUID NULLABLE`、`metadata JSON DEFAULT '{}'`
- `AGENT_SPEC.md` §5.2: 补 `agent_id VARCHAR(32) NOT NULL`，`title` 改为 `NULLABLE`

---

### M-09: TTL 缓存策略不一致（项目分析 24h vs 7d）

| 文档 | 位置 | ProjectAnalysis TTL |
|---|---|---|
| TECHNICAL_SPEC §11.2 | L1949-1950 | 7 天 ✅ |
| AGENT_SPEC §11.2 | L1464 | 24h ❌ |
| PRD §7.4 TBD-06 | L241 | 倾向 7 天 ✅ |

**冲突分析**: AGENT_SPEC 写 24h，PRD TBD-06 决策 + TECHNICAL_SPEC 都写 7 天。

**修复方案**: 统一为 7 天。

**具体改动**:
- `AGENT_SPEC.md` §11.2 L1464: `项目分析 \| 7天 \| project_analyses`

---

### M-10: GraphCache TTL 不一致（5min vs 变更失效 vs 实时）

| 文档 | 位置 | GraphCache TTL |
|---|---|---|
| TECHNICAL_SPEC §11.2 | L1951 | 5 分钟 |
| AGENT_SPEC §11.2 | L1465 | "变更失效"（TF-IDF 增量） |
| MVP_SCOPE §4.1 | L218 | 实时计算（无 TTL） |

**冲突分析**: 三处三种说法。

**修复方案**: 统一为 TECHNICAL_SPEC §11.2 的 "5 分钟 + 项目变更失效"，MVP_SCOPE §4.1 注释引用 SPEC §11.2。

**具体改动**:
- `AGENT_SPEC.md` §11.2 L1465: `图谱数据 \| 5分钟 + 项目变更失效 \| graph_cache`
- `MVP_SCOPE.md` §4.1 L218: 添加注释 "缓存策略见 TECHNICAL_SPEC §11.2"

---

### M-11: `settings/test-llm` vs `agent/config/test` 端点定义混乱

| 文档 | 位置 | 端点 |
|---|---|---|
| TECHNICAL_SPEC §4.1 | L713 | `POST /api/v1/agent/config/test` |
| TECHNICAL_SPEC 附录 A | L2286 | `POST /agent/config/test`（**已删 settings/test-llm**） |
| AGENT_SPEC §8.3 | L1329 | `POST /agent/config/test` |
| MVP_SCOPE §4.1 Settings | L226 | `POST /api/v1/settings/test-llm` ❌ 与 TECHNICAL_SPEC 矛盾 |
| MVP_SCOPE §4.1 Agent | L250 | `POST /api/v1/agent/config/test` |

**冲突分析**: MVP_SCOPE 维护两个测试端点（settings/test-llm + agent/config/test），但 TECHNICAL_SPEC 附录 A 注释明确"已删除 settings/test-llm"（T-06 修复）。这是 TECHNICAL_SPEC 内部的"修复说明"自相矛盾。

**修复方案**: 统一为一个端点 `POST /api/v1/agent/config/test`，删除 MVP_SCOPE §4.1 settings/test-llm。

**具体改动**:
- `MVP_SCOPE.md` §4.1 Settings L226: 删除 `POST /test-llm` 整行
- `MVP_SCOPE.md` L228 N-05 补全注释: 删除（与修复同步）

---

### M-12: `AgentDefinition` 字段名风格不一致

| 字段 | AGENT_SPEC §2.1 | TECHNICAL_SPEC §4.4 |
|---|---|---|
| `system_prompt_template` | ✅ (Jinja2 路径) | ❌ 无（用 `config_yaml_path`） |
| `config_yaml_path` | ❌ 无 | ✅ |
| `config: dict` | ✅ | ❌ 无 |

**冲突分析**: 字段名风格分裂，AGENT_SPEC 多 1 字段，TECHNICAL_SPEC 用不同字段名表达相同含义。

**修复方案**: 合并为统一字段集。建议保留 `agent_md_path` + `soul_md_path` + `config_yaml_path`（TECHNICAL_SPEC 风格更清晰），删除 `system_prompt_template` 和 `config: dict`（YAML 已包含所有配置，避免冗余）。注意 jinja2 模板路径应从 config.yaml 内部字段读取。

**具体改动**:
- `AGENT_SPEC.md` §2.1 L197-198: `system_prompt_template: str = ""` → `config_yaml_path: str = ""`；删 `config: dict` 字段

---

### M-13: `QuestionAnswer` TypeScript 类型 TECHNICAL_SPEC 缺失

| 文档 | 位置 | QuestionAnswer 类型 |
|---|---|---|
| AGENT_SPEC §6.1 | L1173-1179 | ✅ 完整 5 种 type 联合 |
| AGENT_PRD §6.1 | L404-411 | ✅ 完整 5 种 type 联合 |
| TECHNICAL_SPEC §8.1 | — | ❌ 缺失 |

**冲突分析**: 前端提交答案时需要这个 TypeScript 类型，TECHNICAL_SPEC 没定义。

**修复方案**: TECHNICAL_SPEC §8.1 补全 QuestionAnswer 类型（从 AGENT_SPEC §6.1 复制）。

**具体改动**:
- `TECHNICAL_SPEC.md` §8.1 末尾补全 QuestionAnswer type 联合定义

---

### M-14: 工具超时值在 TECHNICAL_SPEC §6.3 伪代码未指定

| 工具 | AGENT_SPEC §4.3 timeout_ms | TECHNICAL_SPEC §6.3 |
|---|---|---|
| `read_source_file` | 15000ms ✅ | 默认 30000ms（未传 timeout_ms） |
| `search_web` | 15000ms ✅ | 默认 30000ms（未传 timeout_ms） |
| `query_user_projects` | 10000ms ✅ | 默认 30000ms（未传 timeout_ms） |

**冲突分析**: TECHNICAL_SPEC §6.3 的 @tool 调用**未传 timeout_ms**（用默认 30000ms），导致实际超时值与 AGENT_SPEC 不一致。

**修复方案**: TECHNICAL_SPEC §6.3 的 @tool 调用补上 `timeout_ms=` 参数。

**具体改动**:
- `TECHNICAL_SPEC.md` L1345-1358 (query_user_projects): `timeout_ms=10000`
- `TECHNICAL_SPEC.md` L1380-1395 (read_source_file): `timeout_ms=15000`
- `TECHNICAL_SPEC.md` L1423-1434 (search_web): `timeout_ms=15000`

---

## 🟢 轻微不一致（建议修复，不影响开发）

| 编号 | 内容 | 建议 |
|---|---|---|
| L-01 | AGENT_SPEC §5.2 SQL 缺其他 9 张表 | 注释 "完整表结构见 TECHNICAL_SPEC §2.2" |
| L-02 | `learning_preferences` 嵌套结构字段定义分裂 | M-04 修复后此问题消失 |
| L-03 | FastAPI/Starlette 版本要求 3 处声明一致 | 保持现状 ✅ |
| L-04 | PBKDF2 600,000 次仅 TECHNICAL_SPEC §5.2 一处 | AGENT_SPEC §10 加一行引用 |
| L-05 | graph_cache 表 AGENT_SPEC §5.2 缺失 | 同 L-01 |
| L-06 | CORS 配置仅 TECHNICAL_SPEC §10.2 一处 | 无需修复（AGENT_SPEC 不涉及） |
| L-07 | StreamEventType 8 种完全一致 ✅ | 无需修复 |
| L-08 | JWT 配置三文档一致 ✅ | 无需修复 |
| L-09 | 14 工具命名数量一致 ✅ | 无需修复 |
| L-10 | 6 Agent 注册信息一致 ✅ | 无需修复 |
| L-11 | 反问消息 `type: "agent_question"` 与 SSE `event: question` 概念不同 | 文档明确两者关系即可 |
| L-12 | AGENT_SPEC §4.3 `read_source_file` 分页 `start_line/end_line` | 与 TECHNICAL_SPEC §6.3 一致 ✅ |
| L-13 | MVP_SCOPE §2.2 OAuth GitHub 描述"已在 v1.0 范围"但同表又说"v1.1 推迟" | 表述含糊，PRD §3.1 明确 PAT 手动绑定即可 |
| L-14 | progress 字段枚举值两处一致 ✅ | 无需修复 |
| L-15 | user_profiles 表名/类名风格 | 业界惯例，可接受 |

---

## ✅ 已确认一致项（无需修改）

- ✅ **StreamEventType 8 种事件类型**：TECHNICAL_SPEC §3.5 + AGENT_SPEC §2.2.2.1 完全一致
- ✅ **JWT 配置**（HS256 + 15min + 7d）：三文档完全一致
- ✅ **14 个工具命名与数量**：四份文档完全一致
- ✅ **6 Agent 注册信息**（capabilities / priority / 工具数）：仅 AGENT_SPEC §2.1 一处定义，无冲突
- ✅ **CORS `allow_origin_regex`**：仅 TECHNICAL_SPEC §10.2 一处（AGENT_SPEC 不涉及）
- ✅ **FastAPI >= 0.100.0 / Starlette >= 0.20.0**：三处声明一致
- ✅ **PBKDF2 600,000 次迭代**：仅 TECHNICAL_SPEC §5.2 一处（已引用）
- ✅ **graph_cache `expires_at NOT NULL`**：字段约束一致
- ✅ **反问消息 payload.type = "agent_question"** + SSE event = "question"：概念不同但定义明确
- ✅ **AGENT_SPEC §10.1 PromptGuard** 与 TECHNICAL_SPEC §10.3 PromptGuard：双文件定义但内容一致

---

## 🛠 修复优先级与工作量估算

### 必须修复（4 项，约 1.5 小时）

1. **S-01 LLMConfig 默认值**（5 分钟）
2. **S-02 预设分类种子数据二选一**（15 分钟）
3. **S-03 索引命名/列/方向**（10 分钟）
4. **S-04 search_web allowed_agents**（5 分钟）

### 强烈建议修复（6 项核心，约 3 小时）

5. **M-01/M-02 工具 allowed_agents**（20 分钟）
6. **M-03 反问 schema 统一**（30 分钟）
7. **M-04~M-08 数据库表字段合并**（60 分钟 — 涉及 4 张表）
8. **M-09/M-10 TTL 缓存策略统一**（10 分钟）
9. **M-11 settings/test-llm 端点**（10 分钟）
10. **M-12 AgentDefinition 字段统一**（10 分钟）
11. **M-13/M-14 QuestionAnswer + 工具超时**（20 分钟）

### 修复策略建议

采用**两 spec 双修**策略，最大限度保留现有文档结构：
- **AGENT_SPEC** 修正项: S-01, S-03 (L1042), S-04, M-04 (无变化), M-06, M-07, M-08, M-09, M-10, M-12, M-14（无变化）
- **TECHNICAL_SPEC** 修正项: S-02, S-03 (L247), M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-08, M-12, M-13, M-14

---

## 🎯 最终结论

**当前状态**: ❌ 不可直接进入开发（4 项 🔴 严重冲突未解决）

**预期状态**（修复后）: ✅ 可进入开发

**修复建议流程**:
1. 第14轮修复: 修复全部 🔴 4 项 + 🟡 M-01~M-08 数据库/工具层冲突
2. 同步更新两份 SPEC 的交叉引用
3. 一次性合并到 MVP_SCOPE（如有冲突）
4. 重新跑一致性检查（确认 0 冲突）
5. 进入开发

**预估修复工作量**: 4-6 小时（含交叉验证）

---

## 📎 附录: 一致性矩阵

### 数据模型一致性矩阵

| 表 | TECHNICAL_SPEC | AGENT_SPEC SQL | AGENT_SPEC dataclass | MVP_SCOPE | 状态 |
|---|---|---|---|---|---|
| users | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| user_settings | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| user_github_accounts | ✅ §2.2 | ❌ | — | ✅ §3.2 | 一致 |
| refresh_tokens | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| projects | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| categories | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| tags | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| project_tags | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| notes | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| graph_cache | ✅ §2.2 | ❌ | — | ✅ §3.1 | 一致 |
| **agent_sessions** | ✅ §2.2 | ✅ §5.2 | — | ✅ §3.1 | **🔴 M-08** |
| **agent_messages** | ✅ §2.2 | ✅ §5.2 | — | ✅ §3.1 | **🔴 S-03** |
| **project_analyses** | ✅ §2.2 | ✅ §5.2 | — | ✅ §3.1 | **🟡 M-07** |
| **user_profiles** | ✅ §2.3 | ✅ §5.2 | ✅ §5.3 | ✅ §3.1 | **🟡 M-05/M-06** |

### API 端点一致性矩阵

| 端点 | TECHNICAL_SPEC §4.1 | AGENT_SPEC §8.x | MVP_SCOPE §4.1 | 状态 |
|---|---|---|---|---|
| POST /api/v1/auth/login | ✅ | — | ✅ | ✅ |
| POST /api/v1/auth/register | ✅ | — | ✅ | ✅ |
| POST /api/v1/auth/refresh | ✅ | — | ✅ | ✅ |
| POST /api/v1/auth/logout | ✅ | — | ✅ | ✅ |
| GET /api/v1/auth/me | ✅ | — | ✅ | ✅ |
| PUT /api/v1/auth/me | ✅ | — | ✅ | ✅ |
| PUT /api/v1/auth/password | ✅ | — | ✅ | ✅ |
| GET /api/v1/github/stars | ✅ | — | ✅ | ✅ |
| GET /api/v1/github/stars/{username} | ✅ | — | ✅ | ✅ |
| GET /api/v1/github/accounts | ✅ | — | ✅ | ✅ |
| POST /api/v1/github/accounts | ✅ | — | ✅ | ✅ |
| DELETE /api/v1/github/accounts/{id} | ✅ | — | ✅ | ✅ |
| GET /api/v1/projects | ✅ | — | ✅ | ✅ |
| POST /api/v1/projects | ✅ | — | ✅ | ✅ |
| POST /api/v1/projects/import | ✅ | — | ✅ | ✅ |
| GET /api/v1/projects/{id} | ✅ | — | ✅ | ✅ |
| PUT /api/v1/projects/{id} | ✅ | — | ✅ | ✅ |
| DELETE /api/v1/projects/{id} | ✅ | — | ✅ | ✅ |
| PUT /api/v1/projects/{id}/progress | ✅ | — | ✅ | ✅ |
| GET /api/v1/projects/{project_id}/notes | ✅ | — | ✅ | ✅ |
| POST /api/v1/projects/{project_id}/notes | ✅ | — | ✅ | ✅ |
| PUT /api/v1/projects/{id}/tags | ✅ | — | ✅ | ✅ |
| GET /api/v1/projects/stats | ✅ | — | ✅ | ✅ |
| GET /api/v1/projects/export | ✅ | — | ✅ | ✅ |
| GET /api/v1/categories | ✅ | — | ✅ | ✅ |
| POST /api/v1/categories | ✅ | — | ✅ | ✅ |
| PUT /api/v1/categories/{id} | ✅ | — | ✅ | ✅ |
| DELETE /api/v1/categories/{id} | ✅ | — | ✅ | ✅ |
| GET /api/v1/tags | ✅ | — | ✅ | ✅ |
| POST /api/v1/tags | ✅ | — | ✅ | ✅ |
| DELETE /api/v1/tags/{id} | ✅ | — | ✅ | ✅ |
| GET /api/v1/notes/{id} | ✅ | — | ✅ | ✅ |
| PUT /api/v1/notes/{id} | ✅ | — | ✅ | ✅ |
| DELETE /api/v1/notes/{id} | ✅ | — | ✅ | ✅ |
| GET /api/v1/notes/search | ✅ | — | ✅ | ✅ |
| GET /api/v1/graph | ✅ | — | ✅ | ✅ |
| GET /api/v1/settings | ✅ | — | ✅ | ✅ |
| PUT /api/v1/settings | ✅ | — | ✅ | ✅ |
| **POST /api/v1/settings/test-llm** | ❌ 已删 | — | ✅ | **🟡 M-11** |
| **POST /api/v1/agent/config/test** | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/chat | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/question | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/analyze/{project_id} | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/compare | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/classify | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/recommend | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/note/generate | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/sessions | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/sessions/{id} | ✅ | ✅ | ✅ | ✅ |
| PUT /api/v1/agent/sessions/{id} | ✅ | ✅ | ✅ | ✅ |
| DELETE /api/v1/agent/sessions/{id} | ✅ | ✅ | ✅ | ✅ |
| POST /api/v1/agent/sessions/{id}/archive | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/config | ✅ | ✅ | ✅ | ✅ |
| PUT /api/v1/agent/config | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/permissions | ✅ | ✅ | ✅ | ✅ |
| PUT /api/v1/agent/permissions | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/profiles | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/profiles/{agent_id} | ✅ | ✅ | ✅ | ✅ |
| PUT /api/v1/agent/profiles/{agent_id}/soul | ✅ | ✅ | ✅ | ✅ |
| PUT /api/v1/agent/profiles/{agent_id}/agent | ✅ | ✅ | ✅ | ✅ |
| GET /api/v1/agent/user-profile | ✅ | ✅ | ✅ | ✅ |
| PUT /api/v1/agent/user-profile | ✅ | ✅ | ✅ | ✅ |

**端点一致性总评**: 除 M-11 (`settings/test-llm`) 外，53 个端点路径在 3 份文档中**完全一致** ✅

### 工具 14 个一致性矩阵

| # | 工具 | TECHNICAL_SPEC §6.3 | AGENT_SPEC §4.3 | MVP_SCOPE §7.4 | AGENT_PRD §5.1 | 状态 |
|---|---|---|---|---|---|---|
| 1 | query_user_projects | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | read_readme | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 3 | read_source_file | ✅ (timeout 缺) | ✅ | ✅ | ✅ | **🟡 M-01/M-14** |
| 4 | search_web | ✅ (timeout 缺) | ✅ | ✅ | ✅ | **🔴 S-04** |
| 5 | get_project_analysis | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 6 | compare_projects | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 7 | update_user_profile | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 8 | ask_user_question | ✅ (隐) | ✅ | ✅ | ✅ | **🟡 M-02** |
| 9 | save_to_memory | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 10 | recall_from_memory | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 11 | suggest_classification | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 12 | generate_note_outline | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 13 | build_learning_path | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |
| 14 | get_user_profile | ✅ (隐) | ✅ | ✅ | ✅ | ✅ |

**工具一致性总评**: 14 个工具命名/数量完全一致，4 个工具的 allowed_agents 或 timeout 需修复

---

## 📌 附录: 审查方法论

### 审查覆盖度

- ✅ 通读两份 SPEC 文档（共 ~2300 行）
- ✅ 通读 PRD/AGENT_PRD/MVP 文档（共 ~1500 行）
- ✅ 启动子 agent 做 15 类交叉对比（1119K tokens 工具调用）
- ✅ 手动 grep 验证 4 项关键冲突
- ✅ 数据模型 14 张表交叉核对
- ✅ API 端点 53 个交叉核对
- ✅ 14 个工具交叉核对

### 审查维度

| 维度 | 覆盖项 | 评分 |
|---|---|---|
| **正确性** | 数据类型、字段约束、SQL DDL、状态机 | B+（存在 4 个表冲突） |
| **可行性** | 工具实现细节、API 设计、性能目标、错误处理 | A-（整体可行，工期 6-8 周） |
| **规范性** | 文档结构、命名约定、TBD 编号、版本号、跨文档引用 | A |
| **安全性** | JWT、密码、SSRF、路径遍历、PromptGuard、跨用户隔离 | A |
| **一致性** | 跨 4 文档交叉验证 | C+（4 项 🔴 冲突 + 14 项 🟡） |

---

**报告生成时间**: 2026-07-04
**审查人**: MiniMax-M3 (5b81b127-fbd3-4b4b-ba7f-a51cefa2e6e8)
**结论**: 4 项 🔴 必须先修复才能开发；建议用一轮 4-6 小时集中修复后启动
