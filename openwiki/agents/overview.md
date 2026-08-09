---
type: Agent Reference
title: Agent 系统概述
description: RepoPilot 中全部 7 个 AI Agent 的概述，包括它们的角色、能力和工作流
tags: [agent, ai, overview, hub, scout, mentor, navigator, curator, scribe, atlas]
openwiki:
  roles: [domain]
  source_paths: [services/agent/agent_core/agents/]
  symbols: [Hub, Scout, Mentor, Navigator, Curator, Scribe, Atlas]
---

# Agent 系统概述

## 7 个 Agent

RepoPilot 采用多 Agent 系统，包含 7 个专业化的 AI Agent，由 Hub Agent 统一编排。

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TB
    Hub(("Hub<br/>Orchestrator"))
    
    subgraph Experts["Expert Agents"]
        Scout["Scout<br/>🔍 Quick Analysis"]
        Mentor["Mentor<br/>👨‍🏫 Teaching"]
        Navigator["Navigator<br/>🧭 Learning Path"]
        Curator["Curator<br/>📚 Organization"]
        Scribe["Scribe<br/>✍️ Note Taking"]
        Atlas["Atlas<br/>🗺️ Knowledge Graph"]
    end
    
    Hub -->|Dispatch| Scout
    Hub -->|Dispatch| Mentor
    Hub -->|Dispatch| Navigator
    Hub -->|Dispatch| Curator
    Hub -->|Dispatch| Scribe
    Hub -->|Dispatch| Atlas
    
    style Hub fill:#f9f,stroke:#333,stroke-width:4px
```

## Agent 汇总

| Agent | 图标 | 角色 | 工作流 | 适用场景 |
|-------|------|------|----------|----------|
| **Hub** | 🎯 | 总调度器 | Plan-and-Execute | 意图路由、任务规划 |
| **Scout** | 🔍 | 快速分析器 | ReAct | 30 秒项目概览 |
| **Mentor** | 👨‍🏫 | AI 导师 | ReAct + ToT | 深度讲解、教学 |
| **Navigator** | 🧭 | 学习规划师 | ReAct | 个性化学习路径 |
| **Curator** | 📚 | 知识整理者 | Reflexion | 项目分类、打标签 |
| **Scribe** | ✍️ | 笔记记录员 | ReAct | 学习笔记生成 |
| **Atlas** | 🗺️ | 图谱向导 | ReAct | 知识图谱探索 |

## Hub Agent

**编排者**

### 角色
- 中央调度与协调
- 意图分类与任务规划
- 多 Agent 结果聚合
- 记忆管理协调

### 工作流：Plan-and-Execute

```
1. Understand user intent
2. Plan task decomposition
3. Dispatch expert agents
4. Collect and aggregate results
5. Present coherent response
```

### 关键工具
- `dispatch_agent` - 路由至专家 Agent
- `ask_user` - 提出澄清问题
- `query_memories` - 访问用户上下文

### 说话风格

| 风格 | 描述 |
|-------|-------------|
| Default | 专业、决策清晰 |
| Gentle | 引导用户澄清需求 |
| Strict | 严格执行计划 |
| Sarcastic | 幽默风趣但乐于助人 |
| Casual | 团队负责人的氛围 |

## Scout Agent

**快速分析器**

### 角色
- 快速项目评估
- GitHub 元数据提取
- README 分析
- 技术栈识别

### 工作流：ReAct

```
1. Fetch GitHub metadata
2. Read README
3. Analyze structure
4. Provide summary
```

### 目标响应时间
- **30 秒**内完成完整分析

### 关键工具
- `fetch_github_repo` - 获取仓库元数据
- `fetch_readme` - 获取 README 内容
- `query_user_projects` - 从用户项目库获取上下文

### 输出格式

```markdown
## Project Overview: {name}

**What it is**: One-sentence description

**Tech Stack**: Primary languages/frameworks

**Key Features**: 3-5 bullet points

**Difficulty**: Beginner/Intermediate/Advanced

**Worth Learning?**: Yes/No + brief rationale
```

## Mentor Agent

**AI 导师**

### 角色
- 深入的技术教学
- 多路径讲解
- 互动测验
- 适应用户水平

### 工作流：ReAct + ToT（思维树）

```
1. Assess user knowledge level (ask if unknown)
2. Generate multiple explanation paths
3. Select best path based on user profile
4. Deliver structured explanation
5. Verify understanding (optional quiz)
```

### 关键工具
- `fetch_readme` - 获取文档
- `query_user_projects` - 了解先验知识
- `ask_user` - 互动提问/测验
- `propose_memory` - 更新学习档案

### 教学方法

| 方法 | 使用时机 |
|--------|-------------|
| Analogy | 复杂概念 |
| Source Walkthrough | 代码理解 |
| Comparison | 相似技术 |
| Step-by-Step | 操作流程 |

### 测验格式

```json
{
  "type": "quiz",
  "title": "Check Your Understanding",
  "items": [
    {
      "key": "q1",
      "question": "What is React's virtual DOM?",
      "type": "choice",
      "options": [
        "A lightweight copy of the actual DOM",
        "A browser extension",
        "A database for React apps"
      ]
    }
  ]
}
```

## Navigator Agent

**学习规划师**

### 角色
- 个性化学习路径创建
- 里程碑定义
- 进度跟踪建议
- 学习资源推荐

### 工作流：ReAct

```
1. Analyze user's current projects/skills
2. Identify knowledge gaps
3. Define learning goals
4. Create phased path
5. Set verification milestones
```

### 关键工具
- `query_user_projects` - 当前知识储备
- `query_graph` - 相关技术
- `create_learning_path` - 存储计划
- `suggest_learning_path` - 获取推荐

### 路径结构

```markdown
## Learning Path: {topic}

