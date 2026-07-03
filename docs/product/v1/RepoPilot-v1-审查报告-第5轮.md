# RepoPilot v1.0 — 第 5 轮全面审核报告

> 审核日期: 2026-07-04
> 审核范围: PRD.md, AGENT_PRD.md, TECHNICAL_SPEC.md, AGENT_SPEC.md, MVP_SCOPE.md, README.md
> 关联文档: 第 1-4 轮审查报告, 第 1-3 次修复报告

---

## 〇、总体评估

本轮审查是在 4 轮历史审查（累计 80+ 问题）和多轮修复之后的**第五次全面审计**。采用 3 路并行深度审核策略，覆盖全部 6 份产品文档。审查重点：

1. **第 4 轮修复回归验证** — 确认修复是否真正落实
2. **代码级类型完整性** — 核心 dataclass 定义与使用是否匹配
3. **PRD 层内部矛盾** — 前 4 轮集中在 SPEC 层，本轮深挖 PRD 层
4. **安全防护深度审计** — DNS Rebinding、路径遍历、权限模型
5. **跨文档交叉验证** — 字段名、引用路径、术语一致性

**发现统计:**

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 开工前必修 | 10 | 运行时必崩 / 需求矛盾 / 安全阻塞 |
| 🟡 Phase 1 前完成 | 25 | 影响开发质量和验收判定 |
| 🟢 后续优化 | 23 | 规范性和一致性改善 |

**与第 4 轮对比:** 第 4 轮集中在 SPEC 层的类型缺失和代码重复；本轮重心转向 **PRD 层内部矛盾**（Agent 数量、性能指标、OAuth/PAT 描述冲突）、**代码示例的运行时正确性**（dataclass 字段与使用不匹配）、以及**深层安全盲区**（DNS Rebinding、路径遍历）。

---

## 一、第 4 轮修复状态验证

基于第 4 轮审查报告中的修复项，逐一验证当前文档状态：

### 已确认修复 ✅（11/12）

| 编号 | 问题 | 验证结果 |
|------|------|---------|
| C-01 | search_web 简化为接口契约 | ✅ AGENT_SPEC §4.3：接口契约表 + 伪代码，函数体为 NotImplementedError |
| C-04 | UserSetting 表 key_salt 字段 | ✅ TECHNICAL_SPEC §2.2：`key_salt BLOB NULLABLE` 已添加 |
| C-05 | api_base 默认值 | ✅ AGENT_SPEC 预设配置均使用 `api_base=None` |
| C-06 | Project 表 UNIQUE 约束 | ✅ TECHNICAL_SPEC §2.2：`UNIQUE(user_id, url)` 已声明 |
| C-07 | agent_messages 索引 | ✅ AGENT_SPEC §5.2：`CREATE INDEX idx_messages_session` 已添加 |
| C-08 | submit.style 5 选项 | ✅ TECHNICAL_SPEC §8.2.3 首版 + 补充块均为 5 个选项 |
| C-10 | _build_system_prompt() | ✅ TECHNICAL_SPEC §7.3.1：6 步实现说明 + PromptGuard 防护指令 |
| C-11 | _extract_entities() | ✅ TECHNICAL_SPEC §7.3.2：正则 + 关键词词典实现建议 |
| S-01 | validate_api_base 挂载 | ✅ TECHNICAL_SPEC §5.2：`@field_validator("api_base")` 已挂载 |
| S-05 | PromptGuard 可配置模式 | ✅ TECHNICAL_SPEC §10.3.1 + AGENT_SPEC：支持 block/mark 两种模式 |
| T-07 | 浅色主题 CSS | ✅ TECHNICAL_SPEC §12.2：完整 [data-theme="light"] 变量定义 |
| S-02 | JWT 密钥强度校验 | ✅ MVP_SCOPE §6.4：`@field_validator("jwt_secret_key")` 强制 len >= 32 |
| S-03 | GitHub PAT Scope 验证 | ✅ MVP_SCOPE AC-06：检查 X-OAuth-Scopes，拒绝超范围 PAT |
| T-05 | read_source_file 行截断 | ✅ TECHNICAL_SPEC §6.3：改为 split("\n") + 行号切片 |
| S-06 | 数据保留策略 | ✅ TECHNICAL_SPEC §2.3：三表保留策略 + 清理机制 |

### 修复不完整 ❌（1/12）

