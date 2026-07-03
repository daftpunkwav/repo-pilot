# RepoPilot v1 文档修复验证报告

> 验证日期: 2026-07-04
> 验证范围: PRD.md, AGENT_PRD.md, TECHNICAL_SPEC.md, AGENT_SPEC.md, MVP_SCOPE.md, DEVELOPMENT_ROADMAP.md, DEVELOPMENT_PROCESS.md, docs/product/README.md, 根 README.md
> 验证目的: 检查基于第二轮审查报告的修复结果，并发现残留/新增问题

---

## 一、修复总体评价

修复工作质量整体不错。核心设计决策（v1.0 单版本策略、BYOK、PAT 认证、反问字段命名约定、SSE 事件枚举等）已落实到文档中，且多数修复带有"决策 N-XX"标注便于追溯。

但仍有残留问题，按严重度分为三档：

- **🔴 开工前必修**：会导致开发歧义或实现冲突（6 项）
- **🟡 Phase 1 前完成**：影响开发效率，不紧急但应修复（9 项）
- **🟢 后续迭代处理**：锦上添花或低影响（7 项）

---

## 二、🔴 开工前必修（6 项）

### R-01: TECHNICAL_SPEC 内部双重模型定义冲突

同一文档中存在两份互相矛盾的模型定义：

| 模型                   | §2.3（修正版）                                                           | §7.2（旧版，未同步）                |
| -------------------- | ------------------------------------------------------------------- | --------------------------- |
| UserProfile          | 参数化泛型 `dict[str, TechProficiencyEntry]`，有 `user_id: UUID`           | 裸 `dict`/`list`，无 `user_id` |
| AgentPreferences     | verbosity, use_emoji, auto_ask_questions, max_questions_per_session | 只有 mentor_style             |
| TechProficiencyEntry | `Literal["none", "basic", ...]` 枚举约束                                | 裸 `str`                     |

**修复**：删除 §7.2 旧版定义，改为"详见 §2.3 数据模型"。

---

### R-02: UserSetting 表字段与 LLMConfig.from_user_settings 不匹配

§2.2 UserSetting 表只定义了 `theme, zoom, font_scale, view_mode` 四个字段。但 §5.2 `LLMConfig.from_user_settings()` 引用了 `setting.llm_provider`, `setting.llm_model`, `setting.encrypted_api_key`, `setting.llm_api_base` — 这些字段在表定义中不存在。

**修复**：§2.2 UserSetting 表补充 4 个 LLM 字段。

---

### R-03: DEVELOPMENT_PROCESS.md 版本策略与 v1.0 单版本策略冲突

- 第 212 行仍写"每个 Phase 完成并发布时更新 MINOR 版本号"，与 v1.0 一次性发布矛盾
- 第 66-73 行安全审查表使用旧 5 阶段划分（Phase 1 用户系统 / Phase 2 项目管理 / Phase 3 Agent / Phase 4 笔记 / Phase 5 可视化），与 DEVELOPMENT_ROADMAP 的 12 Phase（Phase 0-11）完全不对应

**修复**：

1. 版本号规则改为"全部 Phase 完成后发布 v1.0"
2. 安全审查表重写，与 Roadmap 的 Phase 0-11 对应

---

### R-04: AGENT_SPEC 反问 POST 示例与 TypeScript 类型不一致

- TypeScript `QuestionAnswer` 类型定义要求每个回答带 `type` 判别字段（标注"决策 T-01"）
- 但 POST 请求体示例中的回答**不含** `type` 字段，如 `"q1": {"value": "intermediate"}`
- `ask_user_question` 的 type 枚举缺少 `"text"`（但 UI 组件表明确包含 text 类型）
- `TextQuestion` 在 `QuestionItem` 联合类型中完全缺失

**修复**：

1. POST 示例中的回答添加 `type` 字段
2. type 枚举添加 `"text"`
3. `QuestionItem` 添加 `TextQuestion` 定义

---

### R-05: AGENT_SPEC 反问检测机制逻辑矛盾

- `ask_user_question` 注册为 `@tool`，LLM 通过 function calling 调用，返回 `{"status": "question_pending"}`
- 但 ReActEngine 检测反问的方式是 `QuestionParser.parse(collected.text)` 从文本中解析
- 两种机制互相矛盾：如果 LLM 通过 tool_call 触发了反问，引擎应该检测 tool_call 结果，而非从文本解析

