# RepoPilot v1.0 — 第四轮全面审查报告

> 审查日期: 2026-07-04
> 审查范围: PRD.md, AGENT_PRD.md, TECHNICAL_SPEC.md, AGENT_SPEC.md, MVP_SCOPE.md
> 关联文档: v1/RepoPilot-v1-文档审查报告.md (第一轮), v1/RepoPilot-v1-文档审查报告-2026-07-03-v2.md (第二轮), v1/RepoPilot-v1-全面审查报告-2026-07-04.md (第三轮), v1/RepoPilot-v1-修复验证报告-2026-07-04.md (修复验证)

---

## 〇、总体评估

本轮审查是在三轮历史审查（30+ 问题）和两轮修复（R-01~R-22 及第三轮 24 项修复）之后的**第四次全面审计**。审查重点：

1. **第三轮修复回归验证** — 确认第三轮报告中的修复是否真正落实
2. **跨文档一致性** — 精确对比 5 份文档的字段、类型、代码定义
3. **安全性深度审查** — 按 OWASP 标准检查认证/加密/注入/SSRF
4. **技术可行性审查** — 检查工具实现、性能瓶颈、资源管理
5. **现代性与规范性** — 对标行业最佳实践

**发现统计:**

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 开工前必修 | 12 | 导致实现歧义或安全风险 |
| 🟡 Phase 1 前完成 | 8 | 影响开发质量 |
| 🟢 后续优化 | 5 | 锦上添花 |

**文档总体质量评价:** 决策追溯体系（决策 N-XX / D-XX / T-XX）做得很好，v1.0 单版本策略清晰，BYOK 降级设计合理。主要问题集中在**两份 SPEC 之间的大量代码重复导致的同步漂移**、**核心类型定义缺失**、**安全性细节未挂载**、以及**P0 工具未实现**。

---

## 一、第三轮修复状态验证

基于第三轮全面审查报告中的 C-01~C-08、S-01~S-06、T-01~T-10 编号，验证当前文档状态：

### 已确认修复 ✅

| 编号 | 问题 | 当前状态 |
|------|------|----------|
| C-01 | AgentQuestion `intro` 字段类型三方冲突 | ✅ AGENT_SPEC §8.2.3 统一为结构化对象 `{ type: "markdown"; content: string }` |
| C-02 | `actions.submit.style` 枚举不一致 | ✅ AGENT_SPEC §8.2.3 已统一为 5 个选项 |
| C-03 | AgentPreferences 字段集完全不重叠 | ✅ AGENT_SPEC §5.3 已改为引用 TECHNICAL_SPEC §2.3，删除独立定义 |
| C-04 | 6 个工具缺失 @tool 声明 | ✅ AGENT_SPEC §4.3 已补充全部 14 个工具的 @tool 声明 |
| C-06 | goals JSON 示例字段名错误 | ✅ AGENT_PRD §3.2 已修正为 `title` / `priority` / `status` |
| C-07 | README 缓存 TTL 矛盾 | ✅ 统一为 1 小时（TECHNICAL_SPEC §11.3 与 MVP_SCOPE §8.4 一致） |
| S-01 | SSRF via custom `api_base` | ✅ `validate_api_base()` 函数已定义（TECHNICAL_SPEC §5.2） |
| S-02 | JWT Secret Key 无强度要求 | ✅ MVP_SCOPE §6.4 已添加 `jwt_secret_key: str` 必填 + 启动时校验 `len ≥ 32` |
| S-03 | PBKDF2 降级参数未定义 | ✅ TECHNICAL_SPEC §5.2 已补充完整参数（600K 迭代、16 字节 salt、32 字节输出、machine_id 获取方式） |
| S-04 | Refresh Token 无轮换 | ✅ TECHNICAL_SPEC §10.1 已补充 Token 轮换机制 |
| S-06 | GitHub PAT 无作用域校验 | ✅ MVP_SCOPE §4.1 已添加"验证连通性后检查 X-OAuth-Scopes 响应头" |
| T-02 | `read_source_file` 截断无续读 | ✅ 已添加 `start_line` / `end_line` 参数支持分段读取 |
| T-04 | TF-IDF 中文分词无效 | ✅ 已作为已知限制记录（TECHNICAL_SPEC §11.3），并补充字符级 n-gram 备选方案 |
| T-05 | 测试基础设施缺失 | ✅ MVP_SCOPE §10 步骤 1 已添加"建立 conftest.py + fixture + mock 方案" |
| T-08 | 前端数据获取库未决策 | ✅ 统一指定 `@tanstack/react-query`（TECHNICAL_SPEC §12.3 / MVP_SCOPE §6.1） |
| T-09 | `import litellm` 位置 | ✅ TECHNICAL_SPEC §5.1 已改为模块级 `try/except ImportError` 守卫 |
| T-10 | JSON 字段无大小限制 | ✅ MVP_SCOPE §9.4 已添加 JSON 字段大小限制（max 64KB、max 100 keys、key ≤ 128 字符） |

