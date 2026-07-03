# RepoPilot v1.0 — 第 8 轮审核报告（开发者就绪性审查）

> 审核日期: 2026-07-04
> 审核范围: PRD.md, AGENT_PRD.md, TECHNICAL_SPEC.md, AGENT_SPEC.md, MVP_SCOPE.md, README.md
> 审核性质: **开发者就绪性审查** — 判断"读完文档能否立刻开始写代码"

---

## 〇、总体评估

本轮审查采用全新视角——不再是"文档有没有错"，而是**"开发者打开文档后会不会卡住"**。3 路审核员分别模拟后端开发者、Agent 系统开发者、产品理解者通读全部 6 份文档。

**发现统计:**

| 类型 | 数量 | 说明 |
|------|------|------|
| 🔴 阻塞开发 | 7 | 开发者会直接卡住，需要猜或无法编译 |
| 🟡 消耗额外时间 | 10 | 不阻塞但迫使开发者做额外决策 |
| 🟢 文档维护 | 5 | 不影响开发，影响文档可信度 |

**与前 7 轮的区别:** 前 7 轮修复了 ~137 项"文档错误"（字段缺失、类型矛盾、引用错误）。本轮发现的 7 个阻塞项全部是**"规格空白"**——文档没有错，但缺少关键定义，开发者必须自行设计。

---

## 一、🔴 阻塞开发项（7 项）

### B-01: ExecutionContext 缺少 `db` 字段 — 所有数据库工具无法编译

**位置:** TECHNICAL_SPEC.md §3.5 L936-948 vs §6.3 L1754+

**现状:** `ExecutionContext` dataclass 定义了 `user_id, session_id, agent_id, project_id, memory_service, llm_provider, http_client, github, tool_registry, metadata` 共 10 个字段。但 AGENT_SPEC §4.3 中至少 6 个工具直接调用 `context.db.query_projects()`、`context.db.get_project()`、`context.db.get_latest_analysis()` 等方法。

**开发影响:** 开发者按 §3.5 定义写代码后，所有工具实现 `context.db` 直接 AttributeError。

**修复:** 在 ExecutionContext 中添加 `db: "DatabaseService"` 字段。

---

### B-02: `context.llm_provider` vs `context.llm` 字段名矛盾

**位置:** TECHNICAL_SPEC.md §3.5 L944 vs §6.1 L1590

**现状:** ExecutionContext 定义字段名为 `llm_provider: "LLMProvider"`，但 ReAct 引擎代码中使用 `context.llm.complete(...)`。两处名字不同。

**开发影响:** 开发者复制 §3.5 定义后，§6.1 代码报 AttributeError。必须猜哪个是正确的。

**修复:** 统一为 `llm_provider`，§6.1 改为 `context.llm_provider.complete(...)`。

---

### B-03: `@tool` 装饰器从未定义 — 14 个工具无法注册

**位置:** TECHNICAL_SPEC.md §6.2-6.3 / AGENT_SPEC.md §4.2-4.3

**现状:** `@tool(name=, description=, parameters=, allowed_agents=, timeout_ms=)` 在全部 14+ 个工具上使用，但从未定义其实现。开发者不知道：装饰器放在哪个模块？是否自动调用 ToolRegistry.register()？参数签名是否与 ToolDefinition 一一对应？

**开发影响:** 这是工具注册的核心机制。没有它，开发者不知道工具如何被发现和执行。

**修复:** 在 §6.2 ToolRegistry 之后补充 @tool 装饰器的 10 行实现骨架：

```python
def tool(name: str, description: str, parameters: dict,
         allowed_agents: list[str], timeout_ms: int = 30000):
    def decorator(func):
        definition = ToolDefinition(
            name=name, description=description,
            parameters=parameters, handler=func,
            allowed_agents=allowed_agents, timeout_ms=timeout_ms
        )
        ToolRegistry.register(definition)
        return func
    return decorator
```

---

### B-04: `_detect_multi_intent()` 算法完全缺失

