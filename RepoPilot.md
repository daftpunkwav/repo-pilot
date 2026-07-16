



我的初始想法:

我想做一个agent项目，是一个agent驱动的github学习应用。不说登录注册改主题这种基础功能，需要用户BYOK,可以导入多个或同步star的github项目，agent会根据每个项目进行分类。agent可以快速辅助制作学习笔记。agent可以快速介绍项目，也可以详细介绍项目。一共6个agent(当前设想,未来可能进行调整或增加)，有一个用于对话的主agent。系统还有图谱用来分析各个开源项目之间的联系，当然也是使用agent来分析。不过也考虑了用户不输入key，采用降级的无llm处理方式。  

我这个系统的设想是这样的。  

6个agent, hub是老大。在agent对话窗口可以根据用户意图调度其他5个agent。在项目库,图谱的多个开源项目的场景可以直接点击scout通过一个弹窗来快速了解项目。在笔记页面可以直接调度scribe来辅助完成笔记。在导入项目页面如果有key那就自动直接调度curator来完成分类，也可以自动创建没有的分类，当然用户可以选择接受或通过提示进行个性化的重新分类。  

6个agent共享用户画像，用户画像用来描述用户是一个什么样的人，喜欢什么样的风格来让agent为自己介绍项目，喜欢什么样的分类方法，用户画像的更新需要经过hub的审核，可能每个agent得出的用户画像都不一样，其余5个agent需要上报给hub来进行统筹，最后更新用户画像。每个agent都有自己独立的短期memory，由每个agent自己维护。6个agent共享长期memory，维护方式同用户画像，但是用户画像的维护偏向6个取共同点，而长期memory 则是尽量保留，但去除明显的冲突。每个agent都有自己的souls用来规范agent的行为和回答，设置不可更改的内置提示词，供用户不可随意添加的可选择风格，如毒舌还是温和，严厉还是随意。除了hub,每个agent有自己独立的上下文，但是5个agent如果是通过hub调度的那就会获取hub的上下文，即所有上下文。  

通过hub调度其他agent的一次请求hub会使用plan and execute, 其他agent则使用ReAct，其中mentor使用tot或got, curator则始终使用Reflexion，无论是否通过hub调度还是被用户直接调度。  

还有很多设计有待确定，如辅助笔记的scribe究竟是选择写这个项目笔记时与用户学习过的项目做对比还是，每次笔记都作为新的开始等等.


以下是gpt给出的系统性的意见:



我建议PRD和Spec都重新提升一个层级。  

整个系统建议采用四层架构。  

Presentation Layer  

↓  

Agent Layer  

↓  

Knowledge Layer  

↓  

Infrastructure Layer  

---  

RepoPilot PRD（Product Requirement Document）  

一、产品定位  

RepoPilot 是一个基于 Multi-Agent Architecture 的 GitHub 开源项目学习平台。  

它能够帮助开发者：  

导入 Github Repository  

自动分析项目  

自动生成学习路线  

自动生成学习笔记  

自动建立知识图谱  

根据用户水平动态教学  

长期追踪学习成长  

RepoPilot 不希望成为 Github Copilot。  

而是：  

> Github Mentor.  

---  

二、目标用户  

Beginner  

刚开始阅读Github项目  

不知道从哪里开始  

---  

Intermediate  

已经能看懂代码  

需要快速理解架构  

---  

Advanced  

阅读大型仓库  

维护自己的知识库  

---  

Teacher  

制作教学材料  

组织学习路线  

---  

三、核心价值  

一句话：  

> Every Repository deserves an AI Mentor.  

---  

RepoPilot解决：  

GitHub最大的痛点不是代码。  

而是：  

不知道：  

为什么这样设计？  

为什么这样分层？  

先学哪个模块？  

与我以前学过的有什么关系？  

RepoPilot解决的是：  

Learning Context。  

---  

四、系统架构  

Hub  

┌──────────────┐  
│ │  
▼ ▼  

Navigator Mentor  

▼ ▼  

Scout Curator  

▼  

Scribe  

Hub负责：  

Routing  

Planning  

Memory  

UserProfile  

Workflow  

Evaluation  

其余Agent：  

只负责自己的Domain。  

---  

五、Agent设计  

---  

Hub  

定位：  

Chief Agent  

职责：  

Intent Detection  

Task Planning  

Workflow Scheduling  

Context Management  

Memory Merge  

User Profile Review  

Conflict Resolution  

Evaluation  

Workflow：  

Plan and Execute  

User  

↓  

Intent  

↓  

Task Plan  

↓  

Dispatch  

↓  

Collect  

↓  

Evaluate  

↓  

Merge  

↓  

Response  

Hub不会拥有所有Memory。  

Hub只拥有：  

Conversation Summary  

+ 

Task Result Summary  

+ 

Long Memory  

+ 

User Profile  

而不是所有Agent的Context。  

这是为了：  

避免Context Explosion。  

---  

Scout  

定位：  

Repository Analyst  

职责：  

30秒快速分析项目。  

Workflow：  

ReAct  

Tools：  

Github API  

TF-IDF  

Dependency Parser  

README Parser  

Graph Search  

输出：  

Architecture  

Tech Stack  

Difficulty  

Learning Suggestion  

---  

Mentor  

定位：  

AI Teacher  

职责：  

教学。  

Workflow：  

Adaptive。  

简单问题：  

ReAct。  

复杂概念：  

Tree of Thoughts。  

多种讲解方案：  

Graph of Thoughts。  

