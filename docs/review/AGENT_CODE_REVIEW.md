# RepoPilot Agent 核心审查报告

> ⚠️ **状态（2026-08-04）：** 本报告基线 `5ff949c`（2026-08-03）。此后：
> - 报告指出的 P0–P3 整改已随 `9bd682c` 落地（限流、message 上限、`run()`/`_handle_dispatches` 拆分、`question.py`、`AgentEngineConfig`、调度指纹 sha1 等）；
> - Agent 代码已物理迁入 `services/agent/agent_core/`（`8d73a8a`），文中 `services/api/backend/agents/*`、`backend/agents/*` 路径现为转发 shim，**行号已全部失效**；
> - 当前未决问题以 [`full-review-20260804.md`](./full-review-20260804.md)（v2.0 全量审查）为准。

> 审查范围:`services/api/backend/agents/`(`hub.py` 1642 行 / `react.py` 1462 行 / `registry.py` 421 行 / `intent.py` 144 行 / `think_stream.py` 136 行 / `__init__.py`)及其依赖契约(`llm/provider.py`、`tools/builtin.py`、`memory/context.py`、`services/sse_stream.py`、`api/agent.py`)。
> 审查日期:2026-08-03
> 基线 commit:`5ff949c`
> 目的:供廉价 AI 执行具体修改,故每条意见力求**可定位、无歧义、含目标改法**。

---

## 0. 总体评估

| 维度 | 评级 | 摘要 |
|------|------|------|
| 功能正确性 | 🟡 | 核心链路可跑,但"假完成/空承诺"类 bug 反复修(`fed1603`/`9a3498d`/`4340313`),说明根因未除;降级与异常路径脆弱 |
| 代码质量 | 🔴 | `react.py:run()` 666 行单方法、`hub.py:_handle_dispatches()` 353 行三分支重复,圈复杂度极高 |
| 规范性 | 🟡 | 命名一致、注释中文达标;但类型注解缺口大(`apply_*_mode`、`llm_config`、`history` 全无类型) |
| 可扩展性 | 🟡 | 注册表/工具白名单设计合理,但 workflow 分支硬编码、`SOULS`/`AGENT_DEFINITIONS` 字典散落,加 Agent 需改多处 |
| 可维护性 | 🔴 | 关键路径无单测(`run()`/`handle_chat()`/`_handle_dispatches` 主体零覆盖),重构即高风险 |
| 安全性 | 🟡 | 鉴权/越权/SSRF 已做;但 agent SSE 端点**无限流**、消息无长度上限、`dispatch_agent.task` 透传无清洗、`complete_json` 静默返空 |

**最高优先级的 3 个问题**(详 §1):
1. `ReActEngine.run` 与 `HubService._handle_dispatches` 必须拆分(§1.1)
2. agent SSE 端点无限流 + 消息无长度上限(§1.2)
3. 关键路径补单测(§1.3)

---

## 1. 高优先级问题(建议优先修改)

### 1.1 【结构】巨型方法必须拆分

**位置**:
- `services/api/backend/agents/react.py:377-1043`(`ReActEngine.run`,666 行)
- `services/api/backend/agents/hub.py:1206-1559`(`HubService._handle_dispatches`,353 行)
- `services/api/backend/agents/hub.py:861-1135`(`HubService._dispatch_evaluate_loop`,274 行)

**问题**:
- `run()` 内含:流式快路径、CoT 两阶段、Plan-Execute 规划、工具循环、plan_nudge 纠正、收口补写,6 个职责揉在一个 `while` 循环里,嵌套达 6-7 层(如 `react.py:619-648` 的 plan_nudge 块缩进至 35 空格)。
- `_handle_dispatches` 的 `direct`/`must_serial`/并行三分支**结构高度重复**:都是"发 subagent_start → `async for item in self._run_agent(...)` → `isinstance(item, EngineResult)` 取 text/question → 发 subagent_done → append expert_results/summaries → question 时 `append_short_memory`+`return`"。`_run_agent` 的 11 个参数列表在三处近乎逐字复制(对比 `hub.py:1284-1296` vs `1461-1473` vs `_run_one_silent`)。

**目标改法**:

(1) 把 `run()` 按工作流拆成多个内部方法,`run()` 只做分派:
```python
async def run(self, *, agent_def, ctx, messages, emit_sse=True):
    # 1. 降级检查
    # 2. 工具准备 + workflow_hint 注入
    # 3. 按 workflow 分派:
    if self._prefer_token_stream(agent_def, tools):
        if wf == "cot":
            return self._run_cot(...)
        return self._run_direct_stream(...)
    if wf in ("plan_execute","tot","reflexion"):
        messages = await self._run_plan_phase(...)
    return self._run_tool_loop(...)
```
每个被抽出的方法(`_run_direct_stream`/`_run_tool_loop`/`_run_closing_reply`)各 80-120 行,职责单一。

