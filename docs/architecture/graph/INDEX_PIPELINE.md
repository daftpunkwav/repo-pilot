# 附录 A —— 云端项目索引流水线方案分析

> 版本： 2026-08-09 | 状态： **方案敲定（待评审）**
>
> 本文档专门回答方向 README（`README.md`）中遗留的核心难题：**GitHub 云端项目如何进入 L1 代码图谱**。对"是否需要沙箱""有无更快方法"做完整方案对比后敲定，是 `DETAILED_DESIGN.md` §索引流水线的依据。
>
> 所有结论基于对 codebase-memory-mcp 行为、RepoPilot 现有代码与 GitHub API 能力的核对，非推测。关键事实标注【验证】/【引擎约束】。
>
> **部署前提**：RepoPilot 是**纯本地单机应用，用户本机安装即用**——不发布云端、不考虑多用户隔离。本文所有方案（clone 到本机磁盘、本机引擎索引、本机取数）均基于此前提。引擎 per-machine 模型与单机部署天然契合，无多租户问题。

---

## 1. 问题定义

用户在 RepoPilot 导入的是 **GitHub 云端 URL**（`projects.url`，schema 强制 `github.com`，见 `services/api/api_backend/schemas/project.py:45-50`）。L1 代码图谱要求把项目内部的文件/类/函数/调用等结构化成图。中间必须经历：

```
GitHub URL  ──①──▶  本地代码落盘  ──②──▶  引擎索引  ──③──▶  可查询/可渲染
```

三个已核实约束决定了方案空间：

- **【引擎约束】引擎只吃本地路径**：`index_repository(repo_path=...)` 要求磁盘上的绝对路径，**不会自己 clone 远程仓库**【验证，参考项目文档】。
- **【引擎约束】`CBM_ALLOWED_ROOT` 锁定索引目录**：引擎只索引该根目录下的路径，越界拒绝【验证】。这意味着 RepoPilot 的落盘目录必须落在该根下，或二者对齐。
- **【验证】RepoPilot 当前无任何本地代码落盘机制**：`import_repos`（`services/api/api_backend/services/project_service.py:179`）只拉 GitHub 元数据（语言/描述/stars）入库，从不 clone 代码；`projects` 表无本地路径字段（`models/project.py`）。

因此 ①（云端→本地）**必须由 RepoPilot 自己解决**，引擎不代劳。

---

## 2. "沙箱"需求辨析

用户的直觉——"是否需要类似沙箱的东西把项目快速 clone"——方向正确，但需澄清"沙箱"的真正含义：

| 沙箱类型 | 含义 | 本场景是否需要 |
|---------|------|--------------|
| 执行沙箱（Docker/容器/VM） | 隔离运行不可信代码 | **不需要**。索引是**静态解析**（Tree-sitter 语法解析 + 类 LSP 类型推断），不执行被索引项目的任何代码，无运行时安全风险。 |
| 受管缓存目录 | 受配额治理、可清理、受 `CBM_ALLOWED_ROOT` 约束的本地克隆目录 | **需要**。这是落盘、增量、磁盘治理的载体。 |

**结论：不需要容器级执行沙箱，需要一个"受管克隆缓存"目录。** 这比真沙箱快得多（省去容器启停与镜像），且索引只读不执行，安全模型简单。

---

## 3. 云端→本地落盘方案对比

### 3.1 候选方案

#### 方案 A —— GitHub API 无 clone（内存拼装）
直接调 GitHub REST API（`/repos/{o}/{r}`、Git Trees `/repos/{o}/{r}/git/trees/{sha}?recursive=1`、按需 `/contents/{path}`）取文件清单与内容，在内存或临时目录拼装后喂给引擎。

- **优点**：无 git 二进制依赖；不占 `.git` 磁盘。
- **致命问题**：
  - 引擎要的是**真实目录树**，仍需落盘到 `CBM_ALLOWED_ROOT` 下——本质没绕开落盘。
  - 子模块（submodule）、二进制资源、Git LFS、大文件无解。
  - 匿名限流 60 req/h、认证 5000 req/h；多文件仓库逐个拉 `contents` 极慢且易触限。
  - 失去 `git log` / commit / branch 信息（引擎 schema 有 `Branch`/`HAS_BRANCH` 边，见下）。

#### 方案 B —— 浅克隆受管缓存【推荐】
`git clone --depth 1 --filter=blob:none --single-branch` 到受管缓存目录 `data/repo-cache/<repo-hash>/`，引擎索引该目录。

- **优点**：
  - 一次 clone 拿到完整代码与目录结构，引擎吃到**原生真实路径**（符合其约束）。
  - `--filter=blob:none`（部分克隆）只按需拉 blob，`--depth 1` 不拉历史，**显著快于全量 clone 且省磁盘**。
  - 增量更新廉价：`git fetch --depth 1 && git reset --hard origin/<branch>`。
  - 私有仓复用 RepoPilot 现有 GitHub token（`github_client.py` 已支持 `Authorization: Bearer`，`services/api/api_backend/services/github_client.py:33-34`）。
  - 保留引擎 Branch 语义：`git_common_dir`/`head_sha`/`branch` 等会被引擎写入 `Branch` 节点与 `HAS_BRANCH` 边【验证：RepoPilot 索引产出 `Branch`×1、`HAS_BRANCH`×1】。
