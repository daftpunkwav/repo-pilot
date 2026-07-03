# RepoPilot v1 产品文档 — 第二轮全面审查报告

> 审查日期: 2026-07-03
> 审查范围: `v1/PRD/PRD.md`, `v1/PRD/AGENT_PRD.md`, `v1/SPEC/TECHNICAL_SPEC.md`, `v1/SPEC/AGENT_SPEC.md`, `v1/MVP/MVP_SCOPE.md`, `README.md`, `docs/development/guides/DEVELOPMENT_PROCESS.md`, `docs/development/guides/DEVELOPMENT_STEPS.md`
> 审查者: SOLO (Critical-Reviewer)
> 关联文档: `v1/RepoPilot-v1-文档审查报告.md`（第一轮审查，本报告为补充 + 复核）

---

## 〇、摘要与现状

本轮审查在第一轮审查（`RepoPilot-v1-文档审查报告.md`）基础上进行，重点：

1. **复核**第一轮已识别问题（🔴 C-/D-/S-/P- 系列）是否仍存在
2. **补充**第一轮未覆盖的"过程文档"——`docs/development/guides/DEVELOPMENT_STEPS.md` 和 `DEVELOPMENT_PROCESS.md` —— **与 v1 文档存在大量冲突**
3. **深入**检查字段命名、API 路径、JSON Schema、SQL 模型、TypeScript 类型的细节正确性
4. **强化**安全审查（认证、JWT、CSRF、加密、SSRF、Prompt 注入、跨用户隔离）
5. **强化**性能审查（缓存、连接池、TF-IDF、SQLite WAL、上下文组装、SSE 流式）

**总体评估:** 文档质量有提升空间但已具备工程可执行性。**最严重的问题不是单文档内部设计，而是文档之间（特别是 PRD ↔ MVP_SCOPE ↔ DEVELOPMENT_STEPS）存在路线图层面的根本冲突**。如果不解决，开发团队会按错误的 phase 顺序工作。

**本轮新发现严重问题:** 15 个 🔴
**待复核问题:** 第一轮 10 个 🔴 中 9 个仍存在、1 个已部分修复
**优化建议:** 35+ 个 🟡/🟢

按严重程度分级：

- **🔴 严重 (Must Fix):** 直接导致开发歧义或实现冲突，必须在动工前修正
- **🟡 建议 (Should Fix):** 影响开发效率和长期维护，强烈建议修正
- **🟢 优化 (Nice to Have):** 锦上添花的改进

---

## 一、跨文档一致性审查

### 1.1 PRD ↔ MVP_SCOPE ↔ DEVELOPMENT_STEPS 路线图根本冲突

#### 🔴 N-01: PRD §7 路线图与 MVP_SCOPE §2.1 实施范围根本冲突——MVP 范围远超 v0.1 Foundation 定义

**PRD §7 版本路线图:**

| 版本   | 代号         | 核心内容                                          |
| ---- | ---------- | --------------------------------------------- |
| v0.1 | Foundation | 用户系统 + 项目管理 + **基础 UI**                       |
| v0.2 | Insight    | Hub + Scout + Mentor Agent 集成 |
| v0.3 | Connect    | **图谱系统** + 分类系统 + Curator Agent + 交叉分析 |
| v0.4 | Scholar    | Navigator + Scribe Agent + **笔记系统** + 学习路径 + 用户画像 |
| v0.5 | Memory     | 记忆系统完善 + Agent 个性配置 + 上下文优化 |
| v0.6 | Polish     | 性能优化 + 安全加固 + 打包发布 |

**MVP_SCOPE §2.1 实际 MVP 范围：**

- 用户系统（P0）
- 项目管理（P0，含 GitHub 集成）
- 分类系统（P0，含**关键词规则分类 = Curator 降级方案**）
- **笔记系统（P0, 含 Markdown 笔记 + MD 实时预览）** —— PRD 路线图说 v0.4 才有
- **可视化 - 项目关系图谱（P0, TF-IDF 力导向图）** —— PRD 路线图说 v0.3 才有
- 设置（含 LLM 配置 = BYOK，Agent 记忆预留接口 = MemoryService）

**冲突点：**

| 特性          | PRD 路线图位置    | MVP_SCOPE 实际位置 | 冲突？ |
| ----------- | ----------- | -------------- | --- |
| Markdown 笔记 | v0.4 Scholar | **v0.1 Foundation (MVP)** | 🔴 严重  |
| TF-IDF 图谱   | v0.3 Connect | **v0.1 Foundation (MVP)** | 🔴 严重  |
| 分类系统        | v0.3 Connect | **v0.1 Foundation (MVP)** | 🔴 严重  |
| 关键词规则分类     | v0.3 Connect | **v0.1 Foundation (MVP)** | 🔴 严重  |
| LLM 配置面板    | 隐含 v0.2+    | **v0.1 Foundation (MVP)** | 🟡    |
| MemoryService 接口 | 隐含 v0.5    | **v0.1 Foundation (MVP)** | 🟡    |

**修复建议：** 二选一

- (A) **以 PRD 路线图为准，重写 MVP_SCOPE §2.1**，删除笔记、图谱、关键词分类、MemoryService 预留、LLM 配置面板的 MVP 实施（标注为 v0.3/v0.4 范围）
- (B) **以 MVP_SCOPE 为准，更新 PRD §7 路线图**，把 v0.1 Foundation 描述改为"用户系统 + 项目管理 + 分类系统 + 笔记系统 + 图谱 + 设置"，把 v0.2 简化为"Agent Hub + Scout + Mentor + 基础对话"

**推荐方案 (A)**——因为 PRD 是产品层面权威（README.md §4 明确"PRD > SPEC > MVP_SCOPE"），PRD 已经把笔记和图谱放到 v0.3/v0.4 一定有原因（避免 v0.1 过重）。MVP_SCOPE 的范围膨胀违背了"MVP 最小可用"原则。

---

#### 🔴 N-02: DEVELOPMENT_STEPS.md 的 Phase 顺序与 MVP_SCOPE §10 开发顺序完全不一致

**DEVELOPMENT_STEPS.md 的 7 个 Phase：**

| Phase | 内容                  | 持续时间  |
| ----- | ------------------- | ----- |
| 0     | 项目初始化              | 2 天   |
| 1     | 用户系统 + 认证          | 5-7 天 |
| 2     | **项目管理 + UI**       | 7-10 天 |
| 3     | **GitHub 同步 + 分类**   | 4-5 天 |
| 4     | **图谱 + 可视化**        | 5-7 天 |
| 5     | **Agent 集成**         | 7-10 天 |
| 6     | **笔记系统**            | 5-7 天 |
| 7     | 安全加固 + 打包发布         | 5-7 天 |

**MVP_SCOPE §10 开发顺序（v0.1 Foundation）：**

| 顺序 | 模块                | 内容                          |
| -- | ----------------- | --------------------------- |
| 1  | 骨架                | FastAPI 脚手架 + Auth + 主题       |
| 2  | 项目核心              | Project/Category/Tag + 规则引擎   |
| 3  | GitHub 集成         | GitHubService + Star 拉取 + 批量导入 |
| 4  | **笔记 + 图谱**       | Note CRUD + GraphService      |
| 5  | 设置 + 预留           | Settings + 扩展预留               |
| 6  | 质量                | 测试 + lint + E2E               |

**冲突点：**

- **DEVELOPMENT_STEPS 把笔记系统放在 Phase 6（v0.4 路线图对应的位置），MVP_SCOPE 把笔记放在顺序 4（v0.1 范围）。** 这与 N-01 是同一个冲突在不同文档的体现。
- DEVELOPMENT_STEPS 整体不是"v0.1 内部"的分步计划，而是把 v0.1~v0.4 合并为一个 7-Phase 路线图。
- DEVELOPMENT_STEPS 不区分"v0.1 / v0.2 / v0.3 / v0.4 子版本"，违背 README.md §1 "版本驱动开发"原则。

**修复建议：**

- 明确 DEVELOPMENT_STEPS.md 的定位（v1.x 全周期的 Phase 计划 vs v0.1 单一版本的开发顺序）
- 在 DEVELOPMENT_STEPS.md 顶部添加 "本计划跨越 v0.1 → v0.4 子版本，每个 Phase 对应 PRD §7 中的某个子版本" 章节
- 与 MVP_SCOPE §10 同步：MVP_SCOPE 是 v0.1 详细开发顺序，DEVELOPMENT_STEPS 是 v1 全部子版本的高层 Phase 计划
- 推荐重组：DEVELOPMENT_STEPS 改成 "v0.1 Phase A/B/C/D"、"v0.2 Phase E/F/G" 等结构

---

### 1.2 API 路径冲突

#### 🔴 N-03: GitHub 绑定端点路径冲突——`/github/accounts` vs `/github/bindaccount`

| 文档 | 路径 | 状态 |
|------|------|------|
| TECHNICAL_SPEC §3.2 | `POST /api/v1/github/accounts` | 规范 |
| TECHNICAL_SPEC §3.2 | `DELETE /api/v1/github/accounts/{id}` | 规范 |
| MVP_SCOPE §4.1 | `POST /api/v1/github/accounts` | 一致 |
| MVP_SCOPE §4.1 | `DELETE /api/v1/github/accounts/{id}` | 一致 |
| **DEVELOPMENT_STEPS Phase 3.1** | `POST /api/v1/github/bindaccount` | 🔴 冲突 |
| **DEVELOPMENT_STEPS Phase 3.1** | `DELETE /api/v1/github/bindaccount/{id}` | 🔴 冲突 |

**根因：** DEVELOPMENT_STEPS.md 的命名风格来自旧版（archive/ 下的 Flask+JS 实现），未跟随 v1 重新设计。

**修复：** DEVELOPMENT_STEPS.md Phase 3.1 全部 GitHub 端点路径改为 `accounts` 风格。

---

#### 🔴 N-04: 笔记端点路径冲突——`/notes/projects/{id}/notes` vs `/projects/{id}/notes`

| 文档 | 路径 |
|------|------|
| TECHNICAL_SPEC §3.2 | `GET /api/v1/notes/projects/{project_id}/notes` |
| TECHNICAL_SPEC §3.2 | `GET /api/v1/notes/notes/{id}` ⚠️ 路径有 `notes/notes` 重复 |
| TECHNICAL_SPEC §3.2 | `PUT /api/v1/notes/notes/{id}` ⚠️ 路径有 `notes/notes` 重复 |
| MVP_SCOPE §4.1 | `GET /api/v1/notes/projects/{project_id}/notes` |
| MVP_SCOPE §4.1 | `GET /api/v1/notes/{id}` ⚠️ 与 SPEC 不一致 |
| MVP_SCOPE §4.1 | `PUT /api/v1/notes/{id}` ⚠️ 与 SPEC 不一致 |
| **DEVELOPMENT_STEPS Phase 6.1** | `GET /api/v1/projects/{id}/notes` 🔴 |
| **DEVELOPMENT_STEPS Phase 6.1** | `POST /api/v1/projects/{id}/notes` 🔴 |
| **DEVELOPMENT_STEPS Phase 6.1** | `GET /api/v1/notes/{id}` 🔴 |
| **DEVELOPMENT_STEPS Phase 6.1** | `PUT /api/v1/notes/{id}` 🔴 |
| **DEVELOPMENT_STEPS Phase 6.1** | `DELETE /api/v1/notes/{id}` 🔴 |
| **DEVELOPMENT_STEPS Phase 6.1** | `GET /api/v1/notes/search` ✅ 一致 |

**根因：** 同样的路径不一致。

**修复：**

1. **统一为 SPEC 风格**（推荐，因为已经有完整的 `/notes/projects/{id}/notes` 路径）。修复 `notes/notes/{id}` 重复——简化为 `GET /api/v1/notes/{id}`。
2. **修正 DEVELOPMENT_STEPS** Phase 6.1 全部笔记端点路径。

---

#### 🟡 N-05: 第一个轮次已识别的 C-06 (LLM 测试端点冲突) 仍存在

| 文档 | 路径 |
|------|------|
| TECHNICAL_SPEC §3.2 | `POST /api/v1/agent/config/test` |
| MVP_SCOPE §4.1 | `POST /api/v1/settings/test-llm` |
| MVP_SCOPE §4.1 注释 | "v0.2 后迁移到 `/agent/config/test`，原路径保留为兼容别名" |

