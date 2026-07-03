# RepoPilot 文档中心 (Documentation Hub)

> RepoPilot 所有文档、记录、变更、问题跟踪的统一入口。
> 文档按**维度**（产品/架构/开发/接口/调试）组织，避免按"随意分类"导致后期失控。

---

## 1. 文档权威性规则 (Document Authority)

**PRD > SPEC > MVP > 其他任何文档**

权威性递减，具体性递增：

- **PRD** 最抽象（产品视角）：定义"做什么" + 完整产品的成功标准
- **SPEC** 最详细（技术视角）：定义"怎么做"（架构、数据、API、安全、性能）
- **MVP** 最聚焦（实施视角）：定义"**这个版本**做什么 / 不做什么 / 怎么验收"
- **其他文档**（开发日志、过程记录、临时笔记）权重最低

冲突解决规则详见 `docs/product/README.md` §1。

> **核心原则：任何与 PRD/SPEC/MVP 冲突的开发笔记必须先升级文档，再修改代码。**

---

## 2. 5 层文档模型

RepoPilot 文档按**维度**组织：

```
docs/
├── product/         # 产品定义层   (做什么)
├── architecture/    # 架构设计层   (怎么设计)
├── development/     # 开发演化系统 (核心，记录实际怎么演化)
├── api/             # 接口层       (怎么被使用)
└── debug/           # 临时记录层   (快速记问题)
```

### 各层职责一句话总结

| 维度 | 一句话 | 决定什么 |
|------|--------|---------|
| `product/` | 决定**要做什么系统** | 做什么 |
| `architecture/` | 描述**系统如何组织运行** | 怎么设计 |
| `development/` | 记录**系统如何一步步变成现在** | 实际怎么演化（核心） |
| `api/` | 说明**系统如何被外部调用** | 怎么被使用 |
| `debug/` | **快速记问题，不结构化** | 哪里有问题（草稿） |

---

## 3. 各目录详细说明

### 3.1 `product/` — 产品定义层 (做什么)

**存放：**
- PRD（产品需求）
- SPEC（技术规格）
- MVP 范围定义

**职责：** 决定"要做什么系统"。

**特点：**
- 稳定（PRD/SPEC 每个主版本固定）
- 版本化（v1 / v2 / v3...）
- 不频繁变动

**子结构：**

```
product/
└── v1/
    ├── prd/                # PRD - 产品需求
    │   ├── PRD.md
    │   └── AGENT_PRD.md
    ├── spec/               # SPEC - 技术规格
    │   ├── TECHNICAL_SPEC.md
    │   └── AGENT_SPEC.md
    └── mvp/                # MVP - 各子版本范围
        ├── MVP_SCOPE_v0.1.md
        └── ...
```

**详细说明：** `docs/product/README.md`

---

### 3.2 `architecture/` — 架构设计层 (怎么设计)

**存放：**
- 系统结构设计
- Agent 架构
- Memory / Tool / Workflow 设计

**职责：** 描述系统如何组织运行。

**特点：**
- 偏设计文档
- 不直接记录开发过程

**子结构（计划）：**

```
architecture/
├── overview.md              # 系统总览
├── agent-architecture.md    # Agent 架构
├── memory-system.md         # 记忆系统
└── tool-calling.md          # 工具调用
```

> 当前 `architecture/` 目录已创建（待填充内容）。架构内容目前分散在 `product/v1/spec/TECHNICAL_SPEC.md` 中，后续按此结构拆分。

---

### 3.3 `development/` — 核心演化系统 (最重要)

**职责：** "系统是怎么一步步变成现在的"。

这是整个文档体系的**真实历史记录**。所有开发活动的事实、变更、问题、实验都沉淀在这里。

#### 3.3.1 `development/guides/`

**存放：**
- 开发规范
- Coding rules
- Agent 开发流程

**职责：** "应该怎么开发"。

**特点：** **永远不参与变更**（它是规则，不是记录）。

#### 3.3.2 `development/process/`

**存放：**
- 开发流程拆解
- 各子版本的实际开发步骤
- 任务清单与验收对照

**职责：** "开发流程是什么结构" + "这次开发实际做了什么"。

**子结构：**

```
process/
├── v0.1.md          # v0.1 子版本开发步骤（含实际进度）
├── v0.2.md          # v0.2 子版本开发步骤
└── ...
```

> **与 MVP 的关系：** MVP 写"做什么 / 不做什么 / 怎么验收"，process 写"实际怎么做的 / 做到了什么程度 / 遇到什么问题"。

#### 3.3.3 `development/logs/` (关键)

**存放：**
- 按时间记录的开发事实
- 每天/每周变化

**职责：** "系统是怎么一步步变成现在的"。

**子结构：**

```
logs/
├── 2026-07.md
├── 2026-08.md
└── ...
```

#### 3.3.4 `development/changes/` (关键)

**存放：** 按 commit 类型分类的代码变更记录。

**职责：** "发生了什么代码级变化"。

**子结构：**

```
changes/
├── fix/             # bug 修复
├── feat/            # 新功能
├── refactor/        # 重构
├── docs/            # 文档更新
├── chore/           # 杂项
├── style/           # 代码风格
├── test/            # 测试相关
├── perf/            # 性能优化
├── build/           # 构建系统
└── ci/              # CI/CD
```

> 与 `issues/` 不同：changes = 已经发生的修改，issues = 发现的问题。

#### 3.3.5 `development/issues/` (debug 升级版)

**存放：** 结构化的问题记录。

**职责：** "系统哪里有问题"。

**子结构：**