### 部分修复 ⚠️

| 编号 | 问题 | 当前状态 |
|------|------|----------|
| C-05 | SPEC 间 ~887 行代码重复 | ⚠️ 仅添加了"详见 AGENT_SPEC"注释，代码块未删除 |
| C-08 | AGENT_SPEC §5.3 UserProfile 缺失 user_id | ⚠️ 已添加注释引用，但 class 定义仍从 `tech_proficiency` 开始，未显式列出 `user_id` |
| T-03 | SSE 连接生命周期管理 | ⚠️ TECHNICAL_SPEC §11.3 已补充 `is_disconnected()` + `asyncio.Task.cancel()` + 5 分钟超时，但未明确 FastAPI `StreamingResponse` 的集成方式 |

### 未修复 ❌

| 编号 | 问题 | 当前状态 |
|------|------|----------|
| T-01 | `search_web` 工具无实现规范 | ❌ 仍为 `raise NotImplementedError("v1.0 待实现：建议使用 duckduckgo-search 库")` |

---

## 二、🔴 新发现 — 跨文档一致性（12 项）

### C-01: `search_web` 工具未实现（P0 阻塞）

**位置:** AGENT_SPEC.md §4.3

**现状:** 该工具对所有 6 个 Agent 开放（`allowed_agents=["scout", "mentor", "navigator", "curator", "scribe", "hub"]`），是暴露面最大的工具。但实现仅为：

```python
async def search_web(query: str, max_results: int = 5, context: ExecutionContext = None, **kwargs) -> dict:
    """搜索互联网（v1.0 使用 DuckDuckGo Instant Answer API，无需 API Key）"""
    # 实现约束：
    # 1. 仅使用搜索结果 API，不直接抓取网页
    # 2. 返回结果总字符数 ≤ 4000（防止 LLM 上下文溢出）
    # 3. 搜索结果内容需经 PromptGuard.sanitize_user_input() 标记
    # 4. SSRF 防护：禁止搜索词中包含 URL（防止通过搜索绕过 SSRF 限制）
    raise NotImplementedError("v1.0 待实现：建议使用 duckduckgo-search 库")
```

**风险:** Scout、Mentor、Navigator 等核心 Agent 场景依赖此工具。v1.0 无法在不实现此工具的情况下完成 Agent 系统的核心价值。

**修复建议:** 至少定义完整接口规范（DuckDuckGo Instant Answer API + 500 字符截断 + PromptGuard 消毒 + SSRF 防护），代码可为占位但规范必须完整。

---

### C-02: 核心类型完全缺失

**位置:** 全文档（TECHNICAL_SPEC.md、AGENT_SPEC.md）

**现状:** 以下核心类型在文档中仅有零散引用，无任何正式定义：

| 类型 | 引用位置 | 缺失定义 |
|------|---------|---------|
| `Message` | TECHNICAL_SPEC §4.1, §7.3.1, §7.3.2 | 无 dataclass / Pydantic 模型 |
| `StreamEvent` | TECHNICAL_SPEC §4.1, §11.3 | 无 dataclass / Pydantic 模型 |
| `StreamEventType` | TECHNICAL_SPEC §4.1, AGENT_SPEC §2.2.2.1 | ⚠️ AGENT_SPEC §2.2.2.1 已补充枚举，但 TECHNICAL_SPEC §4.1 未同步 |
| `ToolResult` | TECHNICAL_SPEC §6.2, AGENT_SPEC §4.2 | 无 dataclass / Pydantic 模型 |
| `ExecutionContext` | TECHNICAL_SPEC §6.1, AGENT_SPEC §4.1 | 无 dataclass / Pydantic 模型 |
| `Session` | TECHNICAL_SPEC §7.3.1, AGENT_SPEC §5.2 | 无 dataclass / Pydantic 模型 |
| `ProjectContext` | TECHNICAL_SPEC §7.3.1 | 无 dataclass / Pydantic 模型 |
| `MemoryItem` | TECHNICAL_SPEC §5.1.1 | 无 dataclass / Pydantic 模型 |
| `TestResult` | TECHNICAL_SPEC §5.1, AGENT_SPEC §3.1 | 无 dataclass / Pydantic 模型 |
| `LLMChunk` | TECHNICAL_SPEC §5.1 | 无 dataclass / Pydantic 模型 |
| `IntentResult` | TECHNICAL_SPEC §4.4.2, AGENT_SPEC §2.2.1 | ⚠️ AGENT_SPEC §8.2.3 已补充，但 TECHNICAL_SPEC §4.4.2 未同步 |
| `SubIntent` | AGENT_SPEC §2.2.1, §8.2.3 | ⚠️ AGENT_SPEC §8.2.3 已补充，但 TECHNICAL_SPEC §4.4.2 未同步 |