| 编号 | 问题 | 当前状态 |
|------|------|---------|
| C-12 | AgentDefinition capabilities 字段 | ❌ TECHNICAL_SPEC §4.4.1 已添加，但 **AGENT_SPEC §4.1 的 AgentDefinition 类仍缺失此字段** |

---

## 二、🔴 新发现 — 开工前必修（10 项）

### F5-01: LLMChunk 缺少 type 和 tool_call 字段（运行时必崩）

**位置:** TECHNICAL_SPEC.md §3.5

**现状:** LLMChunk dataclass 只定义了 text/model/finish_reason/usage 四个字段，但 ReActEngine.run() 通过 `chunk.type == "text" / "tool_call" / "done"` 分流处理，并访问 `chunk.tool_call`。运行时 AttributeError。

**修复建议:** 在 LLMChunk 中添加：
```python
type: Literal["text", "tool_call", "done"]
tool_call: dict | None = None
```

---

### F5-02: Message 缺少 tool_call_id 字段（运行时必崩）

**位置:** TECHNICAL_SPEC.md §3.5

**现状:** Message dataclass 无 `tool_call_id` 字段。ReAct 引擎注入工具结果时写 `Message(role="tool", tool_call_id=tc.id, ...)`，这是 OpenAI function calling 协议的必需字段。运行时 TypeError。

**修复建议:** 在 Message 中添加 `tool_call_id: str | None = None`。

---

### F5-03: PRD §1 Agent 数量描述遗漏 Hub

**位置:** PRD.md §1 产品愿景

**现状:** 差异化描述中列举 5 个 Agent（"快速分析师、深度导师、学习规划师、分类管家、笔记助手"），遗漏 Hub（对话管家）。但 §3.3.2 完整表格列出 6 个。§1 是读者最先看到的内容。

**修复建议:** 补充"对话管家"，或改为概括性表述"六个专业 Agent"。

---

### F5-04: PRD 图谱性能指标内部 5 倍冲突

**位置:** PRD.md §4.1 vs §7.3

**现状:** §4.1 定义"图谱渲染 **500 节点** < 2s"，§7.3 质量门禁写"图谱 **100 节点** < 2s"。同一文档同一指标相差 5 倍，验收无法判定。

**修复建议:** 统一为一个值，或分层定义："目标 500 节点 < 2s，最低验收 100 节点 < 2s"。

---

### F5-05: PRD §3.1 OAuth/PAT 绑定方式矛盾

**位置:** PRD.md §3.1 vs §7.1 vs §7.2

**现状:** §3.1 写"OAuth **或**手动绑定 GitHub"（P0），但 §7.2 v1.0 交付范围仅"PAT 绑定"，§7.1 将 OAuth 推迟到 v1.1。MVP_SCOPE §2.1 也明确"仅手动绑定（PAT），不做 OAuth"。按权威链 PRD > MVP，PRD §3.1 的 P0 OAuth 描述与 v1.0 实际范围矛盾。

**修复建议:** §3.1 改为"手动绑定 GitHub 账号（用户名 + PAT），用于 Star 同步"，OAuth 标注为 v1.1。

---

### F5-06: 跨文档引用路径错误（PRD + AGENT_PRD）

**位置:** PRD.md §3.3.1/§6, AGENT_PRD.md §10

**现状:** PRD.md 内部链接使用 `../PRD/AGENT_PRD.md`（应为 `./AGENT_PRD.md`，因两者在同一目录）。AGENT_PRD.md 链接使用 `../PRD/PRD.md`（应为 `./PRD.md`）。在 MkDocs/Docusaurus 中会产生 404。

**修复建议:** 统一修正为同目录相对路径 `./`。

---

### F5-07: IntentResult/SubIntent 类型在 AGENT_SPEC 中缺失

**位置:** AGENT_SPEC.md §2.2.1

**现状:** `IntentClassifier.classify()` 返回 `IntentResult`，`_orchestrate_multi()` 使用 `SubIntent`，但这两个 dataclass 在 AGENT_SPEC 中无定义。TECHNICAL_SPEC §8.3 有定义，但 AGENT_SPEC 声称是 Agent 系统的"唯一权威来源"。

**修复建议:** 在 AGENT_SPEC §2.2.1 补充完整 dataclass 定义，与 TECHNICAL_SPEC §8.3 一致。

---

### F5-08: 3 个工具在 AGENT_SPEC 中完全无定义

**位置:** AGENT_SPEC.md §4.3