**修复**：明确反问的唯一触发路径（tool_call 结果 vs 文本解析），删除另一条。

---

### R-06: docs/product/README.md 几乎未修复

整个文档仍基于多子版本渐进交付模型，与实际严重脱节：

- 目录结构使用小写（`prd/`、`spec/`、`mvp/`），实际磁盘是大写（`PRD/`、`SPEC/`、`MVP/`）
- 文件名写 `MVP_SCOPE_v0.1.md` ~ `MVP_SCOPE_v1.0.md`，实际只有一个 `MVP_SCOPE.md`
- §4-6 完整保留了 v0.1 → v1.0 子版本流程
- "当前状态"表列出 7 个子版本，与 v1.0 单版本策略矛盾
- 第 194 行仍写"待重命名为 MVP_SCOPE_v0.1.md"

**修复**：大幅重写，反映 v1.0 单版本策略和实际目录结构。

---

## 三、🟡 Phase 1 前完成（9 项）

### R-07: AGENT_SPEC 缺少集中 SSE 事件枚举

AGENT_SPEC 中没有集中的 `StreamEventType` 枚举。事件类型散落在 §1.3、§2.2.2、§4.1、§8.1 共 4 处。TECHNICAL_SPEC 已通过"决策 T-04"补全了枚举，AGENT_SPEC 应同步。

---

### R-08: agent_permissions JSON 与 @tool allowed_agents 不一致

TECHNICAL_SPEC §3 的 `agent_permissions` JSON 中每个 Agent 的 tools 列表与 AGENT_SPEC 的 `@tool allowed_agents` 严重不一致。例如 TECHNICAL_SPEC 中 mentor 列 4 个工具，AGENT_SPEC config.yaml 列 10 个。两份文档未说明哪种定义优先。

**修复**：明确一种为权威，另一种引用或同步。

---

### R-09: PRD/AGENT_PRD 逐字重复未消除

三处内容仍然逐字重复：

1. PRD §3.3.1 系统定位（5 条核心原则）= AGENT_PRD §1
2. PRD §3.3.2 角色总览表（6 行表格）= AGENT_PRD §2.1
3. PRD §6 未来扩展预留（3 个子节）= AGENT_PRD §9

PRD 末尾虽添加了引用链接，但重复内容未改为摘要。

---

### R-10: AGENT_PRD TBD 表格自相矛盾

AGENT_PRD §10 声明"不再单独维护 TBD 编号"并将权威指向 PRD §7.4，但紧接着贴了一份完整 TBD 表格。而声称权威的 PRD §7.4 的"关联文档"列全部是 `§X` 占位符，反而是 AGENT_PRD 的表格数据正确。

**修复**：二选一——(A) AGENT_PRD 删除 TBD 表格只保留引用 (B) PRD §7.4 填充正确的章节号。

---

### R-11: AGENT_PRD `get_user_profile()` 未定义

§5.2 ReAct 示例调用了 `get_user_profile()`，但 §5.1 工具总表中无此工具（只有 `update_user_profile`）。

---

### R-12: DEVELOPMENT_PROCESS.md LLM_API_KEY 环境变量未说明

§4.2 `.env` 模板有 `LLM_API_KEY` 环境变量，与 MVP_SCOPE §3.2 的 BYOK 数据库存储方案存在概念冲突。未说明二者关系。

**修复**：添加注释说明 LLM_API_KEY 仅用于开发/测试 fallback。

---

### R-13: MVP_SCOPE 内部矛盾（3 处）

1. **agentStore**：§6.6 标记"仅定义接口，不实现"，但 §7.2 和 §10 要求"完整实现"
2. **E2E 数量**：§6.2 写"3 条 happy path"，§9.3 和 §10 写"5 条"
3. **export 功能**：§4.1 写 `GET /export` v1.0 实现，§2.2 标记"JSON 导入/导出"为 v1.1

---

### R-14: 工具数量声明不一致

MVP_SCOPE §7.4 和 DEVELOPMENT_ROADMAP Phase 6 声称"注册全部 **12** 个工具"，但实际列出了 **13** 个工具名。

---

### R-15: slider 字段归类不准确

AGENT_PRD §6.1 字段命名约定将 slider 归入 `text` 阵营，但 slider JSON 示例不使用 `text` 选项字段（用的是 `min`/`max`/`labels`）。

