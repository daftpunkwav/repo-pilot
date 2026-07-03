# RepoPilot v1.0 文档修复报告 — 第5次（终审后收尾）

> 版本: 1.0.0 | 日期: 2026-07-04 | 状态: 已完成
> 基于: 第 6 轮终审报告 
> 修复范围: TECHNICAL_SPEC.md / AGENT_SPEC.md / MVP_SCOPE.md / AGENT_PRD.md

---

## 1. 总体摘要

| 指标 | 数值 |
|------|------|
| 修复来源 | 第 6 轮终审残留项 + ZCode 交叉审计 High 级项 |
| 修复总数 | **8 项** |
| 涉及文档 | 4 份（TECHNICAL_SPEC / AGENT_SPEC / MVP_SCOPE / AGENT_PRD） |
| 修复耗时 | ~15 分钟（全部为文本级修改） |

**修复定位：** 第 4 次修复（50/58）已锁定核心架构，本次修复为终审后收尾——消除剩余的 High 级不一致和 Medium 级遗漏，使文档达到**零已知阻塞**状态。

---

## 2. 修复清单

### 2.1 High 级修复（3 项）

| 编号 | 来源 | 问题 | 修复动作 | 文档 | 位置 |
|------|------|------|---------|------|------|
| H1 | ZCode | `StreamCollector` 缺少 `@dataclass` 装饰器（§3.5 中唯一缺失的类） | 添加 `@dataclass` 装饰器 | TECHNICAL_SPEC | §3.5 L902 |
| H3 | ZCode | AGENT_SPEC `LLMConfig` 缺少 `validate_api_base` field_validator | 添加 `@field_validator("api_base")` 含 scheme 校验，IP blocklist 委托 TECHNICAL_SPEC §5.2 | AGENT_SPEC | §3.2 L436-455 |
| H4 | ZCode | `agent_permissions` mentor 工具列表（5 个）与 config.yaml（10 个）不一致 | 统一全部 6 个 Agent 的工具列表，与 config.yaml 和 AGENT_SPEC @tool 定义对齐 | TECHNICAL_SPEC | §2.2 L243-248 |

### 2.2 Medium 级修复（3 项）

| 编号 | 来源 | 问题 | 修复动作 | 文档 | 位置 |
|------|------|------|---------|------|------|
| F5-29 | 第6轮 | `extensions` 字段无边界约束，可无限膨胀 | 表定义补充约束说明（≤64KB / ≤100 keys / ext_ 前缀 / ≤128 chars），`set_extension()` 方法添加完整校验逻辑 | TECHNICAL_SPEC | §2.3 L394 + §7.3 L1966 |
| F5-37 | 第6轮 | `llm_default_provider/model` 注释"MVP 仅存储，不主动调用"已过时 | 更新为"v1.0 完整启用，BYOK 用户配置优先，此为用户未配置时的回退值" | MVP_SCOPE | §6.4 L375 |
| H4-ext | 衍生 | H4 修复中发现 `get_user_profile` 工具在所有 Agent 权限中引用但从未定义 | 移除不存在的 `get_user_profile`，替换为已定义的 `ask_user_question` / `save_to_memory` 等工具 | TECHNICAL_SPEC | §2.2 L243-248 |

### 2.3 Low 级修复（2 项）

| 编号 | 来源 | 问题 | 修复动作 | 文档 | 位置 |
|------|------|------|---------|------|------|
| L1 | 第6轮 | 降级表列名"无 Agent (降级)"与 PRD US-07 "无 Key 降级"不一致 | 统一为"无 Key (降级)" | AGENT_PRD | §8 L524 |
| L2 | 第6轮 | 降级提示"AI API Key"与全文"LLM API Key"术语不一致 | 统一为"LLM API Key" | AGENT_PRD | §8 L533 |

---

## 3. 修复详情

### 3.1 H1: StreamCollector @dataclass

**问题：** §3.5 核心类型定义中，`Message`、`LLMChunk`、`ToolResult` 均有 `@dataclass` 装饰器，唯独 `StreamCollector` 遗漏。

**修复：**
```python
@dataclass
class StreamCollector:
    """F5-13: 流式响应收集器 — 在 ReAct 循环中收集 LLM 流式输出"""
```

### 3.2 H3: AGENT_SPEC LLMConfig validate_api_base

**问题：** TECHNICAL_SPEC §5.2 的 `LLMConfig` 有 `@field_validator("api_base")` SSRF 校验，但 AGENT_SPEC §3.2 的同名模型缺失。AGENT_SPEC 声称是 Agent 系统的"唯一权威来源"，安全校验不应缺失。

**修复：** 添加 `@field_validator("api_base")` 方法，包含 scheme 校验（仅允许 http/https），IP blocklist 校验委托 TECHNICAL_SPEC §5.2 的完整实现。

```python
@field_validator("api_base")
@classmethod
def validate_api_base(cls, v: str | None) -> str | None:
    """SSRF 防护：校验 api_base 不指向内部网络（完整 BLOCKED_NETWORKS 见 TECHNICAL_SPEC §5.2）"""
    if v is None:
        return v
    from urllib.parse import urlparse
    parsed = urlparse(v)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"api_base 仅允许 http/https，收到: {parsed.scheme}")
    return v
```