(2) 把 `_handle_dispatches` 三分支提取为一个公共协程:
```python
async def _dispatch_one(self, *, d, user, session_id, ..., stream_to_subagent: bool) -> DispatchOutcome:
    """执行单个专家调度,返回 (agent_id, text, question|None)。
    stream_to_subagent=True 时把 thinking/text_delta 转成 subagent_thinking/subagent_text。
    question/error SSE 由调用方或本方法按 emit 决定。"""
```
`direct`/`must_serial`/并行三分支退化为对该协程的调用编排(1 次 / 串行 N 次 / `gather` N 次)。

(3) `_dispatch_evaluate_loop` 中 9 个并列 `if bag.get(...)` 分支(`hub.py:919/927/960/995/1008/1051/1054/1071/1087`)是隐式状态机,建议把 `bag` 换成 `@dataclass DispatchRoundOutcome` 显式字段,分支改为 `match outcome.kind` 枚举。

**风险提示**:拆分前必须先有 §1.3 的单测兜底,否则极易引入回归。建议"先补测、后拆分"。

---

### 1.2 【安全】agent SSE 端点无限流 + 输入无长度上限

**位置**:
- `services/api/backend/routes/api/agent.py`(所有 handler 无 `@limiter.limit`,而 `auth.py` 有)
- `services/api/backend/schemas/agent.py:18`(`AgentChatBody.message: str = Field(..., min_length=1)` 无 `max_length`)
- `services/api/backend/schemas/agent.py:33`(`AgentQuestionAnswer.answers: Any` 完全无校验)

**问题**:
- agent 对话/分析 SSE 端点**未挂限流**(已确认 `main.py:96-99` 装了 slowapi,但 agent 路由未用)。任意已登录用户可高频调用,直接放大 LLM API 成本(每次对话触发多轮 LLM 调用 + 多专家 dispatch)。
- `message` 无 `max_length`,用户可传超长文本,直接进 LLM context + 数据库 short_memory。`hub.py:473` 把 `message[:80]` 写入 short_memory,但完整 message 进 LLM。
- `answers: Any` 完全无 schema,可传任意结构,最终 `json.dumps(answers)[:500]` 写入画像(`hub.py:506`)。

**目标改法**:
```python
# schemas/agent.py
class AgentChatBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)  # 加上限

class AgentQuestionAnswer(BaseModel):
    question_id: str
    answers: dict[str, Any] = Field(default_factory=dict)  # 至少收窄到 dict
    skipped: bool = False
```
```python
# routes/api/agent.py — 给每个 SSE handler 加限流
@router.post("/sessions/{session_id}/chat")
@limiter.limit("20/minute")  # 或按用户:用 user.id 作为 key
async def stream_chat(...): ...
```
注意 slowapi 对 SSE 的支持:限流应在响应建立前生效,若 slowapi 与 StreamingResponse 冲突,改用中间件层按 `user.id` 限频(如简单令牌桶)。

---

### 1.3 【可维护】关键路径补单测

**问题**:审查确认以下核心方法**几乎零直接测试覆盖**:
- `ReActEngine.run`(`react.py:377`)— 仅测了 `_prefer_token_stream`/`_effective_max_iter` 间接属性
- `HubService.handle_chat`(`hub.py:322`)、`handle_question_answer`(`hub.py:476`)、`handle_direct_agent`(`hub.py:562`)
- `HubService._handle_dispatches`(`hub.py:1206`)— `test_hub_evaluate_mode.py` 把它 monkeypatch 掉了,真实路径未测
- `HubService._orchestrate_multi`(`hub.py:642`)
- `_cot_two_phase_stream`(`react.py:129`)、`_plan_phase_to_thinking`(`react.py:279`)

git 历史显示"假完成/空承诺/思考正文混淆"类 bug 反复出现(`fed1603`/`9a3498d`/`4340313`/`4c0cca9`/`159e4e2`/`f216067`),正是这些未测路径的脆弱点。

**目标改法**(用 fake LLM + fake tool_registry):
1. **`run()` 工具循环**:构造 fake `LLMProvider`,依次返回"带 tool_call 的 result → 带 text 的 result",断言 `EngineResult.text`/`dispatches`/`iterations` 正确;覆盖:单轮无工具、单轮有工具、多轮工具、达到 max_iter、LLM 异常、降级(`llm.available=False`)。
2. **plan_nudge 纠正**:fake LLM 第一轮返回纯计划宣告文本,断言 `is_plan_announcement` 命中后追加纠正消息、`plan_nudge_used` 递增、第二轮正常输出。
3. **`_handle_dispatches` 三分支**:fake `_run_agent` 返回固定 `EngineResult`,分别测 direct(单专家流式转 subagent 事件)、must_serial(串行)、并行(gather),断言 `expert_results`/`summaries`/question 拦截/`result_bag` 标志位。
4. **`handle_chat` 主链路**:fake classifier + fake engine,断言 SSE 事件序列(thinking → agent_switch → text_delta → done)、force_agent 直达、chitchat 快路径、反问早返回。
5. **CoT 两阶段**:fake LLM 第一阶段返回 think_text、第二阶段返回正文,断言 thinking/text_delta 通道分流、`total_usage` 累加、phase1 失败中止。

**注意**:`tests/module/test_agent_hub.py` 的 `test_hub_route_message` 是**空壳测试**(只断言 `"hello" in reply`,`route_message` 本身是占位回显),应删除或改造为真实路径测试。

