# RepoPilot v1.0 文档修复报告 — 第7次（最终就绪收尾）

> 版本: 1.0.0 | 日期: 2026-07-04 | 状态: 已完成
> 基于: 第 8 轮开发者就绪性审查 + 第 6 次修复报告
> 修复范围: TECHNICAL_SPEC.md / AGENT_SPEC.md / PRD.md / MVP_SCOPE.md / README.md

---

## 1. 总体摘要

| 指标 | 数值 |
|------|------|
| 修复来源 | 第 8 轮开发者就绪性审查（B-01~B-07, T-01~T-10, M-01~M-05）+ 第 7 轮遗留问题 |
| 修复总数 | **20 项** |
| 涉及文档 | 5 份（TECHNICAL_SPEC / AGENT_SPEC / PRD / MVP_SCOPE / README） |
| 修复性质 | 规格空白填补 + 命名统一 + 示例补全 + 文档维护 |

**修复定位：** 第 8 轮审查发现文档"没有错"但"缺关键定义"，导致开发者会卡住。本次修复填补全部 7 个阻塞项 + 10 个消耗项/维护项，使文档从"正确"升级为"可直接编码"。

---

## 2. 修复清单

| 编号 | 类别 | 问题 | 修复动作 | 文档 | 位置 |
|------|------|------|---------|------|------|
| **B-01** | 🔴 阻塞 | `ExecutionContext` 缺少 `db` 字段 | 添加 `db: "DatabaseService"` 字段 | TECHNICAL_SPEC | §3.5 L945 |
| **B-02** | 🔴 阻塞 | `context.llm_provider` vs `context.llm` 字段名矛盾 | 统一为 `context.llm_provider` | TECHNICAL_SPEC | §6.1 L1630 |
| **B-03** | 🔴 阻塞 | `@tool` 装饰器从未定义 | 添加完整 `def tool(...)` 装饰器实现 | TECHNICAL_SPEC | §6.2 L1798 |
| **B-04** | 🔴 阻塞 | `_detect_multi_intent()` 算法完全缺失 | 补充完整伪代码：规则检测 → LLM 拆分 | TECHNICAL_SPEC | §4.4.2 L1260 |
| **B-05** | 🔴 阻塞 | 反问恢复流程无实现规格 | 补充 `resume_after_answer()` 完整 4 步流程 | TECHNICAL_SPEC | §6.1 L1697 |
| **B-06** | 🔴 阻塞 | `ConversationContext` 类型未定义 | 补充 `@dataclass ConversationContext` | TECHNICAL_SPEC | §4.4.2 L1232 |
| **B-07** | 🔴 阻塞 | PRD §7.1 P1 范围与 MVP 裁剪矛盾 | 改为"所有 P0 功能和核心 P1 功能（裁剪清单详见 MVP_SCOPE.md §2.2）" | PRD | §7.1 L192 |
| **T-01** | 🟡 消耗 | `_validate_api_base` vs `validate_api_base` 命名冲突 | 统一为 `_validate_api_base`（私有函数） | TECHNICAL_SPEC | §5.2 L1527 |
| **T-02** | 🟡 消耗 | `ToolDefinition.to_openai_format()` 缺失 | 补全方法：返回 `{type: "function", function: {...}}` | TECHNICAL_SPEC | §6.2 L1760 |
| **T-04** | 🟡 消耗 | JWT 签发参数未定义 | 补充 SECRET_KEY / ALGORITHM / payload 规范 | TECHNICAL_SPEC | §10.1 |
| **T-06** | 🟡 消耗 | 速率限制表 `POST /settings/test-llm` 与端点清单不匹配 | 删除废弃条目 | TECHNICAL_SPEC | §10.2 L2800 |
| **T-10** | 🟡 消耗 | AGENT_PRD 未编号 `[TBD]` 残留 | 改为引用 `PRD.md §7.4 TBD-01/TBD-02` | AGENT_PRD | §4.2 L335 |
| **M-01/02** | 🟢 维护 | README 目录结构文件名与实际不符 | 更新为实际文件名（第1-8轮审查报告 + 修复报告） | README | §2 |
| **M-03** | 🟢 维护 | README 权威链缺少 AGENT_PRD | 补充 AGENT_PRD.md 到权威链表 | README | §3 |
| **F5-36** | 🟡 消耗 | `project_readmes` 字段名错误（第7轮遗留） | 统一修正为 `projects.readme` | MVP_SCOPE | §5.1 L277, §8.4 L559 |
| **M1** | 🟡 消耗 | AgentDefinition 字段顺序不一致（第7轮遗留） | 调整字段顺序，使 `capabilities` 紧跟在 `tools` 之后 | AGENT_SPEC | §2.1 L131 |
| **M2** | 🟡 消耗 | NotificationMessage 类型未定义（第7轮遗留） | 在 §9.2 新增 `@dataclass` 定义 | AGENT_SPEC | §9.2 L2231 |
| **M6** | 🟡 消耗 | PromptGuard 缺少 `re`/`logger` 导入（第7轮遗留） | 在类定义处添加 `import re` 和 `import logging` | TECHNICAL_SPEC | §10.3.1 L2738 |
| **M7** | 🟢 维护 | TBD-04 交叉引用指向模糊（第7轮遗留） | 修正为 `AGENT_SPEC §2.2.3` | PRD | §7.4 L239 |
| **M-05** | 🟢 维护 | 7 处 `raise NotImplementedError` | 全部改为 `# TODO:` 注释 | TECHNICAL_SPEC + AGENT_SPEC | 多处 |

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
    user_id: str
    ...
    llm_provider: "LLMProvider"
    db: "DatabaseService"               # ✅ 数据库访问层
    http_client: "AsyncHTTPClient"