**修复**：改为三分法——radio/drag_sort 用 `label`，checkbox 用 `text`，slider 用 `labels`（独立类型）。

---

## 四、🟢 后续迭代处理（7 项）

### R-16: AGENT_SPEC MemoryService 无方法签名

MemoryService 在文档中多次被引用（架构图、模块依赖图、TBD），但没有任何方法签名定义。

---

### R-17: AGENT_SPEC Goal 模型未定义

user_profiles 表 `goals JSON NOT NULL DEFAULT '[]'` 的数组元素结构未定义。Jinja2 模板引用了 `goals | map(attribute='description')`，暗示每个 goal 有 `description` 字段，但无显式 `Goal` 数据模型。

---

### R-18: Note/AgentMessage 表缺少索引

SPEC §2.2 已为 RefreshToken、GraphCache 等定义了索引，但 Note 表（按 project_id 高频查询）和 AgentMessage 表（按 session_id 高频查询）未定义索引。

---

### R-19: AGENT_PRD "唯一权威来源"定位矛盾

头部声称"Agent 系统产品需求的唯一权威来源"，但 §10 将 TBD 权威指向 PRD §7.4。建议修正声明为"除 TBD 编号由 PRD §7.4 统一管理外"。

---

### R-20: 根 README.md 版本号 v2.0 vs v1.0

根 README 标题为"RepoPilot v2.0"（指技术栈重写），内部文档为 v1.0（指产品版本）。区分不够清晰。

---

### R-21: AGENT_SPEC `yield from` 异步错误

§2.2.2 `yield from self._execute_agent(...)` 在 async generator 中不合法。应改为 `async for event in ...: yield event`。

---

### R-22: MVP_SCOPE Notes 端点路径归属歧义

Notes 基路径为 `/api/v1/notes`，但项目笔记路径为 `/projects/{project_id}/notes`，完整路径变成 `/api/v1/notes/projects/{project_id}/notes`，非常怪异。建议将项目笔记端点移到 Projects 节下。

---

## 五、验证结果汇总

### 按文档统计

| 文档                     | ✅ 已修复 | ⚠️ 部分修复 | ❌ 未修复 | 🆕 新问题 |
| ---------------------- | ----- | ------- | ----- | ------ |
| PRD.md                 | 1     | 1       | 0     | 0      |
| AGENT_PRD.md           | 1     | 4       | 2     | 0      |
| TECHNICAL_SPEC.md      | 4     | 1       | 1     | 0      |
| AGENT_SPEC.md          | 1     | 3       | 2     | 4      |
| MVP_SCOPE.md           | 4     | 2       | 0     | 3      |
| DEVELOPMENT_ROADMAP.md | 3     | 0       | 0     | 0      |
| DEVELOPMENT_PROCESS.md | 0     | 1       | 2     | 0      |
| docs/product/README.md | 0     | 0       | 1     | 0      |
| 根 README.md            | 1     | 1       | 0     | 0      |

### 按严重度统计

| 严重度            | 数量     | 编号          |
| -------------- | ------ | ----------- |
| 🔴 开工前必修       | 6      | R-01 ~ R-06 |
| 🟡 Phase 1 前完成 | 9      | R-07 ~ R-15 |
| 🟢 后续处理        | 7      | R-16 ~ R-22 |
| **合计**         | **22** |             |

---

## 六、修复优先级建议

### 第一优先级（开工前，约 1-2 小时工作量）

1. **R-01 + R-02**：统一 TECHNICAL_SPEC 内部模型定义（删除 §7.2 旧版 + 补充 UserSetting 字段）
2. **R-04**：修正 AGENT_SPEC 反问 POST 示例 + type 枚举
3. **R-06**：重写 docs/product/README.md（反映 v1.0 单版本 + 实际目录结构）
4. **R-03**：修正 DEVELOPMENT_PROCESS.md 版本策略 + 安全审查表

### 第二优先级（Phase 1 前，约 2-3 小时工作量）

5. **R-05**：明确反问触发路径
6. **R-07 + R-08**：AGENT_SPEC 同步 SSE 枚举 + agent_permissions
7. **R-09 + R-10**：PRD/AGENT_PRD 去重 + TBD 统一
8. **R-11 ~ R-15**：其余中等问题

### 第三优先级（后续迭代）

9. **R-16 ~ R-22**：MemoryService 签名、Goal 模型、索引、版本号等

---

*报告结束。所有编号可直接引用（如"修复 R-01"）。*