---

## 2. 安全性详查

### 2.1 `dispatch_agent.task` 透传无清洗

**位置**:`services/api/backend/tools/builtin.py:784`(`dispatch_agent` 返回 `task` 原样)、`hub.py:1341/1465`(`task` 直接作为 `message` 传给 `_run_agent`)、`hub.py:1632`(`message` 进 `build_messages` 作为 user 消息)。

**问题**:`task` 来自 LLM 生成的 tool_call arguments,**无长度限制、无内容清洗**,直接作为下一轮 LLM 的 user message。虽然 task 由模型自己生成(非用户直接输入),但存在 prompt 注入放大风险:恶意/异常模型输出可构造超长 task,或注入越权指令(如让被调度专家执行其白名单外的操作——实际有白名单兜底,但 task 内容会污染专家上下文)。

**目标改法**:
```python
# builtin.py dispatch_agent 内,或 hub.py _handle_dispatches 入口
MAX_TASK_LEN = 4000
task = (task or "")[:MAX_TASK_LEN]
# 可选:剥离疑似 prompt 注入标记(如重复的 <<<THINK>>>),至少日志记录超长 task
if len(task) >= MAX_TASK_LEN:
    logger.warning("dispatch task truncated: target=%s len=%d", target_agent, len(original))
```

### 2.2 `complete_json` 静默返回 `{}` 的连锁影响

**位置**:`services/api/backend/llm/provider.py:274-277`(解析失败返回 `{}`)、`services/api/backend/agents/intent.py:121-144`(`_llm_classify` 消费返回值)。

**问题**:`complete_json` 在 JSON 解析彻底失败时返回空 dict,不抛异常、不记日志。`intent.py:82-83` 的 `except Exception: pass` 进一步吞掉了上游可能抛的异常。最终 `intent.py:126` `data.get("agent_id") or "hub"` 兜底为 hub,看起来"安全降级",但:
- `confidence` 取 `float(data.get("confidence") or 0.6)` → 空时为 0.6,与"规则未命中走 hub"的 0.5 不一致,可能误导 Hub 编排判断(`hub.py:406` `intent.confidence >= 0.85` 判断 fast 路径)。
- 调用方无法区分"LLM 真返回 hub"与"JSON 解析失败兜底"。

**目标改法**:
```python
# provider.py complete_json — 解析失败时记日志并返回带 __parse_error 标记的 dict
except json.JSONDecodeError:
    logger.warning("complete_json parse failed: %s", text[:200])
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end+1])
        except json.JSONDecodeError:
            pass
    return {}  # 保持空 dict 契约,但已记日志

# intent.py — 去掉裸 except,改为捕获具体异常并记日志
if self.llm and self.llm.available:
    try:
        return await self._llm_classify(msg, context)
    except (json.JSONDecodeError, ValueError, RuntimeError) as e:
        logger.warning("LLM classify failed, fallback to hub: %s", e)
```

### 2.3 `propose_memory(apply=True)` 绕过用户确认

**位置**:`hub.py:503-511`(`handle_question_answer` 用 `apply=True` 直接写偏好)、`memory/service.py:314`(`_merge_preference` 用 `prefs_data.update(parsed)` 合并任意 key)。

**问题**:用户回答反问后,`handle_question_answer` 直接 `apply=True` 把 `json.dumps(answers)[:500]` 写入用户偏好画像,绕过 pending 确认流程。虽然 `_looks_like_answer_dump` 做了过滤(`service.py`),但 `prefs_data.update(parsed)` 可写入任意偏好键——若 `answers` 含恶意 key(如 `{"admin": true}`),会被合并进 `agent_prefs`。

**目标改法**:
```python
# hub.py handle_question_answer — 不应把原始 answers dump 写入偏好
# 改为:只提取结构化字段(如 selected options 的 value),或走 pending 队列让用户确认
if not skipped and answers:
    # 提取选项 value,而非整体 dump
    extracted = {k: v.get("value", v) if isinstance(v, dict) else v
                 for k, v in answers.items() if isinstance(k, str)}
    await self.memory.propose_memory(
        user.id, agent_id="hub",
        value=json.dumps(extracted, ensure_ascii=False)[:500],
        confidence=0.75, evidence=[f"question:{question_id}"],
        kind="preference", apply=True,
    )

# service.py _merge_preference — 白名单 key 或拒绝未知 key
ALLOWED_PREF_KEYS = {"tech_stack", "level", "language", "goal", "speaking_style"}
for k, v in parsed.items():
    if k in ALLOWED_PREF_KEYS:
        prefs_data[k] = v
    else:
        logger.warning("rejected unknown pref key: %s", k)
```

### 2.4 SSE 内容无 HTML 转义(前端依赖问题)

**位置**:`services/api/backend/services/sse_stream.py:6-7`(`format_sse` 仅 `json.dumps`,无 HTML 转义)。

