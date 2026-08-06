# RepoPilot 产品文档 (Product Documentation)

> 本目录是 RepoPilot 的**产品定义层**，定义"做什么"以及"怎么验收"。
> 所有产品决策的权威来源集中在此目录下的 PRD / SPEC / MVP 三层文档中。

---

## 1. 版本策略

RepoPilot 产品文档采用 **v1.0 单版本完整发布** 策略编写；代码包版本已推进至 **2.0.0**，并另有 `v2/` 规划草稿。

- v1 不再拆分 v0.1 ~ v0.6 子版本交付叙事
- 权威产品文档以 `v1/PRD` · `v1/SPEC` · `v1/MVP` 为准
- `v2/` 为下一主版本构思（`IDEA.md` + 草案 PRD/SPEC/MVP），**尚未**取代 v1 权威链
- **实现状态以代码与** [`../development/PROGRESS_REPORT.md`](../development/PROGRESS_REPORT.md) **为准**，勿仅依赖草案正文

---

## 2. 目录结构

```
docs/product/
├── README.md                                  ← 本文件（导航 + 规则）
├── v1/
│   ├── PRD/                                   ← 产品需求文档
│   │   ├── PRD.md
│   │   └── AGENT_PRD.md
│   ├── SPEC/                                  ← 技术规格文档
│   │   ├── TECHNICAL_SPEC.md
│   │   └── AGENT_SPEC.md
│   └── MVP/                                   ← v1.0 实施范围
│       └── MVP_SCOPE.md                       ← 含部分「与代码差异」标注
└── v2/
    ├── IDEA.md
    ├── PRD/ · SPEC/ · MVP/                    ← 规划草案
```

> **审查报告不在此目录：** 2026-07 的 v1 文档审查/修复过程报告（第 1~13 轮 / 第 1~7 次）已于 2026-08-04 移除，由 [`docs/review/`](../review/) 下的审查报告归档取代（最新全量审查见 `full-review-20260804.md`）。

> **命名规范：** 目录名使用大写（`PRD/`、`SPEC/`、`MVP/`），不使用小写。

**仓库布局（Monorepo）：** 代码位于 `apps/`、`services/`、`packages/`。路径对照见 [`../architecture/PATH_MAPPING.md`](../architecture/PATH_MAPPING.md)。

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

| 层 | 状态 | 说明 |
|------|------|------|
| 代码包 | **2.0.0** | `apps/web` + `services/api` 核心闭环已跑通 |
| `v1` PRD/SPEC | 草案 | 部分细节（Agent 数、表结构、端点）与代码不一致 |
| `v1` MVP_SCOPE | 草案 + 差异标注 | 优先参考文内「与代码实际」标注 |
| `v2/` | 构思/草案 | 不覆盖 v1 权威链 |
| 实现进度 | 活文档 | **[`../development/PROGRESS_REPORT.md`](../development/PROGRESS_REPORT.md)**（2026-08-04） |

> 审查报告统一归档在 `docs/review/`，为**历史快照**，仅供追溯，不随代码改写。最新全量审查：`docs/review/full-review-20260804.md`。

| 文档 | 状态 | 说明 |
|------|------|------|
| PRD.md / AGENT_PRD.md | 草案 | 产品需求；Agent 数量等处可能仍写 6 |
| TECHNICAL_SPEC.md / AGENT_SPEC.md | 草案 | 技术规格 |
| MVP_SCOPE.md | 草案 | 含差异标注；工具数等仍可能滞后于代码 |

---

## 8. 关联文档

| 文档 | 路径 | 关系 |
|------|------|------|
| 架构总览 | `../architecture/OVERVIEW.md` | Monorepo 运行时架构 |
| 路径对照 | `../architecture/PATH_MAPPING.md` | 历史路径 → 现行路径 |
| **开发进度报告** | `../development/PROGRESS_REPORT.md` | **当前代码实现状态（优先）** |
| 开发路线图 | `../development/DEVELOPMENT_ROADMAP.md` | 历史 Phase 计划 |
| 全量审查报告 | `../review/full-review-20260804.md` | 最新全量审查（v2.0，175 项发现） |
| Agent 核心审查 | `../review/AGENT_CODE_REVIEW.md` | 2026-08-03 Agent 审查（整改已落地） |

---

*本文件是产品文档的入口。了解「代码现在能做什么」请先读 PROGRESS_REPORT；了解「产品要做什么」再读 PRD → SPEC → MVP。*
