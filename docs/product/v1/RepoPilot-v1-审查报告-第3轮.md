# RepoPilot v1.0 — 第三轮全面审查报告

> 审查日期: 2026-07-04
> 审查范围: PRD.md, AGENT_PRD.md, TECHNICAL_SPEC.md, AGENT_SPEC.md, MVP_SCOPE.md
> 关联文档: v1/RepoPilot-v1-文档审查报告.md (第一轮), v1/RepoPilot-v1-文档审查报告-2026-07-03-v2.md (第二轮), v1/RepoPilot-v1-修复验证报告-2026-07-04.md (修复验证)

---

## 〇、总体评估

本轮审查是在三轮历史审查（30+ 问题）和一轮大规模修复（R-07~R-22 全部修复）之后的**终审级别检查**。审查重点：

1. **历史修复验证** — 确认 R-01~R-22 的修复是否真正落实到当前文档
2. **跨文档一致性** — 精确对比 5 份文档的字段、类型、代码定义
3. **安全性深度审查** — 按 OWASP 标准检查认证/加密/注入/SSRF
4. **技术可行性审查** — 检查工具实现、性能瓶颈、资源管理
5. **现代性与规范性** — 对标行业最佳实践

**发现统计:**

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 开工前必修 | 8 | 导致实现歧义或安全风险 |
| 🟡 Phase 1 前完成 | 10 | 影响开发质量 |
| 🟢 后续优化 | 6 | 锦上添花 |

**文档总体质量评价:** 决策追溯体系（决策 N-XX / D-XX / T-XX）做得很好，v1.0 单版本策略清晰，BYOK 降级设计合理。主要问题集中在**两份 SPEC 之间的大量代码重复导致的同步漂移**和**安全细节的缺失**。

---

## 一、历史修复状态验证

基于修复验证报告中 R-01~R-22 的编号，验证当前文档状态：

### 已确认修复 ✅

| 编号 | 问题 | 当前状态 |
|------|------|----------|
| R-01 | TECHNICAL_SPEC §7.2 旧版模型定义冲突 | ✅ §7.2 已改为引用 §2.3，不再重复定义 |
| R-02 | UserSetting 表缺 LLM 字段 | ✅ §2.2 已补充 4 个 LLM 字段 (llm_provider/llm_model/llm_api_base/encrypted_api_key) |
| R-04 | AGENT_SPEC 反问 POST 示例缺 type 字段 | ✅ 当前示例已包含 `type` 判别字段 |
| R-05 | 反问检测机制矛盾 | ✅ ReActEngine 统一为检测 tool_call 结果中的 `question_pending` |
| R-07 | AGENT_SPEC 缺 SSE 事件枚举 | ✅ §2.2.2.1 已添加集中枚举，引用 TECHNICAL_SPEC 决策 T-04 |
| R-08 | agent_permissions JSON vs @tool 不一致 | ✅ 两文档已统一为 6 个 Agent 的工具列表 |
| R-09 | PRD/AGENT_PRD 逐字重复 | ✅ PRD §3.3.1 改为摘要+引用链接 |
| R-10 | AGENT_PRD TBD 自相矛盾 | ✅ §10 已指向 PRD §7.4 为权威 |
| R-11 | get_user_profile 工具缺失 | ✅ AGENT_PRD §5.1 工具表已添加 |
| R-13 | MVP_SCOPE 内部矛盾 | ✅ agentStore/E2E 数量/export 功能已统一 |
| R-14 | 工具数量声明不一致 | ✅ MVP_SCOPE §7.4 统一为 14 个工具 |
| R-15 | slider 字段归类不准确 | ✅ 三分法: radio/drag_sort 用 label, checkbox 用 text, slider 用 labels |
| R-16 | MemoryService 无方法签名 | ✅ AGENT_SPEC §5.1.1 已补充完整方法签名 |
| R-17 | Goal 模型未定义 | ✅ TECHNICAL_SPEC §2.3 已有完整 Goal Pydantic 模型 |
| R-18 | Note/AgentMessage 缺索引 | ✅ 两个表已补充 INDEX 定义 |
| R-19 | AGENT_PRD "唯一权威" 矛盾 | ✅ 头部声明已修正为 "除 TBD 由 PRD 管理外" |
| R-21 | yield from 异步错误 | ✅ 当前代码使用 `async for event in ...: yield event` |
| R-22 | Notes 端点路径归属歧义 | ✅ 项目笔记端点已移至 Projects 节 |

### 未修复 ❌