**位置:** TECHNICAL_SPEC.md §4.4.2 L1242 / AGENT_SPEC.md §2.2.1 L262

**现状:** `IntentClassifier.classify()` 第二步调用 `self._detect_multi_intent(message)`，但两份文档中都没有任何实现或伪代码。同时 `INTENT_PROMPT` 只返回单个 agent 结果，无法产出多意图。

**开发影响:** Hub 多 Agent 编排是核心路由路径，此方法缺失意味着多意图场景无法工作。

**修复:** 补充伪代码（两种策略）：
```python
async def _detect_multi_intent(self, message: str) -> list[SubIntent] | None:
    """检测消息是否包含多个意图
    策略 1 (规则): 检查连接词 ("并且"/"同时"/"另外")，命中则进入策略 2
    策略 2 (LLM): 调用 INTENT_PROMPT_MULTI 模板，返回多个 SubIntent
    返回 None 表示单意图
    """
    MULTI_KEYWORDS = ["并且", "同时", "另外", "还有", "以及", "并帮我"]
    if not any(kw in message for kw in MULTI_KEYWORDS):
        return None
    # 委托 LLM 拆分
    result = await self.llm.complete(INTENT_PROMPT_MULTI.format(message=message))
    return [SubIntent(**item) for item in result.sub_intents]
```

---

### B-05: 反问恢复流程（Question Resume）无实现规格

**位置:** TECHNICAL_SPEC.md §8.1.2 / AGENT_SPEC.md §4.1 L651

**现状:** ReAct 引擎在 `question_pending=True` 时直接 return 退出。但 `POST /agent/question` 收到用户回答后，以下流程完全缺失：
- 如何从数据库恢复 ReAct 执行上下文（ExecutionContext、messages 列表、当前迭代计数）？
- 用户答案以什么格式注入 messages（作为 user 消息？tool 消息？）？
- 如何重新启动 ReAct 循环？
- 会话状态何时从 pending_question 回到 active？

**开发影响:** 反问是 Mentor/Navigator 的核心交互，开发者无法知道 `/agent/question` 端点的后端实现。

**修复:** 补充 QuestionService.resume_after_answer() 伪代码：
```python
async def resume_after_answer(self, session_id, answer_data):
    session = await self.db.get_session(session_id)
    # 1. 恢复上下文
    messages = await self.db.get_messages(session_id)  # 含历史 + system prompt
    # 2. 注入答案（作为 user 消息）
    messages.append(Message(role="user", content=answer_data.answer))
    # 3. 更新会话状态
    session.status = "active"
    # 4. 继续 ReAct 循环（从上次中断处）
    async for event in self.react_engine.run(session, messages, context):
        yield event
```

---

### B-06: `ConversationContext` 类型未定义

**位置:** TECHNICAL_SPEC.md §4.4.2 L1227

**现状:** `IntentClassifier.classify(message, context: ConversationContext)` 的第二个参数类型为 `ConversationContext`，但此类型在整个文档中从未定义。`Session`、`ExecutionContext` 都不是这个名字。

**开发影响:** 开发者不知道传入的对象结构，无法实现 IntentClassifier。

**修复:** 两种方案任选：(a) 改为 `context: Session`（如果就是 Session 的引用）；(b) 补充 ConversationContext 定义：
```python
@dataclass
class ConversationContext:
    session_id: str
    recent_messages: list[Message]  # 最近 N 条消息摘要
    current_project: "Project | None"
    user_profile: "UserProfile | None"
```

---

### B-07: PRD §7.1 P1 功能范围矛盾 — 开发者不知道哪些 P1 必须做

**位置:** PRD.md §7.1 L192 vs MVP_SCOPE.md §2.2 L60-64

**现状:** PRD §7.1 写"包括**所有 P0/P1 功能**"，但 MVP_SCOPE §2.2 将多个 P1 功能推迟到 v1.1（文件上传头像、JSON 导入、列表/卡片双视图、笔记搜索）。按权威链 PRD > MVP，PRD 说全做，MVP 说裁剪——矛盾。

**开发影响:** 开发者不知道 P1 功能到底做不做。

