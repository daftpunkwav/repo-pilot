可以。你现在这个方向，我建议给 GLM 5.2 的不是“怎么改目录”的简单指令，而是把目标架构、职责边界、运行模式、依赖关系、C/Python fallback、Agent/Graph 生命周期全部定义清楚，让它根据这个约束修改，而不是让它自己发挥。

下面这份可以直接发给 GLM 5.2。

:::document 48317

RepoPilot 目标架构与重构要求

请基于当前 daftpunkwav/repo-pilot 仓库的实际代码，对项目进行架构重构。

这次重构的核心目标不是单纯调整目录名称，而是明确区分：

1. 功能实现（Core）


2. 运行时（Runtime）


3. API Backend


4. Web Application


5. Graph Engine


6. Agent 的长生命周期任务


7. Graph Engine 的索引任务



请先理解以下目标架构，再结合现有代码判断具体如何迁移。不要为了机械对称而破坏现有代码，也不要在没有必要的情况下大规模重写业务逻辑。

一、目标总体架构

目标是一个“默认多进程、未来可独立部署”的模块化系统。

本地开发默认运行：

┌─────────────────────────────────────────────────────────────┐
│                        RepoPilot                            │
│                                                             │
│  ┌──────────────┐                                           │
│  │ Web          │ :5173                                    │
│  │ React/TS     │                                           │
│  └──────┬───────┘                                           │
│         │ HTTP / WebSocket / SSE                            │
│         ↓                                                   │
│  ┌──────────────┐                                           │
│  │ API Backend  │ :1111                                    │
│  │ Python       │                                           │
│  └──────┬───────┘                                           │
│         │                                                   │
│         │ Agent API / Events                                │
│         ↓                                                   │
│  ┌──────────────┐                                           │
│  │ Agent        │ :2222                                    │
│  │ Runtime      │                                           │
│  └──────┬───────┘                                           │
│         │                                                   │
│         │ Graph API / Job API                               │
│         ↓                                                   │
│  ┌──────────────┐                                           │
│  │ Graph Engine │ :3333                                    │
│  │ Runtime      │                                           │
│  └──────────────┘                                           │
│                                                             │
│  MCP Runtime 可以作为额外独立服务运行                       │
└─────────────────────────────────────────────────────────────┘

最终部署时，这几个组件应该具备独立部署能力：

服务器 A
└── Web

服务器 B
└── API Backend

服务器 C
└── Agent Runtime

服务器 D
└── Graph Engine Runtime

服务器 E
└── MCP Runtime

但这并不意味着当前必须做成 Kubernetes / 微服务体系。

本项目是本地优先的 GitHub 学习工具，因此本地可以通过一个启动器统一启动这些进程：

repo-pilot start
    ├── web
    ├── api
    ├── agent
    └── graph

用户仍然把 RepoPilot 当成一个整体应用。

二、最重要的架构原则

请遵守：

Core = 能力本身

Runtime = 让能力长期运行、调度、管理任务，并对外提供服务

API Backend = 传统 Web 后端和数据服务

Web = 用户交互界面

因此：

agent_core
    ↓
Agent 能做什么

agent_runtime
    ↓
Agent 如何运行、调度、管理、持续执行任务

graph_engine_core
    ↓
Graph Engine 的 C 核心实现

graph_engine_py
    ↓
Graph Engine 的 Python fallback 实现

graph_engine_runtime
    ↓
如何运行 Graph Engine、管理索引任务、管理 C/Python 实现、提供 Graph Service

不要把 Runtime 理解成简单的 HTTP Server。

Runtime 可以包含：

Server
Worker
Task Manager
Scheduler
Lifecycle
Process Management
Workflow
Event Handling

如果目前代码还没有这些组件，不需要为了目录结构强行创建大量空模块。

三、目标目录

建议目标结构：