| 编号 | 问题 | 当前状态 |
|------|------|----------|
| R-03 | DEVELOPMENT_PROCESS.md 版本策略冲突 | ❌ 用户选择暂不处理（不在本次审查范围内） |
| R-06 | docs/product/README.md 几乎未修复 | ❌ 不在本次审查范围内（非 PRD/SPEC/MVP） |
| R-12 | DEVELOPMENT_PROCESS.md LLM_API_KEY 环境变量 | ❌ 不在本次审查范围内 |
| R-20 | 根 README.md v2.0 vs v1.0 | ❌ 不在本次审查范围内 |

---

## 二、🔴 新发现 — 跨文档一致性（8 项）

### C-01: AgentQuestion `intro` 字段类型三方冲突

三份定义互相矛盾：

| 位置 | intro 类型 |
|------|-----------|
| TECHNICAL_SPEC §8.2.3 首版 | `{ type: "markdown"; content: string }` |
| TECHNICAL_SPEC §8.2.3 补充块 (决策 T-02/T-05) | `intro?: string` (可选，纯字符串) |
| AGENT_SPEC §6.2.3 | `{ type: "markdown"; content: string }` |

TECHNICAL_SPEC **自身矛盾**：同一节内有两个不同定义。AGENT_SPEC 只匹配首版。

**修复建议：** 统一为结构化对象 `{ type: "markdown"; content: string }`，删除 TECHNICAL_SPEC 补充块中的旧定义。

---

### C-02: `actions.submit.style` 枚举不一致

| 位置 | 枚举值 |
|------|--------|
| TECHNICAL_SPEC §8.2.3 首版 | `"primary" \| "secondary"` (2 个) |
| TECHNICAL_SPEC 补充块 (决策 T-02) | `"primary" \| "secondary" \| "ghost" \| "danger" \| "link"` (5 个) |
| AGENT_SPEC §6.2.3 | 5 个 (与补充块一致) |

TECHNICAL_SPEC 首版定义未同步决策 T-02 的扩展。

**修复建议：** TECHNICAL_SPEC §8.2.3 首版 AgentQuestion 的 style 枚举更新为 5 个选项。

---

### C-03: AgentPreferences 字段集完全不重叠

| 位置 | 字段 |
|------|------|
| TECHNICAL_SPEC §2.3 (权威) | `verbosity`, `use_emoji`, `auto_ask_questions`, `max_questions_per_session` |
| AGENT_SPEC §5.3 | `mentor_style` (仅 1 个字段) |

两者没有任何共同字段。AGENT_SPEC §5.3 虽标注"完整定义见 TECHNICAL_SPEC §2.3"，但自身定义的 `mentor_style` 不在 §2.3 中。

**修复建议：** AGENT_SPEC §5.3 的 AgentPreferences 删除或改为引用 §2.3；如果要保留 `mentor_style`，应将其加入 TECHNICAL_SPEC §2.3。

---

### C-04: Agent config.yaml 工具列表 vs @tool 声明脱节

Mentor 的 config.yaml (AGENT_SPEC §7.4) 列出 10 个工具，但 AGENT_SPEC §4.3 只有 4 个 `@tool` 声明（`query_user_projects`, `get_user_profile`, `read_source_file`, `ask_user_question`）。其余 6 个工具（`read_readme`, `search_web`, `get_project_analysis`, `compare_projects`, `update_user_profile`, `save_to_memory`, `recall_from_memory`）**在整个 AGENT_SPEC 中没有任何实现代码**。

**风险：** 开发者拿到 config.yaml 去实现时，不知道这 6 个工具的参数结构、返回值格式、allowed_agents。

**修复建议：** 为缺失的 6 个工具补充 `@tool` 声明（至少包含 parameters JSON Schema 和返回值示例），或在 TECHNICAL_SPEC 中指定一个权威工具注册表。

---

### C-05: TECHNICAL_SPEC ↔ AGENT_SPEC ~887 行代码重复

AGENT_SPEC §1-§8 约 75-85% 的代码块与 TECHNICAL_SPEC §4-§9 逐字重复（仅章节号不同）。这种大规模重复是之前所有同步漂移问题的根源。

**修复建议：** 明确权威划分策略——TECHNICAL_SPEC 仅提供架构概览摘要 + 引用链接，AGENT_SPEC 作为 Agent 系统代码的**唯一权威**。TECHNICAL_SPEC §4-§9 改为"详见 AGENT_SPEC §X"的简短引用。

---

### C-06: PRD/AGENT_PRD 的 goals JSON 示例使用错误字段名

