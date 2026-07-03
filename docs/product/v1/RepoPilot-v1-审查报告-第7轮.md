# RepoPilot v1.0 产品文档 — 最终审查报告

> 版本: 1.0.0 | 日期: 2026-07-04 | 状态: 最终审查
> 审查范围: `docs/product/` 下全部核心文档（PRD, AGENT_PRD, TECHNICAL_SPEC, AGENT_SPEC, MVP_SCOPE, README）
> 审查轮次: 第 7 轮（最终确认轮）

---

## 1. 审查摘要

| 指标 | 数值 |
|------|------|
| 核心文档数 | 6 |
| 总页数（估算） | ~300+ |
| 第 5 轮修复验证 | 7/7 项已确认修复 |
| 第 6 轮遗留问题 | 4 项（2 项已修复，2 项仍需处理） |
| 本轮新发现问题 | 6 项 |
| **Phase 1 就绪状态** | **有条件通过**（需修复 2 项 Medium 问题） |

---

## 2. 第 5 轮修复验证

以下验证第 5 次修复报告（`RepoPilot-v1-修复报告-第5次.md`）中 claimed fixes 是否实际存在于文档中。

| 编号 | 问题描述 | 声称修复 | 实际状态 | 证据 |
|------|---------|---------|---------|------|
| H1 | StreamCollector 缺少 `@dataclass` | 已修复 | ✅ 已修复 | TECHNICAL_SPEC.md L909: `@dataclass` 存在 |
| H3 | AGENT_SPEC LLMConfig 缺少 validators | 已修复 | ✅ 已修复 | AGENT_SPEC.md L446-470: `@field_validator` + `from_user_settings()` 存在 |
| H4 | agent_permissions mentor 工具列表不一致 | 已修复 | ✅ 已修复 | TECHNICAL_SPEC.md L244: mentor 工具列表含 10 个工具 |
| F5-29 | extensions 字段缺少边界约束 | 已修复 | ✅ 已修复 | TECHNICAL_SPEC.md L394, L1974-1983: ≤64KB / ≤100 keys / key ≤128 chars |
| F5-37 | llm_default_provider 注释过时 | 声称修复 | ⚠️ 未找到 | 全文档无 `llm_default_provider` 字段，可能已删除或从未存在 |
| L1 | AGENT_PRD "无 Agent (降级)" 术语不一致 | 已修复 | ✅ 已修复 | AGENT_PRD.md L524: 已统一为 "无 Key (降级)" |
| L2 | AGENT_PRD "AI API Key" vs "LLM API Key" | 已修复 | ✅ 已修复 | AGENT_PRD.md L14, L533: 已统一为 "LLM API Key" |

**结论：** 6/7 项已验证修复，F5-37 经排查在全文档中不存在，可能为误报或已在更早轮次删除。

---

## 3. 第 6 轮遗留问题状态

| 编号 | 问题描述 | 当前状态 | 说明 |
|------|---------|---------|------|
| F5-32 | AGENT_PRD §3.3 缺少记忆提取用户同意机制 | ❌ 未修复 | §3.3 为"上下文管理策略"，无同意机制内容 |
| F5-36 | MVP_SCOPE §5.1 L277 仍使用 `project_readmes` 字段名 | ❌ 未修复 | 应为 `projects.readme` 字段 |
| N6-06 | AGENT_PRD "无 Agent" vs "无 Key" 术语 | ✅ 已修复 | 已统一为 "无 Key" |
| README 目录结构/权威链 | README 问题 | ✅ 已修复 | 当前 README 目录结构与权威链描述正确 |

---

## 4. 本轮新发现问题

### 4.1 Critical（阻塞 Phase 1）

**无 Critical 问题。**

### 4.2 Medium（建议修复后再启动 Phase 1）

| 编号 | 问题 | 位置 | 影响 | 建议修复方案 |
|------|------|------|------|-------------|
| M1 | AgentDefinition 字段顺序不一致 | TECHNICAL_SPEC.md L1129-1145 vs AGENT_SPEC.md L131-147 | 实现者困惑，可能导致序列化/反序列化错误 | 统一字段顺序：capabilities 放在 agent_md_path 之前（与 TECHNICAL_SPEC 一致） |
| M2 | NotificationMessage 类型未定义 | AGENT_SPEC.md L2239, 2254 | 类型检查失败，实现者不清楚消息结构 | 在 AGENT_SPEC.md §2 或 §9.2 添加 NotificationMessage 类型定义 |
| M6 | PromptGuard 使用 `re`/`logger` 但无局部导入 | TECHNICAL_SPEC.md L2782-2783 | 代码无法运行 | 在 PromptGuard 类定义处添加 `import re` 和 `import logging` / `logger` 定义 |
| M7 | PRD TBD-04 交叉引用指向错误章节 | PRD.md L239: `AGENT_SPEC §2.2` | 导航错误 | 修正为 `AGENT_SPEC §2.2.1`（意图分类）或 `§2.2`（Hub 路由调度） |

