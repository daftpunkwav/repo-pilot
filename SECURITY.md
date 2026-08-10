# Security Policy

## 支持的版本

| 版本 | 支持情况 |
| --- | --- |
| 2.x  | ✅ 当前主版本 |
| 1.x  | ⚠️ 仅安全修复（无新功能） |
| < 1.0 | ❌ 不再支持 |

## 报告漏洞

请**不要**在 GitHub/GitLab/Gitee Issues 公开披露安全漏洞。

联系方式（按优先级）：
- 邮件：仓库 owner 的注册邮箱（GitHub 设置的 `email` 字段）
- 内部 IM（适合已建立合作关系的协作者）

报告内容应包含：
- 复现步骤 / PoC
- 影响范围（哪些接口 / 数据 / 凭据）
- 已知缓解措施
- 你的期望回复窗口

承诺 7 个工作日内首响应。

## 凭据与 PII 处理

本项目历史中曾发生 PII 入仓事件（见 `docs/review/REMEDIATION_PLAN_20260806.md` §4.1.4 / `docs/review/REMEDIATION_REMAINING.md`）：

- `archive/data/stash_users.json` 历史版本曾含真实邮箱 + 密码 SHA256 哈希 + 盐值
- 已通过 `git filter-repo --replace-text --invert-paths` 在本地重写
- 远端 force-push 待手动执行（详见 `REMEDIATION_REMAINING.md`）

**如果你在仓库中再次发现邮箱 / 哈希 / token / API Key 之类的 PII 泄漏：**

1. **不要**截图或转引到公开 issue
2. 立即通过上述私密渠道联系维护者
3. 由维护者执行 `git filter-repo` 重写 + 协调各方重新 clone
4. 同步评估：是否需要轮换对应凭据

## 安全开发生命周期

| 阶段 | 行动 |
| --- | --- |
| 编码 | 输入校验（schema 长度 / 类型 / 枚举）；禁止 hardcoded 凭据；XSS 防御（DOMPurify） |
| 提交前 | `git diff --staged` 审查：禁止 `.env`、`.env.local`、API Key 入仓 |
| 部署 | SECRET_KEY ≥ 32 字节随机；CORS 白名单；`SECRETS_ENCRYPTION_KEY` 与 SECRET_KEY 独立 |
| 运行时 | httpx/requests timeout 上限；SSE 流式读超时上限（120s）；CSRF 跨站拦截 |
| 监控 | 限流（`/api/agent` 20/min）；fail-closed 默认 |

## 已知历史问题（已修复 / 仍在收尾）

- ✅ S-05 多 worker 会话流取消信号（§4.1.1，已落实）
- ✅ S-06 agent_proxy 永远等待（§4.1.2，已落实）
- ✅ S-12 git 历史 PII 泄漏（§4.1.4，本地重写完成；远端 force-push 待手动）
- ✅ D-01 / S-21 外键索引（§4.1.8，已落实）
- ✅ D-05 / S-22 projects (user_id, url) 唯一约束（§4.1.9，已落实）

## 凭据轮换清单（用户行动）

1. 仓库 owner 主邮箱（密码 + 二次验证）
2. GitHub / GitLab / Gitee 平台（如密码复用）
3. 任何曾用 `archive/data/stash_users.json` 中凭据登录的第三方服务

## 不在范围

本项目不维护 `SECURITY.md` 中提及的所有依赖的安全公告分发；依赖的安全更新通过 **Dependabot**（`.github/dependabot.yml`，每周扫描 npm + pip 生态）自动处理，CI 中另以 `npm audit` 与 `pip-audit` 兜底阻断高危漏洞。