**修复建议：** MVP_SCOPE §4.1 注释位置不正确，应该在 TECHNICAL_SPEC 中标注"v0.2 之前使用 `/settings/test-llm`，v0.2+ 迁移到 `/agent/config/test`，原路径保留为兼容别名"，而不是反过来。当前 SPEC 完全没提 MVP_SCOPE 的过渡方案。

---

#### 🟡 N-06: 第一轮已识别的 C-09 (Agent permissions 端点 MVP_SCOPE 缺失) 仍存在

MVP_SCOPE §4.2 的 501 端点列表中**仍缺失** `GET /api/v1/agent/permissions` 和 `PUT /api/v1/agent/permissions` 这两个端点。

**修复：** MVP_SCOPE §4.2 表格中添加：

```
| GET  /api/v1/agent/permissions | v0.2 Insight |
| PUT  /api/v1/agent/permissions | v0.2 Insight |
```

---

### 1.3 字段命名与配置冲突

#### 🔴 N-07: 密码长度约束冲突

| 文档 | 用户名长度 | 密码长度 |
|------|----------|---------|
| MVP_SCOPE §4.1 验收标准 | **3-32 字符** | **≥ 8 字符** |
| DEVELOPMENT_STEPS Phase 1.3 | 2-32 字符 | **≥ 4 字符** |

**根因：** DEVELOPMENT_STEPS 沿用旧版（archive/Flask）实现，密码 4 字符是过弱策略。

**安全影响：** 4 字符密码在 RTX 4090 算力下秒破。即使是 8 字符，也建议至少 10 字符 + 复杂度校验。

**修复：**

1. DEVELOPMENT_STEPS Phase 1.3 改为"用户名 3-32 字符、密码 ≥ 8 字符"
2. MVP_SCOPE §9.4 安全验收补充"密码强度策略（≥ 8 字符 + 字母数字混合）"或"≥ 10 字符"
3. 在 MVP_SCOPE §4.1 验收标准中显式声明"密码强度必须包含字母+数字"

---

#### 🔴 N-08: 单元测试覆盖率冲突

| 文档 | Service 层覆盖率 | 备注 |
|------|---------------|------|
| MVP_SCOPE §6.2 | **70%** | 现实可执行 |
| DEVELOPMENT_STEPS §2 Gate 1 | **100%**（Service 层 + 工具函数） | 不现实 |

**修复：** DEVELOPMENT_STEPS 改为"核心逻辑 ≥ 70%"，与 MVP_SCOPE 一致。100% 覆盖率通常因偶发分支/错误处理路径而难以达成，会导致团队虚假安全感。

---

#### 🔴 N-09: LLM Key 存储模型冲突——BYOK vs 全局环境变量

| 文档 | LLM Key 存储 |
|------|------------|
| PRD §3.3.1 核心原则 | **BYOK (Bring Your Own Key)** — 用户自带 Key |
| TECHNICAL_SPEC §5.2 | 加密存储在 `user_settings.encrypted_api_key` 字段 |
| MVP_SCOPE §2.1 | LLM 配置 UI 完整（BYOK） |
| MVP_SCOPE §3.2 | `user_settings` 表加 4 个字段 (llm_provider, llm_model, llm_api_base, encrypted_api_key) |
| **DEVELOPMENT_STEPS §4.2** | `LLM_API_KEY=<your-api-key>` **环境变量** 🔴 |

**冲突点：** DEVELOPMENT_STEPS 把 LLM Key 视为"全局单租户"环境变量（典型旧版 Flask 桌面应用风格），但 v1 重新设计采用 BYOK 多用户模型。

**修复：**

1. **DEVELOPMENT_STEPS §4.2 移除 `LLM_PROVIDER/...` 等环境变量**——这些是用户级配置，不应通过环境变量。
2. 仅保留必要的全局配置：`DATABASE_URL`, `JWT_SECRET_KEY`, `GITHUB_CLIENT_ID`（OAuth 未来用）
3. DEVELOPMENT_STEPS §4.2 添加一段说明："LLM Key 是 BYOK，存于 user_settings 表加密字段，不由环境变量管理"

---

### 1.4 Agent 行为规范冲突

#### 🟡 N-10: 工具 `query_user_projects` 允许 Agent 列表不一致

| 文档 | 允许 Agent 列表 |
|------|--------------|
| AGENT_PRD §5.1 工具表 | "所有" |
| TECHNICAL_SPEC §6.3 实现 | `["scout", "mentor", "navigator", "curator", "hub"]` |
| AGENT_SPEC §4.3 实现 | `["scout", "mentor", "navigator", "curator", "hub"]` |

**冲突点：** Scribe Agent 是否可以使用 `query_user_projects`？

- AGENT_PRD 说"所有"——包含 Scribe
- SPEC/AGENT_SPEC 实现不包含 Scribe

**修复：** 统一决策。Scribe 的职责是"辅助生成笔记大纲、总结"——理论上它需要查询用户项目作为上下文。建议：

```python
allowed_agents=["scout", "mentor", "navigator", "curator", "scribe", "hub"]
```

---

#### 🟡 N-11: 反问消息 JSON Schema 不一致（沿用 C-03）

- AGENT_PRD §6.1 选项结构: `{ "label": "A", "text": "不了解", "value": "none" }`
- SPEC §8.1.1 权威结构: `{ "value": "none", "label": "不了解", "description": "..." }`

**修复：** AGENT_PRD §6.1 删除 `label: "A"` 序号字段，改为与 SPEC 一致的 `value + label + description` 三元组。

---

#### 🟡 N-12: 反问示例字段结构与 JSON Schema 不一致（`text` vs `label`）

- AGENT_PRD §6.1 选项: `{ "value": "vdom", "text": "虚拟 DOM" }`（使用 `text`）
- TECHNICAL_SPEC §8.2.3 CheckboxQuestion 接口: `{ value: string; text: string }`（也是 `text`）
- 但 AGENT_SPEC §6.1.1 的 CheckboxQuestion 又用了 `{ "value": "vdom", "text": "虚拟 DOM" }`（一致）

**OK，但** RadioQuestion / SliderQuestion / DragSortQuestion 的 SPEC 接口和 AGENT_SPEC 接口存在字段细微差异：

- TECHNICAL_SPEC §8.2.3 RadioQuestion: `{ value, label, description? }`
- AGENT_SPEC §6.1.1 RadioQuestion: `{ value, label, description }`（无可选标记）

- TECHNICAL_SPEC CheckboxQuestion: `{ value, text }`
- AGENT_SPEC CheckboxQuestion: `{ value, text }`（一致）

- TECHNICAL_SPEC DragSortQuestion: `{ value, label, description? }`
- AGENT_SPEC DragSortQuestion: `{ value, label, description? }`（一致）

总体反问 JSON Schema 已在两 SPEC 之间对齐，但 AGENT_PRD 的 §6.1 示例与权威 SPEC 仍有 `text` vs `label` 的差异（多选框选项使用 `text`，单选框/拖拽项使用 `label`）——这是设计选择，但应保持一致。

**修复：** AGENT_PRD §6.1 显式说明"checkbox 的选项字段名为 `text`、radio/drag_sort 的选项字段名为 `label`"——这是设计选择，但易混淆。

---

### 1.5 README 链接错误（影响交付）

#### 🟡 N-13: 仓库根 README.md 链接到 v1 文档的路径错误

```markdown
## 文档

- PRD：`docs/product/prd/PRD.md`     ❌ 实际路径: `docs/product/v1/PRD/PRD.md`
- Spec：`docs/product/spec/TECHNICAL_SPEC.md`  ❌ 实际路径: `docs/product/v1/SPEC/TECHNICAL_SPEC.md`
```

**修复：** README.md 的"文档"章节修正路径，或在 `docs/product/prd/`、`docs/product/spec/` 创建符号链接 / 最新版本代理文件。

---

## 二、设计清晰度与规范性审查

### 2.1 MVP_SCOPE 范围细节

#### 🟡 D-09: 排除理由 "—" 过多

MVP_SCOPE §2.2 多处使用 "—"（破折号）作为排除理由：

| 功能 | 排除理由 |
|------|---------|
| 笔记导出 | — |
| 学习进度看板 | — |
| OAuth GitHub 绑定 | "OAuth 流程复杂" |
| 时间线 | — |
| 分类统计图 | "P1 优先级" |

**修复：** 统一为"非 MVP 范围，列入 v0.x 路线图"或"P1/P2 优先级"。

---

#### 🟡 D-10: MVP_SCOPE §3.1 缺失 `refresh_tokens` 表

SPEC §10.1 明确 "refresh_token: 7 天过期，存储在 SQLite `refresh_tokens` 表中"，且 logout 时删除该用户的所有 refresh_token。

但 MVP_SCOPE §3.1 表中**未列出** `refresh_tokens` 表。

**修复：** MVP_SCOPE §3.1 表格中添加：

```
| `refresh_tokens` | ✅ | ✅ | 完整实现 (id, user_id, token_hash, expires_at, created_at) |
```

---

#### 🟡 D-11: MVP_SCOPE §2.1 LLM 配置深度未明确

MVP_SCOPE §2.1 写："LLM 配置 (BYOK) | 配置 UI 完整，但 MVP 阶段仅做连接测试，不接入 Agent"。

但 MVP_SCOPE §7.1 又写："LLMProvider | 完整实现 SPEC §5.1 的 LLMProvider 类，含 `complete()` 和 `test_connection()`"。

**冲突点：**

- 是只实现 `test_connection()` 还是要"完整实现"含 `complete()` 的 LLMProvider 类？
- 如果完整实现 `complete()`，那要 `import litellm`——MVP 不调用 LLM 也要承担这个启动开销
- 如果只实现 `test_connection()`，那"完整实现"的说法不准

**修复：** 明确二选一：

- (A) "MVP 阶段 LLMProvider 仅实现 `test_connection()`，`complete()` 在 v0.2 实现"（推荐，避免启动开销）
- (B) "MVP 阶段完整实现 LLMProvider（包含 `complete()`），接受 LiteLLM 启动开销"

---

#### 🟡 D-12: Project `note` 字段 UI 用途不明

SPEC §2.2 Project 模型有 `note TEXT NULLABLE` 字段，注释为"简短备注"。

但 MVP_SCOPE：

- §2.1 AC-04 验收："添加项目：填写 name + URL + 选择分类"——**未提 note 字段**
- §5.1 ProjectDetailPage："项目基础信息卡片，README 查看器，笔记面板，学习进度选择器"——**未提 note 字段**

**问题：** 字段存在但 UI 没有任何体现。

**修复：** 二选一：

- (A) ProjectDetailPage 添加"简短备注"输入框
- (B) 移除 Project.note 字段（用 Note 表的笔记替代）

---

#### 🟡 D-13: README 渲染源数据未明确

MVP_SCOPE §5.1 ProjectDetailPage 写 "README 查看器 (GitHub Markdown 渲染)"。

**未明确：**

- (a) 实时调 GitHub API 拉 README（每次打开详情页都调用）
- (b) 导入项目时预存 README 全文到本地
- (c) 缓存策略——首次拉取后缓存

**问题：** (a) 方案会在用户打开 200 个项目详情时消耗 GitHub 5000 次/小时速率限制。(b) 方案需要存储空间且 README 不会自动更新。

**修复：** 明确方案并写入 SPEC：

- 推荐：(b) + 缓存——导入时拉 README 存到 `project_readmes` 表（或 `projects` 表新增 `readme TEXT` 字段），并在用户访问详情页时检查 last_fetched_at，超过 24h 后台异步刷新
- Project 表新增字段：`readme TEXT NULLABLE`, `readme_fetched_at TIMESTAMP NULLABLE`

---

#### 🟡 D-14: GitHub 同步入口位置未明确

MVP_SCOPE §5.1 DashboardPage 描述"项目列表 (表格视图)，搜索栏，筛选面板 (分类/语言/进度)，分页，**快捷操作按钮**"——未明确"快捷操作"是 GitHub 同步。

DEVELOPMENT_STEPS Phase 3.2 提到 `GitHubSyncModal` 但不是 MVP 范围。

**问题：** 用户在 MVP 阶段怎么触发 GitHub Star 同步？

