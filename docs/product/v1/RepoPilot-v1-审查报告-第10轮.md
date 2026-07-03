# RepoPilot v1.0 — 第 10 轮审核报告（重建文档专项审查）

> 审核日期: 2026-07-04
> 审核范围: TECHNICAL_SPEC.md, AGENT_SPEC.md（重建版）+ 跨文档一致性比对
> 审核者: QoderWork (2 路并行深度审查)
> 审核性质: **重建文档完整性验证** — 确认丢失后重建的 SPEC 文件是否可用

---

## 〇、总体评估

两份重建文档（TECHNICAL_SPEC 2304 行 + AGENT_SPEC 1482 行）经深度审查，**核心内容完整、修复项全部到位、可投入开发使用**。但跨文档一致性比对发现 **1 个 P0 级系统性问题**（agent_permissions 工具列表 5 个 Agent 不匹配）和若干 P1/P2 级差异。

**发现统计:**

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 P0 | 1 | agent_permissions 工具列表系统性不匹配 |
| 🟡 P1 | 2 | 枚举值/类型跨文档不一致 |
| 🟢 P2 | 3 | 缓存 TTL 冲突、计数错误、字段结构残留 |

---

## 一、TECHNICAL_SPEC.md 审核结果

### 章节完整性: ✅ 13/13 + 2 附录

§1~§13 全部存在，附录 A（速率限制表）、附录 B（预设分类种子数据）完整。

### 修复项验证: 11/11 ✅

| 编号 | 内容 | 行号 | 状态 |
|------|------|------|------|
| B-01 | ExecutionContext.db | L555 | ✅ |
| B-02 | context.llm_provider | L1131 | ✅ |
| B-03 | @tool 装饰器 | L1311 | ✅ |
| B-04 | _detect_multi_intent() | L823 | ✅ |
| B-05 | resume_after_answer() | L1210 | ✅ |
| B-06 | ConversationContext | L597 | ✅ |
| S-01 | validate_api_base validator | L1051 | ✅ |
| T-02 | to_openai_format() | L1250 | ✅ |
| T-04 | JWT 参数规范 | L1789 | ✅ |
| F5-29 | extensions 边界约束 | L329 | ✅ |
| H4 | agent_permissions 6 Agent 统一 | L119 | ✅ |

### 数据模型: ✅ 无断链

12 张表的 FK 关系全部正确，数据库表与 dataclass 字段对应，UNIQUE 约束完整。

### 安全规格: ✅ 5 项全覆盖

Fernet（OS 密钥链 + PBKDF2 降级）、JWT（HS256 + Token 轮换）、SSRF（7 个 BLOCKED_NETWORKS + DNS Rebinding 文档化）、PromptGuard（block/mark 双模式 + 8 个正则）、路径遍历校验。

### 发现问题: 2 个

| # | 严重度 | 描述 |
|---|--------|------|
| T-01 | 🟡 | `search_web` 的 `allowed_agents` 包含 "hub"，但 §2.2 H4 agent_permissions 中 hub 不含 search_web（见下方 P0 详述） |
| T-02 | 🟢 | StreamEventType 注释写"6 种"但实际定义 7 个枚举成员 |

---

## 二、AGENT_SPEC.md 审核结果

### 工具定义: ✅ 14/14 完整

每个 @tool 均有 name/description/parameters(JSON Schema)/allowed_agents/handler 伪代码。

### 修复项验证: 8/8 ✅

| 编号 | 内容 | 行号 | 状态 |
|------|------|------|------|
| C-03 | AgentPreferences 4 字段 | L1092 | ✅ |
| C-09 | IntentResult/SubIntent | L335 | ✅ |
| F5-08 | 3 个缺失工具 | §4.3 #11/#12/#13 | ✅ |
| F5-10 | capabilities 字段 | L188 | ✅ |
| F5-21 | style Literal 枚举 | L1082 | ✅ |
| H3 | validate_api_base | L502 | ✅ |
| M1 | 字段顺序 | L187 | ✅ |
| M2 | NotificationMessage | L1358 | ✅ |

### 反问系统: ✅ 完整

AgentQuestion TypeScript interface 含 C-01（intro 结构化）+ C-02（submit.style 5 选项），5 种 QuestionItem 类型完整。

### 记忆系统: ✅ 完整

4 张表 SQL 含索引（含 C-07 idx_messages_session），UserProfile 8 字段完整。