**现状:** MVP_SCOPE §7.4 列出 14 个工具，但 AGENT_SPEC §4.3 只定义了 11 个。缺失：
- `suggest_classification`（Curator）
- `generate_note_outline`（Scribe）
- `build_learning_path`（Navigator）

**修复建议:** 补充完整的 `@tool` 定义（含 name/description/parameters JSON Schema/allowed_agents/handler 伪代码）。

---

### F5-09: README 目录结构与实际文件系统严重不符

**位置:** README.md §2 目录结构

**现状:** README 将审查报告放在 `v1/PRD/` 下并使用旧文件名，实际审查报告在 `v1/` 目录下，文件名已改为"第X轮"格式。

**修复建议:** 更新 §2 目录结构，使用实际文件路径和文件名。审查报告建议归入 `v1/reviews/` 子目录。

---

### F5-10: AgentDefinition.capabilities 在 AGENT_SPEC 中缺失

**位置:** AGENT_SPEC.md §4.1 vs TECHNICAL_SPEC.md §4.4.1

**现状:** 第 4 轮 C-12 修复后 TECHNICAL_SPEC 的 AgentDefinition 已有 `capabilities: list[str]`，但 AGENT_SPEC 的同名 dataclass 仍缺失此字段。

**修复建议:** 在 AGENT_SPEC AgentDefinition 中同步添加 `capabilities: list[str]`。

---

## 三、🟡 新发现 — Phase 1 前完成（25 项）

### F5-11: Message.to_dict() 方法未定义

**位置:** TECHNICAL_SPEC.md §5.1

LLMProvider.complete() 调用 `m.to_dict()` 将 Message 转为 LLM API 格式，但 Message dataclass 未定义此方法。补充 to_dict() 返回 OpenAI messages API 兼容格式。

---

### F5-12: ToolResult 缺少 preview() 和 to_string() 方法

**位置:** TECHNICAL_SPEC.md §3.5 vs §6.1

ReAct 引擎调用 `result.preview()`（SSE 事件）和 `result.to_string()`（对话历史注入），但 ToolResult 未定义这两个方法。

---

### F5-13: StreamCollector 类未定义

**位置:** TECHNICAL_SPEC.md §6.1

ReAct 引擎使用 StreamCollector() 收集流式响应（append_text/add_tool_call/set_usage/has_tool_calls），但此类型未在任何位置定义。

---

### F5-14: project_tags 关联表缺少 UNIQUE 约束

**位置:** TECHNICAL_SPEC.md §2.2

`project_tags` 表无 `UNIQUE(project_id, tag_id)` 约束，同一 tag 可重复关联到同一 project。对比 Project 表和 Category 表都有 UNIQUE 约束。

---

### F5-15: Tag 表缺少 user_id — 全局/私有语义矛盾

**位置:** TECHNICAL_SPEC.md §2.2 vs §3.2

Tag 表只有 id/name 两个字段，无 user_id。但 Tags API（GET /api/v1/tags）描述为"列出当前用户所有标签"。如果是用户私有则缺 user_id + UNIQUE(user_id, name)；如果是全局共享则 API 语义不对。

---

### F5-16: SSRF 防护未覆盖 DNS Rebinding

**位置:** TECHNICAL_SPEC.md §5.2

`validate_api_base` 对域名直接放行（注释写"DNS 解析由 litellm 处理"），但 litellm 不做 SSRF 防护。攻击者可注册域名指向 169.254.169.254（AWS 元数据）绕过校验。经典的 DNS Rebinding / TOCTOU 攻击。建议至少在文档中标注为已知限制（TBD）。

---

### F5-17: read_source_file 路径遍历风险

**位置:** TECHNICAL_SPEC.md §6.3

repo/path/ref 参数直接拼接为 GitHub API URL，无任何校验。LLM 可能被诱导传入恶意路径。添加参数校验：repo 匹配 `^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$`，path 禁止 ".." 和以 "/" 开头，ref 禁止 "?"、"&"、"#"。

---

### F5-18: agent_permissions 用户级权限与工具级权限脱节

**位置:** TECHNICAL_SPEC.md §2.2 vs §6.2

User 表有 agent_permissions JSON 字段（含每个 agent 的 enabled/tools 配置），但 ToolRegistry.execute() 只看 ToolDefinition.allowed_agents（静态定义），不参考用户的 agent_permissions。该字段形同虚设。建议在 ReActEngine 入口添加运行时校验，或标注为 v1.1+。