**问题**:LLM 生成的 Markdown 正文经 `text_delta` 传给前端。若前端用 `innerHTML` 渲染,存在 XSS。git 历史显示已移除 `dangerouslySetInnerHTML`(`8e1f128`),说明前端已改用安全渲染,但**后端未做防御性转义**,前端一旦回归即出问题。

**说明**(纠正前期勘察):`json.dumps` 会把字面换行转义为 `\n` 字符串,**不会破坏 SSE 帧结构**——这点是安全的。

**目标改法**:后端 `format_sse` 不应承担 HTML 转义(会破坏 Markdown),但应:
1. 在文档/类型注释中明确"content 字段为 Markdown 原文,前端必须用 Markdown 渲染器(非 innerHTML)处理"。
2. 前端侧保持 `dangerouslySetInnerHTML` 禁用,并加 eslint 规则禁止。

---

## 3. 代码质量与规范性

### 3.1 类型注解缺口

**位置**:
- `hub.py:205` `def apply_merge_mode(agent_def):` — 参数和返回值无类型
- `hub.py:244` `def apply_chitchat_mode(agent_def):` — 同上
- `hub.py:281` `def apply_evaluate_mode(agent_def):` — 同上
- `hub.py` 多处 `llm_config,`(无类型)、`raw_settings: dict`(过宽)、`permissions: dict`(过宽)、`history: list`(无元素类型)— 出现在 `_orchestrate_multi`(:651)、`_dispatch_evaluate_loop`(:868)、`_handle_dispatches`(:1214)、`_run_agent`(:1583)、`_run_merge_finalize`(:1143)
- `react.py:382` `messages: list[dict[str, Any]]` — 应定义 `Message` 类型别名

**目标改法**:
```python
# 新增类型别名(放 agents/types.py 或 registry.py)
from typing import TypedDict, TypeAlias
class Message(TypedDict, total=False):
    role: str
    content: str | None
    tool_calls: list[dict]
    tool_call_id: str
Messages: TypeAlias = list[Message]

# apply_*_mode 加注解
def apply_merge_mode(agent_def: AgentDefinition) -> AgentDefinition: ...
def apply_chitchat_mode(agent_def: AgentDefinition) -> AgentDefinition: ...
def apply_evaluate_mode(agent_def: AgentDefinition) -> AgentDefinition: ...

# llm_config 收窄
from backend.llm.config import LLMConfig
async def _run_agent(self, *, ..., llm_config: LLMConfig | None, 
                     raw_settings: dict[str, Any], 
                     permissions: dict[str, Any],
                     history: list[Message], ...) -> AsyncIterator[str | EngineResult]: ...
```

### 3.2 `_normalize_question` 过度防御且混合多职责

**位置**:`react.py:1156-1462`(306 行的函数级 helper)。

**问题**:这个函数嵌套定义在 `run()` 之外但被 `run()` 调用,内部含 `_clean_options`/`_parse_letter_options`/`_default_options` 三个嵌套函数,处理:字符串解析、A/B/C 选项提取、损坏检测、占位过滤、默认选项生成、题干去重、quiz 标记。逻辑极度密集,且大量"防 LLM 乱输出"的启发式规则(`react.py:1283-1294` 的"多数选项单字符视为损坏")难以理解和维护。

**目标改法**:
1. 把三个嵌套函数提到模块级(或新建 `agents/question.py`),各自独立可测。
2. `_normalize_question` 拆为:`_parse_question_items` → `_enrich_options`(补默认)→ `_build_question_payload`,流水线式处理。
3. 启发式规则(单字符检测、占位检测)抽成具名常量或谓词函数,如 `_is_corrupted_options(opts)`。

### 3.3 `is_plan_announcement` 启发式规则脆弱

**位置**:`react.py:1109-1138` + 正则 `react.py:1088-1106`。

**问题**:用正则匹配"执行计划/这就调度/马上调度"等中文短语判断"假完成",是针对模型输出的打地鼠式补丁。git 历史显示这类规则反复调整(`fed1603`/`9a3498d`),且:
- `len(t) < 280`、`len(t) < 1200`、`len(t) < 800` 等魔数无依据。
- `_DISPATCH_HINT_RE` 匹配 `.{0,24}` 内含 agent 名,正常讲解(如"我调用了 mentor 后得到...")可能误判。

**目标改法**(中期):
- 与其用正则检测,改为**结构化判断**:若 `plan_execute` 且本轮 `result.tool_calls` 为空且 `result.text` 以计划关键词开头,则判定为空承诺。即把"是否调用工具"作为主信号,正则只作辅助。
```python
def is_plan_announcement(text: str, *, agent_id: str, had_tool_calls: bool = False) -> bool:
    if had_tool_calls:
        return False  # 调了工具就不是空承诺
    # 原有正则逻辑作为辅助
    ...
```
调用处(`react.py:623`)传入 `had_tool_calls=bool(result.tool_calls)`。

### 3.4 重复的 SSE 切片发送

**位置**:`react.py:601-604`、`680-685`、`692-695`、`1017-1020`(均为 `step = 24` 或 `40` 的 `for i in range(0, len(text), step)` 切片发 `text_delta`)。

**问题**:同一段切片逻辑出现 4 次以上,`step` 魔数(24/40/32)散落不一致。