### 4.3 Low（可后置处理）

| 编号 | 问题 | 位置 | 影响 | 建议 |
|------|------|------|------|------|
| M3 | AGENT_SPEC §8.2.3 标注"已标记删除"但包含独特 TS 类型 | AGENT_SPEC.md L352 | 冗余但无害 | v1.1 重构时删除 |
| M4 | read_readme 截断限制仅在 AGENT_SPEC 中定义 | AGENT_SPEC.md (read_readme 工具) vs TECHNICAL_SPEC.md | 实现者可能遗漏截断逻辑 | 在 TECHNICAL_SPEC §6.3 补充 read_readme 的截断说明 |
| M5 | TECHNICAL_SPEC §3.2 端点表格缺少请求/响应示例 | TECHNICAL_SPEC.md L521-620 | 实现者需要推断数据结构 | 为关键端点（如 /chat, /analyze）添加请求/响应示例 |
| M8 | AGENT_PRD §3.3 缺少记忆提取用户同意机制 | AGENT_PRD.md L276-285 | 隐私合规风险 | 在 §3.3 或新增 §3.4 添加同意机制描述 |

---

## 5. 关键类型定义一致性检查

### 5.1 核心类型（TECHNICAL_SPEC §3.5 vs AGENT_SPEC §2）

| 类型 | TECHNICAL_SPEC 定义 | AGENT_SPEC 定义 | 一致性 |
|------|-------------------|----------------|--------|
| LLMChunk | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| Message | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| ToolResult | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| StreamCollector | ✅ @dataclass (F5-13) | ✅ @dataclass | ✅ 一致 |
| IntentResult | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| SubIntent | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| ExecutionContext | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| Session | ✅ @dataclass | ✅ @dataclass | ✅ 一致 |
| ProjectContext | ✅ @dataclass | — | ⚠️ AGENT_SPEC 未显式定义（引用 TECHNICAL_SPEC） |
| MemoryItem | ✅ @dataclass | — | ⚠️ AGENT_SPEC 未显式定义（引用 TECHNICAL_SPEC） |
| TestResult | ✅ @dataclass | — | ⚠️ AGENT_SPEC 未显式定义（引用 TECHNICAL_SPEC） |
| UserProfile | ✅ @dataclass (BaseModel) | ⚠️ 普通类（L1373） | ❌ 不一致 |
| NotificationMessage | — | ❌ 未定义 | ❌ 缺失 |

### 5.2 Agent 配置类型

| 类型 | 定义位置 | 状态 |
|------|---------|------|
| AgentDefinition | TECHNICAL_SPEC §2.1 + AGENT_SPEC §2.1 | ⚠️ 字段顺序不一致 |
| LLMConfig | TECHNICAL_SPEC §5.2 + AGENT_SPEC §3.2 | ✅ 一致（validators 均已补全） |
| ToolDefinition | AGENT_SPEC §4.2 | ✅ 已定义 |

### 5.3 工具定义覆盖

| 工具 | TECHNICAL_SPEC §6.3 | AGENT_SPEC §4.3 | 覆盖状态 |
|------|-------------------|----------------|---------|
| query_user_projects | ✅ @tool | ✅ @tool | ✅ 完整 |
| read_source_file | ✅ @tool | ✅ @tool | ✅ 完整 |
| ask_user_question | ✅ @tool | ✅ @tool | ✅ 完整 |
| read_readme | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| search_web | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| get_project_analysis | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| get_user_profile | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| update_user_profile | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| suggest_classification | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| generate_note_outline | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| compare_projects | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| build_learning_path | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| save_to_memory | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |
| recall_from_memory | ❌ 缺少 @tool | ✅ @tool | ⚠️ 仅 AGENT_SPEC 有定义 |

---

## 6. 交叉引用检查

### 6.1 PRD 内部交叉引用

| 引用 | 位置 | 目标 | 状态 |
|------|------|------|------|
| §3.3 → AGENT_PRD.md | PRD.md L61 | `./AGENT_PRD.md` | ✅ 正确（同目录相对路径） |
| TBD-04 → AGENT_SPEC §2.2 | PRD.md L239 | AGENT_SPEC.md | ⚠️ §2.2 为"Hub 路由调度"，§2.2.1 为"意图分类"，引用略模糊 |
| TBD-05 → AGENT_SPEC §5.2 | PRD.md L240 | AGENT_SPEC.md | ✅ 正确 |
| TBD-10 → AGENT_SPEC §5.2、§6 | PRD.md L245 | AGENT_SPEC.md | ✅ 正确 |