### 端点设计: ✅ 完整

对话端点 3 + 便捷端点 4 + 配置端点 8+ = 15+ 个端点全部有定义。

---

## 三、🔴 跨文档一致性问题（重点）

### P0: agent_permissions 工具列表系统性不匹配

**这是本轮最重要的发现。** AGENT_SPEC §4.3 各工具的 `allowed_agents` 反推每个 Agent 可用工具，与 TECHNICAL_SPEC §2.2 `agent_permissions` JSON 存在 **5 个 Agent 不匹配**：

| Agent | AGENT_SPEC @tool 推算 | TECHNICAL_SPEC agent_permissions | 差异 |
|-------|----------------------|--------------------------------|------|
| scout | 7 工具（含 read_readme, recall_from_memory） | 7 工具（含 read_source_file, ask_user_question） | 2 工具不同 |
| navigator | 7 工具（含 search_web, update_user_profile, save_to_memory） | 4 工具 | 缺 3 个 |
| curator | 6 工具（含 search_web, save_to_memory, recall_from_memory） | 3 工具 | 缺 3 个 |
| scribe | 6 工具（含 search_web, save_to_memory, recall_from_memory） | 3 工具（含 read_source_file） | 4 工具不同 |
| hub | 6 工具（含 search_web, get_project_analysis, save_to_memory） | 2 工具 | 缺 4 个 |

**根因：** `search_web`、`save_to_memory`、`recall_from_memory`、`query_user_projects` 在 AGENT_SPEC 中被标记为"全局工具"（allowed_agents 包含大部分 Agent），但 TECHNICAL_SPEC agent_permissions 中这些工具只分配给了部分 Agent。

**修复建议：** 明确"全局工具"策略——
- **方案 A（最小权限）：** 以 TECHNICAL_SPEC agent_permissions 为权威，修改 AGENT_SPEC 各工具的 allowed_agents 缩减范围
- **方案 B（开放权限）：** 以 AGENT_SPEC @tool 为权威，同步扩展 TECHNICAL_SPEC agent_permissions 的工具列表
- 推荐方案 A，符合最小权限原则

### P1: StreamEventType 跨文档不一致

| 差异点 | AGENT_SPEC | TECHNICAL_SPEC |
|--------|-----------|---------------|
| 枚举数量 | 8 种（含 AGENT_SWITCH） | 注释"6 种"，实际 7 种（无 AGENT_SWITCH） |
| TEXT 命名 | `TEXT_DELTA = "text_delta"` | `TEXT = "text"` |
| AGENT_SWITCH | 有 | 无 |

AGENT_SPEC §2.2.2.1 注释声称"引用 TECHNICAL_SPEC §3.5 权威定义"，但两者实际不同。

**修复建议：** 以 AGENT_SPEC 为权威（8 种），更新 TECHNICAL_SPEC 补齐 AGENT_SWITCH、统一命名。

### P1: LearningPreferences.style 枚举值残留

- AGENT_SPEC / TECHNICAL_SPEC: `"hands_on"`（下划线）✅
- AGENT_PRD §3.2 JSON 示例: `"hands-on"`（连字符）❌

### P2: 其他差异

| 问题 | 详情 |
|------|------|
| 缓存 TTL 冲突 | AGENT_SPEC 项目分析 = 24h，TECHNICAL_SPEC = 7 天 |
| AgentPreferences 残留 | AGENT_PRD §3.2 JSON 仍用 `mentor_style`（应为 4 字段结构） |
| ask_user_question 缺实现 | TECHNICAL_SPEC §6.3 无该工具的 @tool 骨架（6 Agent 共用的核心工具） |

---

## 四、结论

| 维度 | TECHNICAL_SPEC | AGENT_SPEC | 跨文档 |
|------|---------------|-----------|--------|
| 完整性 | 5/5 | 5/5 | — |
| 正确性 | 4.5/5 | 4.5/5 | 3/5 |
| 安全性 | 5/5 | — | — |
| 可行性 | 4.5/5 | 5/5 | — |
| 规范性 | 5/5 | 5/5 | — |

**重建文档质量评价：优秀。** 两份文档自身内容完整、修复项全部到位、安全规格可实施。

**唯一阻塞：** P0 级 agent_permissions 系统性不匹配需要在开工前统一裁定（方案 A 或 B），预计 30 分钟可完成三文档同步。

---

*报告结束。所有编号可直接引用。*
