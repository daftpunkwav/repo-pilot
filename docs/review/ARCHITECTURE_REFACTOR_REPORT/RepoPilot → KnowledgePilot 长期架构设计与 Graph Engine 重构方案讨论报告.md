RepoPilot → KnowledgePilot 长期架构设计与 Graph Engine 重构方案讨论报告

一、这次讨论的目标

我希望你基于当前 RepoPilot 的实际代码结构，对项目未来的长期架构进行一次系统性的架构评审。

这次讨论不是单纯讨论“目录应该怎么命名”，也不是要求为了追求所谓的微服务规范而拆服务。

我的核心目标是：

1. 当前项目仍然是本地运行的 AI 学习工具，但代码架构从一开始就应该考虑未来扩展。
2. Agent、Graph Engine、MCP 等复杂业务不应该长期混杂在 API Backend 中。
3. Agent 应该最终成为可以独立运行、独立部署的 Runtime。
4. Graph Engine 更重要，因为它未来可能从“RepoPilot 的源码图谱功能”发展成一个独立的通用知识索引/知识图谱引擎。
5. 因此 Graph Engine 的“功能实现源码”和“服务运行代码”最终必须彻底解耦。
6. 当前 Graph Engine 的 C 实现大量来自 MIT 开源项目 "codebase-memory-mcp"，其功能代码和服务代码高度耦合，因此不能简单通过移动几个目录解决。
7. 希望你不要直接给出“现在不值得拆”的结论，而是认真研究：这个拆分究竟是不可行、代价很大，还是可以通过渐进式重构实现。
8. 希望得到一个可以实际执行的长期架构迁移方案，而不是一次性大重构方案。

---

二、项目当前定位

当前项目名为 RepoPilot：

GitHub：

https://github.com/daftpunkwav/repo-pilot

目前它是一个 AI 赋能的 GitHub 项目学习工具。

但是我现在对项目的长期定位已经开始发生变化。

当前可以理解为：

RepoPilot
=
GitHub Repository Learning Tool

未来希望逐渐发展为：

KnowledgePilot
=
AI + Knowledge Indexing + Knowledge Graph + Learning

也就是说，GitHub 源码只是知识的一种来源。

未来可能支持：

GitHub Repository
新闻
技术文章
文档
教材
论文
课程资料
网页
其他知识源

然后统一经过索引、解析、抽取、关系构建等过程，最终形成知识图谱。

因此，我希望现在的 Graph Engine 架构不要只围绕“GitHub 源码图谱”设计。

---

三、当前整体项目结构

项目目前大体采用 monorepo：

repo-pilot/
├── apps/
│   ├── web/
│   └── desktop/             # 未来实现
│
└── services/
    ├── api/
    ├── agent/
    ├── graph_engine/
    └── mcp/

技术栈主要为：

Python
TypeScript
C

其中：

web

是前端。

api

是传统后端业务服务。

例如：

用户
项目
GitHub
搜索
排序
导入
CRUD
数据库

等等。

agent

负责 AI Agent：

LLM
Agent
Tool Calling
Workflow
Memory
用户意图识别
自动导入项目
Agent 对话
后台任务

等。

graph_engine

负责源码分析、索引、依赖关系、图谱等。

mcp

目前主要作为未来预留。

---

四、当前运行模式

项目最开始希望采用：

Web + API

两个主要进程。

例如：

Web
:5173

API
:19878

API Backend 内部可以调用 Agent 和 Graph Engine。

也就是说：

Web
 ↓
API Backend
 ├── Agent
 └── Graph Engine

这样对于一个本地运行的学习工具来说非常简单。

用户只需要启动：

frontend
backend

即可。

但是我并不希望因此把 Agent 和 Graph Engine 永久绑定在 API Backend 内部。

---

五、我的核心架构思想

我的基本思想是：

«项目刚开始的时候，可以是模块化单体，但模块边界应该从一开始就明确。»

我不喜欢：

backend/
├── users/
├── posts/
├── agent/
├── graph/
├── mcp/
├── everything/

所有业务都长期混在一个 backend 中。

即使项目目前只有一个业务，也希望提前划分业务边界。

原因是：

项目今天可能只有：

用户
帖子
评论

但是未来可能加入：

小组
短视频
直播
推荐
搜索
AI
消息

如果最开始所有东西都是一个巨大的 backend，随着业务增长会越来越难维护。

因此我希望采用：

逻辑模块化
→
必要时 Runtime 化
→
必要时独立进程
→
必要时独立部署