### Phase 1: Foundations (Week 1-2)
- Goal: Understand core concepts
- Resources: [links]
- Verification: Complete tutorial X

### Phase 2: Practice (Week 3-4)
- Goal: Build simple project
- Resources: [links]
- Verification: Submit project

### Phase 3: Advanced (Week 5+)
- Goal: Master advanced topics
- Resources: [links]
- Verification: Contribute to OSS
```

## Curator Agent

**知识整理者**

### 角色
- 项目分类
- 标签建议
- 项目库整理
- 重复项目检测

### 工作流：Reflexion

```
1. Candidate Generation (propose categories)
2. Evaluation (check against existing)
3. Reflection (max 2 rounds of refinement)
4. Final Decision (apply category/tags)
```

### 关键工具
- `set_project_category` - 分配分类
- `set_project_tags` - 应用标签
- `update_project_progress` - 更新状态
- `import_github_repos` - 批量导入

### 分类标准

| 因素 | 权重 |
|--------|--------|
| 主要编程语言 | 高 |
| 项目描述 | 高 |
| 用户已有的分类 | 中 |
| 项目库中的相似项目 | 中 |

### Reflexion 提示

- "这个分类与现有分类是否过于相似？"
- "这个名称对用户来说是否有意义？"
- "我们是否造成了分类膨胀？"

## Scribe Agent

**笔记记录员**

### 角色
- 学习笔记生成
- 项目对比笔记
- 结构化文档
- 复习材料创建

### 模式

#### Project 模式
```
Context: Compare with user's existing projects
Use case: Learning new tech related to known tech
Output: Comparative analysis notes
```

#### Standalone 模式
```
Context: Independent analysis
Use case: First-time learning
Output: Comprehensive standalone notes
```

### 关键工具
- `create_note` - 保存到数据库
- `draft_note_outline` - 生成大纲结构
- `query_user_projects` - 用于对比
- `fetch_readme` - 源材料

### 笔记结构

```markdown
# {Project} Learning Notes

## Overview
Brief project description

## Key Concepts
- Concept 1: Explanation
- Concept 2: Explanation

## Architecture
System design insights

## Code Patterns
Notable implementation patterns

## Comparison
{if similar projects exist}
- Similarities: ...
- Differences: ...

## Action Items
- [ ] Task 1
- [ ] Task 2
```

## Atlas Agent

**图谱向导**

### 角色
- 知识图谱导航
- 关系解释
- 聚类分析
- 学习路径可视化

### 工作流：ReAct

```
1. Query graph for context
2. Analyze relationships
3. Identify clusters/patterns
4. Explain to user
5. Suggest exploration paths
```

### 关键工具
- `query_knowledge_graph` - 图谱数据访问（支持中心项目邻域子图）
- `query_user_projects` / `get_project_detail` - 项目上下文
- `get_learning_stats` - 学习统计

### 图谱概念

| 概念 | 描述 |
|---------|-------------|
| Nodes | 项目、技术、概念 |
| Edges | 关系（uses、similar_to、depends_on） |
| Clusters | 分组的相关技术 |
| Centrality | 关键/枢纽项目 |

### 讲解风格

```markdown
## Your Knowledge Graph

You have {N} projects across {M} domains.

### Key Clusters
1. **Frontend Cluster**: React, Vue, Angular projects
   - Central project: react
   - Learning bridge: Next.js connects to Node.js

2. **Backend Cluster**: Express, Django, FastAPI
   - Central project: django
   - Gap: No microservices experience

### Suggested Exploration
Based on your React knowledge, consider learning:
→ Node.js (natural next step)
→ GraphQL (complements React)
```

## Agent 选择指南

| 用户需求 | 主 Agent | 辅助 Agent |
|-----------|--------------|-----------|
| "这个项目是什么？" | Scout | - |
| "X 是如何工作的？" | Mentor | Scout |
| "我该如何学习 Y？" | Navigator | Mentor |
| "整理我的项目" | Curator | Navigator |
| "为 Z 做笔记" | Scribe | Mentor |
| "展示我的学习图谱" | Atlas | Navigator |
| 复杂的多部分任务 | Hub | 视情况而定 |

## 通信模式

### Agent 之间

```
Hub → Scout: "Analyze facebook/react"
Scout → Hub: Analysis result
Hub → Mentor: "Teach based on this analysis"
Mentor → Hub: Teaching content
Hub → User: Aggregated response
```

### Agent 与用户

所有 Agent 都通过 Hub 与用户通信，Hub 负责管理：
- 上下文连续性
- 流式输出格式
- 错误处理
- 记忆更新�理：
- 上下文连续性
- 流式输出格式
- 错误处理
- 记忆更新