**风险:** 实现者拿到文档后无法开始编码，因为基础类没有类型定义。

**修复建议:** 在 TECHNICAL_SPEC 或 AGENT_SPEC 中新增"基础类型定义"章节，补充上述全部类型。

---

### C-03: TECHNICAL_SPEC §4-§9 与 AGENT_SPEC §1-§8 代码重复未消除

**位置:** TECHNICAL_SPEC.md §4-§9 vs AGENT_SPEC.md §1-§8

**现状:** 第三轮审查已指出此问题（C-05），但当前状态仅在 TECHNICAL_SPEC §4 开头添加了"详见 AGENT_SPEC"的注释，代码块本身未删除。实际对比：

| 内容 | TECHNICAL_SPEC 行数 | AGENT_SPEC 行数 | 重复率 |
|------|-------------------|---------------|--------|
| Agent 架构图 + 模块依赖图 | §4.1 (1-45 行) | §1.1 (1-57 行) | ~80% |
| AgentRegistry + HubService + IntentClassifier | §4.4 (919-1098 行) | §2.1-2.2.2 (126-308 行) | ~75% |
| LLM Provider 层 | §5 (1114-1323 行) | §3 (352-526 行) | ~70% |
| ReAct Engine | §6 (1325-1441 行) | §4.1 (529-641 行) | ~85% |
| ToolRegistry + 工具实现 | §6.2-6.3 (1444-1626 行) | §4.2-4.3 (643-1019 行) | ~90% |
| 记忆系统 | §7 (1663-1856 行) | §5 (1064-1257 行) | ~75% |
| 反问系统 | §8 (1859-2140 行) | §6 (1377-1602 行) | ~80% |
| 安全设计 | §10 (2032-2510 行) | §10 (2323-2510 行) | ~60% |
| 性能设计 | §11 (2102-2763 行) | §11 (2512-2763 行) | ~70% |

**风险:** 任何修改都需要在两处同步，极易产生漂移。这是之前所有同步问题的根源。

**修复建议:** 将 TECHNICAL_SPEC §4-§9 改为"详见 AGENT_SPEC.md §X"的简短引用，删除逐字重复的代码块。预计可删除 ~600 行。

---

### C-04: UserSetting 表缺失 `key_salt` 字段

**位置:** TECHNICAL_SPEC.md §2.2 vs §5.2

**现状:** §5.2 明确写道：

> "Salt: `os.urandom(16)` 生成 16 字节随机盐（首次使用时生成，存储在 `user_settings` 表的 `key_salt` 字段）"

但 §2.2 UserSetting 表定义中只有以下字段：

```sql
user_id         UUID        PK, FK → User
theme           VARCHAR(32) DEFAULT 'dark'
zoom            FLOAT       DEFAULT 1.0
font_scale      FLOAT       DEFAULT 1.0
view_mode       VARCHAR(8)  DEFAULT 'list'
llm_provider    VARCHAR(32) NULLABLE
llm_model       VARCHAR(128) NULLABLE
llm_api_base    VARCHAR(512) NULLABLE
encrypted_api_key BLOB      NULLABLE
```

**缺少:** `key_salt BLOB NULLABLE`

**风险:** PBKDF2 降级方案无法存储盐值，导致 Fernet 密钥推导失败。

**修复建议:** 在 §2.2 UserSetting 表中添加 `key_salt BLOB NULLABLE` 字段。

---

### C-05: `LLMConfig.api_base` 默认值为空字符串

**位置:** AGENT_SPEC.md §3.2

**现状:** `custom` provider 的 `LLMConfig` 定义为：

```python
class LLMConfig(BaseModel):
    provider: Literal["openai", "anthropic", "deepseek", "custom"]
    model: str
    api_key: str
    api_base: str | None = None  # TECHNICAL_SPEC §5.2 正确
    ...
```

但在 AGENT_SPEC §3.2 的 `PRESET_CONFIGS` 中：

```python
"custom": LLMConfig(
    provider="custom",
    model="",
    api_base="",        # ❌ 空字符串，不是 None
    max_context_tokens=8000,
    ...
)
```

