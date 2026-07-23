# RepoPilot 产品文档 (Product Documentation)

> 本目录是 RepoPilot 的**产品定义层**，定义"做什么"以及"怎么验收"。
> 所有产品决策的权威来源集中在此目录下的 PRD / SPEC / MVP 三层文档中。

---

## 1. 版本策略

RepoPilot 采用 **v1.0 单版本完整发布** 策略。

- **不再拆分** v0.1 ~ v0.6 等子版本，一次性交付完整产品
- 所有产品文档（PRD / SPEC / MVP）均针对 **v1.0** 编写
- 仅存在一份 `MVP_SCOPE.md`，定义 v1.0 的完整实施范围
- v1.0 发布后，后续版本（v1.1、v1.2...）按需在本目录下补充增量文档

---

## 2. 目录结构

```
docs/product/
├── README.md                                  ← 本文件（导航 + 规则）
└── v1/
    ├── PRD/                                   ← 产品需求文档
    │   ├── PRD.md                             ← 主产品需求（权威来源）
    │   └── AGENT_PRD.md                       ← Agent 系统产品需求
    ├── SPEC/                                  ← 技术规格文档
    │   ├── TECHNICAL_SPEC.md                  ← 完整技术规格
    │   └── AGENT_SPEC.md                      ← Agent 系统技术规格
    ├── MVP/                                   ← v1.0 实施范围
    │   └── MVP_SCOPE.md                       ← v1.0 唯一范围定义
    ├── RepoPilot-v1-审查报告-第1轮.md
    ├── RepoPilot-v1-审查报告-第2轮.md
    ├── RepoPilot-v1-审查报告-第3轮.md
    ├── RepoPilot-v1-审查报告-第4轮.md
    ├── RepoPilot-v1-审查报告-第5轮.md
    ├── RepoPilot-v1-审查报告-第6轮.md
    ├── RepoPilot-v1-审查报告-第7轮.md
    ├── RepoPilot-v1-审查报告-第8轮.md
    ├── RepoPilot-v1-修复报告-第1次.md
    ├── RepoPilot-v1-修复报告-第2次.md
    ├── RepoPilot-v1-修复报告-第3次.md
    ├── RepoPilot-v1-修复报告-第4次.md
    ├── RepoPilot-v1-修复报告-第5次.md
    └── RepoPilot-v1-修复报告-第6次.md
```

> **命名规范：** 目录名使用大写（`PRD/`、`SPEC/`、`MVP/`），不使用小写。

**仓库布局（Monorepo）：** 自 2026-07-05 起，代码位于 `apps/`、`services/`、`packages/`。与历史文档路径对照见 [`../architecture/PATH_MAPPING.md`](../architecture/PATH_MAPPING.md)。

---

## 3. 文档权威链

**PRD > SPEC > MVP > 其他任何文档**

权威性递减，具体性递增：

| 层级 | 文档 | 视角 | 定义内容 |
|------|------|------|---------|
| 最高 | **PRD** (PRD.md + AGENT_PRD.md) | 产品视角 | "做什么" + 完整产品的成功标准 |
| 中间 | **SPEC** (TECHNICAL_SPEC.md + AGENT_SPEC.md) | 技术视角 | "怎么做"（架构、数据模型、API、安全、性能） |
| 聚焦 | **MVP** (MVP_SCOPE.md) | 实施视角 | "v1.0 做什么 / 不做什么 / 怎么验收" |
| 最低 | 其他文档 | — | 开发日志、过程记录、临时笔记 |

### 冲突解决规则

| 冲突场景 | 优先级 | 说明 |
|---------|--------|------|
| PRD 与 SPEC 冲突 | **PRD 优先** | 产品决策覆盖技术细节 |
| SPEC 与 MVP 冲突 | **SPEC 优先** | 技术约束覆盖实施便利 |
| PRD 与 MVP 冲突 | **PRD 优先** | 产品愿景覆盖实施裁剪 |
| MVP 与开发日志冲突 | **MVP 优先** | 版本定义不被过程记录污染 |

> 任何与 PRD/SPEC/MVP 冲突的开发笔记，必须**先升级文档**，再修改代码。

---