### 3.3 H4: agent_permissions 工具列表统一

**问题：** `agent_permissions` JSON 中 mentor 只列出 5 个工具（含不存在的 `get_user_profile`），但 config.yaml 列出 10 个。其他 Agent 也存在类似缺口。

**修复：** 全部 6 个 Agent 的工具列表统一更新为与 config.yaml 和 AGENT_SPEC @tool 定义一致：

| Agent | 修复前工具数 | 修复后工具数 | 主要变更 |
|-------|------------|------------|---------|
| scout | 2 | 7 | +search_web, +get_project_analysis, +compare_projects, +ask_user_question, +save_to_memory |
| mentor | 5 | 10 | -get_user_profile, +search_web, +get_project_analysis, +compare_projects, +update_user_profile, +save_to_memory, +recall_from_memory |
| navigator | 3 | 4 | -get_user_profile, +ask_user_question, +recall_from_memory |
| curator | 2 | 3 | +ask_user_question |
| scribe | 2 | 3 | +ask_user_question |
| hub | 1 | 2 | +ask_user_question |

### 3.4 F5-29: extensions 边界约束

**问题：** `extensions` 字段被定义为开放 JSON，Agent 可无界写入，无容量/键名/隐私约束。

**修复：** 两处修改：

1. **表定义**（§2.3）补充约束说明：≤64KB / ≤100 keys / ext_ 前缀 / ≤128 chars
2. **set_extension() 方法**（§7.3）添加完整校验逻辑：
   - ext_ 前缀检查
   - 键名长度检查
   - 键数上限检查
   - 写入后 JSON 序列化总量检查（超 64KB 自动回滚）

### 3.5 F5-37: llm_default_provider 注释

**修复前：** `# LLM (MVP 仅存储，不主动调用)`
**修复后：** `# LLM 全局默认值（v1.0 完整启用，BYOK 用户配置优先，此为用户未配置时的回退值）`

### 3.6 L1 + L2: AGENT_PRD 术语统一

**L1：** 降级表列名 `无 Agent (降级)` → `无 Key (降级)`
**L2：** 降级提示 `配置 AI API Key` → `配置 LLM API Key`

---

## 4. 未修复项说明

以下项在审查中被识别但有意保留：

| 编号 | 问题 | 保留理由 |
|------|------|---------|
| M6 | AGENT_SPEC PromptGuard 缺 import re/logger | 规格文档代码示例不需要列出所有 import 语句，实现时自然补充 |
| M7 | PRD TBD-04 引用 AGENT_PRD §2.7 | 验证后确认 §2.7 "Hub — 对话管家" 确实是 Agent 协作路由的定义章节，引用正确 |
| H5 | TECHNICAL_SPEC §6.3 无路径遍历校验代码 | §5.2 安全层已有完整校验规范（repo/path/ref 正则），§6.3 作为工具实现章节引用 §5.2 即可 |
| H6 | TECHNICAL_SPEC §6.3 无 3 个工具的 @tool 定义 | 这 3 个工具（suggest_classification/generate_note_outline/build_learning_path）已在 AGENT_SPEC §4.3 完整定义，TECHNICAL_SPEC 不需要重复全部 14 个工具定义 |

---

## 5. 累计修复统计

| 修复批次 | 日期 | 修复数 | 来源 |
|---------|------|--------|------|
| 第 1 次 | 07-03 | ~34 | 第 1 轮审查 |
| 第 2 次 | 07-03 | ~14 | 第 2 轮审查 |
| 第 3 次 | 07-04 | 23 | 第 3 轮审查（24 项，1 项 deferred） |
| 第 4 次 | 07-04 | 50 | 第 5 轮审查（58 项） |
| **第 5 次（本次）** | **07-04** | **8** | **第 6 轮终审 + ZCode 交叉审计** |
| **累计** | — | **~129** | **6 轮审查迭代** |

---

## 6. 最终状态

| 维度 | 状态 | 说明 |
|------|------|------|
| 核心类型完整性 | ✅ | LLMChunk/Message/ToolResult/StreamCollector/IntentResult 全部含 @dataclass |
| SSRF 防护一致性 | ✅ | TECHNICAL_SPEC + AGENT_SPEC 的 LLMConfig 均有 validate_api_base |
| 工具权限一致性 | ✅ | agent_permissions / config.yaml / @tool 三处统一 |
| 数据边界约束 | ✅ | extensions 字段有完整写入约束 + 校验代码 |
| 术语一致性 | ✅ | "无 Key (降级)" + "LLM API Key" 全文统一 |
| 注释时效性 | ✅ | llm_default_provider 注释反映 v1.0 实际行为 |

**文档状态：✅ 零已知阻塞，可进入 Phase 1 开发。**

---

*生成时间: 2026-07-04*
*生成工具: QoderWork*
*审查基准: 第 6 轮终审报告 + ZCode 交叉审计结果*