而 `validate_api_base("")` 会返回 `False`（`urlparse("").scheme` 为空，不在 `("http", "https")` 中）。

**风险:** 用户选择 `custom` provider 但不填写 `api_base` 时，验证失败，无法保存配置。

**修复建议:** 将 `api_base=""` 改为 `api_base=None`。

---

### C-06: `Project` 表 UNIQUE 约束未在 SQL 中显式声明

**位置:** TECHNICAL_SPEC.md §2.2

**现状:** 文本描述写 `UNIQUE(user_id, url)`，但 SQL 表定义为：

```sql
CREATE TABLE projects (
    ...
    user_id       UUID NOT NULL REFERENCES users(id),
    url           VARCHAR(512) NOT NULL,
    ...
    -- 缺少: UNIQUE(user_id, url)
);
```

**风险:** 应用层逻辑依赖此约束，但数据库层面无保护。并发场景下可能重复导入相同 URL。

**修复建议:** 在 SQL 中添加 `UniqueConstraint('user_id', 'url')`。

---

### C-07: `agent_messages` 索引在 AGENT_SPEC SQL 中缺失

**位置:** TECHNICAL_SPEC.md §2.2 vs AGENT_SPEC.md §5.2

**现状:** TECHNICAL_SPEC §2.2 写了 `INDEX: (session_id, created_at)`，但 AGENT_SPEC §5.2 的 SQL 中未声明：

```sql
-- AGENT_SPEC §5.2
CREATE TABLE agent_messages (
    ...
    session_id    UUID NOT NULL REFERENCES agent_sessions(id),
    ...
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- 缺少: CREATE INDEX idx_messages_session ON agent_messages(session_id, created_at);
);
```

**风险:** 按会话加载消息历史时全表扫描，性能差。

**修复建议:** 在 AGENT_SPEC §5.2 SQL 中添加索引声明。

---

### C-08: `actions.submit.style` 枚举在 TECHNICAL_SPEC 首版未同步

**位置:** TECHNICAL_SPEC.md §8.2.3

**现状:** 第三轮审查已指出此问题（C-02），但当前 TECHNICAL_SPEC §8.2.3 首版定义仍为：

```typescript
interface AgentQuestion {
  ...
  actions: {
    submit: { text: string; style: "primary" | "secondary" };  // ❌ 仅 2 个选项
    skip?: { text: string; style: "ghost" };
  };
}
```

而 AGENT_SPEC §8.2.3 和 TECHNICAL_SPEC 补充块均为 5 个选项：

```typescript
submit: { text: string; style: "primary" | "secondary" | "ghost" | "danger" | "link" };
```

**风险:** 实现者可能按照 TECHNICAL_SPEC 首版实现，导致前端按钮样式不完整。

**修复建议:** 将 TECHNICAL_SPEC §8.2.3 首版的 `style` 枚举更新为 5 个选项。

---

### C-09: `IntentResult` 和 `SubIntent` 类型在 TECHNICAL_SPEC 未定义

**位置:** TECHNICAL_SPEC.md §4.4.2 vs AGENT_SPEC.md §8.2.3

**现状:** AGENT_SPEC §8.2.3 已补充：

```python
@dataclass
class SubIntent:
    agent_id: str
    message: str
    reason: str

@dataclass
class IntentResult:
    agent_id: Literal["hub", "scout", "mentor", "navigator", "curator", "scribe"]
    confidence: float
    is_multi: bool
    sub_intents: list[SubIntent] = []
```

但 TECHNICAL_SPEC §4.4.2 的 `IntentClassifier.classify()` 返回类型仅写 `IntentResult`，无定义。

**风险:** 实现者在 TECHNICAL_SPEC 中找不到 `IntentResult` 和 `SubIntent` 的定义。

**修复建议:** 在 TECHNICAL_SPEC §4.4.2 中添加类型定义引用或完整定义。

---

### C-10: `ContextBuilder._build_system_prompt()` 未定义

**位置:** TECHNICAL_SPEC.md §7.3.1

**现状:** `build()` 方法调用 `self._build_system_prompt(agent, user_profile, project)`，但该方法无任何实现或伪代码。

```python
def build(self, agent, session, user_profile, project, new_message):
    messages = []
    system = self._build_system_prompt(agent, user_profile, project)  # ❌ 未定义
    messages.append(Message(role="system", content=system))
    ...
```

**风险:** 实现者无法据此编码 System Prompt 组装逻辑。

**修复建议:** 至少给出伪代码或明确标注"待实现，参考 AGENT_SPEC §7.3 System Prompt 模板"。

---

### C-11: `HistoryCompressor._extract_entities()` 未定义

**位置:** TECHNICAL_SPEC.md §7.3.2

