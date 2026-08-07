# docs/superpowers/ 目录说明（§4.3.7）

本目录用于存放 **"按权力 / 战略层面的审查与整改计划"** 草稿（"superpowers" 复数 = 一组超能力 / 多种力量，即审查的"力量集合"）。与 `docs/review/` 区分：

- `docs/superpowers/`：战略性、计划性、跨多模块的整改工作流；每个 `plans/<date>-<topic>.md` 是"系统化复盘 + 排期"文档。
- `docs/review/`：单次审查报告（`full-review-*.md` / `architecture-review-*.html` 等）以及修复执行报告（`REMEDIATION_PLAN_*.md` / `REMEDIATION_REMAINING.md` / `REMEDIATION_EXECUTION_LOG.md`）。

## 当前文件清单

- `plans/2026-07-09-front-backend-review-fixes.md`：2026-07-09 启动的前后端联调审查计划（归档状态：已落地，对应 commit `review/front-backend-fixes`）。

## 写作约定

- 文件名格式：`plans/YYYY-MM-DD-<topic>.md`
- 首段注明：**目的 / 范围 / 与代码对照状态 / 涉及 commit / 关联审查报告**
- 状态字段：草案 / 实施中 / 已落地 / 撤回
- 落地完成后挪到 `docs/review/` 下统一归档