- **代价**：大仓磁盘占用；需磁盘治理（§5）。
- **Windows 注意**：路径长度与符号链接（部分仓用）需在 `core.longpaths=true` 与 `git config --local core.symlinks false` 处理【待 Phase 1 实测】。

#### 方案 C —— 远程沙箱（Codespaces / 云容器）
在云端容器内运行引擎索引，结果回传。

- **致命问题**：RepoPilot 是纯本地单机应用，引擎须在本机被直接调用；远程沙箱让引擎脱离本机、引入云端成本与认证，与部署前提冲突。否决。

#### 方案 D —— GitHub tarball
拉 `GET /repos/{o}/{r}/tarball/{ref}` 解压喂引擎。

- **优点**：比 `git clone` 更快（无 `.git` 元数据）、无 git 依赖。
- **致命问题**：失去增量更新（每次全量重下解压）；失去 Branch/HAS_BRANCH 语义；引擎的 git 相关能力空缺。

### 3.2 决策

**采用方案 B（受管浅克隆缓存）为主，方案 D（tarball）作为"首次快速获取"的可选加速保留**（当网络差或 git 不可用时降级，但需接受失去增量与 Branch 语义）。

理由：方案 B 是唯一同时满足"引擎本地路径硬约束 + 增量更新 + 复用现有 token + 保留 Branch 语义"的方案；代价（磁盘治理）可控（§5）。

---

## 4. 渲染取数通路对比（化解方向 README R1）

方向 README 把"渲染取数带宽"列为头号风险。取证后确认存在第三通路，优于原设想：

| 通路 | 来源 | 最适合 | 问题 |
|------|------|--------|------|
| MCP 工具分页 | `search_graph`/`query_graph`/`get_architecture` | Agent 检索、按需查 | 非批量导出；5k 节点需多次往返；`query_graph` 有 100k 行上限但偏查询语义 |
| 直读 SQLite | 引擎存储文件（`~/.cache/codebase-memory-mcp/`） | 全量导出最快 | 与引擎内部 schema 强耦合；引擎升级即碎；并发读需 WAL 模式 |
| **引擎 UI HTTP** | 引擎自带 Web 服务 `localhost:9749`（如 `POST /api/index`） | **前端批量取数渲染** | 已存在、专为渲染设计；需配置与白名单 |

**决策**：
- **渲染层首选引擎 UI HTTP 通路**（已验证存在，专为图形渲染批量取数而设，原生支持节点预算/过滤/聚类的服务端预算）。
- **MCP 工具留给 Agent**（Atlas 等）与按需检索（search_graph/trace_path/get_architecture），不承担批量导出。
- **直读 SQLite 仅作降级**（HTTP 通路不可用时），并在 SPEC 锁定引擎版本，升级时同步更新读取层。

三通路分工见 `DETAILED_DESIGN.md` §取数层。

---

## 5. 受管克隆缓存治理

方案 B 的代价是磁盘，需治理策略（SPEC 阶段定量化）：

| 维度 | 方向 |
|------|------|
| 目录 | `data/repo-cache/<repo-owner>-<repo-name>-<sha7>/`；落在 `CBM_ALLOWED_ROOT` 下 |
| 配额 | 缓存总上限（如 2 GB）+ 单仓上限（如 500 MB）；超限拒绝新克隆并提示 |
| 清理 | LRU 清理：删除项目时清理其缓存；后台清理超期未访问 |
| 隔离 | 纯本地单机，单用户独占本机，无需跨用户隔离；URL 经现有 `github.com` 校验（`schemas/project.py:49-50`） |
| 安全 | 只读索引不执行；缓存目录不出本机；私仓 token 经 Fernet 加密存储（`core/security.py:99`） |
| 幂等 | 同 URL + sha 命中缓存则复用；sha 变更触发增量更新而非全量重克隆 |

---

## 6. 流水线状态机

```
未索引(NONE)
   │ 用户在 L1/详情页点"构建代码图谱"
   ▼
排队(QUEUED) ──并发达上限──▶ 仍 QUEUED（前端可见"排队中"）
   │ 调度
   ▼
克隆中(CLONING) ──失败──▶ CLONE_FAILED（可重试，记 error）
   │ git clone --depth 1 --filter=blob:none
   ▼
索引中(INDEXING) ──失败──▶ INDEX_FAILED（可重试）
   │ 引擎 index_repository(mode=moderate)
   ▼
就绪(READY) ──远端有新提交──▶ 过期(STALE) ──用户点"更新"──▶ CLONING(增量)→INDEXING→READY
   │
   └─▶ 可查询/可渲染（L1 图、Agent 工具）
```