**现状:** `_summarize()` 调用 `self._extract_entities(msg.content)`，但该方法无任何实现。

```python
def _summarize(self, messages):
    key_points = []
    for msg in messages:
        if msg.role == "user":
            entities = self._extract_entities(msg.content)  # ❌ 未定义
            ...
```

**风险:** 历史压缩的规则提取部分无法实现。

**修复建议:** 至少给出伪代码或明确标注"待实现，使用正则 + 关键词词典"。

---

### C-12: `capabilities` 字段在 `AgentDefinition` 中缺失

**位置:** TECHNICAL_SPEC.md §4.4.1 vs AGENT_SPEC.md §2.1

**现状:** TECHNICAL_SPEC 的 `AgentDefinition` dataclass 包含 `tools`, `model_override`, `temperature`, `max_tokens`, `streaming`, `auto_trigger`, `priority`，但缺少 `capabilities` 字段。

AGENT_SPEC §2.1 也未定义 `capabilities`，但 `CapabilityDetector` 需要根据 Agent 的 `supports_tools`、`supports_streaming` 等能力决定降级策略。

**风险:** Agent 能力声明不完整，降级逻辑无法正确执行。

**修复建议:** 在 `AgentDefinition` 中添加 `capabilities: list[str]` 字段（如 `["tools", "streaming", "vision"]`）。

---

## 三、🔴 新发现 — 安全性审查（6 项）

### S-01: `api_base` SSRF 校验未挂载到 Pydantic 模型

**位置:** TECHNICAL_SPEC.md §5.2

**现状:** `validate_api_base()` 函数已定义，包含完整的 BLOCKED_NETWORKS blocklist（127.0.0.0/8, 169.254.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, ::1/128, fc00::/7）。但该函数**仅在文本中描述**，未挂载到 `LLMConfig` Pydantic 模型的 `@validator`。

```python
class LLMConfig(BaseModel):
    provider: Literal["openai", "anthropic", "deepseek", "custom"]
    model: str
    api_key: str
    api_base: str | None = None  # ❌ 无 @validator 调用 validate_api_base()
    ...
```

**攻击向量:**

- `api_base: "http://127.0.0.1:19876/api/v1/..."` — 自引用攻击
- `api_base: "http://169.254.169.254/latest/meta-data/"` — 云环境元数据窃取
- `api_base: "http://192.168.x.x:8080/"` — 内网扫描

**修复建议:** 添加 Pydantic validator：

```python
from pydantic import validator

class LLMConfig(BaseModel):
    ...
    @validator('api_base')
    def validate_api_base(cls, v):
        if v and not validate_api_base(v):
            raise ValueError('api_base 指向内部网络，不允许')
        return v
```

---

### S-02: JWT Secret Key 强度要求未在配置管理中强制执行

**位置:** MVP_SCOPE.md §6.4

**现状:** 第三轮审查已指出此问题（S-02），当前 MVP_SCOPE §6.4 写了：

```python
class Settings(BaseSettings):
    jwt_secret_key: str  # 必填，从环境变量读取（决策 S-02 补全：≥ 32 字节 / 256-bit，启动时校验 len ≥ 32）
```

但仅是注释说明，**无实际校验代码**。

**风险:** 开发者可能使用弱密钥（如 `"secret"`），导致 JWT 被伪造。

**修复建议:** 添加 Pydantic validator 或启动时检查：

```python
from pydantic import validator

class Settings(BaseSettings):
    @validator('jwt_secret_key')
    def validate_jwt_secret(cls, v):
        if len(v) < 32:
            raise ValueError('jwt_secret_key 必须 ≥ 32 字节（256-bit）')
        return v
```

---

### S-03: GitHub PAT Scope 未验证

**位置:** MVP_SCOPE.md §4.1

**现状:** `POST /accounts` 绑定 GitHub 的验收标准写"验证连通性"，但第三轮建议的"检查 `X-OAuth-Scopes` 响应头，拒绝权限过大的 PAT"未落实。

**风险:** 用户绑定具有 `admin:org` 或 `delete_repo` 等高权限 PAT，加密密钥泄露时爆炸半径极大。

**修复建议:** 在 MVP_SCOPE §4.1 验收标准中明确：

> 绑定成功后调用 `GET /user` 检查 `X-OAuth-Scopes` 响应头，拒绝超出 `read:user` + `repo` 范围的 PAT，或至少向用户发出警告。

---

### S-04: `search_web` SSRF 防护仅停留在注释

**位置:** AGENT_SPEC.md §4.3

**现状:** `search_web` 工具的注释中写"禁止搜索词中包含 URL（防止通过搜索绕过 SSRF 限制）"，但：