而不是：

先写一个巨型单体
→
项目变大
→
被迫重构
→
痛苦拆服务

---

六、Agent 的长期设想

我希望 Agent 最终采用：

agent/
├── agent_core/
└── agent_runtime/

或者未来可能：

agent/
├── core/
└── runtime/

其中：

agent_core

只负责 Agent 的功能：

Agent
LLM
Memory
Context
Tool
Workflow
Reasoning
Intent

等。

它不应该依赖：

HTTP
FastAPI
Server
Process
Port

这些运行时概念。

而：

agent_runtime

负责把 Agent Core 变成一个完整的运行单元。

例如：

HTTP Server
SSE
认证
任务管理
生命周期
配置
并发
后台任务

等。

这样：

agent_core

可以被其他 Python 程序直接使用。

而：

agent_runtime

可以：

独立启动
独立监听端口
独立运行
独立部署

例如：

agent_runtime
:2222

未来甚至可以单独把：

services/agent/

发布出去。

---

七、Agent 的真实业务场景

未来 Agent 并不是一个简单的“聊天接口”。

例如用户说：

«我想了解一下 OpenCode 的源码。»

Agent 可能执行：

用户对话
 ↓
识别用户意图
 ↓
发现需要学习 OpenCode
 ↓
后台 clone OpenCode
 ↓
创建 Graph Index Job
 ↓
Graph Engine 开始分析
 ↓
Agent 同时继续和用户交流
 ↓
了解用户基础
 ↓
讲解 OpenCode
 ↓
出题
 ↓
持续教学
 ↓
Graph Index 完成
 ↓
自动通知前端
 ↓
前端跳转 Graph 页面
 ↓
Agent 继续解释图谱

用户甚至可能：

«OpenCode 太难了，我不想看了。»

Agent 应该能够：

取消学习任务
 ↓
取消 Graph Index Job
 ↓
Graph Runtime 停止/取消任务

这意味着 Agent 本质上已经是一个：

长生命周期
有状态
异步
可调度
可取消
具有工作流
具有后台任务

的完整运行系统。

所以我认为 Agent 已经不适合简单理解成：

api_backend/
└── agent_service.py

而应该最终拥有自己的 Runtime。

---

八、Graph Engine 是更加重要的问题

Graph Engine 最初只是：

GitHub Repository
 ↓
源码分析
 ↓
函数
 ↓
文件
 ↓
调用关系
 ↓
依赖关系
 ↓
图谱

但是未来我希望它扩展为：

Graph Engine

甚至：

Knowledge Engine

可以处理：

源码
新闻
技术文章
文档
教材
论文
知识点

例如：

计算机网络教材
 ↓
TCP
UDP
IP
HTTP
DNS
Socket
...
 ↓
概念关系
依赖关系
先修关系
引用关系

新闻：

新闻
 ↓
人物
公司
事件
产品
时间
地点
因果关系

最终统一形成知识图谱。

因此未来：

services/graph_engine/

本身可能成为一个可以独立发布的高质量项目。

我希望做到：

«把 "services/graph_engine/" 单独拿出去，它不需要 RepoPilot 的 API Backend、Agent、Web，也能够独立完成知识索引、图谱构建、查询等工作。»

---

九、Graph Engine 当前最特殊的问题

Graph Engine 的 C 实现并不是我从零设计的。

它大量迁移自：

DeusData/codebase-memory-mcp

MIT License。

原项目本身就是一个完整的 C 工程。

问题在于：

«上游项目把“功能实现”和“服务运行代码”高度耦合在一起。»

当前 C Engine 中存在类似：

src/
├── daemon/
├── ui/
├── main.c
├── pipeline/
├── semantic/
├── store/
├── discover/
├── ...

也就是说：

Graph 功能
HTTP Server
Daemon
Process
Main

不是天然严格分开的。

例如已经存在：

http_server.c
httpd.c
daemon/
main.c

同时又存在大量真正的：

index
parse
semantic
store
graph
discover

代码。

当前整个 C 工程还是作为一个完整工程编译。

---

十、当前 Graph Engine Python 实现

同时项目还有 Python fallback。

Python 实现大致包含：

engine.py
indexer.py
store.py
server.py

其中：

engine.py
indexer.py
store.py

属于真正的 Graph 功能。

而：

server.py

属于服务入口。

所以 Python 部分相对容易拆：

graph_engine_py/
├── core
└── server

但是 C 部分远远没有这么简单。

---