**目标改法**:
```python
def _emit_text_deltas(text: str, *, emit_sse: bool, step: int = 24) -> list[str]:
    """把长文本切片为 text_delta SSE 事件列表。"""
    if not emit_sse or not text:
        return []
    return [format_sse("text_delta", {"content": text[i:i+step]}) 
            for i in range(0, len(text), step)]
# 调用处:yield from _emit_text_deltas(final_text, emit_sse=emit_sse)
```
统一 `step`,或改为配置项。

### 3.5 模块级副作用与导入时注册

**位置**:`hub.py:32`(`ensure_tools_loaded()`)在模块导入时执行。

**问题**:`ensure_tools_loaded()` 实际只是 `return None`(`builtin.py:1467`),靠模块导入副作用注册工具。这种隐式注册导致:
- 测试时必须先 `import backend.tools.builtin` 才能触发注册,否则 `global_registry` 为空。
- 导入 `hub.py` 即触发 `tools/builtin.py` 全量加载,增加启动开销。

**目标改法**:改为显式初始化函数,在 app 启动时(`main.py` lifespan)调用一次,而非模块导入时:
```python
# hub.py: 删除模块级 ensure_tools_loaded()
# main.py lifespan:
from backend.tools.builtin import register_all_tools
register_all_tools()  # 显式注册
```

---

## 4. 可扩展性

### 4.1 workflow 分支硬编码

**位置**:`react.py:418-420`(`if wf == "direct": tools = []`)、`react.py:443`(`if wf == "cot":`)、`react.py:519`(`if wf in ("plan_execute", "tot", "reflexion"):`)、`react.py:619`(`if wf == "plan_execute"`)、`react.py:1043-1073`(`_workflow_hint` 按 wf 字符串分支)。

**问题**:workflow 类型是字符串(`"cot"|"react"|"plan_execute"|"reflexion"|"tot"|"direct"`),散落在多个 `if` 分支。新增 workflow 需改 5+ 处,易遗漏。

**目标改法**:用枚举 + 策略模式:
```python
class Workflow(str, Enum):
    COT = "cot"
    REACT = "react"
    PLAN_EXECUTE = "plan_execute"
    REFLEXION = "reflexion"
    TOT = "tot"
    DIRECT = "direct"

# 每种 workflow 实现为独立处理器类/函数,实现统一接口
class WorkflowHandler(Protocol):
    async def run(self, engine, *, agent_def, ctx, messages, emit_sse) -> AsyncIterator[...]: ...
    def hint(self, agent_def) -> str: ...

# AgentDefinition.workflow 改为 Workflow 枚举
```
短期可先抽 `_workflow_hint` 为 `dict[Workflow, str]` 查表,消除 if 链。

### 4.2 Agent 定义散落且强耦合

**位置**:`registry.py:28-122`(`SOULS` 字典)、`162-391`(`AGENT_DEFINITIONS` 字典)、`hub.py:76-95`(`_AGENT_DISPLAY_NAMES`/`_AGENT_ROLE_HINTS` 字典)、`react.py:1088-1098`(正则硬编码 agent 名)。

**问题**:新增一个 Agent 需改:`registry.py:SOULS` + `registry.py:AGENT_DEFINITIONS` + `hub.py:_AGENT_DISPLAY_NAMES` + `hub.py:_AGENT_ROLE_HINTS` + `hub.py:_SERIAL_DISPATCH_AGENTS` + `tools/builtin.py:dispatch_agent` 的 enum + `intent.py:FAST_RULES`。7 处散落,极易遗漏。

**目标改法**:把 Agent 的所有元数据收敛到 `AgentDefinition` 单一来源:
```python
@dataclass
class AgentDefinition:
    id: str
    name: str  # 显示名
    display_name: str  # = name,可省
    role_hint: str  # 切换条副标题
    serial: bool = False  # 是否强制串行调度
    intent_patterns: list[re.Pattern] = field(default_factory=list)  # 意图规则
    # ...其余字段
```
`_AGENT_DISPLAY_NAMES`/`_AGENT_ROLE_HINTS`/`_SERIAL_DISPATCH_AGENTS` 改为从 registry 派生:
```python
def display_name(agent_id): return get_registry().get(agent_id).name
def role_hint(agent_id): return get_registry().get(agent_id).role_hint
SERIAL = {a.id for a in get_registry().list_all() if a.serial}
```
`dispatch_agent` 的 `target_agent` enum 改为运行时从 registry 动态生成(或校验 `registry.has(target_agent)`)。

### 4.3 `intent.py` 规则与 Agent 解耦不彻底

**位置**:`intent.py:30-48`(`FAST_RULES` 硬编码 agent_id)、`intent.py:113-120`(LLM prompt 硬编码 agent 列表)。

**问题**:意图分类的规则和 prompt 与 Agent 注册表脱节,加 Agent 后意图分类不会自动适配。

**目标改法**:`FAST_RULES` 从 `AGENT_DEFINITIONS` 的 `intent_patterns` 字段派生(见 4.2);LLM prompt 的 agent 列表动态生成:
```python
async def _llm_classify(self, message, context):
    agents = ", ".join(f"{d.id}({d.description})" for d in get_registry().list_all())
    prompt = f"判断用户消息应由哪个 Agent 处理。可选: {agents}。..."
```