1. 工具本身为 `raise NotImplementedError`
2. 无实际的 URL 检测正则
3. 无搜索 API 响应 URL 的校验

**风险:** 即使未来实现，仅靠"禁止搜索词中包含 URL"不足以防护 SSRF。

**修复建议:** 定义完整的 SSRF 防护规范：
- 搜索 API 只返回标题 + URL + 摘要，不返回完整网页内容
- 对返回的 URL 进行 `validate_api_base()` 校验
- 搜索词中禁止包含 `http://`、`https://`、`://`

---

### S-05: PromptGuard 仅标记不拦截

**位置:** TECHNICAL_SPEC.md §10.3.1 / AGENT_SPEC.md §10.1

**现状:** `PromptGuard.sanitize_user_input()` 对检测到的注入内容仅添加 `[INJECTION_FLAGGED]` 标记，不删除、不阻断：

```python
@staticmethod
def sanitize_user_input(text: str) -> str:
    for pattern in PromptGuard.INJECTION_PATTERNS:
        if re.search(pattern, text):
            logger.warning(f"Suspicious injection attempt: {pattern}")
            return f"[INJECTION_FLAGGED] {text}"  # ❌ 仍将标记后的内容发送给 LLM
    return text
```

**风险:** LLM 仍可能被标记后的注入内容影响。标记本身不足以防护。

**修复建议:** 改为三级响应：
1. **拦截:** 检测到明确注入模式（如 `ignore previous instructions`）→ 直接拒绝，返回错误消息
2. **记录:** 记录攻击尝试到安全日志
3. **提示:** 向用户显示"检测到可疑内容，已拦截"

---

### S-06: 无数据保留策略

**位置:** 全文档

**现状:** 以下表无过期清理机制：

| 表 | 增长速率 | 风险 |
|----|---------|------|
| `agent_messages` | 每条对话消息都插入 | 单用户数月使用可达数十万条 |
| `project_analyses` | 每次 Scout/Mentor 分析插入 | 14 个工具 × 6 Agent × 项目数 |
| `graph_cache` | 每次图谱计算插入 | 5 分钟 TTL，但过期后未清理 |

**风险:** SQLite 文件随使用时间线性增长，最终导致性能退化。

**修复建议:** 
- `agent_messages`: 保留最近 1000 条/会话，超出部分归档或删除
- `project_analyses`: `expires_at` 字段已定义，添加定时清理任务（每天清理过期记录）
- `graph_cache`: 同上，`expires_at` 字段已定义，添加定时清理

---

## 四、🟡 新发现 — 技术可行性审查（8 项）

### T-01: `search_web` 工具未实现（重复 C-01）

**位置:** AGENT_SPEC.md §4.3

**说明:** 这是当前最大的技术阻塞点。作为 P0 工具，它 Scout、Mentor、Navigator、Curator、Scribe、Hub 全部开放，但实现为 `raise NotImplementedError`。

---

### T-02: 核心类型缺失（重复 C-02）

**位置:** 全文档

**说明:** `Message`、`StreamEvent`、`ToolResult`、`ExecutionContext`、`Session`、`ProjectContext`、`MemoryItem`、`TestResult`、`LLMChunk` 等基础类型无正式定义。

---

### T-03: `ContextBuilder._build_system_prompt()` 未定义（重复 C-10）

**位置:** TECHNICAL_SPEC.md §7.3.1

**说明:** 该方法负责组装完整的 System Prompt（AGENT.md + SOUL.md + 工具描述 + 用户画像 + 项目上下文），是 Agent 系统的核心逻辑，但无实现。

---

### T-04: `HistoryCompressor._extract_entities()` 未定义（重复 C-11）

**位置:** TECHNICAL_SPEC.md §7.3.2

**说明:** 该方法负责从用户消息中提取关键实体（技术名词、项目名等），是历史压缩的基础，但无实现。

---

### T-05: `read_source_file` 截断可能在中途截断行

**位置:** AGENT_SPEC.md §4.3

**现状:**

```python
content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
return {
    "path": path,
    "content": content[:8000],  # ❌ 可能在中途截断一行
    "truncated": len(content) > 8000,
}
```

**风险:** 返回的代码片段可能包含不完整的行，影响 LLM 理解和展示。

**修复建议:** 改为按行截断：

```python
lines = content.split("\n")
selected = "\n".join(lines[:200])  # 或按字节截断但保证行完整
return {
    "content": selected,
    "total_lines": len(lines),
    "shown_lines": f"1-{min(200, len(lines))}",
    "truncated": len(lines) > 200,
}
```

---