## 4. 各文档职责

| 文档 | 职责 | **不应包含** |
|------|------|-------------|
| **PRD** | 产品愿景、用户画像、功能模块、用户故事、成功指标 | 技术栈、版本时间表、API 路径 |
| **SPEC** | 系统架构、数据模型、API 设计、安全/性能设计 | 业务优先级、用户故事、时间表 |
| **MVP** | v1.0 纳入/排除功能、验收标准、技术路径 | 跨版本规划、开发进度 |

**MVP 只写三件事：**

1. **验收标准** -- v1.0 怎么算"完成"
2. **开发什么** -- v1.0 实现哪些功能（不实现哪些）
3. **具体怎么开发** -- 技术路径（但**不写进度**，进度由 `docs/development/` 跟踪）

---

## 5. 线性工作流

```
PRD (产品需求)        ← v1.0 完整产品定义
  ↓ 提取技术需求
SPEC (技术规格)       ← v1.0 完整技术方案
  ↓ 确定实施范围
MVP (MVP_SCOPE.md)   ← v1.0 验收标准 + 开发内容 + 技术路径
  ↓ 制定开发步骤
DEVELOPMENT_ROADMAP   ← 12 Phase 开发计划（Phase 0~11）
  ↓
开发人员执行 → v1.0 发布
```

**硬性约束：**

- PRD 是 SPEC 的输入 -- 没有 PRD 不写 SPEC
- SPEC 是 MVP 的输入 -- 没有 SPEC 不写 MVP
- MVP 是开发步骤的输入 -- 没有 MVP 不写开发步骤
- 不允许越级（MVP 不能引用 SPEC 未定义的内容）
- 不允许反向覆盖（开发日志不能修改 PRD/SPEC/MVP）

---

## 6. 文档稳定性

| 文档 | 稳定性 | 修改频率 | 冻结时机 |
|------|--------|---------|---------|
| PRD | **极高** | v1.0 发布前定稿 | 主版本发布后冻结 |
| SPEC | **极高** | v1.0 发布前定稿 | 主版本发布后冻结 |
| MVP | **高** | v1.0 开发期间可微调 | v1.0 验收通过后冻结 |
| DEVELOPMENT_ROADMAP | **中** | 按开发进度调整 | 不冻结 |

---

## 7. 当前状态

所有文档均为 **v1.0 草案** 状态，尚未经过正式评审冻结。

> **与代码状态的差距：** 根 `package.json` 与 `apps/web/package.json` 版本已推进至 **v2.0.0**，`docs/product/v2/` 已开始收集 v2 规划（`IDEA.md`），而 `services/api/backend/` 与 `apps/web/src/` 已实现 v1.0 大部分核心功能。产品文档层正在与代码对齐，具体实现状态以 `docs/architecture/REPO_LAYOUT.md` 和代码为准。

| 文档 | 状态 | 说明 |
|------|------|------|
| PRD.md | 草案 | 产品需求 + 路线图（v1.1~v1.4） |
| AGENT_PRD.md | 草案 | Agent 系统产品需求 |
| TECHNICAL_SPEC.md | 草案 | 技术规格 |
| AGENT_SPEC.md | 草案 | Agent 系统技术规格 |
| MVP_SCOPE.md | 草案 | v1.0 实施范围 + 验收标准；部分内容已随代码迭代过期，正在修正 |

---

## 8. 关联文档

| 文档 | 路径 | 关系 |
|------|------|------|
| 架构总览 | `../../architecture/OVERVIEW.md` | Monorepo 运行时架构 |
| 路径对照 | `../../architecture/PATH_MAPPING.md` | 历史路径 → 现行路径 |
| 开发进度报告 | `../development/PROGRESS_REPORT.md` | 当前代码实现状态、与文档差距、修改建议 |
| 审查报告 | `v1/RepoPilot-v1-审查报告-第8轮.md` | 最近一次全面审查（开发者就绪性） |
| 修复报告 | `v1/RepoPilot-v1-修复报告-第6次.md` | 第 8 轮审查问题修复记录 |

---

*本文件是产品文档的入口。新成员请先阅读 PRD，再阅读 SPEC，最后阅读 MVP。*
