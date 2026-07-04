# RepoPilot v1.0 — 第 12 轮审核报告

> 审核日期: 2026-07-04
> 审核范围: TECHNICAL_SPEC.md, AGENT_SPEC.md
> 审核者: QoderWork (2 路并行终审)

---

## 〇、总体评估

经过 11 轮审查后文档整体质量很高，但本轮仍发现 **2 个 HIGH + 5 个 MEDIUM + 1 个 LOW** 问题。主要集中在 `config.yaml` 示例与已统一的数据模型之间的残留不同步。

---

## 一、🔴 HIGH（2 项）

### H1: ReActEngine SSE 事件名 `"text"` 与协议定义 `"text_delta"` 不匹配

**位置:** TECHNICAL_SPEC §6.1 L1148 vs §4.2 L731 vs §3.5 L463

ReActEngine yield `{"event": "text", ...}`，但 StreamEventType 枚举和 SSE 协议均定义为 `TEXT_DELTA = "text_delta"`。前端按 `text_delta` 监听将收不到文本流。

**修复:** L1148 `"text"` → `"text_delta"`

---

### H2: mentor config.yaml 工具列表与 agent_permissions 不一致（两处）

**位置:** TECHNICAL_SPEC §9.4 L1777-1787 vs §2.2 agent_permissions L130-133

| 数据点 | agent_permissions (§2.2) | config.yaml (§9.4) | 冲突 |
|--------|--------------------------|--------------------|----|
| mentor 工具数 | 11 | 10 | ❌ |
| 含 read_readme | ✅ | ✅ | — |
| 含 get_user_profile | ✅ | ❌ | ❌ |
| 含 build_learning_path | ❌ | ✅ | ❌（该工具 allowed_agents 仅 navigator） |

§9.4 的 F5-41 注释声称"与 agent_permissions 保持一致"，但实际不一致。

**修复:** config.yaml 工具列表改为与 agent_permissions 一致的 11 个工具。

---

## 二、🟡 MEDIUM（5 项）

### M1: §3.2 端点计数与 §4.1 实际数量不匹配

| 模块 | §3.2 声称 | §4.1 实际 | 差值 |
|------|----------|---------|------|
| Projects | 11 | 12 | +1 |
| Settings | 3 | 2 | -1 |
| Agent | 20 | 23 | +3 |

**修复:** 以 §4.1 为准更新 §3.2 计数。

### M2: ER 图 User-UserSetting 关系标注错误

**位置:** §2.1 ER 关系 L91

标注 `User 1──N UserSetting`（一对多），但 user_settings 表以 user_id 为 PK，实际为一对一。

**修复:** 改为 `User 1──1 UserSetting`。

### M3: 类型映射表引用不存在的 §4.4.2

**位置:** §3.5 类型使用映射 L641-642

ConversationContext 和 IntentResult 标注首次使用位置为 §4.4.2，但实际为 §4.5。

**修复:** `§4.4.2` → `§4.5`。

### M4: config.yaml Schema 字段名与 AgentDefinition 不对齐

**位置:** TECHNICAL_SPEC §9.3 L1748 / §9.4 L1764

| AgentDefinition (§4.4) | config.yaml (§9.3) |
|------------------------|-------------------|
| `id` | `agent_id` ❌ |
| `name` | `display_name` ❌ |

**修复:** config.yaml 统一使用 `id`/`name`。

### M5: ExecutionContext.db 类型注解缺少 `| None`

**位置:** §3.5 L559

`db: "DatabaseService" = None` — 类型声明为非 None 但默认值为 None。

**修复:** `db: "DatabaseService | None" = None`。

---

## 三、🟢 LOW（1 项）

### L1: D3.js 示例使用 `any` 类型

**位置:** §12.4 L2165

`.id((d: any) => d.id)` 与 §12.1 "TypeScript strict, 禁止 any" 矛盾。

---

## 四、跨文档一致性（全部通过 ✅）

| 检查点 | 结果 |
|--------|------|
| AgentDefinition 字段名 (id/name) | ✅ 两文件一致 |
| StreamEventType (8 种) | ✅ 两文件一致 |
| PromptGuard (8 条规则) | ✅ 两文件一致 |
| agent_permissions 工具数 (5/11/7/6/6/3) | ✅ 两文件一致 |
| raise NotImplementedError (0 处) | ✅ |
| context.llm. (0 处) | ✅ |

---

## 五、结论

**修复 H1-H2 + M1-M5 后可通过终审。** 问题均为文本级改动，不涉及架构变更，预计 20 分钟可完成。