---

### F5-19: 降级 ReAct 模式代码块 Markdown 格式损坏

**位置:** TECHNICAL_SPEC.md §6.4

REACT_PROMPT_TEMPLATE 内含 \`\`\`tool_call 代码块标记，与外层 \`\`\`python 代码块冲突，导致渲染异常。改用缩进代码块或不同 fence 标记（如 ~~~）。

---

### F5-20: search_web SSRF 防护缺少 BLOCKED_NETWORKS 具体列表

**位置:** AGENT_SPEC.md §4.3

search_web 伪代码提到"SSRF blocklist 校验"，但未列出 BLOCKED_NETWORKS 的 IP 段。TECHNICAL_SPEC §5.2 有完整列表，AGENT_SPEC 应添加引用。

---

### F5-21: LearningPreferences.style 枚举值两份文档不一致

**位置:** AGENT_SPEC.md §5.3 vs TECHNICAL_SPEC.md §2.3

AGENT_SPEC 写 `style: str  # hands-on / theoretical / visual`，TECHNICAL_SPEC 写 `style: Literal["hands_on", "theoretical", "visual"]`。两处差异：(1) "hands-on"（连字符）vs "hands_on"（下划线）；(2) str vs Literal 类型。统一为 TECHNICAL_SPEC 版本。

---

### F5-22: CapabilityDetector.has_llm 判断逻辑与 BYOK 存储方案脱节

**位置:** AGENT_SPEC.md §3.3

`has_llm` 检查 `self.config.api_key != ""`，但实际 API Key 是 Fernet 加密存储在 SQLite 中的。当用户未配置 Key 时 config 应为 None（而非 api_key 为空字符串的 LLMConfig）。补充 config 参数来源说明，改 has_llm 为 `self.config is not None and bool(self.config.api_key)`。

---

### F5-23: StreamEventType 引用章节号错误

**位置:** AGENT_SPEC.md §2.2.2.1

注释写"权威定义见 TECHNICAL_SPEC §8.2"，但实际类型定义在 TECHNICAL_SPEC §3.5（核心类型），§8.2.3 仅有一份冗余副本。修正引用指向正确章节。

---

### F5-24: MVP_SCOPE §6.3 Agent 表写入状态描述矛盾

**位置:** MVP_SCOPE.md §6.3

写"Agent 相关表虽然 MVP 不写入"，但 §3.1 表格明确标注 agent_sessions/agent_messages/project_analyses/user_profiles 在 v1.0 都是"✅ 写入"。该描述为旧版遗留，与 v1.0 完整发布策略矛盾。

---

### F5-25: MVP_SCOPE §7.1 ReActEngine 引用章节号错误

**位置:** MVP_SCOPE.md §7.1

写"完整实现 SPEC §4.4 的 ReAct 执行循环"，但 AGENT_SPEC §4.4 是"无 Function Calling 时的降级模式"，ReAct 核心循环在 §4.1。

---

### F5-26: AC-18 验收标准缺少 knowledge_map 反问类型

**位置:** MVP_SCOPE.md §9.1

AC-18 写"反问面板（radio/checkbox/slider/drag_sort）"仅 4 种，但 §2.1 功能范围明确列出 5 种（含 knowledge_map）。验收可能漏测。

---

### F5-27: 4 个 Agent 便捷端点在 AGENT_SPEC 中无定义

**位置:** MVP_SCOPE.md §4.1 vs AGENT_SPEC.md §8

`POST /compare`、`POST /classify`、`POST /recommend`、`POST /note/generate` 在 MVP_SCOPE 中列出，但 AGENT_SPEC 无请求/响应规格。实现者无法确定是 JSON 还是 SSE、请求体结构等。

---

### F5-28: PRD §4.2 缺少登录接口暴力破解防护

**位置:** PRD.md §4.2 安全

提到"API 速率限制"但未单独列出登录失败次数限制。OWASP 认证清单明确要求账户锁定或登录速率限制。

---

### F5-29: extensions 字段无界写入缺少防护约束

**位置:** AGENT_PRD.md §3.2

`extensions` 为开放结构，Agent 可自主写入，但无容量上限、键名规范、隐私边界约束。应与 MVP_SCOPE 已定义的 JSON 字段大小限制（64KB）呼应。

---

### F5-30: 工具失败/异常处理在 ReAct 模式中完全缺失