十一、当前 Graph Engine 的 C/Python fallback

目前 API 层已经存在 C / Python fallback 思路。

逻辑大致是：

API
 ↓
Graph Client
 ↓
C Engine 可用？
 ├── Yes → C
 └── No  → Python

例如：

C Engine
:9750

不可用时：

Python Graph Engine

接管。

这个机制我认为本身是合理的。

但是未来我不希望这个 fallback 永远只存在于 API Backend。

应该逐渐移动到：

Graph Runtime

中。

即：

Graph Runtime
       │
       ├── C implementation
       │
       └── Python implementation

由 Graph Runtime 决定：

C 优先
C 不可用 → Python

而不是让 API Backend 了解 C/Python 的具体实现。

---

十二、我希望最终形成的 Graph 架构

我目前设想最终应该类似：

services/
└── graph_engine/
    │
    ├── core/
    │   ├── domain/
    │   ├── graph/
    │   ├── indexing/
    │   ├── knowledge/
    │   ├── storage/
    │   └── ...
    │
    ├── implementations/
    │   ├── c/
    │   ├── python/
    │   └── future/
    │
    ├── adapters/
    │   ├── c/
    │   └── python/
    │
    └── runtime/
        ├── server/
        ├── scheduler/
        ├── jobs/
        ├── workers/
        ├── engine_selector/
        └── launcher/

这只是我的目标思想，不要求你机械按照这个目录修改。

核心要求是：

Core

绝对不能知道：

Server
HTTP
FastAPI
Daemon
Process
Port
Runtime
RepoPilot
Agent

而：

Runtime

负责：

启动
停止
任务
调度
并发
取消
进度
Fallback
生命周期
网络接口

---

十三、我对“彻底拆分”的要求

这里我要特别强调：

我不是仅仅希望：

graph_engine_core/
graph_engine_runtime/

两个目录看起来分开。

我真正要求的是：

功能实现

在架构上真正独立。

例如：

Graph Core

应该能够被：

Python
C
CLI
Agent
Desktop
第三方项目

直接调用。

而不需要：

启动 HTTP Server
启动 daemon
启动 API

才能使用。

理想状态：

Graph Core
 ↓
Graph API

然后可以有多个上层：

Graph CLI
Graph Server
Graph Runtime
Python Binding
Agent

---

十四、我不希望采用的方案

我不希望最终变成：

graph_engine_runtime/
    ↓
启动 rp-graph-engine
    ↓
rp-graph-engine 内部继续包含所有 HTTP + Core

然后说：

«“没关系，Runtime 在外面，所以已经解耦。”»

对于我未来的目标而言，这种解耦是不充分的。

因为如果未来我要把 Graph Engine 单独发布成一个高质量项目：

graph_engine/

我仍然无法直接复用真正的功能库。

所以：

«Graph Runtime 和第三方 C Engine 的外部隔离只是第一层隔离，不是最终目标。»

---

十五、但我也不希望暴力重写上游项目

这里存在一个非常现实的问题：

C Engine 来自 MIT 开源项目。

目前它规模很大，而且：

Makefile
CMake
CI
vendored dependencies
build scripts

都可能依赖当前目录结构。

如果直接把：

src/ui/http_server.c
src/daemon/
src/main.c

全部移动到：

server/

很可能会导致：

include
link
build
CI
测试
上游同步

全部出现问题。

而且会严重降低未来同步 upstream 的能力。

所以我希望你重点判断：

«这个拆分到底是技术上不可行，还是只是目前成本较高？»

如果可以做，我希望采用：

渐进式解耦

而不是一次性重构。

---

十六、我希望你重点研究“依赖方向”

最终目标不是目录漂亮，而是依赖方向：

Runtime
   ↓
Public Graph API
   ↓
Core

而不能：

Core
   ↓
HTTP

也不能：

Core
   ↓
Runtime

更不能：

Core
   ↓
RepoPilot API

理想情况下：

                    Runtime
                       │
                       ↓
                  Public API
                       │
                       ↓
                     Core
                  ↙    ↓    ↘
               Source Knowledge News

---

十七、建议的渐进式重构方向

我目前倾向于分成多个阶段。

Phase 0：现状分析

不要修改代码。

首先分析 C Engine：

所有 source files
所有 include
所有 symbol
所有调用关系
所有 build dependencies

特别找出：

Core → Server
Core → HTTP
Core → Daemon
Core → Process
Core → Main

这些反向依赖。

最终生成依赖图。

---