例如：  

用户：  

解释FastAPI。  

Mentor：  

生成：  

源码路线  

↓  

生活类比  

↓  

请求生命周期  

↓  

MVC对比  

↓  

SpringBoot对比  

评估后：  

选择最适合User Profile的一种。  

---  

Curator  

定位：  

Knowledge Organizer  

职责：  

分类。  

Workflow：  

Reflexion。  

Trajectory：  

Repository  

↓  

Candidate Category  

↓  

Confidence  

Evaluation：  

是否已有相同分类？  

是否命名一致？  

是否重复？  

是否类别过细？  

Reflection：  

重新命名？  

合并？  

创建新分类？  

最多：  

3轮。  

否则：  

交给用户确认。  

这是Claude提到的问题。  

必须写到Spec里。  

否则：  

Reflexion没有意义。  

---  

Navigator  

定位：  

Learning Planner  

职责：  

规划学习路线。  

Workflow：  

ReAct。  

工具：  

Knowledge Graph  

Difficulty Graph  

Learning History  

输出：  

Learning Roadmap  

---  

Scribe  

定位：  

Knowledge Recorder  

职责：  

辅助笔记。  

Workflow：  

ReAct。  

新增：  

两种模式。  

Project Mode  

自动检索：  

学习History  

Graph Similarity  

Memory  

Standalone Mode  

完全独立。  

另外：  

只有：  

Similarity >  

Threshold  

才调用：  

Compare Tool。  

否则：  

直接写。  

这就是：  

按需RAG。  

不是：  

每次RAG。  

---  

六、Memory Architecture  

这一部分我建议重新设计。  

不要：  

Short Memory  

Long Memory  

结束。  

建议：  

User Profile  

↓  

Preference  

↓  

Knowledge State  

↓  

Long Memory  

↓  

Short Memory  

---  

User Profile  

职业  

语言  

学习目标  

长期稳定。  

---  

Preference  

喜欢代码优先  

喜欢图示  

喜欢Markdown  

---  

Knowledge State  

Python  

92  

FastAPI  

31  

React  

70  

Mentor主要维护这里。  

---  

Long Memory  

学习过什么  

完成什么  

失败什么  

---  

Short Memory  

Agent私有。  

例如：  

Mentor  

最近三轮教学。  

Scout  

最近三个Repository。  

---  

七、Memory Merge  

任何Agent：  

不能直接修改。  

只能：  

Proposal。  

Agent  

↓  

Proposal  

↓  

Evidence  

↓  

Confidence  

↓  

Hub  

↓  

Merge  

↓  

Commit  

Proposal：  

{  
"value":"User knows Docker",  

"confidence":0.83,  

"evidence":[...]  

}  

Hub：  

不是投票。  

而是：  

Evidence Weighted Merge。  

例如：  

Recent Weight  

×  

Confidence  

×  

Evidence Score  

而不是：  

3比2。  

---  

八、Context Engineering  

这是整个项目最大的亮点。  

建议明确写。  

Hub：  

维护：  

Summary  

Long Memory  

Task State  

Agent：  

获得：  

Relevant Context。  

不是：  

All Context。  

Context Builder：  

User Query  

↓  

Retriever  

↓  

Filter  

↓  

Compress  

↓  

Agent  

避免：  

300k Token。  

---  

九、Knowledge Graph  

图谱：  

不是展示。  

而是：  

所有Agent共享工具。  

包括：  

Scout  

Navigator  

Scribe  

Mentor  

都可以：  

Graph Query。


Graph来源：  

TF-IDF  

Embedding  

Dependency  

Github Topic  

Manual Relation  

---  

十、降级模式  

没有Key：  

系统：  

自动切换。  

Github API  

↓  

TF-IDF  

↓  

Keyword  

↓  

Rule Engine  

↓  

Graph  

有Key：  

Github  

↓  

Embedding  

↓  

LLM  

↓  

Agent  

用户：  

几乎无感知。  

---  

十一、未来版本（Roadmap）  

我建议增加一个 第七个 Agent：Evaluator。  

不是现在开发，而是作为 v2.0 规划。  

职责：  

Review Hub 决策  

检查 Memory 冲突  

验证 Agent 回答质量  

判断是否需要重新规划  

对 Agent 输出进行自动评分（Accuracy、Completeness、Grounding）  

这样可以形成一个更完整的闭环：  

User  
↓  
Hub（Plan）  
↓  
Specialized Agents（Execute）  
↓  
Hub（Merge）  
↓  
Evaluator（Review）  
↓  
Memory Update  
↓  
Response  

---  

我认为这个项目最大的价值  

如果按这个方向继续完善，它已经不是一个"Agent 项目"了，而是一个多智能体系统架构项目。  

它能够覆盖目前 Agent 岗位最关注的几乎所有核心能力：  

Multi-Agent Collaboration  

Context Engineering  

Tool Calling / MCP  

Memory Architecture  

Workflow Orchestration  

Plan & Execute  

ReAct / ToT / GoT / Reflexion  

RAG 与知识图谱  

用户画像与长期记忆  

Context Compression  

降级策略（无 LLM 模式）  

可扩展的 Agent 生命周期管理  

对于你的目标（AI Agent 开发实习），我建议把它作为作品集中的核心项目，并且在文档中强调这些架构设计和工程取舍，而不仅仅是功能展示。真正能打动面试官的，往往是为什么这样设计以及面对大规模、多 Agent 场景时如何解决上下文、记忆、协作和成本问题。