AGENT_PRD §3.2 的用户画像 JSON 示例：

```json
{ "description": "全栈开发", "deadline": "2026-12", "progress": 0.3 }
```

但 TECHNICAL_SPEC §2.3 的 Goal 模型定义为：

```python
class Goal(BaseModel):
    title: str              # 不是 description
    deadline: date | None
    priority: int = 3       # 示例中缺失
    status: Literal["active", "achieved", "abandoned"]  # 不是 progress: float
```

三处不匹配：`description` → `title`、`progress` (float) → `status` (enum)、缺失 `priority`。

**修复建议：** AGENT_PRD §3.2 的 JSON 示例更新为 `{ "title": "全栈开发", "deadline": "2026-12", "priority": 3, "status": "active" }`。

---

### C-07: README 缓存 TTL 矛盾 (1 小时 vs 24 小时)

| 位置 | TTL |
|------|-----|
| TECHNICAL_SPEC §11.3 缓存策略表 | 1 小时 |
| MVP_SCOPE §8.4 工程约束 | 24h ("超过 24h 则后台异步刷新") |

**修复建议：** 统一为一个值。建议 24h（README 变化不频繁，1h 刷新浪费 GitHub API 配额）。

---

### C-08: AGENT_SPEC §5.3 UserProfile 缺失 user_id 字段

AGENT_SPEC §5.3 的 UserProfile class 定义从 `tech_proficiency` 开始，缺少 `user_id: UUID` 和 `updated_at: datetime` 字段。虽然标注了"完整字段定义见 TECHNICAL_SPEC §2.3"，但这个省略容易导致实现者遗漏主键。

**修复建议：** AGENT_SPEC §5.3 至少在 class 定义的首行添加注释 `# PK: user_id: UUID (见 TECHNICAL_SPEC §2.3)`，或补全字段。

---

## 三、🔴 新发现 — 安全性审查（6 项）

### S-01: SSRF via custom `api_base` — 无 URL 校验

`LLMConfig` 的 `custom` provider 允许用户填写任意 `api_base` URL，该值直接传给 `litellm.acompletion()`。现有 SSRF 防护（决策 N-S-06）仅覆盖项目 URL，**对 `api_base` 无任何校验**。

攻击向量：

- `api_base: "http://127.0.0.1:19876/api/v1/..."` — 自引用攻击
- `api_base: "http://169.254.169.254/latest/meta-data/"` — 云环境元数据窃取
- `api_base: "http://192.168.x.x:8080/"` — 内网扫描

**修复建议：** 在 `LLMConfig` 验证中添加 SSRF blocklist（127.0.0.0/8, 169.254.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, ::1）。

---

### S-02: JWT Secret Key 无最低强度要求

`jwt_secret_key: str` 在 MVP_SCOPE §6.4 中定义为必填环境变量，但未指定：最低长度（HS256 需要 ≥256-bit / 32 字节）、生成方式（`secrets.token_hex(32)`）、轮换机制。

**修复建议：** 在 MVP_SCOPE §6.4 配置管理中添加强制要求：`jwt_secret_key` 必须 ≥ 32 字节，应用启动时校验。

---

### S-03: PBKDF2 降级方案参数未定义

Fernet 密钥的 PBKDF2 降级方案（OS 密钥链不可用时）存在多处未定义：

- `machine_id` 获取方式未指定（Windows MachineGuid? macOS IOPlatformUUID?）
- 迭代次数未指定（OWASP 建议 ≥600,000）
- `user_salt` 生成方式未指定
- PBKDF2 输出长度未指定（Fernet 需要恰好 32 字节）

如果 `machine_id` 可预测，本地攻击者可推导出相同加密密钥，解密所有 API Key 和 GitHub PAT。

**修复建议：** 明确 PBKDF2 参数（600K+ 迭代、`os.urandom(16)` 生成 salt、输出 32 字节），并定义 `machine_id` 获取方法。或改用 master password 方案。

---

### S-04: Refresh Token 无轮换机制

`POST /auth/refresh` 返回新 `access_token`，但未说明是否同时签发新 `refresh_token`（轮换）。无轮换意味着被盗 refresh_token 在 7 天内可反复使用。OWASP 建议每次使用 refresh_token 时签发新的并废弃旧的。

**修复建议：** `POST /refresh` 同时签发新 access_token + 新 refresh_token，将旧 refresh_token 标记为 `revoked_at`。

---

### S-05: `search_web` 工具安全完全未定义