Phase 1：建立 Public API

先不要移动大量文件。

在 C Engine 内部建立明确的：

Graph Public API

例如：

graph_index(...)
graph_query(...)
graph_delete(...)
graph_health(...)
graph_layout(...)

让上层只依赖这个接口。

---

Phase 2：隔离 Server

逐渐让：

HTTP
Daemon
Main

只调用：

Graph Public API

而 Graph Public API 不反过来调用 Server。

形成：

Server
   ↓
Graph API
   ↓
Core

---

Phase 3：提取真正 Core

当依赖关系稳定后，再逐渐将：

index
parser
semantic
store
graph

整理成真正的：

Graph Core

---

Phase 4：C Engine Library 化

最终 C 实现应该可以：

build library

而不仅仅是：

build executable

例如：

libgraph_engine

然后：

graph_engine_server

只是它的一个消费者。

---

Phase 5：统一 C / Python Interface

让：

C
Python

都实现统一 Graph Engine Contract：

Index
Query
Delete
Health
Status
Layout

然后 Graph Runtime 负责：

C
 ↓
fallback
 ↓
Python

---

Phase 6：Graph Runtime 独立化

Graph Runtime 负责：

Job
Scheduler
Worker
Cancellation
Priority
Progress
Engine Selection
C/Python fallback
Server

例如：

Graph Runtime
:3333

独立运行。

---

十八、未来 Graph Runtime 的作用

Graph Runtime 不是 Graph Core。

例如同时有：

OpenCode
LangGraph
DeepAgents
Linux
Computer Networks
LLM News

需要索引。

Runtime 可以：

Job Queue

Job 1: OpenCode
Job 2: LangGraph
Job 3: DeepAgents
Job 4: Computer Networks
Job 5: News

然后：

Priority
Concurrency
Cancellation
Retry
Progress
Resource Control

全部由 Runtime 管理。

例如 Agent 说：

优先索引 OpenCode

Runtime 调整 Job Priority。

Agent 又说：

取消 OpenCode

Runtime：

cancel(job_id)

这也是为什么我认为 Graph Runtime 最终会成为真正独立的系统，而不是简单的 "server.py"。

---

十九、未来独立部署

最终希望支持：

                 Web
                  │
                  ↓
              API Backend
             /           \
            ↓             ↓
      Agent Runtime    Graph Runtime
          :2222            :3333

也可以进一步：

Web Server
API Server
Agent Server
Graph Server
MCP Server

分别部署。

例如：

server A
API

server B
Agent

server C
Graph

server D
MCP

甚至未来：

Graph Server

本身成为独立产品。

---

二十、未来本地模式

但是我仍然希望支持本地开发/本地使用的简化模式。

最终可以有：

Development / Local

Web
 ↓
API
 ├── Agent Runtime Embedded
 └── Graph Runtime Embedded

也可以：

Full Local

Web
 ↓
API
 ↓
Agent Runtime
 ↓
Graph Runtime

再到：

Production

Web
 ↓
API
 ↓
Agent Runtime
 ↓
Graph Runtime

也就是说：

«逻辑边界必须稳定，但进程边界可以根据部署模式变化。»

这是我非常重视的一点。

---

二十一、Agent Runtime 与 Graph Runtime 的关系

最终：

Agent Runtime

不应该直接控制：

C Engine
Python Engine

而应该：

Agent Runtime
       ↓
Graph Runtime API
       ↓
Graph Runtime
       ↓
C/Python Engine

例如：

Agent:
index repository OpenCode

Graph Runtime：

create_job(
    source="github",
    target="OpenCode"
)

Agent 不需要知道：

C 是否可用
Python 是否 fallback
Worker 在哪里
Job 在哪里

这些都是 Graph Runtime 的职责。

---

二十二、API Backend 的职责

API Backend 最终应该主要负责传统业务：

User
Project
Authentication
GitHub
Notes
Learning Records
Search
CRUD
Database

它不应该负责：

Agent Reasoning
Graph Scheduling
C/Python Selection
Long-running Graph Jobs
Agent Workflow

否则最终仍然会变成：

巨大 API Backend

---

二十三、最终整体架构愿景

我目前脑中的最终结构是：

                           KnowledgePilot
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
               Web             Desktop           Other
                │
                ↓
          API Backend
                │
       ┌────────┴─────────┐
       ↓                  ↓