### T-06: SSE `is_disconnected()` 用法需确认

**位置:** TECHNICAL_SPEC.md §11.3

**现状:** TECHNICAL_SPEC §11.3 补充了 SSE 连接生命周期管理：

```python
async def event_stream(request: Request, hub_service, user_id, session_id, message):
    ...
    if await request.is_disconnected():
        break
    ...
```

但 FastAPI 的 `StreamingResponse` 中，`request.is_disconnected()` 的可用性取决于具体版本。某些版本需要使用 `response.is_disconnected()`。

**修复建议:** 明确 FastAPI 版本要求（>= 0.100.0），或提供兼容写法。

---

### T-07: 浅色主题 CSS 变量缺失

**位置:** TECHNICAL_SPEC.md §12.2

**现状:** TECHNICAL_SPEC §12.2 仅定义了 `:root`（深色主题）变量：

```css
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  ...
}
```

未定义 `[data-theme="light"]`。

**风险:** MVP_SCOPE §8.7 要求"浅色主题必须可用"，但无具体变量定义。

**修复建议:** 在 TECHNICAL_SPEC §12.2 中补充 `[data-theme="light"]` 变量定义。

---

### T-08: 6 个 Agent 全部纳入 v1.0 范围过大

**位置:** PRD.md §3.3, MVP_SCOPE.md §2.1

**现状:** v1.0 要求完整实现 6 个 Agent（Scout / Mentor / Navigator / Curator / Scribe / Hub），每个 Agent 需要：

- 独立的 AGENT.md 行为规范
- 独立的 SOUL.md 性格定义
- 独立的 system_prompt.j2 模板
- 独立的 config.yaml 配置
- 独立的工具集（14 个工具按 Agent 分配）
- 独立的测试用例

**估算:** 仅 Agent 系统的工作量约占整个 v1.0 的 40-50%。

**风险:** 范围过大导致延期，或质量下降。

**修复建议:** 考虑 v1.0 先上线 3 个核心 Agent（Hub + Scout + Mentor），v1.1 再补全 Navigator / Curator / Scribe。

---

## 五、🟢 优化建议（5 项）

| 编号 | 建议 | 影响 |
|------|------|------|
| O-01 | 添加内存预算文档（估算 ~130-260MB 基线） | 部署规划 |
| O-02 | D3.js 力导向图调优指南（alphaDecay, velocityDecay 参数） | 图谱性能 |
| O-03 | 添加 observability 规范（日志级别、metrics 导出） | 运维 |
| O-04 | `agent_permissions` JSON 添加 Pydantic 模型强制执行 | 类型安全 |
| O-05 | 浅色主题 CSS 变量补充（见 T-07） | UI 完整性 |

---

## 六、现代性与规范性评价

### 技术栈选型 — 优秀

| 技术 | 评价 |
|------|------|
| **FastAPI + SQLAlchemy 2.0 + aiosqlite** | 现代异步 Python 全栈，类型安全 |
| **React + Vite + TypeScript strict** | 前端最佳实践 |
| **Zustand** | 轻量状态管理，适合中等复杂度 |
| **LiteLLM** | 统一 LLM 调用层，避免供应商锁定 |
| **D3.js v7** | 可视化灵活度最高 |
| **Pydantic v2 + passlib bcrypt + Fernet** | 安全工具链成熟 |
| **Alembic** | Schema 迁移标准方案 |
| **ReAct Pattern** | 当前 Agent 执行的主流范式 |
| **BYOK (Bring Your Own Key)** | 隐私优先的现代设计 |
| **SSE 流式输出** | 标准实时通信方案 |

### 文档规范性 — 良好

优点：决策追溯体系（N-XX/D-XX/T-XX）、TBD 全局管理、单版本策略、降级设计。

不足：两份 SPEC 之间 ~887 行重复代码是维护负担，建议重构为引用模式；核心类型缺失是规范性硬伤。

### 架构设计 — 良好

分层清晰（Router → Service → Data），Agent 系统可扩展（注册表 + 可插拔工具），BYOK 降级路径完备。主要风险是 SSE 连接管理和搜索工具的实现空缺。

---

## 七、修复优先级建议

### 第一优先级（开工前必修，约 4-6 小时）

