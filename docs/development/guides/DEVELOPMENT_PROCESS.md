# RepoPilot — 开发流程文档

> 版本: 1.0.0 | 日期: 2026-07-03

---

## 1. 开发方法论

采用 **增量迭代 + 质量门禁** 的开发方式。每个开发阶段（Phase）必须通过三道质量门才能进入下一阶段：

```
编码实现 → 通过性测试 → 安全审查 → 代码审查 → ✅ 通过 → 下一阶段
                │            │           │
                ▼            ▼           ▼
              不通过       不通过      不通过 → 修复后重新提交
```

---

## 2. 质量门禁 (Quality Gates)

### Gate 1: 通过性测试

每个阶段必须有对应的测试覆盖，测试通过方可继续。

**测试层级:**

| 层级 | 工具 | 覆盖范围 | 通过标准 |
|------|------|---------|---------|
| 单元测试 | pytest + pytest-asyncio | Service 层、工具函数 | 核心逻辑 100% 覆盖 |
| API 测试 | httpx + pytest | 所有 API 端点 | 正常 + 异常路径均覆盖 |
| 前端测试 | Vitest + Testing Library | 组件、Hooks | 关键交互路径覆盖 |
| E2E 测试 | Playwright | 完整用户流程 | 核心场景 100% 通过 |
| 手动测试 | 人工 | UI 视觉、交互体验 | 无视觉错位、无交互卡死 |

**执行方式:**
```bash
# 后端测试
pytest backend/ -v --cov=backend --cov-report=term-missing

# 前端测试
cd frontend && npm run test

# E2E 测试
cd frontend && npx playwright test

# 全量测试 (CI)
make test-all
```

### Gate 2: 安全审查

每个阶段完成后进行安全审查，检查清单如下：

**必查项 (每个阶段):**

- [ ] 所有数据 API 端点均有 `Depends(get_current_user)` 保护
- [ ] 用户输入经过 Pydantic Schema 校验，无原始数据直入数据库
- [ ] 密码/Token 不以明文出现在响应、日志、前端存储中
- [ ] SQL 查询使用 ORM 参数化，无字符串拼接
- [ ] 文件操作路径经过校验，无目录遍历风险
- [ ] 错误响应不暴露内部堆栈信息

**阶段性审查 (按 DEVELOPMENT_ROADMAP.md Phase 0~11):**

| 阶段 | 额外审查项 |
|------|-----------|
| Phase 0 (项目初始化) | CI 流水线安全配置、pre-commit hooks 有效性、依赖锁文件无已知漏洞 |
| Phase 1 (骨架) | bcrypt cost >= 12, JWT 过期时间合理, refresh token 轮换, 速率限制 (Auth 5/min/IP, 全局 60/min), LogSanitizer 中间件, CORS 白名单 |
| Phase 2 (项目核心) | URL 校验防 SSRF, 批量导入数量限制 (<=500), N+1 防护, get_current_user 缓存 |
| Phase 3 (GitHub 集成) | PAT 加密存储 (Fernet), GitHub API 速率限制处理, 文件上传类型校验 |
| Phase 4 (笔记+图谱) | Markdown XSS 过滤, 笔记大小限制, 跨用户访问隔离, TF-IDF sparse 矩阵内存安全 |
| Phase 5 (设置+LLM) | BYOK API Key 加密存储 (SecureKeyStore), LLMConfig Literal 类型限定, 密钥不落盘明文 |
| Phase 6 (Agent 核心) | Prompt 注入防护, Tool 权限隔离, SubIntent 边界校验 |
| Phase 7 (Agent API+SSE) | SSE 流安全, PromptGuard 实现, System Prompt 分隔符, 端点鉴权完整 |
| Phase 8 (Agent 前端) | XSS 防护 (用户输入渲染), CSP 头配置, SSE 连接鉴权 |
| Phase 9 (记忆系统) | UserProfile 数据隔离, 会话历史加密存储, 跨用户数据不可访问 |
| Phase 10 (Scout 集成) | ProjectAnalysis 缓存键防碰撞, GraphCache 失效机制正确性 |
| Phase 11 (质量) | 全量安全回归测试, 依赖漏洞扫描, 渗透测试关键路径 |