**修复：** MVP_SCOPE §5.1 DashboardPage 显式列出"GitHub 同步按钮"作为快捷操作之一。

---

#### 🟡 D-15: 标签 CRUD 端点未在 MVP_SCOPE 中明确定义

SPEC §3.2 Categories 端点只列 Category 的 CRUD。**未列 Tag 的 CRUD 端点**。

但 MVP_SCOPE §2.1 "多标签" 列为 P0 完整实现。

**问题：** Tag 怎么增删改？端点路径是什么？

**修复：** 补充 Tag CRUD 端点：

```
GET    /api/v1/tags                 # 列出所有标签
POST   /api/v1/tags                 # 新建标签
DELETE /api/v1/tags/{id}            # 删除标签
PUT    /api/v1/projects/{id}/tags   # 设置项目标签 (多对多)
```

或者在 MVP_SCOPE 明确："标签是项目详情页的内联管理，不提供独立端点"。

---

#### 🟡 D-16: GitHub 账号列表端点未在 MVP_SCOPE 中定义

MVP_SCOPE §4.1 列出 `POST /api/v1/github/accounts` 和 `DELETE /api/v1/github/accounts/{id}`，但**没有 `GET /api/v1/github/accounts`** 用于列出已绑定账号。

SettingsPage 提到"GitHub 账号绑定管理"——用户怎么看到自己绑定了哪些账号？

**修复：** MVP_SCOPE §4.1 添加 `GET /api/v1/github/accounts` 端点。

---

### 2.2 数据模型细节

#### 🟡 D-17: 预设分类种子数据的注入机制未明确

MVP_SCOPE §附录 B 列了 `PRESET_CATEGORIES`，但**未说明**：

- 何时注入（首次启动？Alembic 数据迁移？init 函数？）
- 是否每个新用户都插入一份（应该不会——预设分类的 `user_id` 应为 NULL）
- 升级时如何处理

**修复：** MVP_SCOPE §6.3 或 §附录 B 补充：

```python
# 数据迁移方式：Alembic data migration
# 时机：仅在 categories 表为空时插入（避免重复）
# 字段：user_id=NULL, is_preset=true
```

---

#### 🟡 D-18: 大量导入数量限制的边界值不一致

| 文档 | 限制 |
|------|------|
| MVP_SCOPE §9.2 性能 | "Star 导入 (100 个项目) < 10s" |
| SPEC §3.2 `POST /import` | **无数量限制** |
| DEVELOPMENT_STEPS Phase 2 安全 | "批量导入数量限制 (≤ 500 条/次)" |

**修复：** 统一为 ≤ 500 条/次，并在 SPEC §3.2 `POST /import` 端点文档中标注"单次最多 500 条"。

---

#### 🟡 D-19: Project `progress` 枚举值与 MVP 验收文档不一致

SPEC §2.2 Project.progress 枚举值：`none / learning / learned / mastered`

MVP_SCOPE §9.1 AC-04 验收 "添加项目"——**未明确 progress 默认值**

DEVELOPMENT_STEPS Phase 2.4 "进度切换 — 点击循环 (未学习 → 正在学习 → 已学习 → 熟练掌握)"——**未提 mastered**

**修复：** 在 SPEC §2.2 Project 模型添加约束注释 `DEFAULT 'none'`，并在 MVP_SCOPE 验收中明确"新项目 progress 默认 'none'"。

---

#### 🟡 D-20: User 表 `agent_permissions` JSON 字段无结构定义

SPEC §2.2 User 模型 `agent_permissions JSON DEFAULT '{}'`，**无任何文档说明内部结构**。

第一轮审查 D-06 已记录此问题。

**新发现：** MVP_SCOPE §3.1 把 `users` 表列为完整实现，但**没有说明** `agent_permissions` 的默认内容（应该默认 `{}` 还是某种默认权限配置？）

**修复：** 在 SPEC §2.2 User 模型添加 `agent_permissions` 字段的 JSON Schema 或示例：

```json
{
  "agents": {
    "scout": {"enabled": true, "tools": ["query_user_projects", "read_readme"]},
    "mentor": {"enabled": true, "tools": ["read_source_file", "ask_user_question"]}
  },
  "global": {"max_calls_per_hour": 100}
}
```

---

#### 🟡 D-21: 笔记 `metadata` 字段结构未定义

SPEC §2.2 AgentMessage 表有 `metadata JSON DEFAULT '{}'`，注释"附加信息 (token usage、工具调用详情等)"——但**没有定义**内部结构。

**修复：** 在 SPEC §2.2 AgentMessage 表补充 metadata 字段的 JSON Schema 文档或示例。

---

#### 🟡 D-22: ProjectAnalysis `model_used` 与 `tokens_used` 字段冗余

SPEC §2.2 ProjectAnalysis 表：

- `model_used VARCHAR(64) NULLABLE` —— 用了什么模型
- `tokens_used INTEGER DEFAULT 0` —— 用了多少 token

`model_used` 可放入 `metadata` JSON 字段，避免字段膨胀。

**修复：** 二选一：

- (A) 保留 `model_used` 和 `tokens_used` 字段（便于 SQL 聚合统计）
- (B) 移除 `model_used` 和 `tokens_used`，只保留 `metadata` JSON

推荐 (A)，因为后续可能按模型统计 token 用量。

---

#### 🟡 D-23: User.email 字段预留在 MVP 阶段不强制

SPEC §2.2 User 表 `email VARCHAR(255) NULLABLE`，PRD §3.1 注册流程**未提**邮箱字段。

MVP_SCOPE §4.1 AC-01 验收 "注册" **未提**邮箱。

**问题：** 字段存在但 MVP 阶段不可用——用户注册时不填邮箱。如何处理找回密码？

**修复：** 二选一：

- (A) MVP 阶段不实现找回密码，邮箱字段保留为 P1 预留
- (B) MVP 阶段注册时强制邮箱，PRD 加"邮箱 P0 必填"

推荐 (A)——MVP 简化，邮箱作为 v0.x 增强。

---

### 2.3 API 设计细节

#### 🟡 D-24: 部分 API 端点缺少响应 Schema 文档

MVP_SCOPE §4.1 列出端点但**部分端点未明确响应结构**：

- `GET /api/v1/projects/stats` 写"返回分类分布、语言分布、进度分布的聚合数据"——**未给出 JSON 结构**
- `GET /api/v1/graph` 写"返回 nodes + edges，支持 min_similarity 参数"——**未给出 JSON 结构**
- `GET /api/v1/notes/notes/{id}` 写"含完整 Markdown content"——**未给出 JSON 结构**

**修复：** 在 MVP_SCOPE §4.1 表格中或附录中补充关键端点的响应 JSON 示例。

---

#### 🟡 D-25: `GET /api/v1/projects` 搜索范围未明确

SPEC §3.2 `GET /api/v1/projects` 参数只列 `search`，**未明确 search 匹配什么字段**。

PRD §3.2 "项目搜索" 描述为 "按名称、分类、标签、语言搜索"——但 `category` 和 `language` 是单独的筛选参数，不应该归到 `search` 字段。

**问题：** `search` 参数是只搜名称还是搜名称+描述+标签？

**修复：** SPEC §3.2 明确 `search` 参数匹配范围。推荐：`search` 匹配 `name` 和 `description`；标签和语言通过独立参数。

---

#### 🟡 D-26: `POST /api/v1/projects/import` 响应格式未定义

MVP_SCOPE §4.1 验收"接收 GitHub repo 列表，批量写入，**返回成功/失败计数**"——但响应 JSON 结构未定义。

**修复：** 明确响应结构：

```json
{
  "data": {
    "succeeded": [{"id": "uuid", "name": "owner/repo"}, ...],
    "failed": [{"url": "https://github.com/owner/repo", "reason": "DUPLICATE_URL"}, ...],
    "summary": {"total": 100, "succeeded": 95, "failed": 5}
  },
  "meta": {}
}
```

---

#### 🟡 D-27: `PUT /api/v1/projects/{id}` 部分更新字段范围未明

SPEC §3.2 写 "PUT /{id} | 更新项目 | 支持部分更新"——但**未明确哪些字段可部分更新**。

**修复：** 明确可更新字段：`name`, `description`, `category_id`, `tags`, `note`。**不可更新**：`id`, `user_id`, `url`, `imported_at`, `created_at`, `updated_at`（避免业务漏洞）。

URL 应该通过专门的 `PUT /api/v1/projects/{id}/url` 或删除+新建更新，因为 URL 是唯一性约束字段。

---

### 2.4 AGENT_PRD 内容问题

#### 🟡 A-01: AGENT_PRD.md 与 PRD.md §3.3 大量重复（沿用 C-01）

PRD §3.3 共 7 个子节，AGENT_PRD 几乎完全复制：

- §1 定位 = PRD §3.3.1
- §2 角色定义 = PRD §3.3.2
- §3 记忆系统 = PRD §3.3.3 (重复)
- §4 行为规范 = PRD §3.3.4
- §5 工具集 = PRD §3.3.5
- §6 交互式反问 = PRD §3.3.6
- §7 交互形态 = PRD §3.3.7
- §8 降级策略 = PRD §3.3.8
- §9 未来扩展 = PRD §3.3.9
- §10 TBD = PRD §3.3.10

**修复：** 从 PRD §3.3 删除详细内容，只保留摘要 + "详见 AGENT_PRD" 链接。AGENT_PRD 聚焦于"产品层面的行为准则"（如"反问选项必须包含'其他'"、"工具调用前必须先调用 query_user_projects"），而不是再讲一遍技术细节。

---

#### 🟡 A-02: AGENT_PRD §4.1 Mentor 工具名错误（沿用 C-07）

AGENT_PRD §4.1 列出的 Mentor 工具：
- `read_source` （错误）
- `query_project_db` （错误）

实际 SPEC §6.3 工具名是 `read_source_file` 和 `query_user_projects`。

**修复：** AGENT_PRD §4.1 改为 `read_source_file` 和 `query_user_projects`。

---

#### 🟡 A-03: AGENT_PRD §6.1 反问示例中使用 `text` 字段而非 `label` 字段

```json
{ "value": "vdom", "text": "虚拟 DOM" },
```

但权威来源 SPEC §8.2.3 CheckboxQuestion 用的就是 `text`，**OK 一致**。

但 RadioQuestion 用 `label`：

```json
{ "value": "none", "label": "不了解", "description": "..." }
```

**字段不一致：** radio/drag_sort 用 `label`，checkbox 用 `text`。这是设计选择但易混淆。

**修复：** 显式说明"label 用于单选/拖拽（用户主要看 label 决定），text 用于多选（用户快速浏览）"——或者统一为 `label`。

---

### 2.5 TBD 编号管理

#### 🟡 A-04: TBD 编号在多个文档独立维护，容易失控

| 文档 | TBD 范围 | 数量 |
|------|---------|------|
| PRD §9 | TBD-01 ~ TBD-10 | 10 |
| AGENT_PRD §10 | TBD-01 ~ TBD-10 | 10 (重复) |
| TECHNICAL_SPEC §14 | TBD-01 ~ TBD-10 | 10 (重复 + 影响范围) |
| AGENT_SPEC §12 | TBD-? (需复核) | 未知 |

**问题：** 三份文档各自维护 TBD 编号，编号重叠但内容不同——读者无法判断"TBD-04"指的是哪个文档的哪个问题。

**修复：** 建立全局 TBD 注册表 `docs/TBD.md`：

```markdown
# 全局 TBD 注册表

## TBD-01: Agent 的"形象"
- 来源: PRD §9, AGENT_PRD §10, TECHNICAL_SPEC §14
- 倾向: 简单头像
- 决策日期: TBD
- 关联 PR: TBD
```

各文档的 TBD 章节改为引用全局注册表。

---

## 三、细节正确性审查

### 3.1 JSON Schema / TypeScript 类型

#### 🟡 T-01: `QuestionAnswer` 类型缺少判别字段（沿用 D-05）

```typescript
type QuestionAnswer =
  | { value: string; other_text?: string }    // radio
  | { values: string[] }                       // checkbox
  | { value: number }                          // slider
  | { order: string[] }                        // drag_sort
  | { checked: string[] };                     // knowledge_map
```

问题：radio 和 slider 都有 `value` 字段（string vs number），但 TypeScript 无法通过 `value` 类型区分。

