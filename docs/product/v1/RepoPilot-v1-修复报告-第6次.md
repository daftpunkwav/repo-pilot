# RepoPilot v1.0 文档修复报告 — 第6次（开发者就绪性收尾）

> 版本: 1.0.0 | 日期: 2026-07-04 | 状态: 已完成
> 基于: 第 8 轮审核报告（开发者就绪性审查，7 项阻塞）
> 修复范围: TECHNICAL_SPEC.md / PRD.md

---

## 1. 总体摘要

| 指标 | 数值 |
|------|------|
| 修复来源 | 第 8 轮开发者就绪性审查 B-01 ~ B-07 |
| 修复总数 | **7 项** |
| 涉及文档 | 2 份（TECHNICAL_SPEC / PRD） |
| 修复性质 | 规格空白填补（伪代码 + 类型定义 + 范围澄清） |

**修复定位：** 第 8 轮审查发现文档"没有错"但"缺关键定义"，导致开发者会卡住。本次修复填补全部 7 个规格空白，使文档从"正确"升级为"可直接编码"。

---

## 2. 修复清单

| 编号 | 问题 | 修复动作 | 文档 | 位置 |
|------|------|---------|------|------|
| **B-01** | `ExecutionContext` 缺少 `db` 字段，6+ 个工具 `context.db` 报 AttributeError | 添加 `db: "DatabaseService"` 字段 | TECHNICAL_SPEC | §3.5 L943 |
| **B-02** | `context.llm_provider` vs `context.llm` 字段名矛盾 | ReAct 引擎 `context.llm` → `context.llm_provider` | TECHNICAL_SPEC | §6.1 L1590 |
| **B-03** | `@tool` 装饰器从未定义，14 个工具无法注册 | 添加完整 `def tool(...)` 装饰器实现（含 ToolDefinition 创建 + ToolRegistry.register 调用） | TECHNICAL_SPEC | §6.2 L1700+ |
| **B-04** | `_detect_multi_intent()` 算法完全缺失 | 补充完整伪代码：规则检测（连接关键词）→ LLM 拆分（MULTI_INTENT_PROMPT）→ 返回 `list[SubIntent]` | TECHNICAL_SPEC | §4.4.2 L1242+ |
| **B-05** | 反问恢复流程（Question Resume）无实现规格 | 补充 `resume_after_answer()` 完整伪代码：加载历史 → 注入答案 → 更新状态 → 重启 ReAct | TECHNICAL_SPEC | §6.1 L1652+ |
| **B-06** | `ConversationContext` 类型未定义 | 补充 `@dataclass ConversationContext`：session_id, recent_messages, current_project, user_profile, active_agent | TECHNICAL_SPEC | §4.4.2 L1226+ |
| **B-07** | PRD §7.1 "所有 P0/P1 功能" 与 MVP_SCOPE §2.2 裁剪清单矛盾 | 改为"所有 P0 功能和核心 P1 功能（裁剪清单详见 MVP_SCOPE.md §2.2）" | PRD | §7.1 L192 |

---

## 3. 修复详情

### 3.1 B-01: ExecutionContext.db 字段

**修复前：**
```python
@dataclass
class ExecutionContext:
    user_id: str
    ...
    llm_provider: "LLMProvider"
    http_client: "AsyncHTTPClient"  # ❌ 无 db 字段
```

**修复后：**
```python
@dataclass
class ExecutionContext:
    ...
    llm_provider: "LLMProvider"
    db: "DatabaseService"               # B-01 补全：数据库访问层
    http_client: "AsyncHTTPClient"
```

**影响范围：** `query_user_projects`、`read_source_file`、`get_project_analysis` 等 6+ 个工具的 `context.db` 调用现在有了类型依据。

### 3.2 B-02: llm_provider 字段名统一

**修复前：** ReAct 引擎使用 `context.llm.complete(...)`
**修复后：** 统一为 `context.llm_provider.complete(...)`

### 3.3 B-03: @tool 装饰器

**补充完整实现：**
```python
def tool(name: str, description: str, parameters: dict,
         allowed_agents: list[str], timeout_ms: int = 30000):
    """工具注册装饰器（B-03 补全）"""
    def decorator(func):
        definition = ToolDefinition(
            name=name, description=description,
            parameters=parameters, handler=func,
            allowed_agents=allowed_agents, timeout_ms=timeout_ms,
        )
        ToolRegistry.register(definition)
        return func
    return decorator
```

### 3.4 B-04: _detect_multi_intent() 多意图检测

**补充完整伪代码（双策略）：**
- **策略 1（规则）：** 检测 "并且"/"同时"/"另外" 等连接关键词
- **策略 2（LLM）：** 使用 MULTI_INTENT_PROMPT 委托 LLM 拆分为多个 SubIntent
- 返回 `list[SubIntent]` 或 `None`（单意图）

### 3.5 B-05: 反问恢复流程

**补充 `resume_after_answer()` 完整流程：**
1. 从数据库加载会话历史（含 system prompt + messages）
2. 将用户答案作为 user 消息注入对话历史
3. 更新会话状态 `pending_question` → `active`
4. 重新启动 ReAct 循环（`react_engine.run()`）

### 3.6 B-06: ConversationContext 类型

**补充 @dataclass 定义：**
```python
@dataclass
class ConversationContext:
    session_id: str
    recent_messages: list[Message]        # 最近 5 条消息摘要
    current_project: "Project | None"
    user_profile: "UserProfile | None"
    active_agent: str | None = None       # 连续对话时倾向保持
```

### 3.7 B-07: P1 功能范围澄清

**修复前：** "包括所有 P0/P1 功能"
**修复后：** "包括所有 P0 功能和核心 P1 功能（裁剪清单详见 MVP_SCOPE.md §2.2）"

消除了 PRD > MVP 权威链下"P1 全做"vs"P1 裁剪"的矛盾。

---

## 4. 累计修复统计

| 修复批次 | 日期 | 修复数 | 来源 |
|---------|------|--------|------|
| 第 1 次 | 07-03 | ~34 | 第 1 轮审查 |
| 第 2 次 | 07-03 | ~14 | 第 2 轮审查 |
| 第 3 次 | 07-04 | 23 | 第 3 轮审查 |
| 第 4 次 | 07-04 | 50 | 第 5 轮审查 |
| 第 5 次 | 07-04 | 8 | 第 6 轮终审 + ZCode 交叉审计 |
| **第 6 次（本次）** | **07-04** | **7** | **第 8 轮开发者就绪性审查** |
| **累计** | — | **~136** | **8 轮审查迭代** |

---

## 5. 最终状态

| 维度 | 状态 | 说明 |
|------|------|------|
| 核心类型完整性 | ✅ | ExecutionContext 含 db，ConversationContext 已定义 |
| 字段名一致性 | ✅ | 全文统一 llm_provider |
| 工具注册机制 | ✅ | @tool 装饰器有完整实现 |
| 多意图路由 | ✅ | _detect_multi_intent() 有双策略伪代码 |
| 反问恢复流程 | ✅ | resume_after_answer() 有完整 4 步流程 |
| 产品范围清晰度 | ✅ | P1 范围引用 MVP_SCOPE 裁剪清单 |

**文档状态：✅ 开发者就绪。所有核心流程有可执行伪代码，所有核心类型有完整定义。**

---

*生成时间: 2026-07-04*
*生成工具: QoderWork*
*审查基准: 第 8 轮开发者就绪性审查报告*