**位置:** AGENT_PRD.md §5.2

ReAct 示例展示了完美路径（所有工具都成功），未定义工具失败时的行为（重试？降级？向用户透明说明？）。

---

### F5-31: Curator require_confirmation 权限模型不完整

**位置:** AGENT_PRD.md §2.5

require_confirmation 仅含 ["reclassify", "remove_tag"]，但 add_tag、generate_summary 等操作是否需要确认未定义。auto_classify_on_import 的"自动"语义也不清晰。

---

### F5-32: 记忆系统"关键信息提取"缺少用户知情同意

**位置:** AGENT_PRD.md §3.3

Agent 从对话中静默提取用户信息写入 UserProfile，在 GDPR/个保法环境下属于"用户画像自动化"。需首次提取通知 + 设置开关 + 数据查看/删除。

---

### F5-33: 桌面客户端技术选型 pywebview/Electron 未决

**位置:** PRD.md §4.3 兼容性

两者打包体积（~5MB vs ~150MB）、原生能力差异极大。应明确选择或标注为 TBD 项。

---

### F5-34: README §8 关联文档路径与实际文件名不符

**位置:** README.md §8

使用旧文件名引用审查/修复报告，与实际 "第X轮" 格式不匹配。

---

### F5-35: README §3 冲突解决规则未覆盖 AGENT_PRD

**位置:** README.md §3 文档权威链

AGENT_PRD 与 PRD 存在覆盖重叠（Agent 角色、降级策略），但权威链中无 AGENT_PRD 的位置。需明确冲突时以哪个为准。

---

## 四、🟢 新发现 — 后续优化（23 项）

| 编号 | 位置 | 问题 | 建议 |
|------|------|------|------|
| F5-36 | TECHNICAL_SPEC §4.4.2 | ConversationContext 类型未定义，IntentClassifier.classify() 第二个参数无类型依据 | 改为已定义的 Session 类型或补充定义 |
| F5-37 | TECHNICAL_SPEC §6.2 | ToolDefinition 缺少 @dataclass 装饰器 | 添加 @dataclass |
| F5-38 | TECHNICAL_SPEC §3.5 vs §8.2.3 | StreamEventType 重复定义，§3.5 注释指向错误的 §11.4 | 保留 §3.5 唯一权威定义，删除 §8.2.3 副本 |
| F5-39 | TECHNICAL_SPEC §10.3.1 | PromptGuard.mode 为类变量，不支持按用户/按会话配置 | 改为实例属性或从配置读取 |
| F5-40 | TECHNICAL_SPEC §5.2 | validate_api_base 逻辑重复（field_validator + 独立函数） | 统一为一处实现 |
| F5-41 | TECHNICAL_SPEC §9.4 | mentor config.yaml 工具列表（10 个）与 §6.3 实际定义（3 个）不同步 | 补齐定义或标注引用 |
| F5-42 | TECHNICAL_SPEC §11.3 | SSE 事件序列化不一致（f-string vs json.dumps） | 统一使用 json.dumps |
| F5-43 | TECHNICAL_SPEC §13.2 | NotificationMessage 类型未定义 | 补充 dataclass 或标注 TBD |
| F5-44 | TECHNICAL_SPEC §10.2 | CORS Origin `http://127.0.0.1:*` 非 Starlette 合法语法 | 改为 allow_origin_regex |
| F5-45 | TECHNICAL_SPEC §8.1.2 | pending_question 状态排斥逻辑实现位置不明确 | 在 HubService 或 Router 层添加前置检查 |
| F5-46 | AGENT_SPEC §4.3 | search_web 实现规范标题重复（L929 和 L1053） | L1053 改为"参见上方"引用 |
| F5-47 | AGENT_SPEC §4.2 | ToolDefinition 缺少 @dataclass 装饰器（同 F5-37） | 添加 @dataclass |
| F5-48 | AGENT_SPEC §11.2 | 缓存策略表缺少 GitHub README（1h）和 Stars 列表（30min）条目 | 补充两行 |
| F5-49 | MVP_SCOPE §4.1/§8.4 | "project_readmes" 字段名与 projects.readme 不一致 | 统一为 projects.readme |
| F5-50 | MVP_SCOPE §6.4 | llm_default_provider/model 注释"不主动调用"已过时 | 更新为"全局默认值" |
| F5-51 | PRD §4.1 vs §7.3 | TF-IDF 性能指标仅在质量门禁出现，性能章节缺失 | §4.1 补充 TF-IDF 200 项目 < 3s |
| F5-52 | PRD §3.2 | JSON 导入/导出（P1/v1.1）缺少数据安全约束说明 | 标注排除敏感字段 + Schema 校验 |
| F5-53 | PRD §7.4 vs AGENT_PRD §4.2 | TBD 编号未覆盖 AGENT_PRD 中的 [TBD] 标记 | 替换为正式 TBD-XX 编号 |
| F5-54 | AGENT_PRD §8 vs PRD §5 | 降级表术语不一致："无 Agent" vs "无 Key"，"AI API Key" vs "LLM API Key" | 统一术语 |
| F5-55 | AGENT_PRD §2.6 | Scribe Agent 工具权限未定义（仅 generate_note_outline 一个工具） | 补充工具或说明现有工具覆盖范围 |
| F5-56 | AGENT_PRD §8 vs §2.2 | 降级表"项目介绍"与 Scout 自动触发机制矛盾 | 明确无 Key 时 Scout 自动触发的替代行为 |
| F5-57 | README §3 | "具体性递增"表述易与权威性混淆 | 改为"实施聚焦度递增"或"范围收窄度递增" |
| F5-58 | MVP_SCOPE §7.4 | 3 个缺失工具与 AGENT_SPEC 的交叉验证（关联 F5-08） | AGENT_SPEC 补齐后添加引用注释 |