**修复:** 修改 PRD §7.1 为"包括所有 P0 功能和核心 P1 功能（裁剪清单详见 MVP_SCOPE.md §2.2）"。

---

## 二、🟡 消耗额外时间项（10 项）

| 编号 | 位置 | 问题 | 建议 |
|------|------|------|------|
| T-01 | TECHNICAL_SPEC §5.2 L1416 vs L1487 | `_validate_api_base`（带下划线）vs `validate_api_base`（无下划线）函数名不一致 | 统一为 `_validate_api_base` |
| T-02 | TECHNICAL_SPEC §6.2 L1676 | `ToolDefinition.to_openai_format()` 被 §5.1 调用但未定义 | 补充方法骨架，返回 `{type: "function", function: {name, description, parameters}}` |
| T-03 | TECHNICAL_SPEC §3.2 | 40+ 个 API 端点中仅 3 个有请求/响应示例 | 至少为 Auth 7 个端点和 Projects CRUD 补充 JSON 示例 |
| T-04 | TECHNICAL_SPEC §10.1 | JWT 签发参数未定义（SECRET_KEY 来源、payload 字段、ALGORITHM） | 补充 JWT payload 清单 + SECRET_KEY 从 Settings 读取 |
| T-05 | TECHNICAL_SPEC §2.2 | Project/User/Note 等表无 Python ORM 模型定义 | 至少为核心表补充 SQLAlchemy model 骨架 |
| T-06 | TECHNICAL_SPEC §11.3 L2690 | 速率限制表中 `POST /settings/test-llm` 与 §3.2 端点清单不匹配 | 删除或标注已废弃 |
| T-07 | AGENT_SPEC §7.4 | 仅 mentor 有完整 config.yaml 示例，其余 5 个 Agent 缺失 | 补充 scout/hub 的 config.yaml |
| T-08 | AGENT_SPEC §2.1 | `capabilities: list[str]` 字段从未给出任何 Agent 的实际值 | 在 config.yaml 中补充 capabilities 示例值 |
| T-09 | MVP_SCOPE L37/L517 | 引用了不存在的 PRD §3.3.7（降级方案实际在 AGENT_PRD §8） | 改为引用 AGENT_PRD §8 |
| T-10 | AGENT_PRD L336-338 | 3 个未编号 [TBD] 残留，PRD §7.4 已有编号 TBD-01/02 | 改为引用 `详见 TBD-01/TBD-02（PRD §7.4）` |

---

## 三、🟢 文档维护项（5 项）

| 编号 | 位置 | 问题 |
|------|------|------|
| M-01 | README §2 | 审查报告文件名全部不匹配（旧日期格式 vs 实际"第X轮"格式） |
| M-02 | README §8 | 关联文档路径指向不存在的文件 |
| M-03 | README §3 | 权威链缺少 AGENT_PRD 的位置 |
| M-04 | PRD §7.2 | 交付范围表遗漏 Scribe/Curator 等实际在 v1.0 的功能 |
| M-05 | AGENT_SPEC §4.3 | 4 个工具仍有 `raise NotImplementedError`（伪代码已充分，建议改为 `# TODO: 按伪代码实现`） |

---

## 四、跨文档开发者体验矩阵