`search_web` 对所有 Agent 开放（最高风险暴露面），但没有任何实现定义：未指定搜索 API（DuckDuckGo? SerpAPI?）、未定义 URL 校验（SSRF 风险）、未定义响应大小限制、未定义获取的网页内容是否需要消毒（prompt injection 注入风险）。

**修复建议：** 指定搜索 API 提供商、添加 SSRF blocklist、限制响应大小（≤4000 字符）、对获取的网页内容进行 prompt injection 标记。

---

### S-06: GitHub PAT 无作用域校验

`POST /accounts` 绑定 GitHub 时仅验证连通性，不检查 PAT 的作用域（scopes）。过大权限的 PAT（如 `admin:org`, `delete_repo`）在加密密钥泄露时增加爆炸半径。

**修复建议：** 绑定后调用 `GET /user` 并检查 `X-OAuth-Scopes` 响应头，拒绝或警告权限过大的 PAT。最低要求 `read:user` scope。

---

## 四、🟡 新发现 — 技术可行性审查（10 项）

### T-01: `search_web` 工具无实现规范

作为唯一一个需要第三方外部服务的工具，search_web 的缺失比任何工具都严重。需要明确：搜索 API 提供商、API Key 管理（是否也算 BYOK?）、响应 Schema、超时设置、错误处理。

**修复建议：** 在 TECHNICAL_SPEC 或 AGENT_SPEC 中补充完整的 search_web 实现规范。建议 v1.0 使用 DuckDuckGo Instant Answer API（免费、无需 API Key）或 Brave Search API（有免费额度）。

---

### T-02: `read_source_file` 截断后无续读机制

工具将文件内容截断在 8000 字符（约 200 行），返回 `truncated: true` 标记，但 Agent 没有任何工具来获取剩余内容。对于 Mentor Agent 的核心场景（深度源码分析），这是一个严重的能力缺口。

**修复建议：** 添加可选参数 `start_line` 和 `end_line`，或添加 `offset` + `limit` 参数，让 Agent 可以分段读取大文件。

---

### T-03: SSE 连接生命周期管理未定义

SPEC §11.1 展示了基于 `asyncio.Queue` 的 SSE 实现，但缺少：

- **客户端断连检测** — 用户导航离开 AgentPage 后，producer 继续运行消耗 LLM API 额度
- **任务取消** — 无 `try/finally` 和 `asyncio.Task.cancel()` 逻辑
- **连接超时** — 无最大连接时长限制，LLM 挂起时连接永远不关闭
- **僵尸 producer** — 20 个被放弃的对话 = 20 个后台 producer 持续消耗 API credits

**修复建议：** 添加 `Request.is_disconnected()` 轮询、`asyncio.Task.cancel()` 断连取消、最大连接时长（如 5 分钟）。

---

### T-04: TF-IDF `stop_words='english'` 对中文内容无效

`TfidfVectorizer(stop_words='english', ngram_range=(1,2))` 默认 `token_pattern=r"(?u)\b\w\w+\b"` 会把整句中文当作一个 token 或完全跳过。由于项目描述和用户笔记可能包含中文，图谱相似度计算对这些项目会失效。

**修复建议：** 在 MVP_SCOPE §8.2 中明确记录这是一个已知限制。可考虑使用自定义 `token_pattern` 或字符级 n-gram 来改善中文分词效果。

---

### T-05: 测试基础设施缺失

MVP_SCOPE §6.2 指定了 70% 覆盖率目标，但无 conftest.py、无 fixture 策略、无 mock 方案（LLMProvider、GitHubService）、无测试数据库配置。开发顺序步骤 11 才"补全测试"，但测试基础应在步骤 1 就建立。

**修复建议：** MVP_SCOPE §10 步骤 1 中添加"建立 conftest.py + fixture（AsyncSession、mock LLMProvider、mock GitHubService）"。

---

### T-06: HistoryCompressor 的实体提取对中文脆弱

`_extract_entities` 使用正则 + 关键词词典，对于中英混合文本质量不稳定。英文技术名词提取良好，但中文表述（如"那个做虚拟DOM的框架"）无法匹配。

**修复建议：** 记录为已知限制。v1.0 可接受，v1.1+ 考虑引入轻量分词。

---

### T-07: GitHub PAT scope 验证缺失

已在安全部分 S-06 提及，同时也是一个技术实现缺口——需要在绑定流程中添加 scope 检查逻辑。

---

### T-08: 前端数据获取库未做最终决策