**修复：** 添加判别字段 `type`（已在 D-05 提出，但仍未修复）。

---

#### 🟡 T-02: `AgentQuestion` 的 `actions` 字段类型不严格

```typescript
actions: {
  submit: { text: string; style: "primary" | "secondary" };
  skip: { text: string; style: "ghost" };
};
```

`style` 只支持 "primary" | "secondary" | "ghost"——但 UI 设计可能需要更多变体（danger、link 等）。

**修复：** 扩展为 `"primary" | "secondary" | "ghost" | "danger" | "link"`。

---

#### 🟡 T-03: `IntentResult` 类型缺少 `sub_intents` 元素结构

TECHNICAL_SPEC §4.4.2 IntentClassifier.classify 提到返回 `sub_intents`，但**没有定义** `sub_intents` 元素结构。

```python
# 文档中只说:
# - agent_id: 目标 Agent
# - confidence: 置信度 0-1
# - is_multi: 是否需要多个 Agent 协作
# - sub_intents: 多 Agent 时的子意图列表
```

但 sub_intents 中每个元素是什么？应该有 `agent_id`, `message`, `reason` 字段。

**修复：** SPEC §4.4.2 显式定义 `SubIntent` dataclass：

```python
@dataclass
class SubIntent:
    agent_id: str
    message: str         # 子意图的指令
    reason: str          # 路由原因（用于 UI 显示）
```

---

#### 🟡 T-04: SSE 事件类型枚举未集中定义

SPEC §3.4 列了 SSE 事件类型：

- `agent_switch`
- `text_delta`
- `tool_call`
- `agent_question`
- `done`
- `error`

**问题：** 这些事件类型在 SPEC §4.4.3 和 §6.1 重复出现。**没有集中的 TypeScript / Python 枚举定义**。

**修复：** 在 SPEC §3 或附录 A 定义：

```python
# backend/core/events.py
class StreamEventType(str, Enum):
    AGENT_SWITCH = "agent_switch"
    TEXT_DELTA = "text_delta"
    TOOL_CALL = "tool_call"
    AGENT_QUESTION = "agent_question"
    DONE = "done"
    ERROR = "error"
```

```typescript
// frontend/src/types/agent.ts
export type StreamEventType =
  | "agent_switch"
  | "text_delta"
  | "tool_call"
  | "agent_question"
  | "done"
  | "error";
```

---

#### 🟡 T-05: AgentQuestion `actions.skip` 是必填但 `allow_skip` 已存在

SPEC §8.1.1 AgentQuestion JSON:

```json
{
  "actions": {
    "submit": {"text": "提交", "style": "primary"},
    "skip": {"text": "跳过，用默认深度讲解", "style": "ghost"}
  }
}
```

但 SPEC §8.1.1 上面也提到 `"allow_skip": true` 在 question 级别。两个字段表达同一信息，**冗余**。

**修复：** 二选一：

- (A) 删除 `actions.skip`，通过 `allow_skip: true/false` 控制 UI 是否显示跳过按钮
- (B) 删除 `allow_skip`，必须始终提供 `actions.skip` 和 `actions.submit`

推荐 (A)——`allow_skip` 更语义化。

---

### 3.2 数据模型 SQL 细节

#### 🟡 S-01: `UNIQUE(user_id, url)` 约束的 SQLite 行为需注意

SPEC §2.2 Project 表 `*UNIQUE(user_id, url) — 同一用户不可重复导入相同 URL*`。

**问题：** SQLite 中 `NULL = NULL` 返回 `false`（NULL 不等于 NULL），如果未来需要支持"未分类项目"（`category_id=NULL`），需要确保 UNIQUE 约束正确处理 NULL。

MVP 阶段只要求 `user_id` NOT NULL + `url` NOT NULL，应该没问题。但 `Category.user_id` 是 NULLABLE（预设分类），`UNIQUE(user_id, name)` 在 SQLite 中允许多个 NULL user_id 行——这是预期行为。

**修复：** 无需修改，添加注释说明。

---

#### 🟡 S-02: 缺少必要的索引

SPEC §2.2 中只显式定义了 `project_analyses` 的 `INDEX: (project_id, analysis_type)`。

**未定义但应该有的索引：**

- `projects.user_id` —— 列表查询按用户过滤
- `projects.category_id` —— 按分类筛选
- `projects.progress` —— 按进度筛选
- `projects.url` —— 去重检查
- `agent_sessions.user_id` —— 列出用户会话
- `agent_sessions.project_id` —— 项目关联会话
- `agent_messages.session_id` —— 会话消息查询
- `notes.project_id` —— 项目笔记查询
- `notes.user_id` —— 用户笔记查询

**修复：** SPEC §2.2 数据模型章节添加"必备索引清单"或单独的"性能索引"章节。

---

#### 🟡 S-03: `TIMESTAMP` 类型在 SQLite 中存为字符串

SPEC §2.2 大量使用 `TIMESTAMP` 字段，但 SQLite 没有原生 `TIMESTAMP` 类型——SQLAlchemy 会存为 `DATETIME`（ISO 8601 字符串）。

**问题：** 跨数据库迁移（如未来切到 PostgreSQL）会有兼容性问题。

**修复：** SPEC §2.2 明确"使用 SQLAlchemy `DateTime` 类型，SQLite 存为字符串，PostgreSQL 存为 `timestamp`"。或在数据迁移章节补充。

---

### 3.3 Pydantic 模型错误

#### 🔴 S-04: `UserProfile` 模型字段类型错误（SPEC §7.2）

SPEC §7.2:

```python
class UserProfile:
    tech_proficiency: dict           # 技术掌握程度
    learning_preferences: dict            # 学习偏好
    goals: list                  # 学习目标
    history_summary: str         # 学习历史摘要
    agent_preferences: dict            # Agent 个性化配置
```

**问题：**

1. Python 标准库 `dict` 和 `list` 是**未参数化的泛型**——这是 Pydantic V1 风格，但 Pydantic V2 建议用 `dict[str, Any]` 或显式定义子模型。
2. 缺少 `extensions: dict` 字段（但 SQL 定义里有 `extensions`！）
3. 字段定义中没有 `user_id` PK（但 SQL 定义里有！）

**修复：** SPEC §7.2 修正为：

```python
class UserProfile(BaseModel):
    user_id: UUID  # PK
    tech_proficiency: dict[str, TechProficiencyEntry]
    learning_preferences: LearningPreferences
    goals: list[Goal]
    history_summary: str = ""
    agent_preferences: AgentPreferences = AgentPreferences()
    extensions: dict[str, Any] = {}
    updated_at: datetime
```

---

#### 🟡 S-05: `TechProficiencyEntry` 模型有 `name` 字段但实际是 dict value（沿用 D-01）

第一轮 D-01 已记录。SPEC §7.2 中模型定义已正确（`TechProficiencyEntry` 无 `name` 字段），但注释提到"技术名称作为 dict 的 key，因此条目中不需要 name 字段"。

**但** SPEC §7.2 上面的示例 JSON 仍然有 `name` 字段（虽然注释说不需要）——文档内部不一致。

**修复：** 删除示例 JSON 中的 `name` 字段（如果是 dict value），或重新明确 `TechProficiencyEntry` 是单条记录类型（用于 list 场景）。

---

#### 🟡 S-06: `LLMConfig` 模型定义缺失

TECHNICAL_SPEC §5.2 列了 `LLMConfig`:

```python
class LLMConfig(BaseModel):
    """LLM 配置 — 用户自带 Key"""
    provider: str
    model: str
    api_key: str
    api_base: str | None
    max_context_tokens: int
    supports_tools: bool
    supports_vision: bool
```

**问题：**

- 没有 `LLMConfig.from_user_settings(user_settings: UserSetting) -> LLMConfig` 工厂方法定义
- 没有 `LLMConfig` 与 `user_settings` 字段的映射关系文档

**修复：** SPEC §5.2 补充：

```python
class LLMConfig(BaseModel):
    provider: Literal["openai", "anthropic", "deepseek", "custom"]
    model: str
    api_key: str
    api_base: str | None = None
    max_context_tokens: int = 128000
    supports_tools: bool = True
    supports_vision: bool = False

    @classmethod
    def from_user_settings(cls, setting: UserSetting) -> "LLMConfig":
        return cls(
            provider=setting.llm_provider or "openai",
            model=setting.llm_model or "gpt-4o",
            api_key=SecureKeyStore.decrypt(setting.encrypted_api_key) if setting.encrypted_api_key else "",
            api_base=setting.llm_api_base,
        )
```

---

## 四、安全审查（专项）

> 下列编号 N-S- 是本轮安全审查新发现的问题；S-01~S-07 是第一轮已识别问题（部分已修复，未修复的标注 ⚠️）。

### 4.1 认证与授权

#### 🟡 N-S-01: `PUT /api/v1/auth/me` 头像更新缺少文件上传规范

PRD §3.1 用户头像 "P1 上传头像或使用 GitHub 头像"，SPEC §3.2 有 `PUT /me` 端点。

**问题：**

- 头像上传走 `PUT /me` 还是单独的 `POST /me/avatar`？
- 头像文件类型、大小限制未定义
- 头像存储路径未定义（数据库 URL？文件系统？S3？）

**修复：** SPEC §3.2 明确：

- 头像作为 URL 字段，不上传文件（`avatar_url VARCHAR(512)`）——MVP 阶段用户填 GitHub 头像 URL
- v0.x 增加文件上传支持，类型 png/jpg/webp，≤ 2MB，存储在 `./data/avatars/{user_id}.png`

**MVP 阶段：**

- `PUT /me` 接收 `{"avatar_url": "https://github.com/...png"}`
- 不接收 multipart 文件上传
- 后端只做 URL 格式校验

---

#### 🟡 N-S-02: 修改密码端点未强制使 refresh_token 失效

SPEC §10.1 写 "密码修改后使该用户所有 `refresh_token` 失效"——但**没有明确哪个端点实现**。

MVP_SCOPE §4.1 写 `PUT /password` ——但**验收标准只写"验证旧密码，设置新密码"**，没提 refresh_token 失效。

**修复：** MVP_SCOPE §4.1 验收补充："修改密码成功后，使该用户所有 refresh_token 失效（删除 refresh_tokens 表中相关记录）"。

---

#### 🔴 N-S-03: 缺少全局默认速率限制

SPEC §10.3.4 只列了 Agent 端点的速率限制：

| 端点 | 限制 |
|------|------|
| /agent/chat | 20 次/分钟 |
| /agent/analyze | 10 次/分钟 |
| /agent/config/test | 5 次/分钟 |
| 工具: search_web | 5 次/分钟 |
| 工具: read_source_file | 30 次/分钟 |

**问题：**

- `POST /api/v1/auth/login` / `/register` 缺少速率限制（DEVELOPMENT_STEPS 提到 5 次/分钟，但 SPEC/MVP_SCOPE 都没明确）
- `POST /api/v1/projects/import` 缺少限制（批量导入可被滥用）
- `GET /api/v1/notes/search` 全文搜索可能造成 DB 压力
- 通用 GET/POST 端点**没有默认全局速率限制**

**修复：** SPEC §10.2 安全措施清单补充：

| 端点 | 限制 | 理由 |
|------|------|------|
| POST /auth/login | 5 次/分钟/IP | 防爆破 |
| POST /auth/register | 5 次/小时/IP | 防垃圾注册 |
| POST /auth/refresh | 30 次/分钟/user | 防 token 探测 |
| POST /projects/import | 10 次/小时/user | 防滥用 |
| GET /graph | 20 次/分钟/user | 防止 TF-IDF 重算 |
| **默认（其他所有 GET/POST）** | 60 次/分钟/user | 基础保护 |

---

#### 🟡 N-S-04: GitHub PAT 存储位置未明确定义

SPEC §2.2 User 表有 `github_accounts JSON DEFAULT '[]'`，SPEC §5.2 写 "PAT 存储使用与 API Key 相同的 SecureKeyStore 加密方案"——但 **PAT 存在哪里？**

- 方案 A: 存在 `User.github_accounts` JSON 里（加密后）
- 方案 B: 存在 `user_settings.encrypted_pat` BLOB 字段
- 方案 C: 独立的 `user_github_accounts` 表

第一轮 D-03 已记录此问题。

**修复：** SPEC §2.2 数据模型章节补充：