---

## 5. 可维护性细节

### 5.1 魔数与配置散落

**位置**:
- `hub.py:35` `_EXPERT_SUMMARY_CHARS = 6000`
- `hub.py:37` `_EXPERT_HISTORY_WINDOW = 6`
- `hub.py:269` `MAX_HUB_DISPATCH_ROUNDS = 2`
- `react.py:40` `MAX_ITERATIONS = 8`
- `react.py:951` `[:12000]` tool result 截断
- `react.py:1149` `_small_enough` limit `4000`
- `react.py:1141` `_preview` limit `200`
- `react.py:992` `close_tokens = max(..., 2048)`
- `react.py:336-338` `plan_cap = min(420, ...)` / `min(900, ...)`
- 多处 `[:24000]`、`[:100_000]`、`[:500]`

**问题**:这些阈值是性能/成本/防截断的关键参数,但散落在代码各处,无统一配置,调整需全文搜索。

**目标改法**:收敛到一个配置 dataclass:
```python
@dataclass(frozen=True)
class AgentEngineConfig:
    expert_summary_chars: int = 6000
    expert_history_window: int = 6
    max_hub_dispatch_rounds: int = 2
    max_iterations: int = 8
    tool_result_truncate: int = 12000
    tool_result_sse_limit: int = 4000
    preview_limit: int = 200
    closing_min_tokens: int = 2048
    plan_cap_default: int = 420
    plan_cap_tot: int = 900
    subagent_thinking_limit: int = 24000
    subagent_output_limit: int = 100_000
```
注入 `ReActEngine` / `HubService` 构造函数,测试时可覆盖。

### 5.2 `route_message` 占位函数与空壳测试

**位置**:`hub.py:306-309`(`route_message` 返回固定回显字符串)、`tests/module/test_agent_hub.py:5-8`(只断言 `"hello" in reply`)。

**问题**:`route_message` 自述"兼容旧测试的占位接口",但其内容只是 `f"Agent 服务已接入 Hub...消息摘要：{message[:200]}"`,不触发任何真实 agent 逻辑。对应测试是**假测试**,给出虚假的覆盖率信号。

**目标改法**:删除 `route_message` 和 `test_agent_hub.py`(若确认无外部调用),或改造为真实调用 `handle_chat` 的集成测试。grep 确认 `route_message` 是否被其他模块引用后再删。

### 5.3 日志不一致

**位置**:
- `react.py:121` `logger.exception("LLM stream error in engine")` — 有
- `react.py:557` `logger.exception("LLM error in ReAct")` — 有
- `hub.py:888` `logger.info("跳过重复调度: %s", key[:80])` — 有
- `hub.py:842` `logger.warning("merge_mode Hub 仍返回 dispatches...")` — 有
- 但 `intent.py:82` `except Exception: pass` — **吞异常无日志**
- `hub.py:341`/`346` `except json.JSONDecodeError: pass` — settings 解析失败无日志
- `hub.py:590-594` `except Exception: ... except json.JSONDecodeError: ...` — permissions 解析失败无日志

**目标改法**:所有 `except ... : pass` 至少加 `logger.warning(...)`。尤其 `intent.py:82` 和 `hub.py` 的 settings/permissions 解析失败,应记录以便排查"用户配置为何不生效"。

### 5.4 `handle_direct_agent` 重复的配置加载

**位置**:`hub.py:578-594`(`handle_direct_agent` 用 `build_llm_bundle_from_user` + 手动 `db.refresh` 刷新 permissions)、`hub.py:332-347`(`handle_chat` 用 `build_llm_config_from_user` + 手动解析 settings/permissions)。

**问题**:两个入口的配置加载逻辑不一致:
- `handle_direct_agent` 用 `build_llm_bundle_from_user`(返回 config+key_status+settings 一次查库),再 `db.refresh(user, ["agent_permissions"])` 刷新权限。
- `handle_chat` 用 `build_llm_config_from_user`,再 `json.loads(user.settings_json)` + `json.loads(user.agent_permissions)`(不刷新)。

**目标改法**:统一为一个 helper:
```python
async def _load_user_bundle(self, user: User) -> tuple[LLMProvider, LLMConfig|None, str, dict, dict]:
    """一次加载 LLM 配置 + key 状态 + settings + permissions。"""
    llm_config, key_status, raw_settings = await build_llm_bundle_from_user(self.db, user.id)
    await self.db.refresh(user, attribute_names=["agent_permissions"])
    permissions = {}
    try: permissions = json.loads(user.agent_permissions or "{}")
    except json.JSONDecodeError: logger.warning(...)
    return LLMProvider(llm_config), llm_config, key_status, raw_settings, permissions
```
两个入口都调用它。

---

## 6. 正确性与健壮性细节

### 6.1 `load_chat_history` 丢弃 tool 消息

**位置**:`memory/context.py:249-260`(注释明确"仅保留 user/assistant,丢弃 tool 消息")。

