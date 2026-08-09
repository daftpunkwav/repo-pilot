# Spike: Windows 浅克隆与缓存

**状态：** 已拍板  
**范围：** 多仓克隆策略、Windows 长路径、本地缓存配额

## 结论

**采用浅克隆**；进程/服务启动时确保 `core.longpaths=true`；缓存目录 `data/repo-cache/<owner>-<repo>-<sha7>/`；**默认总配额 2GB**。

## 核实事实

- 浅克隆命令形态：

```bash
git clone --depth 1 --filter=blob:none --single-branch <url> <dest>
```

- Windows：需要 `core.longpaths=true`；必要时 `core.symlinks=false`（无管理员/开发者模式时）
- 缓存路径约定：`data/repo-cache/<owner>-<repo>-<sha7>/`

## 拍板

1. **克隆策略**：一律浅克隆（depth 1 + blob:none + single-branch）；需要完整历史时另开显式深克隆任务，不作为默认。
2. **Windows**：启动路径设置 `core.longpaths=true`；若 symlink 创建失败，回退 `core.symlinks=false`，不阻塞克隆。
3. **缓存布局**：`data/repo-cache/<owner>-<repo>-<sha7>/`，sha7 绑定可复现快照。
4. **配额**：默认 **总容量 2GB**；超限按 LRU/最旧优先驱逐（实现细节跟进，策略本处拍板为有硬上限）。

## 非目标

- 不在本 spike 实现驱逐算法细节
- 不修改全局 git config 以外的用户机器默认（优先进程内 / 仓库局部设置）