```python
# 方案 A 实施：GitHub 账号列表存为加密 JSON
# 每个 GitHub 账号对象结构:
# {
#   "id": "uuid",
#   "username": "octocat",
#   "encrypted_pat": "base64(fernet.encrypt(pat))",
#   "added_at": "2026-07-03T..."
# }
```

**MVP 阶段：** MVP_SCOPE §3.1 不应只支持一个 GitHub 账号（User.github_accounts 是 list 但 MVP 不明确）。建议：

- MVP：User.github_accounts 列表只支持 1 个账号
- v0.x：扩展为多账号

或者 MVP 阶段直接简化为 `user_settings.encrypted_pat` 单一字段，与 `encrypted_api_key` 类似。

---

#### 🟡 N-S-05: 密码强度校验缺失

MVP_SCOPE §4.1 验收"密码 ≥ 8 字符"——**未要求复杂度**。

**问题：** 8 字符纯数字密码（如 `12345678`）虽然符合长度但极易被爆。

**修复：** MVP_SCOPE §4.1 验收补充："密码必须同时包含字母和数字，长度 ≥ 8 字符"。或更严格："密码长度 ≥ 10 字符，必须包含大小写字母 + 数字"。

---

#### 🟡 N-S-06: SSRF 防护要求仅在 DEVELOPMENT_STEPS 出现

DEVELOPMENT_STEPS Phase 2 安全审查 "URL 输入校验 (防 SSRF — 仅允许 https://github.com/*)"——但 SPEC 和 MVP_SCOPE **都没明文要求**。

**问题：** URL 校验规则散落在不同文档。

**修复：** MVP_SCOPE §4.1 AC-04 验收补充："URL 必须为 https://github.com/{owner}/{repo} 格式（owner/repo 为 1-100 字符的字母数字、点、连字符、下划线）"。

---

#### 🟡 N-S-07: 文件路径校验未明文

SPEC §10.2 安全措施清单有"目录遍历 | 文件路径校验 | 自定义 validator"——但**没有说明哪些操作涉及文件路径**。

MVP 阶段涉及文件路径的操作：

- `agent_analyses` 中 `model_used` 不存文件
- 笔记 Markdown 存储在 DB（不是文件系统）
- 头像存储：MVP 阶段不实现

**问题：** 文件路径校验是预留的——但没说明预留到哪个版本。

**修复：** SPEC §10.2 标注"文件路径校验在 v0.5+ 实现（届时引入文件存储）"。

---

### 4.2 数据安全

#### 🟡 N-S-08: 错误响应可能暴露内部信息

SPEC §3.3 错误格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "项目名称不能为空",
    "details": [...]
  }
}
```

**问题：** MVP_SCOPE §6.5 错误码列表中的 `GITHUB_API_ERROR` 可能包含 GitHub 原始错误信息（如 "API rate limit exceeded at 2026-07-03..."），暴露内部时间戳、限速状态。

**修复：** MVP_SCOPE §6.5 错误处理规范补充：

- 后端捕获所有第三方 API 异常，记录完整堆栈到日志
- 响应只返回友好错误消息（不暴露堆栈、时间戳、路径）
- 内部错误（如数据库连接失败）返回通用消息 "服务暂时不可用，请稍后重试"

---

#### 🟡 N-S-09: 日志脱敏要求未明文

PRD §4.2 安全要求"日志中 Key 自动脱敏 (`sk-****xxxx`)"——但 SPEC 和 MVP_SCOPE **没明文要求**实现日志脱敏中间件。

**修复：** SPEC §10.2 补充：

```python
# backend/core/middleware.py
import re

API_KEY_PATTERN = re.compile(r'(sk-|ant-)[a-zA-Z0-9]{20,}')

class LogSanitizer:
    @staticmethod
    def sanitize(text: str) -> str:
        return API_KEY_PATTERN.sub(
            lambda m: m.group(0)[:4] + '****' + m.group(0)[-4:],
            text
        )
```

MVP_SCOPE §9.4 安全验收补充："所有日志输出经过脱敏中间件，禁止记录完整 API Key、密码、Token"。

---

### 4.3 跨用户隔离

#### 🟡 N-S-10: Project `note` 字段在跨用户访问时的隔离

SPEC §2.2 Project 表无 `user_id` 显式声明在 NOT NULL 约束（虽然 SPEC §2.1 ER 图显示 1 User──* Project）。

**修复：** SPEC §2.2 Project 表约束加 `user_id UUID NOT NULL FK → User`。

---

#### 🟡 N-S-11: `GET /projects/{id}` 未明确返回时是否包含 user_id 字段

MVP_SCOPE §3.3 响应示例：

```json
{
  "data": {
    "id": "uuid",
    "name": "facebook/react",
    "url": "https://github.com/facebook/react",
    "category": {...},
    "tags": [...],
    "stars": 220000,
    "language": "JavaScript",
    "progress": "learning"
  },
  "meta": {"request_id": "abc123"}
}
```

**问题：** 响应中**不包含 user_id**——这是好的（避免暴露）。但需要明确：所有 API 端点都应该自动按 `current_user.id` 过滤数据，不应该让客户端传 `user_id` 参数。

**修复：** SPEC §3.1 设计原则补充："所有资源端点强制注入 current_user，WHERE 子句自动添加 user_id 过滤；不接受客户端传来的 user_id 参数（防越权）"。

---

### 4.4 LLM / Prompt 注入安全

#### 🟡 N-S-12: `sanitize_user_input` 方法为空实现

SPEC §10.3.1:

```python
@staticmethod
def sanitize_user_input(text: str) -> str:
    """检测并标记可疑的注入内容"""
    ...
```

**问题：** 文档中方法是空的（`...`）——没说明具体实现策略。

**修复：** SPEC §10.3.1 补充实现策略：

```python
class PromptGuard:
    INJECTION_PATTERNS = [
        r"(?i)ignore\s+(previous|all|above)\s+instructions",
        r"(?i)you\s+are\s+now\s+",
        r"(?i)system\s*prompt\s*:",
        r"(?i)forget\s+(everything|all)",
        # ... 更多规则
    ]

    @staticmethod
    def sanitize_user_input(text: str) -> str:
        """检测并标记可疑的注入内容 (不删除，标记让 LLM 警觉)"""
        for pattern in PromptGuard.INJECTION_PATTERNS:
            if re.search(pattern, text):
                logger.warning(f"Suspicious injection attempt: {pattern}")
                return f"[INJECTION_FLAGGED] {text}"
        return text
```

---

#### 🟡 N-S-13: System Prompt 与用户消息分隔符未明确定义

SPEC §10.3.1 提 "System Prompt 与用户消息之间添加明确分隔标记 (`===END SYSTEM INSTRUCTIONS===`)"——但**没说明这个分隔符在哪个代码文件中实现**。

**修复：** SPEC §10.3.1 明确分隔符注入位置：

```python
# 在 ContextBuilder._build_system_prompt() 中
system = f"""<system>
{agent_md_content}
{soul_md_content}
===END SYSTEM INSTRUCTIONS===
</system>
"""
```

---

### 4.4 旧审查安全复核

| 第一轮编号 | 状态 | 复核结果 |
|----------|------|---------|
| S-01: read_source_file 不使用 GitHub PAT | ⚠️ 未完全修复 | AGENT_SPEC §4.3 已使用 PAT，但 TECHNICAL_SPEC §6.3 仍未使用（不一致） |
| S-02: Logout 缺乏 Token 失效机制 | ⚠️ 未完全修复 | SPEC §10.1 补充了 refresh_token 存储在 SQLite refresh_tokens 表，但未在数据模型章节列出该表 |
| S-03: CSRF 防护与 JWT 不匹配 | ⚠️ 未修复 | 仍写"CSRF: SameSite Cookie + Origin 校验"——应删除 SameSite Cookie 相关 |
| S-04: Prompt 注入防护简单 | ⚠️ 未完全修复 | 补充了长度限制和工具参数校验，但 sanitize_user_input 仍为空 |
| S-05: CORS 策略未定义 | ✅ 已修复 | SPEC §10.2 补充了 CORS 策略 |
| S-06: 修改密码端点缺保护 | ⚠️ 未完全修复 | SPEC §10.1 提了"修改密码后 refresh_token 失效"，但 MVP_SCOPE §4.1 验收未提 |
| S-07: 文件上传安全 | ⚠️ 未修复 | 仍无文件上传规范 |

---

## 五、性能审查（专项）

### 5.1 缓存策略

#### 🔴 N-P-01: 图谱计算缺乏增量更新（沿用 P-01，但更深）

MVP_SCOPE §8.2 "计算结果可缓存，项目数据变化时失效"——**未定义失效机制**。

**当前问题：**

- 没有图谱缓存表设计
- 没有缓存键计算方法
- 没有失效触发器（项目增删改时清除缓存）
- 没有缓存 TTL 兜底

**修复方案：**

```python
# backend/services/graph_service.py
import hashlib

class GraphService:
    CACHE_TTL = 300  # 5 分钟

    @staticmethod
    def _compute_cache_key(projects: list[Project]) -> str:
        """基于项目 (id, updated_at) 列表计算缓存键"""
        sig = "|".join(
            f"{p.id}:{p.updated_at.isoformat()}"
            for p in sorted(projects, key=lambda p: p.id)
        )
        return hashlib.sha256(sig.encode()).hexdigest()

    async def compute_graph(self, user_id: UUID, min_similarity: float = 0.1):
        projects = await self.db.get_projects(user_id)
        cache_key = self._compute_cache_key(projects)
        
        # 检查缓存
        cached = await self.db.get_graph_cache(user_id, cache_key)
        if cached and not self._is_expired(cached):
            return cached.graph_data
        
        # 计算并缓存
        graph_data = self._compute_tfidf(projects, min_similarity)
        await self.db.set_graph_cache(user_id, cache_key, graph_data, ttl=self.CACHE_TTL)
        return graph_data
```

**DB 设计：**

```sql
CREATE TABLE graph_cache (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cache_key VARCHAR(64) NOT NULL,
    graph_data JSON NOT NULL,
    computed_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, cache_key)
);

CREATE INDEX idx_graph_cache_expires ON graph_cache(expires_at);
```

---

#### 🟡 N-P-02: Scout/Mentor 分析缓存键未定义

SPEC §11.3 缓存策略表：

| 缓存对象 | TTL | 失效条件 |
|----------|-----|---------|
| Scout 分析结果 | 7 天 | 项目更新 / 用户手动刷新 |
| Mentor 深度分析 | 3 天 | 项目更新 |
| 工具结果 (GitHub API) | 1 小时 | 不过期，仅追加 |
| 图谱计算结果 | 5 分钟 | 项目增删改时失效 |

**问题：** "项目更新"如何检测？需不需要 trigger？

**修复：** SPEC §11.3 明确"项目更新" = `project.updated_at` 时间戳变化。在查询缓存时检查：

```python
if analysis.project_id == project.id and analysis.created_at > project.updated_at:
    return analysis  # 缓存有效
```

---

#### 🟡 N-P-03: 工具结果缓存设计细节缺失

SPEC §11.3 "工具结果 (GitHub API) | 1 小时 | 不过期，仅追加"。

**问题：** "仅追加" 是 append-only 的意思？还是 LRU 替换？

**修复：** SPEC §11.3 明确策略：

- GitHub README 缓存：1 小时 TTL，项目更新时立即失效
- GitHub Stars 列表缓存：30 分钟 TTL（用户多次访问时复用）
- GitHub 文件内容缓存：1 小时 TTL，文件路径 + commit SHA 作为 key

---

### 5.2 数据库性能

#### 🟡 N-P-04: SQLite WAL 模式未明确启用

SPEC §1.1 ADR "数据库 | SQLite + SQLAlchemy | 零部署、单文件、够用；未来可换 PostgreSQL"。

**问题：** SQLite 默认 journal mode 是 `delete`，不是 WAL。WAL 提供更好的并发性能。

**修复：** SPEC §1.2 目录结构中的 `database.py` 实现要求：

```python
# backend/database.py
from sqlalchemy import event

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

---

#### 🟡 N-P-05: `get_current_user` 依赖每次都查 DB

SPEC §10.1 认证流程中 `FastAPI Depends(get_current_user) → 验证 JWT → 注入 current_user`。