**安全审查记录:** 每个阶段的安全审查结果记录在 `docs/security_reviews/phase_N.md`。

### Gate 3: 代码审查

**审查维度:**

| 维度 | 标准 |
|------|------|
| 可读性 | 函数 ≤ 50 行，文件 ≤ 500 行，命名清晰无缩写 |
| 可维护性 | 单一职责，依赖注入，无循环依赖 |
| 类型安全 | TypeScript strict mode，Pydantic 类型校验 |
| 错误处理 | 无空 catch，异常有明确类型和消息 |
| 测试 | 新功能有对应测试，修改 bug 有回归测试 |
| 文档 | API 端点有 docstring，复杂逻辑有注释 |
| 代码规范 | ESLint 零 warning，Ruff 零 warning |

**代码规范工具:**

```bash
# Python
ruff check backend/          # Lint
ruff format backend/         # Format
mypy backend/                # Type check

# TypeScript/React
npx eslint src/              # Lint
npx prettier --write src/    # Format
npx tsc --noEmit             # Type check
```

---

## 3. Git 工作流

### 3.1 分支策略

```
main          ← 稳定版本，每个 Phase 合并一次
  └── develop ← 开发主线
       ├── feature/auth-system
       ├── feature/project-crud
       ├── feature/agent-integration
       ├── feature/graph
       └── feature/notes
```

### 3.2 提交规范

```
<type>(<scope>): <description>

type: feat | fix | refactor | docs | test | chore | style
scope: auth | project | agent | graph | note | ui | infra
```

示例:
```
feat(auth): implement JWT login with refresh token
fix(project): correct URL dedup logic in batch import
test(graph): add integration tests for TF-IDF similarity
```

### 3.3 合并流程

1. Feature 分支开发完成
2. 通过三道质量门禁
3. Rebase 到 develop 最新
4. 创建 PR，描述变更内容
5. Code Review 通过
6. Squash Merge 到 develop
7. Phase 所有任务完成后，develop merge 到 main，打 tag

---

## 4. 环境配置

### 4.1 开发环境要求

| 工具 | 版本 |
|------|------|
| Python | 3.11+ |
| Node.js | 20+ |
| pnpm | 9+ |
| Git | 2.40+ |
| SQLite | 3.40+ (系统自带) |

### 4.2 环境变量 (.env)

```env
# 数据库
DATABASE_URL=sqlite+aiosqlite:///./data/repopilot.db

# JWT
JWT_SECRET_KEY=<random-64-char-hex>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Agent
# LLM_API_KEY 仅用于开发/测试环境的 fallback。生产环境下 LLM Key 由用户在
# Settings 页面通过 BYOK 方式配置，存储在 user_settings 表的 encrypted_api_key 字段中。
LLM_PROVIDER=openai          # openai / anthropic / local
LLM_MODEL=gpt-4o
LLM_API_KEY=<your-api-key>
LLM_API_BASE=                 # 可选，自定义 API 地址

# GitHub
GITHUB_CLIENT_ID=             # 可选，用于 OAuth
GITHUB_CLIENT_SECRET=         # 可选

# 应用
APP_ENV=development
APP_DEBUG=true
APP_HOST=127.0.0.1
APP_PORT=19876
```

### 4.3 启动命令

```bash
# 后端
uvicorn backend.main:app --reload --host 127.0.0.1 --port 19876

# 前端
cd frontend && pnpm dev

# 桌面端 (打包后)
python main.py
```

---

## 5. 版本发布

RepoPilot 采用 **v1.0 单版本完整发布** 策略，不按 Phase 递增 MINOR 版本号。

| 版本号 | 规则 |
|--------|------|
| MAJOR (x.0.0) | 不兼容的 API 变更 |
| MINOR (0.x.0) | 新功能 (向下兼容) |
| PATCH (0.0.x) | Bug 修复 |

**发布规则：**

- DEVELOPMENT_ROADMAP.md 中全部 12 个 Phase（Phase 0~11）完成后，统一发布 **v1.0**
- 单个 Phase 完成不触发版本号递增，仅作为内部开发里程碑
- v1.0 发布后，后续版本（v1.1、v1.2...）按 SemVer 规则递增
- 打包使用 PyInstaller + 前端 build 产物