SPEC §12.3 写"SWR 或 React Query"未做最终选择。如果项目已有代码使用了 `@tanstack/react-query`（根据审查发现的引用），应在 SPEC 中明确指定。

**修复建议：** TECHNICAL_SPEC §12.3 和 MVP_SCOPE §6.1 统一指定 `@tanstack/react-query`。

---

### T-09: `import litellm` 位置可优化

`LLMProvider.complete()` 方法内部 `import litellm` 是延迟导入模式。虽然功能正确，但隐藏了依赖关系，妨碍静态分析和启动时错误报告。

**修复建议：** 改为模块级 `try/except ImportError` 守卫，设置 `HAS_LITELLM` 标志。

---

### T-10: JSON 字段无大小限制

`user_profiles.extensions` (`dict[str, Any]`) 和 `agent_permissions` 等 JSON 字段无应用层大小限制。Prompt injection 攻击可能通过 Agent 写入无界数据导致 SQLite 性能退化。

**修复建议：** 在 Pydantic 验证器中添加 max size（如 64KB/字段、max 100 keys、key 长度 ≤128 字符）。

---

## 五、🟢 优化建议（6 项）

| 编号 | 建议 | 影响 |
|------|------|------|
| O-01 | 添加内存预算文档（估算 ~130-260MB 基线） | 部署规划 |
| O-02 | D3.js 力导向图调优指南（alphaDecay, velocityDecay 参数） | 图谱性能 |
| O-03 | 添加 observability 规范（日志级别、metrics 导出） | 运维 |
| O-04 | Agent 消息表添加数据保留策略（如保留最近 1000 条/会话） | 长期性能 |
| O-05 | 登录端点补充 username-based 速率限制（补充 IP-based） | 安全增强 |
| O-06 | 添加最大并发会话限制（如 max 5 个 active refresh_token） | 安全增强 |

---

## 六、现代性与规范性评价

### 技术栈选型 — 优秀

| 技术 | 评价 |
|------|------|
| FastAPI + SQLAlchemy 2.0 + aiosqlite | 现代异步 Python 全栈，类型安全 |
| React + Vite + TypeScript strict | 前端最佳实践 |
| Zustand | 轻量状态管理，适合中等复杂度 |
| LiteLLM | 统一 LLM 调用层，避免供应商锁定 |
| D3.js v7 | 可视化灵活度最高 |
| Pydantic v2 + passlib bcrypt + Fernet | 安全工具链成熟 |
| Alembic | Schema 迁移标准方案 |

### 文档规范性 — 良好

优点：决策追溯体系（N-XX/D-XX/T-XX）、TBD 全局管理、单版本策略、降级设计。

不足：两份 SPEC 之间 ~887 行重复代码是维护负担，建议重构为引用模式。

### 架构设计 — 良好

分层清晰（Router → Service → Data），Agent 系统可扩展（注册表 + 可插拔工具），BYOK 降级路径完备。主要风险是 SSE 连接管理和搜索工具的实现空缺。

---

## 七、修复优先级建议

### 第一优先级（开工前，约 2-3 小时）

1. **C-01 + C-02**: 统一 TECHNICAL_SPEC §8.2.3 内的 AgentQuestion 类型定义（删除旧版，保留结构化 intro + 5-option style）
2. **C-03**: 统一 AgentPreferences 定义（AGENT_SPEC §5.3 引用 TECHNICAL_SPEC §2.3）
3. **C-06**: 修正 AGENT_PRD §3.2 goals JSON 示例字段名
4. **S-01**: 为 LLMConfig api_base 添加 SSRF blocklist 校验
5. **S-02**: JWT secret key 添加强度要求

### 第二优先级（Phase 1 前，约 3-4 小时）

6. **C-05**: 重构 TECHNICAL_SPEC §4-§9 为简短引用（消除 887 行重复）
7. **C-04**: 补充缺失的 6 个工具的 @tool 声明
8. **S-03**: 完善 PBKDF2 降级参数定义
9. **S-04**: Refresh token 添加轮换机制
10. **S-05**: 补充 search_web 工具实现规范
11. **T-02**: 为 read_source_file 添加分段读取参数

### 第三优先级（开发过程中）

12. **T-03**: SSE 连接生命周期管理
13. **T-04 + T-06**: 记录中文处理已知限制
14. **T-05**: 建立测试基础设施
15. **T-08 + T-09 + T-10**: 前端库/导入优化/JSON 限制

---

*报告结束。所有编号可直接引用（如"修复 C-01"、"修复 S-01"）。*