repo-pilot/
│
├── apps/
│   ├── web/
│   └── desktop/
│
├── services/
│   │
│   ├── api/
│   │   └── api_backend/
│   │
│   ├── agent/
│   │   ├── agent_core/
│   │   └── agent_runtime/
│   │
│   ├── graph_engine/
│   │   ├── graph_engine_core/
│   │   ├── graph_engine_py/
│   │   ├── graph_engine_runtime/
│   │   └── layout/
│   │
│   └── mcp/
│       └── mcp_runtime/
│
├── packages/
│   └── ...
│
└── tools/
    └── ...

其中 packages/、tools/ 是否需要保留或创建，请根据实际代码决定，不要为了形式强行增加。

四、Agent Core 与 Agent Runtime 的严格边界

目标：

agent/
├── agent_core/
└── agent_runtime/

agent_core 是 Agent 的能力实现。

它应该包含：

Agent
LLM
Tools
Memory
Reasoning
Context
Workflow Logic

但不要让 agent_core 依赖 agent_runtime。

依赖方向应该是：

agent_runtime
      ↓
agent_core

而不是：

agent_core
      ↓
agent_runtime

agent_runtime 是独立运行 Agent 的运行层。

它负责：

启动 Agent
监听端口
HTTP/WebSocket/SSE
Agent Session
Workflow 生命周期
Task 生命周期
任务取消
任务状态
事件
后台任务
必要的调度

未来如果需要：

agent_runtime/
├── server/
├── workflow/
├── task/
├── scheduler/
└── ...

可以逐渐演化，但目前不要过度设计。

五、Agent 不再是 API Backend 的普通 Library

这是这次架构调整最重要的变化之一。

当前如果存在：

from agent_core import ...

然后 API Backend 直接运行 Agent，请判断是否应该迁移。

目标架构应该逐渐变成：

Web
 ↓
API Backend
 ↓
Agent Runtime
 ↓
Agent Core

而不是：

Web
 ↓
API Backend
 └── import agent_core

原因是 RepoPilot 的 Agent 已经不是简单的 request/response handler。

Agent 可能执行一个持续数分钟甚至更久的 workflow：

用户：
“我想了解 OpenCode 源码”

        ↓

Agent Runtime
        ↓
识别用户意图
        ↓
导入 OpenCode
        ↓
clone repository
        ↓
请求 Graph Engine 建立 index
        ↓
同时继续和用户聊天
        ↓
根据用户反馈继续调整 workflow
        ↓
Graph Engine 完成
        ↓
通知 Web
        ↓
自动进入 Graph 页面

因此：

HTTP Request 生命周期
        ≠
Agent Workflow 生命周期

Agent Runtime 必须拥有自己的任务生命周期。

六、Agent Runtime 应支持长生命周期任务

例如：

Agent Task
├── created
├── planning
├── cloning
├── indexing
├── learning
├── waiting_user
├── completed
├── cancelled
└── failed

用户可能在任务进行过程中改变意图。

例如：

用户：
“我想学习 OpenCode”

Agent：
开始 clone OpenCode
开始建立 index

用户：
“算了，OpenCode 太难了，我不想看了”

Agent Runtime：
取消当前 workflow

Graph Runtime：
取消对应 OpenCode index job

因此 Agent Runtime 和 Graph Runtime 之间应该存在明确的任务控制接口。

七、Graph Engine 的目标架构

Graph Engine 有两个实现：

graph_engine_core
        ↓
C implementation

以及：

graph_engine_py
        ↓
Python fallback implementation

这两个目录代表“能力实现”。

不要让它们承担 Graph Runtime 的业务编排职责。

目标：

graph_engine/
├── graph_engine_core/
├── graph_engine_py/
└── graph_engine_runtime/

其中：

graph_engine_core

负责 C Graph Engine 本身。

graph_engine_py

负责 Python fallback。

graph_engine_runtime

负责：

Graph Server
Index Job
Job Queue
Job State
Priority
Cancellation
Worker
C/Python implementation selection
C → Python fallback

八、Graph Runtime 的 C/Python 策略

Graph Runtime 应该能够支持三种模式：

C 模式

Graph Runtime
      ↓
C Graph Engine

Python 模式