- 状态持久化于 RepoPilot DB（一张映射/状态表：`project_id ↔ 引擎 project 名 ↔ local_path ↔ head_sha ↔ status ↔ indexed_at ↔ error`）。这也回应了 SPEC 曾规划、后被实时计算替代的 `graph_cache` 表——v2 下持久化重新必要（方向 README §D3）。
- 并发：本地单用户场景先**串行**（同时只 1 个索引任务），后续按资源评估放开有限并发。
- 异步：索引分钟级，前端轮询或 SSE 推送状态（复用现有 SSE 能力，`services/api/api_backend/services/agent_service.py` 已有 SSE 基建）。

---

## 7. 索引模式与规模预期

引擎 `index_repository` 支持 `fast/moderate/full` 模式【验证，工具定义】。策略：

| 场景 | 模式 | 理由 |
|------|------|------|
| 首次快速预览（L1 首进） | `fast` 或 `moderate` | 牺牲语义边（SIMILAR_TO/SEMANTICALLY_RELATED）换速度，先让用户看到结构 |
| 用户主动"深度索引" | `full` | 产出语义边与聚类，解锁死代码/架构视图 |
| 超大仓（>50k 文件） | `fast` + 节点预算 | 防内存峰值；渲染层服务端预算分页 |

**规模实测参考**：RepoPilot 自身（TS+Python 混合，中等规模）moderate 索引产出 **7136 节点 / 22125 边**【验证，`get_architecture` 实测】，含 15 类节点、20 类边。L1 渲染按此规模起算，预留 5 万节点上限。

---

## 8. 安全核查清单

| 项 | 措施 | 现状 |
|----|------|------|
| URL 来源 | 仅 `github.com`（schema 强制） | ✅ 已有 `schemas/project.py:49-50` |
| 私仓凭据 | GitHub token，Fernet 加密存储 | ✅ 已有 `core/security.py:99`、`github_client.py:33` |
| 索引根目录 | 落盘目录必须在 `CBM_ALLOWED_ROOT` 下 | ⚠️ 需对齐 RepoPilot 缓存目录与引擎根配置 |
| 路径穿越 | clone 目标路径由 RepoPilot 计算（`<owner>-<repo>-<sha>`），不接受用户任意路径 | ⚠️ 新增，禁止用户传本地路径参数（本期） |
| 不可信代码执行 | 索引只静态解析，不执行项目代码 | ✅ 引擎特性 |
| 磁盘耗尽 | 配额 + LRU 清理 | ⚠️ 新增 |

---

## 9. 与 Agent 服务的融合点

索引流水线不只服务前端渲染，也是 Agent 代码级感知的基础（方向 README D7）：

- **Atlas**（`registry.py:413`，"知识图谱向导"）当前只有 `query_knowledge_graph`（项目级相似度，`builtin.py:289`）。L1 落地后，Atlas 应获得代码级工具：`search_code_graph`、`trace_calls`、`get_project_architecture`，经同一图谱服务（取数层）调用引擎 MCP 工具。
- **Scout**（速览）可用 `fast` 模式索引 + `get_architecture` 给出"30 秒级结构速览"（补强当前仅靠 README 的速览）。
- **触发**：用户在对话中说"分析这个项目的调用关系"→ Hub 调度 Atlas → Atlas 发现项目未索引 → **触发索引流水线**（或提示用户授权）→ 就绪后查询。流水线状态机对 Agent 可见。
- **统一入口**：Agent 工具与前端渲染**共用同一图谱服务**（方向 README D2 原则），不各接一套引擎。

---

## 10. 决策汇总

| # | 决策 | 选择 | 关键依据 |
|---|------|------|---------|
| P1 | 落盘方式 | 受管浅克隆（`--depth 1 --filter=blob:none`） | 引擎只吃本地路径；增量廉价；保留 Branch 语义 |
| P2 | 沙箱 | 不用执行沙箱，用受管缓存目录 | 索引只读不执行，无运行时风险 |
| P3 | 首次加速（可选） | tarball 降级 | 无 git 时备用，代价是失增量与 Branch |
| P4 | 渲染取数 | 引擎 UI HTTP（9749）为主 | 专为批量渲染设计，已存在 |
| P5 | Agent 取数 | MCP 工具（search_graph/trace_path/get_architecture） | 检索语义，天然适配工具调用 |
| P6 | 降级取数 | 直读 SQLite（锁版本） | HTTP 不可用时备用 |
| P7 | 状态持久化 | RepoPilot DB 映射/状态表 | 回应 `graph_cache` 历史决策 |
| P8 | 并发 | 先串行 | 本地单用户，资源可控 |
| P9 | 索引模式 | 首进 fast/moderate，深度 full | 平衡首响与深度 |
| P10 | Agent 融合 | Atlas 获代码级工具，经同一图谱服务 | D7 单一入口 |

---

## 11. 待 SPEC 细化的开放问题

- 缓存配额具体阈值、LRU 触发条件。
- 引擎 UI HTTP 9749 的多项目隔离方式（单机多项目如何区分索引实例）。
- `CBM_ALLOWED_ROOT` 与 RepoPilot `data/repo-cache/` 的对齐策略（统一根 vs 子目录）。
- 引擎版本锁定与升级 checklist（直读 SQLite 降级路径依赖版本）。
- Windows 长路径、符号链接实测结论（Phase 1）。
- 增量更新的 diff 策略（全量重建 vs 引擎 watcher 增量）。