---

## 五、跨文档一致性矩阵

| 检查点 | PRD ↔ SPEC | SPEC ↔ MVP | AGENT_SPEC ↔ TECHNICAL_SPEC | 状态 |
|--------|-----------|-----------|---------------------------|------|
| Agent 数量 | ⚠️ §1 列 5 个 vs §3.3 列 6 个 | ✅ | ✅ | F5-03 |
| GitHub 绑定方式 | ❌ §3.1 OAuth vs §7.2 PAT | ✅ | — | F5-05 |
| 图谱性能指标 | ❌ 500 节点 vs 100 节点 | — | — | F5-04 |
| Agent 工具数量 | — | ❌ MVP 14 vs AGENT_SPEC 11 | — | F5-08 |
| AgentDefinition.capabilities | — | — | ❌ AGENT_SPEC 缺失 | F5-10 |
| IntentResult/SubIntent | — | — | ❌ AGENT_SPEC 缺失 | F5-07 |
| LearningPreferences.style | — | — | ❌ hands-on vs hands_on | F5-21 |
| StreamEventType | — | — | ⚠️ 引用章节号错误 | F5-23 |
| README 缓存 TTL | — | ✅ 1 小时 | ✅ | — |
| PromptGuard 模式 | — | — | ✅ block/mark | — |
| submit.style 枚举 | — | — | ✅ 5 选项 | — |
| ToolDefinition @dataclass | — | — | ❌ 两份文档均缺 | F5-37/47 |
| Agent 便捷端点 | — | ❌ 4 个端点无规格 | — | F5-27 |
| 缓存策略完整性 | — | — | ⚠️ AGENT_SPEC 缺 2 条目 | F5-48 |

---

## 六、安全性专项审计

| 编号 | 威胁类型 | 严重度 | 位置 | 现状 |
|------|---------|--------|------|------|
| F5-16 | DNS Rebinding SSRF | 🟡 | TECHNICAL_SPEC §5.2 | validate_api_base 对域名直接放行 |
| F5-17 | 路径遍历 | 🟡 | TECHNICAL_SPEC §6.3 | read_source_file 参数无校验 |
| F5-18 | 权限绕过 | 🟡 | TECHNICAL_SPEC §2.2/§6.2 | agent_permissions 字段形同虚设 |
| F5-28 | 暴力破解 | 🟡 | PRD §4.2 | 登录接口无失败次数限制 |
| F5-29 | 数据膨胀/隐私 | 🟡 | AGENT_PRD §3.2 | extensions 无界写入 |
| F5-32 | 隐私合规 (GDPR) | 🟡 | AGENT_PRD §3.3 | 静默提取用户信息无知情同意 |

---

## 七、修复优先级建议

### 第一优先级：开工前必修（约 4-6 小时）

**A. 代码示例运行时正确性（~2h）**
1. F5-01: LLMChunk 添加 type + tool_call 字段
2. F5-02: Message 添加 tool_call_id 字段
3. F5-11: Message 添加 to_dict() 方法
4. F5-12: ToolResult 添加 preview() + to_string()
5. F5-13: 补充 StreamCollector 类定义