**问题**:历史消息进 `build_messages` 时不含 tool 角色。这意味着跨会话轮次中,工具调用的上下文丢失。当前靠 short_memory(`append_short_memory` 写摘要)补偿,但若 short_memory 满了(上限 12 条)或摘要质量差,模型会丢失"上一轮调过什么工具"的信息,可能导致重复调用或上下文断裂。

**目标改法**:这是设计取舍(简化),应至少在注释中说明权衡,并评估是否保留最近一轮的 tool 消息:
```python
# 保留最近一轮完整 tool 交互(assistant tool_calls + tool results),其余只留 user/assistant
```
或明确文档化"跨会话上下文依赖 short_memory 而非完整 history"。

### 6.2 `_dispatch_fingerprint` 去重可能误杀

**位置**:`hub.py:272-278`、`hub.py:886-890`。

**问题**:指纹 = `target_agent|task[:120]`。若 Hub 对同一专家发两个 task 内容前 120 字相同但后半不同的任务,第二个会被跳过。虽 `logger.info` 记录,但用户可能期望两个任务都执行。

**目标改法**:去重应区分"完全相同的重复调度"与"同专家不同任务":
```python
def _dispatch_fingerprint(d: dict) -> str:
    target = str(d.get("target_agent") or "").strip().lower()
    task = str(d.get("task") or "").strip().lower()
    return f"{target}|{hashlib.sha1(task.encode()).hexdigest()[:16]}"  # 全文 hash,非截断
```

### 6.3 降级模式 SSE 切片魔数

**位置**:`react.py:397-398`(`for i in range(0, len(text), 40)` 降级回复切片)。

**问题**:降级模式(`llm.available=False`)把固定文案切片发 `text_delta`,`step=40`。与正常路径的 `step=24` 不一致(见 3.4),无理由差异。

**目标改法**:统一用 §3.4 的 `_emit_text_deltas` helper,统一 `step`。

### 6.4 `hub_passthrough` / `nested_expert` / `direct_streamed` 标志位隐式状态机

**位置**:`hub.py:919/927/960/995/1008`(`_dispatch_evaluate_loop` 内 `bag.get("hub_passthrough")`/`nested_expert`/`direct_streamed` 判断)。

**问题**:`result_bag` 是 `dict`,用字符串 key 传递状态(`"hub_passthrough"`/`"nested_expert"`/`"direct_streamed"`/`"had_question"`/`"summaries"`/`"expert_results"`)。无类型保护,key 拼错不报错,状态组合语义不明。

**目标改法**(见 §1.1):改为 `@dataclass DispatchRoundOutcome`,字段显式:
```python
@dataclass
class DispatchRoundOutcome:
    expert_results: list[tuple[str, str]] = field(default_factory=list)
    summaries: list[str] = field(default_factory=list)
    had_question: bool = False
    direct_streamed: bool = False
    hub_passthrough: bool = False
    nested_expert: bool = False
```
`_handle_dispatches` 返回该 dataclass,`_dispatch_evaluate_loop` 用属性访问替代 `bag.get(...)`。

---

## 7. 其他改进建议

### 7.1 `think_stream.py` 边界逻辑可简化

**位置**:`think_stream.py:54-59`(`detect` 模式下的"可能是标记前缀"判断)。

**问题**:`any(THINK_START.startswith(self._buf.lstrip()[:i]) for i in range(...))` 逻辑绕,且与 `:41-44` 的同类判断重复。

**目标改法**:抽一个 `_is_partial_marker(buf: str) -> bool` helper,统一"缓冲是否为 THINK_START 的前缀"判断。该模块注解最干净,可作为其他模块的范例。

### 7.2 `intent.py` 多意图检测过于简单

**位置**:`intent.py:50`(`MULTI_KEYWORDS = ["并且", "同时", ...]`)、`intent.py:87-107`(`_rule_multi`)。

**问题**:多意图靠关键词命中 + `FAST_RULES` 正则扫描,无顺序感知。"分析 A 并且对比 B"会被识别为 multi(scout + scout),但两个 sub_intent 的 message 都是完整原句,专家无法区分自己该处理哪部分。

**目标改法**(中期):多意图应做句子切分,每个 sub_intent 带切分后的子句作为 message。或交由 LLM 分类时输出 sub_intents 的 message 字段(当前 `_llm_classify` 已支持,但规则路径 `_rule_multi` 不切分)。

### 7.3 `AgentRegistry` 全局单例无并发保护

**位置**:`registry.py:414-421`(`_registry` 全局变量 + `get_registry()` 懒加载)。

**问题**:异步环境下,若两个请求同时首次调用 `get_registry()`,理论上可能创建两个实例(虽 `AGENT_DEFINITIONS` 是不可变字典,影响有限)。`register()` 动态注册若在运行时调用,无锁保护。

**目标改法**:`get_registry()` 用 `functools.lru_cache(maxsize=1)` 或模块级直接实例化 `_registry = AgentRegistry()`(导入即创建,无竞态)。`register()` 若需运行时动态注册,加 `asyncio.Lock`。

---

## 8. 修改优先级清单