**问题：** 如果 `get_current_user` 每次都查 DB 加载 User 对象，会增加不必要的 DB 查询。

**修复：** SPEC §10.2 补充：

```python
# backend/api/deps.py
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """从 JWT 解析 user_id，仅在需要时查 DB"""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid token")
    
    # 缓存 User 对象到 request state
    if not hasattr(request.state, "user"):
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(401, "User not found")
        request.state.user = user
    return request.state.user
```

或者使用 Redis 缓存 User 对象（TTL 5 分钟）。

---

#### 🟡 N-P-06: `get_projects` 列表查询的 N+1 风险

MVP_SCOPE §4.1 `GET /api/v1/projects` 验收"支持 search、category、language、progress、sort_by、sort_order、page、page_size 参数"。

**问题：** 如果实现时每个项目都单独查 category 和 tags，会有 N+1 查询问题（200 个项目 = 401 次查询）。

**修复：** SPEC §2.2 数据模型章节或 §3.2 性能注意事项补充：

```python
# 使用 SQLAlchemy selectinload / joinedload 预加载
projects_query = (
    select(Project)
    .options(
        selectinload(Project.category),
        selectinload(Project.tags),
    )
    .where(Project.user_id == current_user.id)
)
```

---

#### 🟡 N-P-07: TF-IDF 计算的内存占用

MVP_SCOPE §8.2 写"使用 scikit-learn 的 `TfidfVectorizer`"——但**没明确**：

- 矩阵存储：dense 还是 sparse？
- 词汇表大小限制？
- 计算时的内存占用？

**问题：** 1000 个项目，每个 description 1KB，TF-IDF 矩阵可能 1000×50000 = 50M 元素，dense 存储 200MB，sparse 存储 ~5MB。必须用 sparse。

**修复：** MVP_SCOPE §8.2 补充：

```python
from sklearn.feature_extraction.text import TfidfVectorizer

vectorizer = TfidfVectorizer(
    max_features=5000,  # 限制词汇表大小
    stop_words='english',
    ngram_range=(1, 2),
)
# 显式使用 sparse 矩阵
tfidf_matrix = vectorizer.fit_transform(corpus)  # 返回 sparse
similarity = cosine_similarity(tfidf_matrix)  # 内存可能爆
# 推荐: 使用 sparse cosine_similarity
from sklearn.metrics.pairwise import cosine_similarity as cs_sparse
similarity = cs_sparse(tfidf_matrix)  # OK
```

---

### 5.3 前端性能

#### 🟡 N-P-08: 图谱组件未明确为懒加载

SPEC §11.1 性能目标 "图谱渲染 < 2s (500 节点)"，MVP_SCOPE §5.1 GraphPage 实现 D3.js。

**问题：** D3.js 体积约 250KB。如果首屏加载，违反 "首屏 < 2s" 目标。

**修复：** MVP_SCOPE §5.1 GraphPage 标注：

```typescript
// React.lazy 懒加载
const GraphPage = React.lazy(() => import('./pages/GraphPage'));

// 在路由配置中:
<Route path="/graph" element={
  <Suspense fallback={<Loading />}>
    <GraphPage />
  </Suspense>
} />
```

---

#### 🟡 N-P-09: 项目列表虚拟滚动未要求

MVP_SCOPE §9.2 "图谱渲染 (100 节点) < 2s"——但**没要求项目列表的虚拟滚动**。

**问题：** 用户导入 1000 个项目后，列表渲染会卡顿。

**修复：** MVP_SCOPE §5.1 DashboardPage 实现要求补充：

```typescript
// 使用 react-window 或 react-virtuoso 虚拟滚动
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={projects.length}
  itemSize={50}
  width="100%"
>
  {Row}
</FixedSizeList>
```

---

### 5.4 LLM / Agent 性能

#### 🟡 N-P-10: 上下文组装 200ms 目标难以达成（沿用 P-03）

SPEC §7.3.1 ContextBuilder.build() 步骤：

1. 加载 System Prompt（文件 I/O）
2. 加载用户画像（DB 查询）
3. 加载项目记忆（DB 查询）
4. 加载会话历史（DB 查询，可能数百条）
5. Token 计数（遍历所有文本）

**问题：** 步骤 5 遍历会话历史计算 token 是个性能瓶颈。

**修复：** SPEC §7.3.1 明确：

- System Prompt 预渲染缓存（Agent 配置变更时失效）
- Token 计数使用近似：`len(text) // 3`（中英文混合）
- 仅在接近 Token 预算上限时调用精确 tokenizer（如 tiktoken）

```python
def estimate_tokens(text: str) -> int:
    """快速 token 估算 — 1 token ≈ 3 字符 (中英文混合)"""
    return len(text) // 3

def accurate_tokens(text: str, model: str) -> int:
    """精确 token 计数 — 仅在必要时使用"""
    import tiktoken
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))
```

---

#### 🟡 N-P-11: 历史压缩算法未定义

SPEC §7.3.2 HistoryCompressor 提到 `_extract_entities` 和 `_summarize`，但**没有实现细节**。

**问题：** 如果 `_extract_entities` 用 NLP 库（如 jieba、spaCy），启动慢且依赖重。

**修复：** SPEC §7.3.2 明确：

- 不引入额外 NLP 依赖
- `_extract_entities` 使用正则 + 关键词词典
- `_summarize` 优先用 LLM 摘要，fallback 到规则提取
- 摘要结果缓存（同一会话不重复生成）

---

#### 🟡 N-P-12: SSE 流式输出的反压（backpressure）机制

SPEC §3.4 Agent 对话协议用 SSE 流式输出。

**问题：** 如果前端处理速度慢，server 端可能 buffer 大量数据导致内存爆。

**修复：** SPEC §3.4 或 §4.4 补充：

```python
# FastAPI SSE 异步生成器
async def event_stream():
    queue = asyncio.Queue(maxsize=10)  # 限制 buffer 大小
    
    async def producer():
        async for event in hub_service.receive_message(...):
            await queue.put(event)
        await queue.put(None)  # 结束信号
    
    producer_task = asyncio.create_task(producer())
    
    while True:
        event = await queue.get()
        if event is None:
            break
        yield f"event: {event.type}\ndata: {event.data}\n\n"
        # FastAPI 自动 flush
```

---

### 5.5 旧审查性能复核

| 第一轮编号 | 状态 | 复核结果 |
|----------|------|---------|
| P-01: 图谱计算缺乏增量更新 | ⚠️ 部分修复 | N-P-01 描述了具体方案但仍未在 SPEC 中实现 |
| P-02: read_source_file 每次创建新 httpx.AsyncClient | ⚠️ 未修复 | SPEC §6.3 仍写 `async with httpx.AsyncClient() as client` |
| P-03: 上下文组装可能超时 | ⚠️ 未完全修复 | N-P-10 补充了具体策略 |
| P-04: GET /api/v1/graph 缺乏分页/限制 | ⚠️ 未完全修复 | MVP_SCOPE §4.1 写了 min_similarity 但缺 max_edges |
| P-05: SQLite 并发写入限制 | ⚠️ 未修复 | N-P-04 补充了 WAL 模式 |
| P-06: HistoryCompressor 摘要生成 | ⚠️ 未完全修复 | N-P-11 补充了实现策略 |
| P-07: 前端首屏加载优化 | ⚠️ 未完全修复 | N-P-08 补充了 D3.js 懒加载 |

---

## 六、API 端点权威参考表（更新版）

下表整合 SPEC、MVP_SCOPE、DEVELOPMENT_STEPS 三个文档的所有端点，标注权威来源和冲突。

### 6.1 端点清单

| 模块 | 方法 | 路径 | 权威来源 | MVP 状态 | 备注 |
|------|------|------|---------|---------|------|
| Auth | POST | `/api/v1/auth/register` | SPEC §3.2 | MVP ✅ | ✅ 一致 |
| Auth | POST | `/api/v1/auth/login` | SPEC §3.2 | MVP ✅ | ✅ |
| Auth | POST | `/api/v1/auth/refresh` | SPEC §3.2 | MVP ✅ | ✅ |
| Auth | POST | `/api/v1/auth/logout` | SPEC §3.2 | **MVP 缺失** | ⚠️ MVP_SCOPE §4.1 未列（虽然 DEVELOP_STEPS 提到） |
| Auth | GET  | `/api/v1/auth/me` | SPEC §3.2 | MVP ✅ | ✅ |
| Auth | PUT  | `/api/v1/auth/me` | SPEC §3.2 | MVP ✅ | ✅ |
| Auth | PUT  | `/api/v1/auth/password` | SPEC §3.2 | MVP ✅ | ✅ |
| GitHub | GET  | `/api/v1/github/stars` | SPEC §3.2 | MVP ✅ | ✅ |
| GitHub | GET  | `/api/v1/github/stars/{username}` | SPEC §3.2 | **MVP 缺失** | ⚠️ MVP_SCOPE §4.1 未列 |
| GitHub | POST | `/api/v1/github/accounts` | SPEC §3.2 | MVP ✅ | ✅ |
| GitHub | GET  | `/api/v1/github/accounts` | 推论 | **MVP 缺失** | ⚠️ N-D-16 |
| GitHub | DELETE | `/api/v1/github/accounts/{id}` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | GET  | `/api/v1/projects` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | POST | `/api/v1/projects` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | POST | `/api/v1/projects/import` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | GET  | `/api/v1/projects/{id}` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | PUT  | `/api/v1/projects/{id}` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | DELETE | `/api/v1/projects/{id}` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | PUT  | `/api/v1/projects/{id}/progress` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | GET  | `/api/v1/projects/stats` | SPEC §3.2 | MVP ✅ | ✅ |
| Projects | GET  | `/api/v1/projects/export` | SPEC §3.2 | v0.2 | ✅ |
| Categories | GET  | `/api/v1/categories` | SPEC §3.2 | MVP ✅ | ✅ |
| Categories | POST | `/api/v1/categories` | SPEC §3.2 | MVP ✅ | ✅ |
| Categories | PUT  | `/api/v1/categories/{id}` | SPEC §3.2 | MVP ✅ | ✅ |
| Categories | DELETE | `/api/v1/categories/{id}` | SPEC §3.2 | MVP ✅ | ✅ |
| Tags | GET  | `/api/v1/tags` | 缺失 | **MVP 缺失** | ⚠️ N-D-15 |
| Tags | POST | `/api/v1/tags` | 缺失 | **MVP 缺失** | ⚠️ N-D-15 |
| Tags | DELETE | `/api/v1/tags/{id}` | 缺失 | **MVP 缺失** | ⚠️ N-D-15 |
| Project-Tags | PUT  | `/api/v1/projects/{id}/tags` | 缺失 | **MVP 缺失** | ⚠️ N-D-15 |
| Notes | GET  | `/api/v1/notes/projects/{project_id}/notes` | SPEC §3.2 | MVP ✅ | ✅ |
| Notes | POST | `/api/v1/notes/projects/{project_id}/notes` | SPEC §3.2 | MVP ✅ | ✅ |
| Notes | GET  | `/api/v1/notes/{id}` | **修复版**（删除 `notes/notes` 重复） | MVP ✅ | ⚠️ SPEC 写 `notes/notes/{id}` 重复 |
| Notes | PUT  | `/api/v1/notes/{id}` | **修复版** | MVP ✅ | ⚠️ 同上 |
| Notes | DELETE | `/api/v1/notes/{id}` | **修复版** | MVP ✅ | ⚠️ 同上 |
| Notes | GET  | `/api/v1/notes/search` | SPEC §3.2 | v0.3 (501) | ✅ |
| Graph | GET  | `/api/v1/graph` | SPEC §3.2 | MVP ✅ | ✅ (但缺 max_edges 参数 N-P-01) |
| Settings | GET  | `/api/v1/settings` | SPEC §3.2 | MVP ✅ | ✅ |
| Settings | PUT  | `/api/v1/settings` | SPEC §3.2 | MVP ✅ | ✅ |
| Settings | POST | `/api/v1/settings/test-llm` | MVP_SCOPE §4.1 | MVP ✅ | ⚠️ 与 SPEC §3.2 `/agent/config/test` 冲突 (沿用 C-06) |
| Agent | POST | `/api/v1/agent/chat` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | POST | `/api/v1/agent/question` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | POST | `/api/v1/agent/analyze/{project_id}` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | POST | `/api/v1/agent/compare` | SPEC §3.2 | v0.3 (501) | ✅ |
| Agent | POST | `/api/v1/agent/classify` | SPEC §3.2 | v0.3 (501) | ✅ |
| Agent | POST | `/api/v1/agent/recommend` | SPEC §3.2 | TBD | ⚠️ MVP_SCOPE §4.2 缺 |
| Agent | POST | `/api/v1/agent/note/generate` | SPEC §3.2 | v0.4 (501) | ✅ |
| Agent | GET  | `/api/v1/agent/sessions` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | GET  | `/api/v1/agent/sessions/{id}` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | PUT  | `/api/v1/agent/sessions/{id}` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | DELETE | `/api/v1/agent/sessions/{id}` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | POST | `/api/v1/agent/sessions/{id}/archive` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | GET  | `/api/v1/agent/config` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | PUT  | `/api/v1/agent/config` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | POST | `/api/v1/agent/config/test` | SPEC §3.2 | v0.2 (501) | ⚠️ 与 MVP `/settings/test-llm` 冲突 (沿用 C-06) |
| Agent | GET  | `/api/v1/agent/permissions` | SPEC §3.2 | v0.2 (501) | ⚠️ MVP_SCOPE §4.2 缺 (沿用 C-09) |
| Agent | PUT  | `/api/v1/agent/permissions` | SPEC §3.2 | v0.2 (501) | ⚠️ MVP_SCOPE §4.2 缺 (沿用 C-09) |
| Agent | GET  | `/api/v1/agent/profiles` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | GET  | `/api/v1/agent/profiles/{agent_id}` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | PUT  | `/api/v1/agent/profiles/{agent_id}/soul` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | PUT  | `/api/v1/agent/profiles/{agent_id}/agent` | SPEC §3.2 | v0.2 (501) | ✅ |
| Agent | GET  | `/api/v1/agent/user-profile` | SPEC §3.2 | v0.4 (501) | ✅ |
| Agent | PUT  | `/api/v1/agent/user-profile` | SPEC §3.2 | v0.4 (501) | ✅ |