**B. PRD 层矛盾修复（~1h）**
6. F5-03: PRD §1 补充 Hub Agent
7. F5-04: 统一图谱性能指标
8. F5-05: 修正 GitHub 绑定为 PAT only
9. F5-06: 修正跨文档引用路径

**C. 跨文档同步（~1h）**
10. F5-07: AGENT_SPEC 补充 IntentResult/SubIntent
11. F5-08: AGENT_SPEC 补充 3 个缺失工具定义
12. F5-10: AGENT_SPEC AgentDefinition 同步 capabilities

### 第二优先级：Phase 1 前（约 3-4 小时）

13. F5-14/15: project_tags UNIQUE + Tag user_id
14. F5-16/17: SSRF DNS Rebinding 标注 + 路径遍历校验
15. F5-18: agent_permissions 运行时校验或标注 v1.1+
16. F5-21: LearningPreferences.style 枚举统一
17. F5-24/25: MVP_SCOPE 遗留描述修正
18. F5-26/27: 验收标准 + 便捷端点规格

### 第三优先级：开发过程中

19-58: 剩余 🟢 级问题，按开发进度逐步修复

---

## 八、与历史审查的对比

| 审查轮次 | 日期 | 发现数 | 核心关注层 | 特征 |
|---------|------|--------|-----------|------|
| 第一轮 | 07-03 | 36 | PRD/SPEC 基础 | 字段名、路径、重复内容 |
| 第二轮 | 07-03 | 15+ | SPEC 细节 | 代码定义、接口一致性 |
| 第三轮 | 07-04 | 24 | 安全性 + 技术完整性 | SSRF、加密、SSE、工具缺失 |
| 第四轮 | 07-04 | 25 | SPEC 层深度 | 核心类型缺失、代码重复、校验挂载 |
| **第五轮（本轮）** | **07-04** | **58** | **全栈深度** | **PRD 矛盾 + 代码运行时正确性 + 深层安全盲区** |

**趋势分析:**
- 基础冲突（字段名、路径、重复内容）已基本消除
- SPEC 层的类型定义和校验挂载基本到位（第 4 轮修复率 92%）
- 本轮发现的 58 项中，约 40% 是前 4 轮未覆盖的**新维度**（PRD 内部矛盾、代码示例运行时错误、深层安全盲区）
- 剩余问题以 🟢 级为主（23/58），核心修复集中在 10 项 🔴

---

## 九、结论

| 审查维度 | 得分 (1-5) | 变化 | 关键结论 |
|---------|-----------|------|---------|
| 规范性 | 3.5 | ↑0.5 | 决策追溯和类型体系改善，但仍有 dataclass 装饰器遗漏和格式损坏 |
| 现代性 | 5 | — | 技术栈全部为现代最佳实践（维持） |
| 可行性 | 3 | ↑1 | 核心类型基本补充，但 LLMChunk/Message 字段遗漏导致代码示例不可执行 |
| 合理性 | 4 | — | v1.0 范围清晰，OAuth/PAT 矛盾修复后可开工 |
| 冲突一致性 | 3 | ↑1 | SPEC 间同步改善，但 AGENT_SPEC 仍落后于 TECHNICAL_SPEC（capabilities、IntentResult） |
| 安全性 | 3.5 | ↑0.5 | SSRF 校验挂载、PromptGuard 可配置等已到位，DNS Rebinding 和路径遍历是新盲区 |
| 技术完整性 | 3 | ↑1 | 第 4 轮修复到位率高，但代码示例的运行时正确性仍有硬伤 |

**最终建议:** 完成第一优先级的 12 项修复（约 4-6 小时）后可进入 Phase 1 开发。最关键的 5 项：

1. LLMChunk + Message 核心字段补充（F5-01/F5-02）— 运行时必崩
2. PRD OAuth/PAT 矛盾修复（F5-05）— 需求范围歧义
3. 3 个缺失工具定义补充（F5-08）— Agent 实现阻塞
4. AGENT_SPEC 同步 capabilities + IntentResult（F5-07/F5-10）— 跨文档漂移
5. PRD 内部矛盾修复（F5-03/F5-04）— 第一印象和验收判定

---

*报告结束。所有编号可直接引用（如"修复 F5-01"）。*