```
issues/
├── bug/             # bug 问题
├── performance/     # 性能问题
├── ux/              # 体验问题
├── improvement/     # 可改进点
└── investigation/   # 未确定原因问题
```

#### 3.3.6 `development/experiments/`

**存放：**
- Prompt 实验
- Agent 策略测试
- Tool calling 失败案例

**职责：** "尝试过什么，但不一定成功"。

#### 3.3.7 `development/changelog/`

**存放：** 对外版本发布记录。

**职责：** "对用户发布了什么"。

**子结构：**

```
changelog/
├── CHANGELOG.md
└── versions/
    ├── 0.1.0.md
    ├── 0.1.1.md
    └── ...
```

---

### 3.4 `api/` — 接口层

**存放：**
- API 文档
- Endpoint 说明
- 请求/响应结构

**职责：** "系统如何被外部调用"。

> 当前 `api/` 目录已创建（待填充内容）。API 端点定义在 `product/v1/spec/TECHNICAL_SPEC.md` §3。

---

### 3.5 `debug/` — 快速记录层 (临时)

**存放：**
- 临时问题记录
- 未分类现象
- 开发过程中随手记

**职责：** "快速记问题，不结构化"。

**特点：**
- 可以后期迁移到 `development/issues/` 或 `development/changes/`
- **不参与权威性决策**（与 PRD/SPEC/MVP 冲突时永远是 PRD/SPEC/MVP 优先）

---

## 4. 关键原则 (避免以后混乱)

### 4.1 changes ≠ issues

- **changes** = 已经发生的修改（事实）
- **issues** = 发现的问题（待解决）

### 4.2 logs ≠ changelog

- **logs** = 内部真实历史（按时间）
- **changelog** = 对外发布总结（按版本）

### 4.3 debug ≠ issues

- **debug** = 临时/未分类记录（草稿）
- **issues** = 已结构化问题（待跟进）

### 4.4 guides 永远不参与变更

它是"规则"，不是"记录"。修改 guides 需要明确说明"为什么改规则"。

### 4.5 文档权威性不可越级

- `debug/` 不能修改 `product/`
- `development/logs/` 不能修改 `product/`
- `development/process/` 只能引用 `product/`，不能反过来改 `product/`
- `product/MVP` 只能引用 `product/SPEC`，不能反过来改 `product/SPEC`
- `product/SPEC` 只能引用 `product/PRD`，不能反过来改 `product/PRD`

```
product/PRD (权威性最高，固定)
  ↓ 唯一方向
product/SPEC (固定)
  ↓ 唯一方向
product/MVP (固定)
  ↓ 唯一方向
development/process (随时更新)
  ↓
development/{logs, changes, issues, ...} (随时记录)
```

**任何逆向修改都是文档腐烂的起点。**

---

## 5. 当前状态

### 5.1 目录状态

| 目录 | 状态 | 备注 |
|------|------|------|
| `product/` | ✅ 完整 | 详见 `product/README.md` |
| `architecture/` | ✅ 已创建（待填充） | 空目录 |
| `api/` | ✅ 已创建（待填充） | 空目录 |
| `debug/` | ✅ 已创建（待填充） | 空目录 |
| `development/guides/` | ✅ 有内容 | `DEVELOPMENT_PROCESS.md` |
| `development/process/` | ✅ 已创建（待填充） | 空目录 |
| `development/logs/` | ✅ 已创建（待填充） | 空目录 |
| `development/changes/` | ✅ 已创建（待填充） | 9 个 commit 类型子目录（fix/feat/refactor/docs/chore/style/test/perf/build/ci），均空 |
| `development/issues/` | ✅ 已创建（待填充） | 5 个问题类型子目录（bug/performance/ux/improvement/investigation），均空 |
| `development/experiments/` | ✅ 已创建（待填充） | 空目录 |
| `development/changelog/` | ✅ 已创建（待填充） | 空目录 |

### 5.2 现有文件清单

```
docs/
├── README.md                                    ← 本文件
├── api/                                         (空)
├── architecture/                                (空)
├── debug/                                       (空)
├── product/
│   ├── README.md                                ← 产品层 README
│   └── v1/
│       ├── PRD/
│       │   ├── PRD.md
│       │   └── AGENT_PRD.md
│       ├── SPEC/
│       │   ├── TECHNICAL_SPEC.md
│       │   └── AGENT_SPEC.md
│       ├── MVP/
│       │   └── MVP_SCOPE.md
│       ├── RepoPilot-v1-文档审查报告.md
│       └── RepoPilot-v1-文档审查报告-2026-07-03-v2.md
└── development/
    ├── guides/
    │   └── DEVELOPMENT_PROCESS.md
    ├── process/                                 (空)
    ├── logs/                                    (空)
    ├── changes/
    │   ├── fix/  feat/  refactor/  docs/  chore/  style/  test/  perf/  build/  ci/    (均空)
    ├── issues/
    │   ├── bug/  performance/  ux/  improvement/  investigation/                       (均空)
    ├── experiments/                             (空)
    └── changelog/                               (空)
```

---

## 6. 未来扩展

### 6.1 自动化系统（推荐升级）

未来可建立自动化归档：

```
git commit → 自动分类 → 写入 changes/<type>/
            → 写入 logs/<YYYY-MM>.md
            → 更新 changelog/versions/<version>.md
```

进一步可做到：

- AI 自动判断 fix / feat / perf 类型
- 自动从 debug/ 归类到 issues/
- 自动归档过期的 experiments/

### 6.2 跨版本迁移

每个主版本（v1, v2, v3）独立维护自己的 `product/vN/` 目录，但 `development/` 是**全局共享**的——不按版本分目录，因为开发活动是连续的历史。