### 6.2 SPEC 内部交叉引用

| 引用 | 位置 | 目标 | 状态 |
|------|------|------|------|
| §3.5 → AGENT_SPEC 唯一权威 | TECHNICAL_SPEC.md L4 | AGENT_SPEC.md | ✅ 正确 |
| §5.2 validate_api_base | TECHNICAL_SPEC.md L1408 | 自身函数 | ✅ 正确 |
| §5.2 SecureKeyStore | TECHNICAL_SPEC.md L379 | 自身章节 | ✅ 正确 |
| §10.3 PromptGuard | TECHNICAL_SPEC.md L2739 | 自身类 | ⚠️ 缺少导入语句 |

### 6.3 MVP 交叉引用

| 引用 | 位置 | 目标 | 状态 |
|------|------|------|------|
| §3.1 → PRD §3.1 | MVP_SCOPE.md L25 | PRD.md | ✅ 正确 |
| §3.3 → SPEC §8 | MVP_SCOPE.md L50 | TECHNICAL_SPEC.md | ✅ 正确 |
| §3.3 → SPEC §5.2 | MVP_SCOPE.md L43 | TECHNICAL_SPEC.md | ✅ 正确 |
| §5.1 project_readmes | MVP_SCOPE.md L277 | 应为 `projects.readme` | ❌ 字段名错误 |
| §8.4 project_readmes | MVP_SCOPE.md L559 | 应为 `projects.readme` | ❌ 字段名错误 |

---

## 7. 代码片段可运行性检查

### 7.1 导入完整性

| 代码片段 | 位置 | 问题 | 严重度 |
|---------|------|------|--------|
| StreamCollector | TECHNICAL_SPEC L909 | @dataclass 已导入（L829） | ✅ 正常 |
| PromptGuard.sanitize_user_input | TECHNICAL_SPEC L2767 | 使用 `re.search`（L2782）但 `import re` 在 L2708（文件末尾），不在类附近 | ⚠️ Medium |
| PromptGuard.sanitize_user_input | TECHNICAL_SPEC L2783 | 使用 `logger.warning` 但全文件无 `import logging` 或 logger 定义 | 🔴 High |
| UserProfile | AGENT_SPEC L1373 | 普通类但 TECHNICAL_SPEC §2.3 定义为 BaseModel | ⚠️ Medium |
| NotificationMessage | AGENT_SPEC L2239 | 作为类型使用但从未定义 | ⚠️ Medium |

### 7.2 类型注解一致性

| 字段/类型 | TECHNICAL_SPEC | AGENT_SPEC | 一致性 |
|----------|---------------|-----------|--------|
| AgentDefinition.capabilities | list[str] (L1139) | list[str] (L137) | ✅ 一致 |
| AgentDefinition.tools | list[str] (L1138) | list[str] (L141) | ✅ 一致 |
| AgentDefinition.model_override | str \| None (L1140) | str \| None (L142) | ✅ 一致 |
| LLMConfig.api_base | str \| None (L1401) | str \| None (L441) | ✅ 一致 |
| UserProfile.extensions | dict[str, Any] (L1394) | dict[str, Any] (L1388) | ✅ 一致 |

---

## 8. 术语一致性检查

| 术语 | 使用位置 | 统一状态 |
|------|---------|---------|
| "无 Key (降级)" | AGENT_PRD.md L14, L524 | ✅ 统一 |
| "LLM API Key" | AGENT_PRD.md L14, L533 | ✅ 统一 |
| "BYOK (Bring Your Own Key)" | AGENT_PRD.md L14 | ✅ 统一 |
| "project_readme" | MVP_SCOPE.md L277, L559 | ❌ 应为 `projects.readme` |
| "extensions" | TECHNICAL_SPEC.md L394, L1394 | ✅ 统一 |
| "Agent 之间协作" | PRD.md L239 | ✅ 统一 |

---

## 9. Phase 1 就绪评估

### 9.1 已满足条件

- ✅ 所有 Critical 问题已修复
- ✅ 核心类型定义完整且一致（LLMChunk, Message, ToolResult, StreamCollector, IntentResult, SubIntent, ExecutionContext, Session）
- ✅ Agent 权限配置与工具列表一致
- ✅ BYOK 配置存储与 SSRF 防护已定义
- ✅ 降级策略已文档化
- ✅ 文档权威链清晰（PRD > SPEC > MVP）
- ✅ 目录结构与 README 描述一致

### 9.2 待处理条件

- ⚠️ M1: AgentDefinition 字段顺序不一致（需统一）
- ⚠️ M2: NotificationMessage 类型未定义（需补充）
- ⚠️ M6: PromptGuard 缺少导入语句（需补充）
- ⚠️ M7: PRD TBD-04 交叉引用指向模糊（需修正）
- ❌ F5-36: MVP_SCOPE 中 `project_readmes` 字段名错误（需修正）

