好,我把最后一轮验证的全部发现整理出来。

## C 引擎功能与服务拆分:详细分析

### 一、C 引擎源码的真实结构

`graph_engine_core/src/` 下有 15 个子目录,Makefile **已经按模块分组**:

| Makefile 分组 | 子目录 | .c 文件数 | 性质 | 行数 |
|---|---|---|---|---|
| `FOUNDATION_SRCS` | `foundation/` | 29 | **功能**:内存/线程/文件/日志/SHA256/平台兼容 | - |
| `STORE_SRCS` | `store/` | 1 | **功能**:SQLite 图谱存储 | - |
| `CYPHER_SRCS` | `cypher/` | 1 | **功能**:Cypher 查询解析 | - |
| `PIPELINE_SRCS` | `pipeline/` | 31 | **功能**:索引流水线(AST/解析/符号提取) | - |
| `SIMHASH_SRCS` | `simhash/` | 1 | **功能**:相似度哈希 | - |
| `SEMANTIC_SRCS` | `semantic/` | 3 | **功能**:语义分析(AST profile/rostsq) | - |
| `TRACES_SRCS` | `traces/` | 1 | **功能**:调用链追踪 | - |
| `DISCOVER_SRCS` | `discover/` | 4 | **功能**:项目发现 | - |
| `GRAPH_BUFFER_SRCS` | `graph_buffer/` | 1 | **功能**:图缓冲区 | - |
| `GIT_SRCS` | `git/` | 1 | **功能**:Git 上下文解析 | - |
| `WATCHER_SRCS` | `watcher/` | 1 | **功能**:文件监听 | - |
| `UI_SRCS` | `ui/` | 7 | **服务**:HTTP server + 前端资源 + 布局 | 5776 行(含 .h) |
| `DAEMON_SRCS` | `daemon/` | 10 | **服务**:进程管理/IPC/锁/版本协调 | 18634 行 |
| `CLI_SRCS` | `cli/` | 12 | **服务**:命令行界面 | - |
| `MCP_SRCS` | `mcp/` | 3 | **服务**:MCP 协议适配 | - |

**最终链接**:所有分组拼成 `PROD_SRCS`,编译成**单一二进制** `rp-graph-engine`。

```makefile
PROD_SRCS = $(FOUNDATION_SRCS) $(STORE_SRCS) $(CYPHER_SRCS) $(MCP_SRCS) \
            $(DAEMON_SRCS) $(DISCOVER_SRCS) $(GRAPH_BUFFER_SRCS) \
            $(PIPELINE_SRCS) $(SIMHASH_SRCS) $(SEMANTIC_SRCS) \
            $(TRACES_SRCS) $(WATCHER_SRCS) $(GIT_SRCS) $(CLI_SRCS) \
            $(UI_SRCS) $(YYJSON_SRC)
```

### 二、`src/ui/` 目录的混合情况(已验证)

`UI_SRCS` 编译的 7 个 .c 文件,实际混了三种东西:

| 文件 | 行数 | 实际职责 | RepoPilot 需要? | 分类 |
|---|---|---|---|---|
| `http_server.c` | 2139 | HTTP 功能 API(`/api/layout`、`/rpc` 的 `search_graph`/`trace_path`/`index_repository` 等)+ **index_job_t 结构体与 job 管理** | ✅ 需要 | 服务(功能 API) |
| `httpd.c` | 866 | HTTP 底层(socket/请求解析/响应) | ✅ 需要 | 服务(HTTP 底层) |
| `layout3d.c` | 869 | 3D 布局算法(anchor-based,纯计算) | ✅ 需要 | **功能**(不是服务) |
| `config.c` | 431 | UI 配置(语言/缓存目录) | ⚠️ 部分 | 服务(配置) |
| `asset_pack.c` | 892 | **前端资源服务**(text/html、index.html、/assets/、webp) | ❌ **不需要** | 服务(前端资源) |
| `asset_pack_stub.c` | 98 | asset_pack 空实现(占位) | ✅ 默认编译用此 | 服务(stub) |
| `asset_manifest_stub.c` | 6 | 资源清单空实现 | ✅ 默认编译用此 | 服务(stub) |

**关键发现**:

1. **`layout3d.c` 被错误归类到 `UI_SRCS`**。它是纯布局算法("Anchor-based 3D graph layout with local optimization"),不含任何 HTTP/前端逻辑,应该是功能代码。放在 `ui/` 目录是上游 CBM 的历史遗留。