Graph Runtime
      ↓
Python Graph Engine

Hybrid / Fallback 模式

Graph Runtime
      ↓
尝试 C Engine
      │
      ├── 可用 → C
      │
      └── 不可用
             ↓
          Python

不要让 API Backend 自己负责所有 C/Python fallback 逻辑。

Fallback 的真正归属应该逐渐移动到 Graph Runtime。

API Backend 只需要知道：

Graph Runtime API

而不应该关心：

C binary 在哪里
Python implementation 怎么 import
C 是否可用
如何 fallback

九、Graph Runtime 应拥有 Index Job 生命周期

例如：

POST /projects/{id}/index

→ 创建 IndexJob
→ clone/analyze
→ C Engine 优先
→ fallback Python
→ 更新状态
→ 完成

Job 应至少可以表达：

queued
running
completed
failed
cancelled

并可以逐渐支持：

priority
progress
logs
estimated_time
worker
implementation

例如：

OpenCode
priority = high
implementation = c
status = running
progress = 67%

如果 C Engine 不可用：

implementation = python
fallback = true

十、Agent 与 Graph Runtime 的关系

不要：

Agent Runtime
    ↓
import graph_engine_core

而应该：

Agent Runtime
    ↓
Graph Runtime API

例如：

Agent Runtime
    │
    ├── create index job
    ├── query job status
    ├── change priority
    ├── cancel job
    └── wait for completion
                │
                ↓
        Graph Runtime
                │
        ┌───────┴────────┐
        ↓                ↓
    C Engine        Python Engine

这样 Agent 不需要知道 Graph Engine 内部具体使用 C 还是 Python。

十一、Graph Runtime 与 Web 的关系

Graph Runtime 完成索引后，可以产生事件：

Graph Runtime
      ↓
index.completed
      ↓
Agent Runtime
      ↓
workflow continues
      ↓
通知 API / Web
      ↓
Web 自动进入 Graph 页面

Web 不应该直接管理 Graph Engine 内部状态。

Web 主要负责：

展示 Graph
用户交互
节点点击
缩放
旋转
查询

具体 Graph 数据由 Graph Runtime 提供。

十二、API Backend 的职责

API Backend 仍然保留传统后端职责：

用户
项目
GitHub import
搜索
排序
数据库
用户数据
项目数据
REST API
权限

不要因为 Agent 独立出来就把所有东西都塞到 Agent Runtime。

例如：

用户请求：
导入一个 GitHub 项目

API Backend
    ↓
传统 CRUD / 项目管理

Agent Runtime
    ↓
理解自然语言并决定“应该导入什么”

Agent 可以调用 API Backend 的业务接口。

因此：

Agent Runtime
    ↓
API Backend

也是合理的。

但双方应该通过 API / 明确的 service interface 解耦。

十三、不要把“多进程”误认为“必须微服务化”

本项目的目标不是：

为了企业级而微服务

而是：

明确独立生命周期
明确任务边界
明确部署边界
允许独立扩展

因此本地：

Web
API
Agent Runtime
Graph Runtime

四个进程完全可以运行在同一台电脑：

localhost:5173
localhost:1111
localhost:2222
localhost:3333

未来：

Web Server
API Server
Agent Server
Graph Server

可以分别部署。

这是“可独立部署的模块化架构”，而不是要求现在就完整微服务化。

十四、一个非常重要的架构原则

请不要为了目录对称而机械修改。

例如：

agent_core
agent_runtime

与：

graph_engine_core
graph_engine_py
graph_engine_runtime

不需要完全相同。

因为 Graph Engine 本身有：

C implementation
Python implementation
Runtime

而 Agent 只有：

Core
Runtime

这是业务事实造成的差异。

不要为了形式上的对称破坏真实职责。

十五、最终依赖关系

目标应该接近：