1. **C-01: 实现 `search_web` 工具规范** — 至少定义完整接口（DuckDuckGo + 500 字符截断 + PromptGuard 消毒 + SSRF 防护），代码可为占位但规范必须完整
2. **C-02: 补充核心类型定义** — 在 TECHNICAL_SPEC 或 AGENT_SPEC 中新增"基础类型定义"章节，补充 `Message`、`StreamEvent`、`ToolResult`、`ExecutionContext`、`Session`、`ProjectContext`、`MemoryItem`、`TestResult`、`LLMChunk`、`IntentResult`、`SubIntent`
3. **C-03: 消除 SPEC 间代码重复** — 将 TECHNICAL_SPEC §4-§9 改为"详见 AGENT_SPEC.md §X"的简短引用，删除逐字重复的代码块（预计 ~600 行）
4. **S-01: 挂载 `api_base` 校验** — 在 `LLMConfig` 中添加 `@validator('api_base')`，调用 `validate_api_base()`
5. **C-04: UserSetting 表补充 `key_salt` 字段** — 在 §2.2 添加 `key_salt BLOB NULLABLE`

### 第二优先级（Phase 1 前，约 3-4 小时）

6. **S-03: 添加 PAT scope 验证** — 在 `POST /accounts` 验收标准中明确"调用 `GET /user` 检查 `X-OAuth-Scopes`，拒绝超出 `read:user` + `repo` 的 PAT"
7. **C-10: 补充 `_build_system_prompt()`** — 至少给出伪代码或明确标注"待实现，参考 AGENT_SPEC §7.3 System Prompt 模板"
8. **C-11: 补充 `_extract_entities()`** — 至少给出伪代码或明确标注"待实现，使用正则 + 关键词词典"
9. **T-07: 定义浅色主题 CSS** — 在 TECHNICAL_SPEC §12.2 中补充 `[data-theme="light"]` 变量
10. **C-06: Project 表添加 UNIQUE 约束** — 在 SQL 中显式声明 `UniqueConstraint('user_id', 'url')`

### 第三优先级（开发过程中）

11. **S-05: 增强 PromptGuard** — 从"标记"改为"拦截 + 记录 + 提示"
12. **S-06: 添加数据保留策略** — 为 `agent_messages`、`project_analyses`、`graph_cache` 添加清理机制
13. **T-05: `read_source_file` 行截断** — 确保截断发生在行边界
14. **T-06: 确认 SSE `is_disconnected()` 用法** — 明确 FastAPI 版本要求和兼容写法
15. **T-08: 考虑缩减 v1.0 Agent 数量** — 从 6 个减至 3 个（Hub + Scout + Mentor），降低第一版复杂度

---

## 八、与前三轮审查的对比

| 审查轮次 | 审查日期 | 发现问题 | 已修复 | 未修复/新增 |
|---------|---------|---------|--------|------------|
| 第一轮 | 2026-07-03 | 36 项 | 基本完成 | — |
| 第二轮 | 2026-07-03 | 15+ 项 | 基本完成 | — |
| 第三轮 | 2026-07-04 | 24 项 | 23 项 | 1 项 deferred (T-01 search_web) |
| **第四轮（本报告）** | **2026-07-04** | **25 项** | — | **需开工前修复** |

**趋势分析:**
- 第一轮/第二轮的基础冲突（字段名、路径、重复内容）已基本修复
- 第三轮发现的安全性和技术完整性问题部分已修复
- 第四轮新发现的核心问题集中在：**类型定义缺失**、**代码重复未彻底消除**、**安全性校验未挂载**、**P0 工具未实现**

---

## 九、结论

| 审查维度 | 得分 (1-5) | 关键结论 |
|---------|-----------|---------|
| 规范性 | 3 | 决策追溯体系优秀，但核心类型缺失和 C-05 代码重复是规范性硬伤 |
| 现代性 | 5 | 技术栈全部为现代最佳实践 |
| 可行性 | 2 | `search_web` 未实现 + 核心类型缺失是严重阻塞，无法直接开工 |
| 合理性 | 4 | v1.0 单版本 + BYOK + 降级设计合理；6 Agent 范围略显 ambitious |
| 冲突一致性 | 2 | C-05 代码重复、UserSetting 字段遗漏等冲突未解决 |
| 安全性 | 3 | 基础防护到位，但 `api_base` SSRF 校验未挂载、PAT scope 未验证、PromptGuard 偏弱 |
| 技术完整性 | 2 | 数据模型和 API 设计优秀，但代码级类型定义、方法实现大量缺失 |

**最终建议:** **强烈建议在开工前完成第一优先级的 5 项修复**（约 4-6 小时工作量），特别是：

1. `search_web` 工具规范定义
2. 核心类型定义补充
3. SPEC 间代码重复消除
4. `api_base` SSRF 校验挂载
5. UserSetting `key_salt` 字段补充

完成后再进入 Phase 1 开发。否则开发过程中将频繁遇到"文档未定义"的阻塞。

---

*报告结束。所有编号可直接引用（如"修复 C-01"、"修复 S-01"）。*