| 开发者任务 | 所需文档 | 信息是否完整 | 阻塞编号 |
|-----------|---------|------------|---------|
| 搭建 FastAPI 项目骨架 | TECHNICAL_SPEC §1-3 + MVP §10 | ✅ 完整 | — |
| 实现数据库 Schema | TECHNICAL_SPEC §2.2 | ⚠️ 缺 ORM 模型 | T-05 |
| 实现认证系统 | TECHNICAL_SPEC §10.1 | ⚠️ 缺 JWT 参数细节 | T-04 |
| 实现 API Router | TECHNICAL_SPEC §3.2 | ⚠️ 缺请求/响应体 | T-03 |
| 实现 ToolRegistry + @tool | TECHNICAL_SPEC §6.2 + AGENT_SPEC §4.2 | ❌ @tool 未定义 | B-03 |
| 实现 IntentClassifier | TECHNICAL_SPEC §4.4.2 + AGENT_SPEC §2.2.1 | ❌ 多意图缺失 | B-04, B-06 |
| 实现 ReAct 引擎 | TECHNICAL_SPEC §6.1 + AGENT_SPEC §4.1 | ⚠️ 字段名矛盾 | B-01, B-02 |
| 实现反问系统 | TECHNICAL_SPEC §8 + AGENT_SPEC §6 | ❌ 恢复流程缺失 | B-05 |
| 实现 14 个工具 | AGENT_SPEC §4.3 | ✅ 参数 Schema 完整 | — |
| 实现 UserProfile CRUD | TECHNICAL_SPEC §2.3 + §7.3 | ✅ 完整 | — |
| 实现 SSE 流式输出 | TECHNICAL_SPEC §11.3 | ✅ 完整 | — |
| 实现前端 UI | TECHNICAL_SPEC §12 + MVP §8 | ✅ 完整 | — |
| 确定 v1.0 功能范围 | PRD §7 + MVP §2 | ❌ P1 矛盾 | B-07 |

---

## 五、修复优先级建议

### 第一优先级：开工前必修（~2 小时）

1. **B-01 + B-02**: ExecutionContext 添加 `db` 字段 + 统一 `llm_provider` 字段名
2. **B-03**: 补充 @tool 装饰器 10 行实现
3. **B-04**: 补充 _detect_multi_intent() 伪代码
4. **B-05**: 补充反问恢复流程伪代码
5. **B-06**: 明确 ConversationContext 类型
6. **B-07**: 修正 PRD §7.1 P1 范围描述

### 第二优先级：Phase 1 第一周（~3 小时）

7. **T-01 ~ T-06**: 函数名统一、API 示例补充、JWT 参数
8. **T-07 ~ T-10**: config.yaml 补全、引用修正、TBD 清理

### 第三优先级：开发过程中

9. **M-01 ~ M-05**: README 校准、交付表补全

---

## 六、与历史审查的对比

| 审查轮次 | 视角 | 发现类型 | 🔴 数量 |
|---------|------|---------|---------|
| 第 1-3 轮 | 文档正确性 | 字段错误、路径错误、冲突 | 基础冲突 ~30 |
| 第 4-5 轮 | 技术完整性 | 类型缺失、安全校验未挂载 | 核心类型 ~15 |
| 第 6-7 轮 | 修复验证 | 修复是否到位 | 0（全部修复） |
| **第 8 轮（本轮）** | **开发者就绪性** | **规格空白、实现细节缺失** | **7** |

**趋势:** 文档的"正确性"已经过关（前 7 轮），但"可执行性"仍有 7 个缺口。这些缺口的共同特征是：文档描述了"应该有什么"，但没有给出"怎么实现"——而开发者需要的恰恰是后者。

---

## 七、结论

| 维度 | 得分 | 说明 |
|------|------|------|
| 架构清晰度 | 5/5 | 分层、路由、降级、BYOK 设计优秀 |
| 类型完整性 | 4.5/5 | 核心类型齐全，ExecutionContext 有小缺陷 |
| API 规格完整性 | 3/5 | Agent 端点完整，但 Auth/Projects 端点缺请求/响应示例 |
| 工具系统完整性 | 4/5 | 14 个工具参数 Schema 完整，@tool 装饰器需补充 |
| 安全规格完整性 | 4.5/5 | 防护全面，JWT 参数细节可补充 |
| 开发可执行性 | 3.5/5 | 主流程可执行，反问恢复 + 多意图分类是最大缺口 |
| 产品需求清晰度 | 4/5 | 范围清晰，P1 矛盾修复即可 |

**最终判定:** 修复 B-01 ~ B-07 共 7 项后（约 2 小时），文档达到**开发者就绪**状态。这些修复全部是"补充一段伪代码"或"添加一个字段"级别的小改动，不涉及架构变更。

---

*报告结束。所有编号可直接引用。*