2. **`asset_pack.c` 是前端资源服务**。它服务 `text/html`、`index.html`、`/assets/` 路径,是上游 CBM 自带 React `graph-ui` 的资源托管。RepoPilot 前端在 `apps/web`,不需要。Makefile 已有 stub 机制替代(`asset_pack_stub.c`),但 .c 源文件仍留在目录里。

3. **`http_server.c` 不是薄壳**。它 2139 行里混了:路由处理 + `index_job_t` 结构体 + job 调度逻辑 + 跨模块功能调用(30+ 个 `cbm_*` 函数)。它既是"HTTP 服务"又承担了"索引 job 管理"。

4. **Makefile 的 stub 机制**:
   - 默认编译 `asset_pack_stub.c`(空实现),不编译 `asset_pack.c`
   - `Makefile.rp:374`: `src/ui/asset_pack_stub.c`(默认)
   - `Makefile.rp:462`: `TEST_PROD_SRCS = $(subst src/ui/asset_pack_stub.c,src/ui/asset_pack.c src/ui/asset_manifest_stub.c,$(PROD_SRCS))`(仅 TEST 模式替换)
   - `Makefile.rp:1063-1067`: `UI_ASSET_MANIFEST` / `UI_ASSET_DIST` / `UI_ASSET_PREBUILT`(UI 资源构建,RepoPilot 不用)

### 三、`http_server.c` 对功能模块的依赖(耦合面)

`http_server.c` 的 `#include` 列表(已验证):

```c
// 服务层自依赖
#include "ui/http_server.h"
#include "ui/httpd.h"
#include "ui/asset_pack.h"       // ← 前端资源(RepoPilot 不用)
#include "ui/layout3d.h"         // ← 功能(布局算法,被错误归到 ui/)

// 功能模块依赖(跨模块调用)
#include "mcp/mcp.h"             // MCP 协议
#include "store/store.h"         // 图谱存储
#include "watcher/watcher.h"     // 文件监听
#include "cli/cli.h"             // 命令行
#include "git/git_context.h"     // Git 上下文

// 基础设施
#include "foundation/log.h"
#include "foundation/platform.h"
#include "foundation/secure_random.h"
#include "foundation/sha256.h"
#include "foundation/compat.h"
#include "foundation/compat_fs.h"
#include "foundation/str_util.h"
#include "foundation/compat_thread.h"
#include "foundation/subprocess.h"
#include "foundation/win_utf8.h"
#include "foundation/workspace.h"
```

`http_server.c` 调用的跨模块函数(30+ 个,已验证):

```
cbm_config_open / cbm_config_get / cbm_config_close     (配置)
cbm_resolve_cache_dir                                    (缓存)
cbm_validate_project_name                                (校验)
cbm_git_context_resolve / cbm_git_context_free           (Git)
cbm_http_server_new / _run / _free / _port / _is_running (HTTP 生命周期)
cbm_http_server_set_index_executor                       (索引执行器注入)
cbm_http_server_set_project_mutation_guard               (项目变更守卫)
cbm_http_server_schedule_run / _cancel_scheduled_run     (任务调度)
cbm_http_replyf / cbm_reply_buf                          (HTTP 响应)
cbm_http_query_param / cbm_http_path_match               (路由匹配)
cbm_ui_asset_lookup                                      (前端资源查找 ← RepoPilot 不用)
```

**结论**:`http_server.c` 与功能模块是**函数调用级耦合**(直接调 `cbm_*` 函数),不是接口级耦合。拆目录不消除依赖,只是让 `#include` 路径变长。

### 四、`src/daemon/` 的进程管理逻辑(服务层)

`DAEMON_SRCS` 编译的 10 个 .c 文件(18634 行),职责:

| 文件 | 行数 | 职责 |
|---|---|---|
| `host.c` | 1170 | 主机进程管理(启动/信号/生命周期) |
| `service.c` | 1023 | 系统服务(fingerprint/rendezvous/conflict log) |
| `version_cohort.c` | 976 | 版本协调(多实例兼容) |
| `application.c` | - | 应用层编排 |
| `runtime.c` | - | 运行时状态 |
| `bootstrap.c` | - | 启动引导 |
| `frontend.c` | - | 前端进程管理 |
| `ipc.c` | - | 进程间通信 |
| `project_lock.c` | - | 项目锁 |
| `daemon.c` | - | daemon 入口 |