### 6.2 待新增/修正的端点

| 端点 | 修复来源 | 说明 |
|------|---------|------|
| `GET /api/v1/github/accounts` | N-D-16 | 列出已绑定 GitHub 账号 |
| `GET /api/v1/tags` | N-D-15 | 标签列表（可选） |
| `POST /api/v1/tags` | N-D-15 | 创建标签（可选） |
| `DELETE /api/v1/tags/{id}` | N-D-15 | 删除标签（可选） |
| `PUT /api/v1/projects/{id}/tags` | N-D-15 | 设置项目标签 |
| `POST /api/v1/auth/logout` | N-API-1 | SPEC §3.2 有，MVP_SCOPE §4.1 缺 |
| `GET /api/v1/github/stars/{username}` | N-API-1 | SPEC §3.2 有，MVP_SCOPE §4.1 缺 |
| `POST /api/v1/agent/recommend` | N-API-1 | SPEC §3.2 有，MVP_SCOPE §4.2 缺 |
| `GET /api/v1/notes/{id}` | N-04 | 修正 `notes/notes/{id}` 重复 |
| `PUT /api/v1/notes/{id}` | N-04 | 修正 `notes/notes/{id}` 重复 |
| `DELETE /api/v1/notes/{id}` | N-04 | 修正 `notes/notes/{id}` 重复 |

---

## 七、字段命名权威参考表（更新版）

下表整合 SPEC §2.2、SPEC §7.2、AGENT_SPEC §5.3、PRD §3.3.3、AGENT_PRD §3.2 的所有字段定义，标注权威来源和冲突。

### 7.1 数据表字段

| 表/模型 | 字段 | 类型 | 权威命名 | 备注 |
|---------|------|------|---------|------|
| users | id | UUID | `id` | PK |
| users | username | VARCHAR(32) | `username` | UNIQUE, NOT NULL |
| users | password_hash | VARCHAR(255) | `password_hash` | bcrypt cost ≥ 12 |
| users | email | VARCHAR(255) | `email` | NULLABLE (MVP 不强制) |
| users | avatar_url | VARCHAR(512) | `avatar_url` | NULLABLE |
| users | github_accounts | JSON | `github_accounts` | ⚠️ 内部结构待定义 (D-03) |
| users | agent_permissions | JSON | `agent_permissions` | ⚠️ 结构待定义 (D-06) |
| users | created_at | TIMESTAMP | `created_at` | DEFAULT NOW |
| users | updated_at | TIMESTAMP | `updated_at` | AUTO UPDATE |
| user_settings | user_id | UUID | `user_id` | PK, FK |
| user_settings | theme | VARCHAR(32) | `theme` | DEFAULT 'dark' |
| user_settings | zoom | FLOAT | `zoom` | DEFAULT 1.0 |
| user_settings | font_scale | FLOAT | `font_scale` | DEFAULT 1.0 |
| user_settings | view_mode | VARCHAR(8) | `view_mode` | 'list' / 'card' |
| user_settings | llm_provider | VARCHAR(32) | `llm_provider` | MVP 扩展 (BYOK) |
| user_settings | llm_model | VARCHAR(128) | `llm_model` | MVP 扩展 |
| user_settings | llm_api_base | VARCHAR(512) | `llm_api_base` | MVP 扩展 |
| user_settings | encrypted_api_key | BLOB | `encrypted_api_key` | MVP 扩展 (Fernet 加密) |
| **refresh_tokens** ⚠️ | - | - | - | **MVP_SCOPE 缺 (N-D-10)** |
| projects | id | UUID | `id` | PK |
| projects | user_id | UUID | `user_id` | FK → users, NOT NULL ⚠️ N-S-10 |
| projects | name | VARCHAR(255) | `name` | owner/repo |
| projects | url | VARCHAR(512) | `url` | UNIQUE(user_id, url) |
| projects | description | TEXT | `description` | NULLABLE |
| projects | stars | INTEGER | `stars` | DEFAULT 0 |
| projects | language | VARCHAR(64) | `language` | NULLABLE |
| projects | progress | VARCHAR(16) | `progress` | none/learning/learned/mastered |
| projects | note | TEXT | `note` | NULLABLE ⚠️ UI 用途不明 (D-12) |
| projects | category_id | UUID | `category_id` | FK → categories, NULLABLE |
| projects | imported_at | TIMESTAMP | `imported_at` | DEFAULT NOW |
| projects | created_at | TIMESTAMP | `created_at` | DEFAULT NOW |
| projects | updated_at | TIMESTAMP | `updated_at` | AUTO UPDATE |
| categories | id | UUID | `id` | PK |
| categories | user_id | UUID | `user_id` | FK → users, NULLABLE (预设) |
| categories | name | VARCHAR(64) | `name` | UNIQUE(user_id, name) |
| categories | icon | VARCHAR(32) | `icon` | NULLABLE |
| categories | color | VARCHAR(16) | `color` | NULLABLE |
| categories | is_preset | BOOLEAN | `is_preset` | DEFAULT FALSE |
| tags | id | UUID | `id` | PK |
| tags | name | VARCHAR(64) | `name` | NOT NULL |
| project_tags | project_id | UUID | `project_id` | FK |
| project_tags | tag_id | UUID | `tag_id` | FK |
| notes | id | UUID | `id` | PK |
| notes | user_id | UUID | `user_id` | FK |
| notes | project_id | UUID | `project_id` | FK |
| notes | title | VARCHAR(255) | `title` | NOT NULL |
| notes | content | TEXT | `content` | DEFAULT '' |
| notes | created_at | TIMESTAMP | `created_at` | DEFAULT NOW |
| notes | updated_at | TIMESTAMP | `updated_at` | AUTO UPDATE |
| agent_sessions | id | UUID | `id` | PK |
| agent_sessions | user_id | UUID | `user_id` | FK |
| agent_sessions | title | VARCHAR(255) | `title` | DEFAULT '新对话' |
| agent_sessions | project_id | UUID | `project_id` | FK, NULLABLE |
| agent_sessions | active_agent | VARCHAR(32) | `active_agent` | DEFAULT 'hub' ⚠️ 建议改 `active_agent_id` |
| agent_sessions | status | VARCHAR(16) | `status` | active/archived/pending_question |
| agent_sessions | created_at | TIMESTAMP | `created_at` | |
| agent_sessions | updated_at | TIMESTAMP | `updated_at` | |
| agent_messages | id | UUID | `id` | PK |
| agent_messages | session_id | UUID | `session_id` | FK |
| agent_messages | role | VARCHAR(16) | `role` | user/assistant/system/tool |
| agent_messages | agent_id | VARCHAR(32) | `agent_id` | NULLABLE |
| agent_messages | content | TEXT | `content` | NOT NULL |
| agent_messages | content_type | VARCHAR(16) | `content_type` | text/markdown/question/tool_call/tool_result |
| agent_messages | metadata | JSON | `metadata` | DEFAULT '{}' ⚠️ 结构待定义 (D-21) |
| agent_messages | created_at | TIMESTAMP | `created_at` | |
| project_analyses | id | UUID | `id` | PK |
| project_analyses | project_id | UUID | `project_id` | FK |
| project_analyses | agent_id | VARCHAR(32) | `agent_id` | NOT NULL |
| project_analyses | analysis_type | VARCHAR(32) | `analysis_type` | scout_overview/mentor_deep/curator_classify |
| project_analyses | content | TEXT | `content` | NOT NULL |
| project_analyses | model_used | VARCHAR(64) | `model_used` | NULLABLE |
| project_analyses | tokens_used | INTEGER | `tokens_used` | DEFAULT 0 |
| project_analyses | created_at | TIMESTAMP | `created_at` | |
| project_analyses | expires_at | TIMESTAMP | `expires_at` | NULLABLE |
| **graph_cache** ⚠️ | - | - | - | **待新增 (N-P-01)** |
| **user_github_accounts** ⚠️ | - | - | - | **可选独立表 (N-S-04)** |

### 7.2 JSON 字段结构（UserProfile）

| 字段 | JSON 键 | 权威定义 | 备注 |
|------|--------|---------|------|
| 技术掌握程度 | `tech_proficiency` | `dict[str, TechProficiencyEntry]` | SPEC §7.2 |
| 学习偏好 | `learning_preferences` | `LearningPreferences` 模型 | SPEC §7.2 |
| 学习目标 | `goals` | `list[Goal]` | SPEC §7.2 |
| 历史摘要 | `history_summary` | `str` | SPEC §7.2 |
| Agent 偏好 | `agent_preferences` | `AgentPreferences` 模型 | SPEC §7.2 ⚠️ 仍需定义 (D-02) |
| 扩展特征 | `extensions` | `dict[str, Any]` | SPEC §7.2 |

### 7.3 LearningPreferences 内部字段

| 字段 | 权威命名 | 类型 | 备注 |
|------|---------|------|------|
| 学习风格 | `style` | str | hands-on / theoretical / visual |
| 深度优先 | `depth_first` | bool | |
| 代码示例 | `code_examples` | bool | |
| **对比分析** | `comparisons` | bool | ⚠️ **复数形式** (沿用 C-04) |
| 详细程度 | `verbosity` | str | concise / balanced / detailed |
| 解释语言 | `language` | str | zh-CN / en (在 learning_preferences 下，不在 agent_preferences) |
| 代码注释语言 | `code_comment_language` | str | |

### 7.4 TechProficiencyEntry 内部字段

| 字段 | 权威命名 | 类型 | 备注 |
|------|---------|------|------|
| 技术等级 | `level` | str | none / basic / intermediate / advanced / mastered |
| 来源 | `source` | str | self_reported / inferred / assessed |
| 置信度 | `confidence` | float | 0-1 |
| 依据 | `evidence` | list[str] | |
| 更新时间 | `updated_at` | datetime | |

⚠️ dict key 已经是技术名，**条目内不应有 name 字段** (沿用 D-01)

### 7.5 工具名权威参考