Agent Runtime       Graph Runtime
       │                  │
       ↓                  ↓
 Agent Core          Graph Core
                          │
             ┌────────────┼────────────┐
             ↓            ↓            ↓
          Source       Knowledge      News
          Engine         Engine       Engine
             │
        ┌────┴────┐
        ↓         ↓
       C        Python

最终 Graph Engine 可以完全脱离：

Web
API
Agent
RepoPilot

独立运行。

---

二十四、我希望你回答的核心问题

请不要只回答“合理/不合理”。

请从代码和工程实现角度认真分析下面的问题。

1.

当前 "codebase-memory-mcp" C 工程的功能代码与服务代码，究竟耦合到什么程度？

请具体分析：

HTTP
daemon
main
service
graph/indexing/semantic/store

之间的真实依赖关系。

---

2.

把它最终拆成：

Graph Core
Graph Server

技术上是否可行？

如果可行：

需要拆什么
风险是什么
哪些可以渐进迁移
哪些必须保留

---

3.

哪些代码绝对不能放进 Core？

例如：

HTTP
TCP
FastAPI
daemon
CLI
process management
configuration
logging

请给出明确边界。

---

4.

Core 与 Runtime / Server 之间应该通过什么接口连接？

例如：

C ABI
REST
RPC
function API
callback
event

分别有什么优缺点？

---

5.

C Engine 是否应该最终同时提供：

libgraph_engine
rp-graph-engine

即：

Library
Executable

两个产物？

如果是，请给出推荐结构。

---

6.

Python fallback 应该如何设计？

最终是否应该：

Graph Core
├── C Implementation
└── Python Implementation

还是：

Graph Core
Graph C Adapter
Graph Python Adapter

或者其他方式？

---

7.

Graph Runtime 应该负责什么？

请明确区分：

Graph Core
Graph Implementation
Graph Adapter
Graph Runtime
Graph Server

五者的职责。

---

8.

未来如果增加：

新闻索引
知识点索引
教材索引
论文索引
网页索引

应该如何扩展？

是：

source/
knowledge/
news/

还是：

plugins/
providers/
pipelines/

还是其他架构？

---

9.

如何保证未来：

services/graph_engine/

能够被单独拿出来成为一个独立仓库？

也就是说：

graph_engine

不能依赖：

api_backend
agent
web
RepoPilot-specific database

请给出依赖约束。

---

10.

当前 MIT 上游项目应该如何处理？

请比较：

A. 直接在原工程上重构
B. upstream + patches
C. fork 后逐渐重构
D. 抽取核心代码重新组织
E. 其他

重点考虑：

未来 upstream 更新
MIT license
维护成本
Git merge
代码可追溯性

---

11.

请给出一个真正可以执行的渐进式迁移路线。

例如：

Phase 0
依赖分析

Phase 1
Public API

Phase 2
Server → API

Phase 3
Core extraction

Phase 4
Library

Phase 5
Runtime

Phase 6
Python/C abstraction

Phase 7
Knowledge Engine

每个阶段请说明：

目标
修改范围
风险
完成标准

---

12.

最后，请判断我的总体架构思想是否合理：

«“从一开始就建立业务边界和模块边界，但不一定一开始就拆成多个进程。随着业务成熟，再把模块提升为 Runtime / 独立服务。”»

以及：

«“功能源码和运行时源码应该严格分离。即使某个第三方实现内部没有做到，也应该通过渐进式重构最终建立这个边界。”»

请不要因为当前项目规模较小就简单建议“没必要”。

我要讨论的是这个项目未来 2～3 年的架构演进方向。

---

二十五、最重要的最终目标

我最终希望做到的不是：

RepoPilot
├── api
├── agent
└── graph

而是：

KnowledgePilot
│
├── applications
│   ├── web
│   └── desktop
│
├── services
│   ├── api
│   ├── agent
│   ├── graph_engine
│   └── mcp
│
└── libraries / packages
    ├── shared
    └── ...

其中：

Agent

可以成为独立 Runtime。

Graph Engine

可以成为独立 Runtime。

而 Graph Engine 内部进一步做到：

Graph Core
       ↓
Implementations
       ↓
Runtime

最终：

Graph Engine

甚至可以完全脱离 KnowledgePilot，成为一个独立的、高质量、可复用的知识索引与图谱基础设施。

所以当前真正需要解决的不是“目录怎么改”，而是：如何从现在高度耦合的第三方 C 工程，渐进式演化出一个真正干净的 Core，而不破坏现有功能、构建系统和未来 upstream 同步能力。

请基于这个目标，对当前代码进行深入分析后再给出结论。