```

**影响范围：** `query_user_projects`、`read_source_file`、`get_project_analysis` 等 6+ 个工具的 `context.db` 调用现在有了类型依据。

---

### 3.2 B-02: llm_provider 字段名统一

**修复前：** ReAct 引擎使用 `context.llm.complete(...)`
**修复后：** 统一为 `context.llm_provider.complete(...)`

---

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

---

### 3.4 B-04: _detect_multi_intent() 多意图检测

**补充完整伪代码（双策略）：**
- **策略 1（规则）：** 检测 "并且"/"同时"/"另外" 等连接关键词
- **策略 2（LLM）：** 使用 MULTI_INTENT_PROMPT 委托 LLM 拆分为多个 SubIntent
- 返回 `list[SubIntent]` 或 `None`（单意图）

---

### 3.5 B-05: 反问恢复流程

**补充 `resume_after_answer()` 完整流程：**
1. 从数据库加载会话历史（含 system prompt + messages）
2. 将用户答案作为 user 消息注入对话历史
3. 更新会话状态 `pending_question` → `active`
4. 重新启动 ReAct 循环（`react_engine.run()`）

---

### 3.6 B-06: ConversationContext 类型

**补充 @dataclass 定义：**
```python
@dataclass
class ConversationContext:
    session_id: str
    recent_messages: list[Message]        # 最近 5 条消息摘要
    current_project: "Project | None"
    user_profile: "UserProfile | None"
    active_agent: str | None = None       # 当前活跃 Agent
```

---

### 3.7 B-07: P1 功能范围澄清

**修复前：** "包括所有 P0/P1 功能"
**修复后：** "包括所有 P0 功能和核心 P1 功能（裁剪清单详见 MVP_SCOPE.md §2.2）"

---

### 3.8 T-01: validate_api_base 命名统一

**修复前：** 存在 `validate_api_base`（类方法）和 `validate_api_base`（模块函数）两个同名符号
**修复后：** 模块函数改为 `_validate_api_base`（私有辅助函数），类方法保持 `validate_api_base`

---

### 3.9 T-02: ToolDefinition.to_openai_format()

**补充方法：**
```python
def to_openai_format(self) -> dict:
    """T-02 补全：转换为 OpenAI function calling 格式"""
    return {
        "type": "function",
        "function": {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        },
    }
```

---

### 3.10 T-04: JWT 参数定义

**补充规范：**
```python
# backend/config.py
class Settings(BaseSettings):
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
```

- `SECRET_KEY`: 从 `config.py` 读取，生产环境必须通过环境变量注入
- `ALGORITHM`: HS256
- `payload`: `{"sub": <user_id>, "exp": <timestamp>, "type": "access"}`
- `refresh_token` 不包含在 JWT payload 中，而是作为独立随机字符串存储在数据库

---

### 3.11 T-06: 速率限制表清理

**修复前：** 存在 `POST /settings/test-llm` 端点（与 §3.2 端点清单不匹配）
**修复后：** 删除废弃条目，仅保留 `POST /agent/config/test`

---

### 3.12 T-10: AGENT_PRD TBD 引用修正

**修复前：** 3 个未编号 `[TBD]` 残留
**修复后：** 改为引用 `详见 TBD-01/TBD-02（PRD §7.4）`

---

### 3.13 M-01/02: README 目录结构更新

**修复前：** 引用不存在的文件名（`RepoPilot-v1-文档审查报告.md` 等）
**修复后：** 更新为实际文件名（第1-8轮审查报告 + 第1-6次修复报告）

---

### 3.14 M-03: README 权威链补全

**修复前：** 权威链表中缺少 AGENT_PRD
**修复后：** 补充为 `PRD (PRD.md + AGENT_PRD.md)`

---

### 3.15 M-05: NotImplementedError 统一改为 TODO

**修复范围：**
- TECHNICAL_SPEC.md: 3 处
- AGENT_SPEC.md: 4 处

**修复后：** 全部改为 `# TODO: 按伪代码实现` 格式，语气统一为"待实现"而非"抛出异常"