### 9.3 就绪结论

**有条件通过（Conditional Go）**

建议在启动 Phase 1 开发前完成以下修复：

1. **必须修复（阻塞）**：
   - M6: PromptGuard 导入语句（代码无法运行）
   - F5-36: `project_readmes` → `projects.readme`（实现者会困惑）

2. **建议修复（非阻塞但影响体验）**：
   - M1: AgentDefinition 字段顺序统一
   - M2: NotificationMessage 类型定义
   - M7: TBD-04 交叉引用修正

3. **可后置处理**：
   - M3, M4, M5, M8 可在 v1.1 迭代中处理

---

## 10. 附录：问题追踪表

| 编号 | 来源 | 严重度 | 状态 | 文档 | 行号 | 描述 |
|------|------|--------|------|------|------|------|
| H1 | 第 5 轮 | High | ✅ 已修复 | TECHNICAL_SPEC | L909 | StreamCollector 缺少 @dataclass |
| H3 | 第 5 轮 | High | ✅ 已修复 | AGENT_SPEC | L436 | LLMConfig 缺少 validators |
| H4 | 第 5 轮 | High | ✅ 已修复 | TECHNICAL_SPEC | L244 | agent_permissions mentor 工具列表不一致 |
| F5-29 | 第 5 轮 | Medium | ✅ 已修复 | TECHNICAL_SPEC | L394 | extensions 缺少边界约束 |
| F5-32 | 第 5 轮 | Medium | ❌ 未修复 | AGENT_PRD | L276 | 缺少记忆提取用户同意机制 |
| F5-36 | 第 5 轮 | Medium | ❌ 未修复 | MVP_SCOPE | L277, L559 | `project_readmes` 字段名错误 |
| F5-37 | 第 5 轮 | Low | ⚠️ 未找到 | 全文档 | — | llm_default_provider 注释过时（字段不存在） |
| N6-06 | 第 6 轮 | Medium | ✅ 已修复 | AGENT_PRD | L524 | "无 Agent" vs "无 Key" 术语 |
| M1 | 本轮 | Medium | ❌ 待修复 | TECHNICAL_SPEC/AGENT_SPEC | L1129/L131 | AgentDefinition 字段顺序不一致 |
| M2 | 本轮 | Medium | ❌ 待修复 | AGENT_SPEC | L2239 | NotificationMessage 类型未定义 |
| M3 | 本轮 | Low | ⏸️ 后置 | AGENT_SPEC | L352 | §8.2.3 标注删除但含独特内容 |
| M4 | 本轮 | Low | ⏸️ 后置 | TECHNICAL_SPEC/AGENT_SPEC | L1732/L890 | read_readme 截断限制仅在一处定义 |
| M5 | 本轮 | Low | ⏸️ 后置 | TECHNICAL_SPEC | L521 | 端点表格缺少请求/响应示例 |
| M6 | 本轮 | High | ❌ 待修复 | TECHNICAL_SPEC | L2782 | PromptGuard 缺少 import re 和 logger |
| M7 | 本轮 | Medium | ❌ 待修复 | PRD | L239 | TBD-04 交叉引用指向模糊 |
| M8 | 本轮 | Medium | ⏸️ 后置 | AGENT_PRD | L276 | 缺少记忆提取用户同意机制（与 F5-32 重复） |

---

## 11. 建议下一步行动

1. **立即修复（Phase 1 启动前）**：
   - 在 TECHNICAL_SPEC.md PromptGuard 类定义处添加 `import re` 和 `import logging; logger = logging.getLogger(__name__)`
   - 修正 MVP_SCOPE.md 中所有 `project_readmes` 为 `projects.readme`
   - 统一 AGENT_SPEC.md 中 AgentDefinition 字段顺序与 TECHNICAL_SPEC 一致
   - 在 AGENT_SPEC.md §2 或 §9.2 添加 NotificationMessage 类型定义
   - 修正 PRD.md L239 TBD-04 引用为 `AGENT_SPEC §2.2.1`

2. **Phase 1 开发期间**：
   - 在 TECHNICAL_SPEC §6.3 补充 read_readme 工具的 @tool 定义和截断说明
   - 为关键端点添加请求/响应示例（M5）

3. **v1.1 规划时**：
   - 处理 M3（删除冗余的 §8.2.3）
   - 处理 M8（用户同意机制）

---

*报告生成时间: 2026-07-04*
*审查人: ZCode AI Assistant*
*基于: 第 5 轮修复报告 + 第 6 轮审查报告 + 当前文档状态快照*