这些是**纯服务层逻辑**(进程管理/IPC/锁),不含索引/查询/布局等功能。但它们与功能模块共用同一个 Makefile、同一个 `src/` 根、编进同一个二进制。

### 五、三个拆分等级(从轻到重)

#### 等级 A:删除前端遗留(推荐,低风险)

| 改动 | 说明 |
|---|---|
| 删除 `asset_pack.c` + `asset_pack.h` | 前端资源服务,RepoPilot 不需要(apps/web 负责) |
| 删除 `asset_manifest_stub.c` | 资源清单空实现,只在 TEST 模式用 |
| `Makefile.rp` 移除 `TEST_PROD_SRCS` 的 subst 行 | 不再有 TEST 模式替换 asset_pack |
| `graph_engine_sidecar.py:110` 移除 `--ui=true` | stub 模式下是 no-op,传它有误导性 |
| `graph_engine_core/README.md` 补充 | "C 引擎只提供功能 API,前端可视化由 apps/web 负责" |

**效果**:`src/ui/` 从 7 个 .c 减到 4 个(`http_server` + `httpd` + `config` + `layout3d`),且不再有前端资源代码。

**风险**:极低。`asset_pack.c` 在默认构建中本就不编译(stub 替代)。

**不动的**:`asset_pack_stub.c` 保留(默认编译需要它作为空实现占位)。

#### 等级 B:目录归位(不改编译,中等成本)

把 `src/` 下的文件按"功能 vs 服务"重新归位:

```
graph_engine_core/
├── src/                    # 功能源码(纯能力)
│   ├── foundation/         (29 .c)
│   ├── store/              (1 .c)
│   ├── cypher/             (1 .c)
│   ├── pipeline/           (31 .c)
│   ├── simhash/            (1 .c)
│   ├── semantic/           (3 .c)
│   ├── traces/             (1 .c)
│   ├── discover/           (4 .c)
│   ├── graph_buffer/       (1 .c)
│   ├── git/                (1 .c)
│   └── watcher/            (1 .c)
│
├── server/                 # 服务源码(运行层)
│   ├── http_server.c       (2139 行,功能 API + job 管理)
│   ├── httpd.c             (866 行,HTTP 底层)
│   ├── config.c            (431 行,配置)
│   ├── layout3d.c          (869 行,布局 ← 从 ui/ 移出,它是功能不是服务)
│   ├── asset_pack_stub.c   (98 行,stub)
│   ├── daemon/             (10 .c,18634 行,进程管理)
│   ├── cli/                (12 .c,命令行)
│   └── mcp/                (3 .c,MCP 协议)
│
└── vendored/               (第三方库,不动)
```

**需要同步改的**:
- `Makefile.rp` 所有 `src/ui/*.c` -> `server/*.c`、`src/daemon/*.c` -> `server/daemon/*.c`、`src/cli/*.c` -> `server/cli/*.c`、`src/mcp/*.c` -> `server/mcp/*.c`
- `layout3d.c` 移到 `src/`(它是功能)或 `server/`(保持在 UI_SRCS 分组里)
- 所有 `#include "ui/http_server.h"` -> `#include "server/http_server.h"` 等(跨文件引用约 20-30 处)
- `main.c` 的 `#include "daemon/..."` -> `#include "server/daemon/..."` 等

**效果**:目录上看得出"功能(src/) vs 服务(server/)"。

**风险**:中。纯路径替换,不改编译逻辑,但 Makefile + include 路径改动量大(~50 处),且 C 工程是迁入的 MIT 代码,路径大改增大与上游 diff。

**关键问题**:`layout3d.c` 归类有争议--它是布局算法(功能),但当前在 `UI_SRCS` 分组里(因为 C 引擎把它当 UI 模块的一部分)。如果移到 `src/`,要从 `UI_SRCS` 移到新的 `LAYOUT_SRCS` 分组;如果留在 `server/`,语义不对。

#### 等级 C:编译分离 lib + exe(高成本,标准 C 工程做法)

把功能源码编成静态库,服务源码链接它编出可执行:

```makefile
# 1. 功能源码 -> 静态库
CORE_SRCS = $(FOUNDATION_SRCS) $(STORE_SRCS) $(CYPHER_SRCS) \
            $(PIPELINE_SRCS) $(SIMHASH_SRCS) $(SEMANTIC_SRCS) \
            $(TRACES_SRCS) $(DISCOVER_SRCS) $(GRAPH_BUFFER_SRCS) \
            $(GIT_SRCS) $(WATCHER_SRCS)

$(BUILD_DIR)/libgraph_engine_core.a: $(CORE_OBJS)
	$(AR) rcs $@ $^

# 2. 服务源码 + 链接库 -> 可执行
SERVER_SRCS = $(UI_SRCS) $(DAEMON_SRCS) $(CLI_SRCS) $(MCP_SRCS)

rp-graph-engine: $(SERVER_OBJS) $(BUILD_DIR)/libgraph_engine_core.a $(VENDORED_LIBS)
	$(CC) $(SERVER_OBJS) -L$(BUILD_DIR) -lgraph_engine_core $(VENDORED_LIBS) -o $@
```

**效果**:
- 功能代码编译成 `libgraph_engine_core.a`(可被其他 C 程序链接)
- 服务代码编译成 `rp-graph-engine`(链接上面的库)
- 真正的"功能库 + 服务可执行"分离

**需要同步改的**:
- 重写 Makefile 链接规则(加 `ar` 静态库步骤 + 改链接依赖)
- 处理 `main.c` 的位置(它是服务入口,放 server 侧)
- 处理 vendored 库的链接顺序(mimalloc/sqlite3/tree-sitter 等的链接依赖)
- 确保 `http_server.c` 的 `index_job_t` 等 job 管理逻辑能正确链接到 store/pipeline 的功能函数
- CI 脚本(`scripts/build.ps1` + 21 个 ci 脚本)中产物路径可能变

**风险**:高。Makefile 链接规则重写容易出错(尤其 vendored 库的链接顺序),且 C 工程是迁入代码,大改 Makefile 增大上游同步成本。

### 六、三个等级的对比

| 维度 | 等级 A(删前端遗留) | 等级 B(目录归位) | 等级 C(编译分离) |
|---|---|---|---|
| 改动量 | 4-5 文件删除 + 1 行参数移除 | ~50 处路径替换(Makefile + include) | Makefile 链接规则重写 + 全部路径改 |
| 风险 | 极低 | 中(纯路径,但量大) | 高(链接规则 + vendored 依赖) |
| 效果 | `ui/` 只剩功能 API,无前端 | 目录看出"功能 vs 服务" | 真正 lib + exe 分离 |
| 对 Python runtime 的影响 | 无(不变) | 无(不变) | 无(不变) |
| 上游同步成本 | 极低(删的是 RepoPilot 不用的) | 中(路径大改) | 高(Makefile 结构变) |
| 对 RepoPilot 实际需求的价值 | **高**(清除不必要的前端遗留) | 低(目录好看,不改运行) | 无(C 二进制就是 C 二进制,runtime subprocess 管理它) |

### 七、核心判断

**关键洞察**:RepoPilot 的架构里,graph_engine_runtime(Python)通过 **subprocess 启动/管理 C 二进制**(`rp-graph-engine --port=9750`)。C 二进制自带 HTTP server,runtime 不替代它,只做:
- 启动/停止 C 进程
- 健康检查
- C 不可用时降级到 Python
- job 状态管理(在 Python 侧)

所以 **C 内部的"功能 vs 服务"分离,对 Python runtime 层没有实际影响**--无论 C 内部是 lib+exe 还是单一二进制,Python runtime 都是 `subprocess.Popen("rp-graph-engine")`。

**建议**:
- **做等级 A**:清除前端遗留,低风险高收益
- **不做等级 B 和 C**:对 RepoPilot 的实际需求无价值,且增加上游同步成本
- 如果未来有其他 C 程序需要链接 graph_engine 的功能库(不太可能),再考虑等级 C

### 八、`http_server.c` 里的 `index_job_t` 问题

一个额外发现:`http_server.c` 内部定义了 `index_job_t` 结构体和 job 管理逻辑(调度/取消/状态)。这是 **C 引擎自带的 job 管理**,和 Python 侧 `index_pipeline.py` 的 job 管理是**两套独立的 job 管理**。

这意味着:
- C sidecar 模式下:C 引擎自己管 job(在 `http_server.c` 里)
- Python 回退模式下:Python `index_pipeline.py` 管 job
- 两套 job 管理逻辑不共享,状态不同步

这是当前架构的一个潜在问题(两套 job 状态可能不一致),但属于功能层面的问题,不是目录拆分能解决的。报告里阶段 3 迁移 `index_pipeline.py` 到 `graph_engine_runtime` 时,需要决定:是统一用 C 的 job 管理(C 模式下),还是 Python 统管(两种模式都用 Python 的 `index_pipeline` 调 C 的 index API)。