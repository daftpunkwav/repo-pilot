# RepoPilot 修复执行报告（2026-08-06）

> 本报告由 Codex 自动生成，跟踪 REMEDIATION_PLAN_20260806.md 的执行进度与结果。
> 每一项独立可验证；✅=已落实（含验证方式）、⏳=部分落实/进行中、⚪=无需处理、⚠️=风险/阻塞。

## 执行摘要

- 最高优先级 **§4.1.4 git 历史 PII**：本地仓库已重写（filter-repo）并裁剪出旧分支/对象，**仍需手动 force-push 三个远端**（GitHub/GitLab/Gitee）才能对外彻底洗净。
- 接下来要执行 §4.1.1 – §4.4.3 共 42 个剩余修复项。

## §4.1.4 (P0) git 历史 PII 执行细节（已完成本地）

### 本地验证

```bash
$ git log --all -S 'REDACTED-EMAIL' --oneline
# (无输出 = PII 已彻底从可达历史中移除)

$ git log --all -- archive/data/stash_users.json
# (无输出 = 污染路径已被 filter-repo 移除)

$ git ls-tree -r HEAD archive/data/
100644 ... archive/data/stash_data.json
100644 ... archive/data/stash_settings.json
# stash_users.json 已从 HEAD 中消失
```

### 操作步骤（本地已执行，可重放）

1. **建立备份 bundle**（本地事故回滚）：
   ```bash
   git bundle create C:/Users/daftpunkwav/AppData/Local/Temp/repopilot.bundle --all
   ```
2. **安装 git-filter-repo**：
   ```bash
   pip install git-filter-repo
   ```
3. **构建 expressions 文件**（注意：文件保存为 ASCII，不要带 UTF-8 BOM，否则 filter-repo 会跳过）：
   ```
   # repopilot-filter-expressions.txt
   REDACTED-EMAIL==>REDACTED-EMAIL
   ```
   ⚠️ BOM 问题：Powershell `Set-Content -Encoding utf8` 默认加 BOM，必须用 `-Encoding ascii` 或 `-Encoding oem` 或 `-NoNewline`。
4. **在 Bare Clone 中执行重写**：
   ```bash
   git clone --bare <main-repo> /tmp/repopilot-rewrite.git
   cd /tmp/repopilot-rewrite.git
   git filter-repo \
     --replace-text /path/to/repopilot-filter-expressions.txt \
     --invert-paths --path archive/data/stash_users.json \
     --force
   ```
5. **将重写后的历史切换为本地 main**：
   ```bash
   git remote add rewrite /tmp/repopilot-rewrite.git
   git fetch rewrite
   # 把所有本地分支指向 rewrite 等价分支
   for b in $(git branch --format='%(refname:short)' | grep -v '^main$'); do
     git update-ref "refs/heads/$b" "refs/remotes/rewrite/$b"
   done
   git reset --hard rewrite/main
   git remote remove rewrite
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
6. **删除所有指向老历史的 remote-tracking refs**（这些 refs 一旦存在，`git log --all` 仍会命中 PII）：
   ```bash
   git for-each-ref --format='%(refname)' refs/remotes | \
     xargs -I{} git update-ref -d {}
   ```

### ⚠️ 仍未完成 — 必须由你手动执行：Force-push 到三个远端

> 由于 force-push 到 GitHub/GitLab/Gitee 是不可逆的破坏性操作（会改变所有公开 commit hash、影响已有 fork/clone），本执行器未自动进行。

**强密码轮换**（首要，与 push 顺序无关，并行进行）：
- `REDACTED-EMAIL` Outlook 账号密码。
- 若该邮箱在 GitHub/Gitee/GitLab/任何 SSO 平台也用作密码复用，请全部轮换。
- 若 `archive/data/stash_users.json` 中任何 token（refresh token 等）曾用生产环境，登入对应服务吊销。

**Force-push 顺序**（先非主仓库→再主仓库；避免被 Rules Hook 卡住）：

```bash
# 1. 把本地重写好的历史推到 GitHub
git push --force --tags github --all

# 2. 把本地重写好的历史推到 GitLab
git push --force --tags gitlab --all

# 3. 把本地重写好的历史推到 Gitee
git push --force --tags gitee --all

# 4. 远端 ref 删除（可选，需要 remote-side 删除或 disable branch protection）
# 如果某个平台不允许 force-push 分支列表，需要在网页端先关闭 branch protection，
# 推送后再开启。详见各家文档。
```

**Push 后验证**（每个远端独立验证）：

```bash
# 远程端不应再能拉到污染 commit
git fetch --all --tags --prune
git log --all -S 'REDACTED-EMAIL' --oneline
git log --all -- archive/data/stash_users.json
```

**已知不可恢复的尾巴**：
- 任何 **在 force-push 之前** 已 clone/fork 该仓库的副本，仍保留旧历史与旧 commit hash。这些副本一旦公开，凭据视为永久泄漏。**密码轮换是唯一有效补救**，历史清洗只是减轻未来风险。
- CI/部署系统若依赖固定 commit hash，需同步更新。

## 后续待办（REMEDIATION §4.1.1 – §4.4.3）

参见 `docs/review/REMEDIATION_PLAN_20260806.md` 全量修复计划。Codex 将按 P0 → P1 → P2 → P3 顺序逐项落实，每一项完成后回填到 `docs/review/REMEDIATION_EXECUTION_LOG.md`。