> **已解决状态（2026-08-05 复核）**：以下清单基于基线 `5ff949c`（2026-08-03）。经后续提交 `9bd682c`/`d6152c9`/`8d73a8a` 等整改，多数条目已落地：**已解决** = 1.2（SSE 限流 + 消息长度）、2.1（dispatch_task 清洗）、3.1（类型注解）、3.2（question.py 拆分）、3.4（SSE 切片 helper）、5.1（AgentEngineConfig）、5.2（route_message 删除）、6.2（_dispatch_fingerprint 全文 hash）、7.3（registry 单例）；**部分解决** = 1.1（react.py 已拆分 1462->1282 行，hub._handle_dispatches 仍 1199 行）、2.2（intent 已加日志，complete_json 仍返 {}）、4.3（规则已从 registry 派生，MULTI_KEYWORDS 仍硬编码）、3.3（is_plan_announcement 已提为模块级函数）；**待核** = 1.3（单测覆盖）、2.3、5.3、4.1、4.2、6.4、2.4、5.4、7.1、7.2。下表保留原基线内容供追溯。

| 优先级 | 编号 | 问题 | 工作量 | 风险 |
|--------|------|------|--------|------|
| P0 | 1.2 | agent SSE 无限流 + 消息无长度上限 | 小 | 低 |
| P0 | 1.3 | 关键路径补单测(run/handle_chat/_handle_dispatches) | 大 | 低 |
| P0 | 2.1 | dispatch_agent.task 透传无清洗 | 小 | 低 |
| P1 | 1.1 | 拆分 run() 与 _handle_dispatches() | 大 | 高(需先有测) |
| P1 | 2.2 | complete_json 静默返空 + intent 吞异常 | 小 | 低 |
| P1 | 2.3 | propose_memory(apply=True) 绕过确认 + 任意 key 合并 | 中 | 中 |
| P1 | 5.3 | except pass 无日志(intent/settings/permissions) | 小 | 低 |
| P2 | 3.1 | 类型注解缺口(apply_*_mode/llm_config/Message) | 中 | 低 |
| P2 | 4.1 | workflow 字符串分支 → 枚举/策略 | 中 | 中 |
| P2 | 4.2 | Agent 元数据散落 7 处 → 收敛到 AgentDefinition | 中 | 中 |
| P2 | 6.4 | result_bag dict → DispatchRoundOutcome dataclass | 中 | 中(配合 1.1) |
| P3 | 2.4 | SSE HTML 转义文档化 + 前端 eslint 规则 | 小 | 低 |
| P3 | 3.2 | _normalize_question 拆分到 question.py | 中 | 低 |
| P3 | 3.3 | is_plan_announcement 改结构化判断 | 中 | 中 |
| P3 | 3.4 | SSE 切片逻辑统一 helper | 小 | 低 |
| P3 | 5.1 | 魔数收敛到 AgentEngineConfig | 中 | 低 |
| P3 | 5.2 | 删除 route_message 空壳 + 假测试 | 小 | 低 |
| P3 | 5.4 | 配置加载统一 _load_user_bundle | 小 | 低 |
| P3 | 6.2 | _dispatch_fingerprint 全文 hash | 小 | 低 |
| P3 | 7.1-7.3 | think_stream 简化 / 多意图切分 / registry 单例 | 中 | 低 |

---

## 9. 验证与回归建议

修改后应依次验证:
1. `pytest tests -q`(后端全量,含现有 agent 单测)
2. `npm run test:web`(前端单测,含 SSE 解析)
3. 手动冒烟:寒暄 → Scout 速览 → Mentor 讲解(触发 ask_user)→ 反问回答 → Hub 汇总,确认 SSE 事件序列与落库正常
4. 限流修改后:用脚本高频调用 `/api/agent/sessions/{id}/chat`,确认被限流
5. 拆分 `run()` 后:跑 §1.3 新增的单测,确认 EngineResult 字段不变

---

## 附录:被审查文件清单
> **路径与行数已更新（2026-08-05）**：权威实现已迁至 `services/agent/agent_core/agents/`；`services/api/backend/agents/*` 现为 9 行 shim。下表为当前行数。

| 文件 | 行数 | 关键问题编号 |
|------|------|-------------|
| `services/agent/agent_core/agents/react.py` | 1282 | 1.1, 1.3, 2.2, 3.2, 3.3, 3.4, 4.1, 5.1, 6.3 |
| `services/agent/agent_core/agents/hub.py` | 1674 | 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 4.2, 5.1, 5.3, 5.4, 6.2, 6.4 |
| `services/agent/agent_core/agents/registry.py` | 466 | 4.1, 4.2, 7.3 |
| `services/agent/agent_core/agents/intent.py` | 183 | 2.2, 4.2, 4.3, 5.3, 7.2 |
| `services/agent/agent_core/agents/think_stream.py` | 141 | 7.1 |
| `services/api/backend/agents/__init__.py` | 9（shim） | - |
| 依赖:`agent_core/llm/provider.py` | - | 2.2 |
| 依赖:`agent_core/tools/builtin.py` | - | 2.1, 3.5, 4.2 |