| 工具名 | 用途 | 允许 Agent | 权威来源 |
|--------|------|-----------|---------|
| `read_readme` | 读取项目 README | Scout, Mentor | AGENT_PRD §5.1 |
| `read_source_file` | 读取 GitHub 仓库文件 | Mentor | SPEC §6.3 / AGENT_SPEC §4.3 |
| `search_web` | 搜索互联网 | 所有 | AGENT_PRD §5.1 |
| `query_user_projects` | 查询用户项目库 | scout/mentor/navigator/curator/hub ⚠️ N-10 | SPEC §6.3 |
| `get_project_analysis` | 获取缓存分析结果 | Hub, Mentor | AGENT_PRD §5.1 |
| `update_user_profile` | 更新用户画像 | Mentor, Navigator | AGENT_PRD §5.1 |
| `suggest_classification` | 建议分类 | Curator | AGENT_PRD §5.1 |
| `generate_note_outline` | 生成笔记大纲 | Scribe | AGENT_PRD §5.1 |
| `compare_projects` | 对比项目 | Mentor | AGENT_PRD §5.1 |
| `build_learning_path` | 构建学习路径 | Navigator | AGENT_PRD §5.1 |
| `ask_user_question` | 反问交互 | Mentor, Navigator | SPEC §6.3 |
| `save_to_memory` | 存储记忆 | 所有 | AGENT_PRD §5.1 |
| `recall_from_memory` | 检索记忆 | 所有 | AGENT_PRD §5.1 |

⚠️ AGENT_PRD §4.1 中的 `read_source` 和 `query_project_db` 是错误命名 (沿用 C-07)

### 7.6 SSE 事件类型

| 事件类型 | 含义 | 字段 |
|---------|------|------|
| `agent_switch` | Agent 切换 | `agent_id`, `display_name` |
| `text_delta` | 文本增量 | `text` |
| `tool_call` | 工具调用 | `tool`, `status`, `args_preview`/`result_preview` |
| `agent_question` | 反问交互 | `question_id`, `agent_id`, `intro`, `questions`, `actions` |
| `done` | 完成 | `usage`, `iterations` |
| `error` | 错误 | `code`, `message`, `action` |

⚠️ 缺少集中枚举定义 (T-04)

---

## 八、修复优先级建议

按**业务影响**和**修复成本**排序：

### 第一优先级（🔴 严重 — 开工前必做）

1. **N-01 + N-02** — 解决路线图根本冲突（PRD §7 vs MVP_SCOPE §2.1 vs DEVELOPMENT_STEPS）
   - 决策：保留 PRD §7，重写 MVP_SCOPE §2.1，标注 DEVELOPMENT_STEPS 为 v1.x 全周期计划
2. **N-03 + N-04 + N-05 + N-06** — 修复 API 路径冲突
   - DEVELOPMENT_STEPS 全部 GitHub/笔记端点路径改为 SPEC 风格
3. **N-07** — 统一密码策略（≥ 8 字符 + 字母数字，DEVELOPMENT_STEPS 4 字符太弱）
4. **N-08** — 统一测试覆盖率（70%，DEVELOPMENT_STEPS 100% 不现实）
5. **N-09** — 统一 LLM Key 存储（BYOK user_settings 表，DEVELOPMENT_STEPS 不能用环境变量）
6. **N-S-03** — 全局速率限制清单

### 第二优先级（🟡 重要 — Phase 1 前完成）

7. **D-09 ~ D-23** — 完善 MVP_SCOPE 范围细节（refresh_tokens 表、LLMProvider 深度、note 字段 UI、README 渲染、GitHub 同步入口、Tag 端点、PAT 存储、预设分类种子、批量导入限制、progress 默认值、agent_permissions 结构、metadata 结构）
8. **N-10 ~ N-12** — Agent 行为规范统一（query_user_projects 允许 Scribe、反问 JSON Schema 统一）
9. **A-01 ~ A-04** — AGENT_PRD 内容去重 + TBD 编号集中
10. **T-01 ~ T-06** — JSON Schema / TypeScript 类型修正（QuestionAnswer 判别字段、SSE 事件枚举等）
11. **S-04** — 修正 UserProfile Pydantic 模型（dict/list 参数化、补充 extensions / user_id 字段）
12. **N-P-01 + N-P-04** — 图谱缓存表 + SQLite WAL 模式
13. **N-P-08 + N-P-09** — 前端图谱懒加载 + 列表虚拟滚动

### 第三优先级（🟢 优化 — Phase 2+ 完成）

14. **D-24 ~ D-27** — 完善 API 响应 Schema 文档
15. **N-P-02 ~ N-P-12** — 细化性能策略（缓存键、连接池、Token 估算、SQLite 索引）
16. **N-S-01 ~ N-S-13** — 完善安全细节（头像上传、密码强度、SSRF、文件校验、日志脱敏、跨用户隔离、Prompt 注入分隔符）
17. **N-13** — 修复 README.md 文档链接

---

## 九、复核与追踪

### 9.1 第一轮审查复核结果汇总

| 第一轮编号 | 状态 |
|----------|------|
| C-01 PRD/AGENT_PRD 重复 | ⚠️ 未修复 (本轮 A-01) |
| C-02 TECHNICAL_SPEC/AGENT_SPEC 重复 | ⚠️ 未修复 |
| C-03 反问选项字段名不一致 | ⚠️ 未修复 (本轮 N-11) |
| C-04 comparison vs comparisons | ⚠️ 未修复 |
| C-05 learning_preferences JSON 与 SPEC 不匹配 | ⚠️ 未修复 |
| C-06 LLM 测试端点冲突 | ⚠️ 未修复 (本轮 N-05) |
| C-07 AGENT_PRD §4.1 工具名错误 | ⚠️ 未修复 (本轮 A-02) |
| C-08 GitHub 端点命名 bindaccount | ⚠️ 仍未完全修复 (本轮 N-03) |
| C-09 Agent permissions 端点 MVP_SCOPE 缺失 | ⚠️ 未修复 (本轮 N-06) |
| C-10 路线图版本号对应 | 🟡 部分修复（PRD §7 仍不一致, 本轮 N-01） |
| D-01 TechProficiency 模型歧义 | ⚠️ 部分修复（注释有，但 JSON 仍有 name 字段） |
| D-02 agent_preferences 结构未定义 | ⚠️ 未修复 |
| D-03 github_accounts JSON 结构未定义 | ⚠️ 未修复 (本轮 N-S-04) |
| D-04 pending_question 状态与 active 重叠 | ⚠️ 未修复 |
| D-05 QuestionAnswer 缺判别字段 | ⚠️ 未修复 (本轮 T-01) |
| D-06 agent_permissions 字段未定义 | ⚠️ 未修复 (本轮 D-20) |
| D-07 预设分类 UNIQUE 约束 SQLite NULL | 🟢 仅记录无需修复 |
| D-08 progress 枚举值国际化 | 🟡 未修复 |
| S-01 read_source_file 不使用 PAT | ⚠️ 部分修复（AGENT_SPEC 已用，TECHNICAL_SPEC 未用） |
| S-02 Logout 缺 Token 失效 | ⚠️ 部分修复（SPEC §10.1 提了但 refresh_tokens 表 MVP 缺） |
| S-03 CSRF 与 JWT 不匹配 | ⚠️ 未修复 |
| S-04 Prompt 注入简单 | ⚠️ 未完全修复 (本轮 N-S-12, N-S-13) |
| S-05 CORS 策略未定义 | ✅ 已修复 |
| S-06 修改密码端点缺保护 | ⚠️ 未完全修复 (本轮 N-S-02) |
| S-07 文件上传安全 | ⚠️ 未修复 (本轮 N-S-01) |
| P-01 图谱计算缺增量更新 | ⚠️ 未完全修复 (本轮 N-P-01) |
| P-02 read_source_file httpx 连接池 | ⚠️ 未修复 (本轮 N-P-02) |
| P-03 上下文组装超时 | ⚠️ 未完全修复 (本轮 N-P-10) |
| P-04 图谱 API 缺分页 | ⚠️ 未完全修复 (本轮 N-P-01) |
| P-05 SQLite 并发写入 | ⚠️ 未完全修复 (本轮 N-P-04) |
| P-06 HistoryCompressor 摘要 | ⚠️ 未完全修复 (本轮 N-P-11) |
| P-07 前端首屏优化 | ⚠️ 未完全修复 (本轮 N-P-08) |

**统计：** 第一轮 36 个问题中：
- ✅ 完全修复: 1 个 (S-05 CORS)
- 🟢 仅记录: 1 个 (D-07)
- ⚠️ 部分修复或未修复: 34 个
- 🟡 未完全修复: 0 个独立

**结论：** 第一轮审查的问题 **大部分仍未解决**。开发团队应在 Phase 0 启动前完成修复，否则会按错误设计继续推进。

### 9.2 本轮审查新增编号索引

- **N-01 ~ N-13**: 跨文档一致性新问题
- **D-09 ~ D-27**: 设计清晰度新问题（D-01~D-08 是第一轮）
- **A-01 ~ A-04**: AGENT_PRD / TBD 新问题
- **T-01 ~ T-06**: JSON Schema / TypeScript 类型问题
- **S-01 ~ S-06**: 数据模型 Pydantic 问题
- **N-S-01 ~ N-S-13**: 安全审查新问题
- **N-P-01 ~ N-P-12**: 性能审查新问题

---

## 十、附录

### 附录 A: 文档长度统计

| 文档 | 行数 | 字数 (KB) | 评级 |
|------|------|----------|------|
| PRD.md | 177 | 13.8 | 🟢 简洁 |
| AGENT_PRD.md | 430 | 23.4 | 🟡 与 PRD 重复 |
| TECHNICAL_SPEC.md | 1994 | 97.3 | 🟡 偏长（含大量代码） |
| AGENT_SPEC.md | 1578 | 70.6 | 🟡 与 TECHNICAL_SPEC 重复 |
| MVP_SCOPE.md | 406 | 27.0 | 🟢 适中 |
| DEVELOPMENT_PROCESS.md | 219 | 10.0 | 🟢 适中 |
| DEVELOPMENT_STEPS.md | 472 | 22.0 | 🔴 与 v1 文档冲突 |
| 第一轮审查报告 | 469 | 27.7 | 🟡 内容详尽 |
| README.md | 38 | 1.5 | 🔴 链接错误 |

### 附录 B: 推荐文档结构重组

建议重新组织文档职责：

```
docs/
├── product/
│   ├── README.md                  # 文档索引（修正链接）
│   └── v1/
│       ├── PRD/
│       │   ├── PRD.md            # 简短产品需求（≤ 100 行），链接到下方
│       │   └── AGENT_PRD.md      # Agent 系统产品需求（去重，独立价值）
│       ├── SPEC/
│       │   ├── TECHNICAL_SPEC.md # 总体技术规范（≤ 500 行）
│       │   └── AGENT_SPEC.md     # Agent 系统技术规范（独立价值）
│       └── MVP/
│           └── MVP_SCOPE.md      # v0.1 实施范围（不与 PRD/SPEC 重复）
├── development/
│   ├── DEVELOPMENT_PROCESS.md    # 流程规范（质量门禁等）
│   ├── DEVELOPMENT_ROADMAP.md    # v1.x 全周期 Phase 计划（取代 DEVELOPMENT_STEPS.md）
│   └── DEVELOPMENT_V0_1.md      # v0.1 详细开发顺序（与 MVP_SCOPE 同步）
└── TBD.md                        # 全局 TBD 注册表
```

### 附录 C: 决策清单（需用户确认）

需要用户做决策的设计点（本轮审查中浮现）：

1. **N-01 决策**: PRD 路线图 vs MVP_SCOPE 范围——以哪个为准？
2. **N-08 决策**: 单元测试覆盖率 70% vs 100%——以哪个为准？
3. **N-S-05 决策**: 密码强度策略（≥ 8 + 字母数字 vs ≥ 10 + 复杂度）
4. **N-D-12 决策**: Project.note 字段是否保留？（保留则补 UI，删除则去字段）
5. **D-11 决策**: LLMProvider 在 MVP 阶段完整实现 vs 仅 test_connection()？
6. **N-10 决策**: Scribe Agent 是否能使用 query_user_projects 工具？
7. **N-D-15 决策**: Tag 是否提供独立 CRUD 端点？
8. **N-13 决策**: README.md 链接是修正路径还是建立软链接？
9. **N-S-04 决策**: GitHub PAT 存储方案（User.github_accounts JSON vs 独立表 vs user_settings 字段）

---

*报告结束。所有编号可在后续讨论中直接引用（如 "修复 N-01" 或 "复核 S-01"）。*