┌─────────────┐
                     │     Web     │
                     └──────┬──────┘
                            │
                            ↓
                     ┌─────────────┐
                     │ API Backend │
                     └──────┬──────┘
                            │
                 ┌──────────┴──────────┐
                 ↓                     ↓
        ┌─────────────────┐   ┌──────────────────┐
        │ Agent Runtime   │   │ 传统 API Service │
        └────────┬────────┘   └──────────────────┘
                 │
                 ↓
          ┌─────────────┐
          │ Agent Core  │
          └──────┬──────┘
                 │
       ┌─────────┼─────────┐
       ↓         ↓         ↓
     API       Graph      MCP
       │         │         │
       │         ↓         │
       │  Graph Runtime    │
       │         │         │
       │    ┌────┴────┐    │
       │    ↓         ↓    │
       │    C         Py   │
       │                    │
       └────────────────────┘

其中最重要的依赖原则：

Runtime → Core
Runtime → 外部 Service API

Core 不应该 → Runtime

Graph Runtime → graph_engine_core / graph_engine_py

Agent Runtime → Agent Core

Agent Runtime → Graph Runtime API

API Backend → Agent Runtime API

API Backend → Graph Runtime API（必要时）

尽量避免：

Core → Runtime
Core → Web
Core → API Backend
Graph Core → Agent
Agent Core → Graph Core

十六、迁移策略

不要一次性重写整个项目。

建议：

第一阶段：

agent/
├── agent_core/
└── agent_runtime/

明确 Agent Runtime 入口和 Agent Core 边界。

第二阶段：

graph_engine/
├── graph_engine_core/
├── graph_engine_py/
└── graph_engine_runtime/

将 Graph Server / Job 管理 / C-Python fallback 逐渐移动到 Runtime。

第三阶段：

修改 API Backend：

API Backend
    ↓
Agent Runtime API
Graph Runtime API

减少 API Backend 对 Agent Core / Graph Core 的直接 import。

第四阶段：

实现统一启动：

repo-pilot start

自动启动：

Web
API
Agent Runtime
Graph Runtime

第五阶段：

确保每个 Runtime 都可以独立启动：

agent runtime
graph runtime

并可以未来独立部署。

十七、特别注意

当前仓库中 C Graph Engine 是迁移过来的大型 C 工程。

不要为了满足目录设计而机械拆分 C 源码。

如果 C Engine 内部的 HTTP server、daemon、main 等代码与核心实现高度耦合，应该优先考虑：

graph_engine_runtime
        ↓
启动/管理
        ↓
graph_engine_core 编译出的 C binary

而不是强行把 C 源码拆成：

graph_engine_core
graph_engine_server

除非实际代码结构允许低风险拆分。

这里的架构目标是：

> 运行职责与功能职责逻辑分离。



不要求：

> 所有物理源文件必须被机械移动。



十八、最终判断标准

重构完成后，希望可以回答以下问题：

1. agent_core 是什么？ → Agent 的功能实现。


2. agent_runtime 是什么？ → Agent 的完整运行层，可以独立进程、独立端口、独立部署。


3. graph_engine_core 是什么？ → C Graph Engine 功能实现。


4. graph_engine_py 是什么？ → Python fallback 功能实现。


5. graph_engine_runtime 是什么？ → Graph Engine 的运行层、索引任务管理、C/Python fallback 和对外服务。


6. API Backend 是否必须知道 Agent 使用哪个 LLM？ → 不应该。


7. API Backend 是否必须知道 Graph Engine 使用 C 还是 Python？ → 不应该。


8. Agent 是否可以拥有一个比 HTTP Request 更长的生命周期？ → 可以，而且这是核心需求。


9. Graph Index Job 是否可以比 HTTP Request 生命周期更长？ → 可以，而且应该可以。


10. 用户取消学习任务时，能否取消对应的 Graph Index Job？ → 应该可以。


11. 默认本地运行是否可以仍然作为一个整体应用？ → 可以。


12. 未来能否把 Web、API、Agent Runtime、Graph Runtime 分别部署？ → 应该可以。



请基于以上目标检查当前代码，并给出实际可执行的重构方案。优先保证职责边界和依赖方向正确，而不是追求目录表面上的对称。 :::