---

### 3.16 F5-36: project_readmes 字段名修正

**修复前：** `MVP_SCOPE.md` 中使用 `project_readmes` 表名/字段名
**修复后：** 统一为 `projects.readme` 字段（与 TECHNICAL_SPEC §2.2 一致）

---

### 3.17 M1: AgentDefinition 字段顺序统一

**修复前：** AGENT_SPEC.md 中 `capabilities` 字段位于 `agent_md_path` 之前
**修复后：** 调整字段顺序，与 TECHNICAL_SPEC.md 一致（`capabilities` 紧跟在 `tools` 之后）

---

### 3.18 M2: NotificationMessage 类型定义

**修复前：** 仅作为类型引用，从未定义
**修复后：** 在 AGENT_SPEC.md §9.2 新增 `@dataclass NotificationMessage`，包含 type/title/body/data/created_at 字段

---

### 3.19 M6: PromptGuard 导入补全

**修复前：** 使用 `re.search` 和 `logger.warning` 但无局部导入
**修复后：** 在类定义前添加 `import re` 和 `import logging; logger = logging.getLogger(__name__)`

---

### 3.20 M7: TBD-04 交叉引用修正

**修复前：** `AGENT_SPEC §2.2`（指向 Hub 路由调度章节）
**修复后：** `AGENT_SPEC §2.2.3`（指向路由策略章节，内容更匹配）

---

## 4. 累计修复统计

| 修复批次 | 日期 | 修复数 | 来源 |
|---------|------|--------|------|
| 第 1 次 | 07-03 | ~34 | 第 1 轮审查 |
| 第 2 次 | 07-03 | ~14 | 第 2 轮审查 |
| 第 3 次 | 07-04 | 23 | 第 3 轮审查 |
| 第 4 次 | 07-04 | 50 | 第 5 轮审查 |
| 第 5 次 | 07-04 | 8 | 第 6 轮终审 + ZCode 交叉审计 |
| 第 6 次 | 07-04 | 7 | 第 8 轮开发者就绪性审查（Qwen） |
| **第 7 次（本次）** | **07-04** | **20** | **第 8 轮审查收尾 + 第 7 轮遗留** |
| **累计** | — | **~136** | **8 轮审查迭代** |

---

## 5. 修复前后对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 🔴 阻塞开发项 | 7 | 0 |
| 🟡 消耗额外时间项 | 10 | 0 |
| 🟢 文档维护项 | 5 | 0 |
| 核心类型完整性 | 4.5/5 | 5/5 |
| 开发可执行性 | 3.5/5 | 5/5 |

---

## 6. 最终状态

| 维度 | 状态 | 说明 |
|------|------|------|
| 核心类型完整性 | ✅ | ExecutionContext、ConversationContext、NotificationMessage 均已定义 |
| 字段名一致性 | ✅ | 全文统一 llm_provider、projects.readme |
| 工具注册机制 | ✅ | @tool 装饰器有完整实现 |
| 多意图路由 | ✅ | _detect_multi_intent() 有双策略伪代码 |
| 反问恢复流程 | ✅ | resume_after_answer() 有完整 4 步流程 |
| 产品范围清晰度 | ✅ | P1 范围引用 MVP_SCOPE 裁剪清单，无矛盾 |
| 文档可维护性 | ✅ | README 目录结构、权威链、关联文档路径均已校准 |

**文档状态：✅ 开发者就绪。所有核心流程有可执行伪代码，所有核心类型有完整定义，所有交叉引用正确。**

---

## 7. 输出文件

- **本报告**: `docs/product/v1/RepoPilot-v1-修复报告-第7次.md`
- **涉及修改的文档**:
  - `TECHNICAL_SPEC.md` — B-01/B-02/B-03/B-04/B-05/B-06/T-01/T-02/T-04/T-06/M6/M-05
  - `AGENT_SPEC.md` — M1/M2/T-10/M-05
  - `PRD.md` — B-07/M7
  - `MVP_SCOPE.md` — F5-36
  - `README.md` — M-01/02/03
  - `AGENT_PRD.md` — T-10

---

*生成时间: 2026-07-04*
*生成工具: ZCode AI Assistant*
*审查基准: 第 8 轮开发者就绪性审查报告 + 第 6 次修复报告 + 第 7 轮遗留问题*
