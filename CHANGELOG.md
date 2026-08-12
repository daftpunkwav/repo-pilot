# Changelog

Voyager 的所有重要变更都会记录在此文件。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 改名（2026-08-13）
- 产品名定为 **Voyager**，展示层文案收敛 `APP_NAME` 配置（config.py 默认值，可 env 覆盖）
- 代码标识符全面去品牌中性化：
  - Python 包 `repopilot_shared`→`py_shared`，发行名 `repopilot-*`→`api`/`agent`/`graph-engine`/`mcp`/`py-shared`
  - npm 去 `@repopilot` scope：`web`/`types`/`ui`/`config`
  - C 引擎 `cbm_*`/`CBM_*`/`CBMCamelCase` → `engine_*`/`ENGINE_*`/`EngineCamelCase`（55,373 处）
  - 目录 `internal/cbm/`→`internal/engine/`，二进制 `rp-graph-engine`→`graph-engine`
  - 环境变量 `RP_*`/`CBM_*`→`GRAPH_*`/`AGENT_*`（破坏性，旧 .env 需迁移）
  - flavor 字面量 `"cbm"`/`"rp_graph"`→`"native"`/`"fallback"`（C=默认实现、py=降级实现）
- 历史评审文档（docs/review/ARCHITECTURE_REFACTOR_REPORT/）文件名保留原名作存档
- 上游 MIT 归属（THIRD_PARTY.md / LICENSE / NOTICE / vendored）完整保留

### Added
- §4.1.1 跨 worker 会话流取消信号（agent_session_cancel_tokens 表 + 流循环每 8 chunk 轮询）
- §4.1.2 agent_proxy SSE 透传读超时上限 120s
- §4.1.3 Mock 端 token 不再写 localStorage（内存 Map + e2e 清理 hook）
- §4.1.5 .gitignore 增加 .claude/ .pytest_cache/ *.pkg
- §4.1.7 archive/README-archive.md 隐私与安全声明
- §4.1.8 10 个外键列 B-tree 索引
- §4.1.9 projects (user_id, url) 唯一约束
- §4.1.10 SSE handler 拆分（text_delta/thinking/subagent_*/error/done）
- §4.1.11 graph_similarity / settings_service 业务测试扩充
- §4.1.12 Agent/Tool 真源矩阵 (docs/AGENT_TOOL_MATRIX.md)
- §4.1.13 LICENSE / CHANGELOG / CONTRIBUTING / SECURITY
- §4.4.1 PII 历史本地重写（filter-repo + 文档脱敏 + 远端 force-push 待手动）

### Changed
- services/api/backend/services/agent_service.py 流循环每 N chunk 跨 worker token 轮询
- apps/web/src/stores/agentStore.ts 6 个简单 case 委托独立 handler

### Fixed
- 多 worker 部署下取消/抢占语义形同虚设
- agent_proxy 上游 hang 永久挂起连接池
- Mock 端 token 落 localStorage（XSS 可读）
- 公开仓库 git 历史含真实用户邮箱 + 密码哈希 + 盐值

## [2.0.0] - 2026-07-04

### Changed
- v1 → v2 多 Agent 系统重构：Hub/Scout/Mentor/Navigator/Curator/Scribe + Atlas
- 引入 Knowledge Graph 作为共享查询工具
- 引入 Memory Merge Protocol
- 引入 Context Engineering Pipeline

## [1.0.0] - 2026-07-03

### Added
- 初始发布：6 个 Agent（Hub/Scout/Mentor/Navigator/Curator/Scribe）
- GitHub Star 管理、笔记、标签、分类
- 学习进度与总览页
- JWT 鉴权 + 基础 REST API