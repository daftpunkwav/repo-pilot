/* ==========================================================================
   api-mock.js · RepoPilot 前端接口模拟层
   目的：
   1. 前端不依赖后端即可完整演示所有交互
   2. 所有方法路径 + payload 严格对齐 docs/product/v1/SPEC §3 API 规范
   3. 后端只需实现 ApiClient 接口的真实版本即可对接
   ========================================================================== */

(function () {
  'use strict';

  // ---------- Mock Data ----------
  const MOCK_USER = {
    id: 'usr_zhang_jie',
    username: 'zhang.jie',
    email: 'zhang.jie@example.com',
    avatar_url: null,
    github_login: 'zhang-jie',
    github_bound: true,
    created_at: '2026-05-12T10:00:00Z'
  };

  const MOCK_CATEGORIES = [
    { id: 'cat_frontend', name: 'Web 前端', icon: 'layout', color: '#007aff', is_preset: true },
    { id: 'cat_backend', name: 'Web 后端', icon: 'server', color: '#34c759', is_preset: true },
    { id: 'cat_ai', name: 'AI / 机器学习', icon: 'brain', color: '#ff3b30', is_preset: true },
    { id: 'cat_data', name: '数据科学', icon: 'bar-chart', color: '#ff9f0a', is_preset: true },
    { id: 'cat_devops', name: 'DevOps / 运维', icon: 'cloud', color: '#5e5ce6', is_preset: true },
    { id: 'cat_mobile', name: '移动开发', icon: 'smartphone', color: '#30d158', is_preset: true },
    { id: 'cat_desktop', name: '桌面应用', icon: 'monitor', color: '#007aff', is_preset: true },
    { id: 'cat_game', name: '游戏开发', icon: 'gamepad', color: '#ff375f', is_preset: true },
    { id: 'cat_security', name: '安全', icon: 'shield', color: '#bf5af2', is_preset: true },
    { id: 'cat_tools', name: '工具 / 库', icon: 'wrench', color: '#8e8e93', is_preset: true },
    { id: 'cat_learning', name: '学习资源', icon: 'book', color: '#ff9f0a', is_preset: true },
    { id: 'cat_other', name: '其他', icon: 'folder', color: '#6e6e73', is_preset: true }
  ];

  const MOCK_TAGS = [
    { id: 'tag_react', name: 'react', count: 5 },
    { id: 'tag_python', name: 'python', count: 8 },
    { id: 'tag_typescript', name: 'typescript', count: 7 },
    { id: 'tag_rust', name: 'rust', count: 2 },
    { id: 'tag_framework', name: 'framework', count: 6 },
    { id: 'tag_lib', name: 'library', count: 10 },
    { id: 'tag_db', name: 'database', count: 3 },
    { id: 'tag_async', name: 'async', count: 4 }
  ];

  const MOCK_PROJECTS = [
    { id: 'p_react', name: 'facebook/react', url: 'https://github.com/facebook/react', description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.', language: 'JavaScript', stars: 220000, category_id: 'cat_frontend', progress: 'mastered', tags: ['tag_react', 'tag_typescript', 'tag_framework'], source: 'github', imported_at: '2026-05-12T10:30:00Z', readme: '# React\n\nReact is a JavaScript library for building user interfaces.\n\n* **Declarative:** React makes it painless to create interactive UIs. Design simple views for each state in your application, and React will efficiently update and render just the right components when your data changes.\n* **Component-Based:** Build encapsulated components that manage their own state, then compose them to make complex UIs.\n* **Learn Once, Write Anywhere:** You can develop new features in React without rewriting existing code.\n\n## Installation\n\n```bash\nnpm install react react-dom\n```\n\n## Quick Start\n\n```jsx\nimport React from "react";\nimport ReactDOM from "react-dom/client";\n\nfunction App() {\n  return <h1>Hello, world!</h1>;\n}\n\nconst root = ReactDOM.createRoot(document.getElementById("root"));\nroot.render(<App />);\n```\n\n## Documentation\n\nSee [reactjs.org](https://reactjs.org) for the full documentation.\n\n## License\n\nReact is [MIT licensed](./LICENSE).' },
    { id: 'p_vue', name: 'vuejs/core', url: 'https://github.com/vuejs/core', description: 'The Progressive JavaScript Framework — Vue.js.', language: 'TypeScript', stars: 46000, category_id: 'cat_frontend', progress: 'learning', tags: ['tag_framework', 'tag_typescript'], source: 'github', imported_at: '2026-05-12T10:30:00Z' },
    { id: 'p_next', name: 'vercel/next.js', url: 'https://github.com/vercel/next.js', description: 'The React Framework for the Web.', language: 'TypeScript', stars: 122000, category_id: 'cat_frontend', progress: 'learning', tags: ['tag_react', 'tag_framework'], source: 'github', imported_at: '2026-05-13T09:15:00Z' },
    { id: 'p_tailwind', name: 'tailwindlabs/tailwindcss', url: 'https://github.com/tailwindlabs/tailwindcss', description: 'A utility-first CSS framework for rapid UI development.', language: 'CSS', stars: 80000, category_id: 'cat_frontend', progress: 'learned', tags: ['tag_lib'], source: 'github', imported_at: '2026-05-13T09:15:00Z' },
    { id: 'p_fastapi', name: 'tiangolo/fastapi', url: 'https://github.com/tiangolo/fastapi', description: 'FastAPI is a modern, fast (high-performance) web framework for building APIs with Python.', language: 'Python', stars: 73000, category_id: 'cat_backend', progress: 'learning', tags: ['tag_python', 'tag_async', 'tag_framework'], source: 'github', imported_at: '2026-05-14T14:20:00Z' },
    { id: 'p_flask', name: 'pallets/flask', url: 'https://github.com/pallets/flask', description: 'The Python micro framework for building web applications.', language: 'Python', stars: 66000, category_id: 'cat_backend', progress: 'learned', tags: ['tag_python', 'tag_framework'], source: 'github', imported_at: '2026-05-14T14:20:00Z' },
    { id: 'p_requests', name: 'psf/requests', url: 'https://github.com/psf/requests', description: 'A simple, yet elegant, HTTP library.', language: 'Python', stars: 51000, category_id: 'cat_backend', progress: 'mastered', tags: ['tag_python', 'tag_lib'], source: 'github', imported_at: '2026-05-15T11:00:00Z' },
    { id: 'p_typescript', name: 'microsoft/TypeScript', url: 'https://github.com/microsoft/TypeScript', description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.', language: 'TypeScript', stars: 99000, category_id: 'cat_tools', progress: 'none', tags: ['tag_typescript'], source: 'github', imported_at: '2026-05-15T11:00:00Z' },
    { id: 'p_d3', name: 'd3/d3', url: 'https://github.com/d3/d3', description: 'Bring data to life with SVG, Canvas and HTML.', language: 'JavaScript', stars: 108000, category_id: 'cat_data', progress: 'learning', tags: ['tag_lib'], source: 'github', imported_at: '2026-05-16T16:45:00Z' },
    { id: 'p_langchain', name: 'langchain-ai/langchain', url: 'https://github.com/langchain-ai/langchain', description: 'Build context-aware reasoning applications.', language: 'Python', stars: 91000, category_id: 'cat_ai', progress: 'learning', tags: ['tag_python', 'tag_lib'], source: 'github', imported_at: '2026-05-17T08:30:00Z' },
    { id: 'p_postgres', name: 'postgresql/postgres', url: 'https://github.com/postgresql/postgres', description: 'Mirror of the official PostgreSQL repository.', language: 'C', stars: 16000, category_id: 'cat_backend', progress: 'none', tags: ['tag_db'], source: 'github', imported_at: '2026-05-17T08:30:00Z' },
    { id: 'p_docker', name: 'docker/compose', url: 'https://github.com/docker/compose', description: 'Define and run multi-container applications with Docker.', language: 'Go', stars: 33000, category_id: 'cat_devops', progress: 'learned', tags: ['tag_lib'], source: 'github', imported_at: '2026-05-18T12:00:00Z' }
  ];

  const MOCK_NOTES = [
    { id: 'n_react_1', project_id: 'p_react', title: 'React Hooks 深度理解', content: '# React Hooks\n\n## 为什么需要 Hooks\n\nReact Hooks 解决了类组件的几个核心问题：\n\n- **逻辑复用困难**：HOC 和 render props 都存在嵌套地狱\n- **复杂组件难以理解**：生命周期方法中混杂不相关逻辑\n- **类组件的 this 困惑**：需要 bind 或者箭头函数\n\n## useState 原理\n\nuseState 内部维护一个单向链表（Hook 链表），按调用顺序存储状态：\n\n```jsx\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  const [name, setName] = useState("");\n  // 第一个 useState 对应 hook 0\n  // 第二个 useState 对应 hook 1\n  return <div>{count} {name}</div>;\n}\n```\n\n> 💡 **关键洞察**：Hook 的顺序至关重要，不能写在条件分支里。\n\n## useEffect vs useLayoutEffect\n\n| 维度 | useEffect | useLayoutEffect |\n|------|-----------|-----------------|\n| 时机 | 浏览器绘制后 | DOM 更新后、绘制前 |\n| 用途 | 数据获取、订阅 | DOM 测量、布局同步 |\n| 阻塞绘制 | 否 | 是 |\n\n## 实战：自定义 Hook\n\n```jsx\nfunction useLocalStorage(key, initialValue) {\n  const [value, setValue] = useState(() => {\n    const item = localStorage.getItem(key);\n    return item ? JSON.parse(item) : initialValue;\n  });\n\n  useEffect(() => {\n    localStorage.setItem(key, JSON.stringify(value));\n  }, [key, value]);\n\n  return [value, setValue];\n}\n```\n\n## 踩坑记录\n\n1. **依赖数组遗漏**：导致闭包陷阱\n2. **清理函数忘记返回**：订阅泄漏\n3. **大量状态合并**：考虑 useReducer', created_at: '2026-06-15T14:30:00Z', updated_at: '2026-07-01T10:20:00Z' },
    { id: 'n_react_2', project_id: 'p_react', title: 'Fiber 架构笔记', content: '# React Fiber\n\n## 背景\n\nReact 15 的 Stack Reconciler 是同步的，一旦开始无法中断。当组件树很大时，主线程被占用过久会导致卡顿。\n\n## 核心思想\n\n将渲染工作拆分为多个小单元，每个单元完成后检查是否还有时间继续。\n\n```\nwhile (还有任务 && 还有时间) {\n  执行一个工作单元\n  检查 shouldYield()\n}\n```\n\n## 双缓冲技术\n\nFiber 维护两颗树：\n- **current tree**：当前显示\n- **workInProgress tree**：正在构建\n\n构建完成后一次性替换，最小化视觉不一致。', created_at: '2026-06-20T09:00:00Z', updated_at: '2026-06-28T15:45:00Z' },
    { id: 'n_fastapi_1', project_id: 'p_fastapi', title: 'FastAPI 异步原理', content: '# FastAPI 异步 I/O\n\nFastAPI 基于 Starlette（ASGI）和 Pydantic，性能优秀的关键在于其**全异步**架构。\n\n## 与 Flask 的对比\n\nFlask 是 WSGI（同步），每个请求一个线程。FastAPI 是 ASGI（异步），单线程可处理上千并发。\n\n## 关键特性\n\n- **自动 OpenAPI 文档**：基于 Pydantic 模型自动生成\n- **类型提示驱动**：请求/响应都通过类型注解校验\n- **依赖注入**：Depends() 优雅管理依赖\n\n```python\nfrom fastapi import FastAPI, Depends\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Item(BaseModel):\n    name: str\n    price: float\n\n@app.post("/items/")\nasync def create_item(item: Item):\n    return {"name": item.name, "price": item.price}\n```\n\n## 学习建议\n\n1. 先掌握 Python async/await 语法\n2. 理解 ASGI 与 WSGI 区别\n3. 学习 Pydantic 数据建模', created_at: '2026-06-22T11:15:00Z', updated_at: '2026-07-02T14:00:00Z' },
    { id: 'n_flask_1', project_id: 'p_flask', title: 'Flask 路由与请求上下文', content: '# Flask 核心概念\n\n## 请求上下文\n\nFlask 通过 `request` 对象暴露当前请求的数据，但背后的实现是**线程局部变量 + 上下文栈**。\n\n```python\nfrom flask import Flask, request\n\napp = Flask(__name__)\n\n@app.route("/user/<id>")\ndef get_user(id):\n    # request 是当前请求的代理\n    token = request.headers.get("Authorization")\n    return {"id": id, "token": token}\n```\n\n## 应用上下文 vs 请求上下文\n\n| 上下文 | 触发 | 用途 |\n|--------|------|------|\n| 应用上下文 | app.app_context() | 访问 current_app、g |\n| 请求上下文 | 自动（请求进入时）| 访问 request、session |\n\n## 蓝图（Blueprint）\n\n大型项目用蓝图拆分模块：\n\n```python\n# auth/views.py\nfrom flask import Blueprint\nbp = Blueprint("auth", __name__, url_prefix="/auth")\n\n@bp.route("/login")\ndef login(): ...\n```', created_at: '2026-06-25T16:00:00Z', updated_at: '2026-06-25T16:00:00Z' }
  ];

  const MOCK_GRAPH = {
    nodes: MOCK_PROJECTS.map(p => ({
      id: p.id,
      name: p.name,
      language: p.language,
      stars: p.stars,
      category_id: p.category_id,
      progress: p.progress
    })),
    edges: [
      { source: 'p_react', target: 'p_vue', similarity: 0.92 },
      { source: 'p_react', target: 'p_next', similarity: 0.88 },
      { source: 'p_react', target: 'p_d3', similarity: 0.78 },
      { source: 'p_react', target: 'p_typescript', similarity: 0.72 },
      { source: 'p_vue', target: 'p_next', similarity: 0.85 },
      { source: 'p_vue', target: 'p_tailwind', similarity: 0.74 },
      { source: 'p_fastapi', target: 'p_flask', similarity: 0.95 },
      { source: 'p_fastapi', target: 'p_requests', similarity: 0.82 },
      { source: 'p_fastapi', target: 'p_postgres', similarity: 0.68 },
      { source: 'p_flask', target: 'p_requests', similarity: 0.88 },
      { source: 'p_docker', target: 'p_postgres', similarity: 0.71 },
      { source: 'p_langchain', target: 'p_d3', similarity: 0.65 },
      { source: 'p_langchain', target: 'p_requests', similarity: 0.62 },
      { source: 'p_next', target: 'p_docker', similarity: 0.58 }
    ]
  };

  // GitHub Trending · mock 数据（按 daily/weekly/monthly 三个周期）
  // 真实接口应对接 https://api.github.com/search/repositories?q=created:>YYYY-MM-DD&sort=stars
  // 这里手动构造的样本贴近真实 trending 列表
  const MOCK_TRENDING_REPOS = {
    daily: [
      { rank: 1, owner: 'denoland',  repo: 'deno',          description: 'A modern runtime for JavaScript and TypeScript.',  language: 'Rust',       stars: 95000,  added_stars: 412, total_stars: 95800 },
      { rank: 2, owner: 'withastro', repo: 'astro',         description: 'The web framework for content-driven websites.',   language: 'TypeScript', stars: 45000,  added_stars: 318, total_stars: 46000 },
      { rank: 3, owner: 'ggerganov', repo: 'llama.cpp',     description: 'LLM inference in C/C++',                            language: 'C++',        stars: 64000,  added_stars: 287, total_stars: 66500 },
      { rank: 4, owner: 'huggingface', repo: 'transformers', description: 'State-of-the-art ML for PyTorch & JAX.',            language: 'Python',     stars: 132000, added_stars: 256, total_stars: 133800 },
      { rank: 5, owner: 'openai',     repo: 'whisper',       description: 'Robust Speech Recognition via Large-Scale Weak Supervision.', language: 'Python', stars: 67000,  added_stars: 198, total_stars: 68900 },
      { rank: 6, owner: 'tldraw',     repo: 'tldraw',        description: 'A tiny little drawing app.',                        language: 'TypeScript', stars: 35000,  added_stars: 175, total_stars: 36200 },
      { rank: 7, owner: 'electric-sql', repo: 'pglite',      description: 'Lightweight Postgres packaged as WASM into JS.',     language: 'TypeScript', stars: 6800,   added_stars: 142, total_stars: 7400  },
      { rank: 8, owner: 'langchain-ai', repo: 'langgraph',   description: 'Build stateful, multi-actor applications with LLMs.',language: 'Python',     stars: 4200,   added_stars: 128, total_stars: 4500  }
    ],
    weekly: [
      { rank: 1, owner: 'denoland',   repo: 'deno',           description: 'A modern runtime for JavaScript and TypeScript.',   language: 'Rust',        stars: 95000, added_stars: 1840, total_stars: 95800 },
      { rank: 2, owner: 'openai',     repo: 'whisper',        description: 'Robust Speech Recognition via Large-Scale Weak Supervision.', language: 'Python', stars: 67000, added_stars: 1620, total_stars: 68900 },
      { rank: 3, owner: 'huggingface',repo: 'transformers',   description: 'State-of-the-art ML for PyTorch & JAX.',           language: 'Python',      stars: 132000, added_stars: 1450, total_stars: 133800 },
      { rank: 4, owner: 'ggerganov',  repo: 'llama.cpp',      description: 'LLM inference in C/C++',                           language: 'C++',         stars: 64000, added_stars: 1320, total_stars: 66500 },
      { rank: 5, owner: 'withastro',  repo: 'astro',          description: 'The web framework for content-driven websites.',   language: 'TypeScript',  stars: 45000, added_stars: 1180, total_stars: 46000 },
      { rank: 6, owner: 'anthropics', repo: 'claude-code',    description: 'Anthropic\'s official CLI for Claude.',           language: 'TypeScript',  stars: 18000, added_stars: 980,  total_stars: 18900 },
      { rank: 7, owner: 'electric-sql',repo:'pglite',         description: 'Lightweight Postgres packaged as WASM into JS.',   language: 'TypeScript',  stars: 6800,  added_stars: 720,  total_stars: 7400 },
      { rank: 8, owner: 'tldraw',     repo: 'tldraw',         description: 'A tiny little drawing app.',                       language: 'TypeScript',  stars: 35000, added_stars: 680,  total_stars: 36200 },
      { rank: 9, owner: 'supabase',   repo: 'supabase',       description: 'The open source Firebase alternative.',            language: 'TypeScript',  stars: 71000, added_stars: 540,  total_stars: 71600 },
      { rank: 10, owner: 'vercel',    repo: 'next.js',        description: 'The React Framework for the Web.',                 language: 'JavaScript',  stars: 122000, added_stars: 480, total_stars: 123200 }
    ],
    monthly: [
      { rank: 1, owner: 'denoland',    repo: 'deno',          description: 'A modern runtime for JavaScript and TypeScript.',  language: 'Rust',        stars: 95000, added_stars: 6800, total_stars: 95800 },
      { rank: 2, owner: 'openai',      repo: 'whisper',       description: 'Robust Speech Recognition via Large-Scale Weak Supervision.', language: 'Python', stars: 67000, added_stars: 5200, total_stars: 68900 },
      { rank: 3, owner: 'anthropics',  repo: 'claude-code',   description: 'Anthropic\'s official CLI for Claude.',           language: 'TypeScript',  stars: 18000, added_stars: 4800, total_stars: 18900 },
      { rank: 4, owner: 'huggingface', repo: 'transformers',  description: 'State-of-the-art ML for PyTorch & JAX.',           language: 'Python',      stars: 132000, added_stars: 4200, total_stars: 133800 },
      { rank: 5, owner: 'ggerganov',   repo: 'llama.cpp',     description: 'LLM inference in C/C++',                           language: 'C++',         stars: 64000, added_stars: 3800, total_stars: 66500 },
      { rank: 6, owner: 'withastro',   repo: 'astro',         description: 'The web framework for content-driven websites.',   language: 'TypeScript',  stars: 45000, added_stars: 3200, total_stars: 46000 },
      { rank: 7, owner: 'electric-sql',repo: 'pglite',        description: 'Lightweight Postgres packaged as WASM into JS.',   language: 'TypeScript',  stars: 6800,  added_stars: 2100, total_stars: 7400 },
      { rank: 8, owner: 'tldraw',      repo: 'tldraw',        description: 'A tiny little drawing app.',                       language: 'TypeScript',  stars: 35000, added_stars: 1900, total_stars: 36200 },
      { rank: 9, owner: 'supabase',    repo: 'supabase',      description: 'The open source Firebase alternative.',            language: 'TypeScript',  stars: 71000, added_stars: 1700, total_stars: 71600 },
      { rank: 10, owner: 'langchain-ai',repo:'langgraph',     description: 'Build stateful, multi-actor applications with LLMs.', language: 'Python',   stars: 4200,  added_stars: 1400, total_stars: 4500 }
    ]
  };

  const MOCK_AGENT_SESSIONS = [
    { id: 'sess_001', title: 'Flask vs FastAPI 对比分析', agent: 'mentor', updated_at: '2026-07-04T14:23:00Z', unread: true },
    { id: 'sess_002', title: 'Next.js 学习路径规划', agent: 'navigator', updated_at: '2026-07-04T12:15:00Z', unread: false },
    { id: 'sess_003', title: 'React 速览', agent: 'scout', updated_at: '2026-07-03T18:40:00Z', unread: false },
    { id: 'sess_004', title: '项目库批量分类建议', agent: 'curator', updated_at: '2026-07-03T15:20:00Z', unread: false },
    { id: 'sess_005', title: 'LangChain 笔记大纲', agent: 'scribe', updated_at: '2026-07-01T10:00:00Z', unread: false },
    { id: 'sess_006', title: 'Docker 学习计划', agent: 'hub', updated_at: '2026-07-01T09:30:00Z', unread: false },
    { id: 'sess_007', title: 'Vue 3 组合式 API 讲解', agent: 'mentor', updated_at: '2026-06-29T16:00:00Z', unread: false },
    { id: 'sess_008', title: '全栈开发者 3 个月规划', agent: 'navigator', updated_at: '2026-06-28T11:00:00Z', unread: false }
  ];

  const MOCK_SETTINGS = {
    theme: 'light',
    font_scale: 1.0,
    code_font: 'JetBrains Mono',
    llm_provider: 'openai',
    llm_model: 'gpt-4o',
    llm_api_base: 'https://api.openai.com/v1',
    llm_api_key_masked: 'sk-****a8d2',
    llm_configured: true,
    llm_last_test: '2026-07-04T14:18:00Z',
    llm_latency_ms: 412,
    llm_calls_this_month: 1247,
    llm_cost_this_month: 3.84
  };

  const MOCK_USER_PROFILE = {
    tech_proficiency: {
      javascript: { level: 'mastered', confidence: 0.9 },
      python: { level: 'intermediate', confidence: 0.7 },
      react: { level: 'learning', confidence: 0.85 },
      docker: { level: 'none', confidence: 0.5 }
    },
    learning_preferences: {
      style: 'hands-on',
      depth_first: true,
      comparisons: true,
      verbosity: 'balanced',
      language: 'zh-CN'
    },
    goals: [
      { description: '全栈开发', deadline: '2026-12', progress: 0.35 }
    ]
  };

  // ---------- ApiClient (Mock Implementation) ----------
  // 严格对应 docs/product/v1/SPEC §3 API 规范
  // 后端实现 ApiClient 同名方法即可对接（fetch with /api/v1/...）
  class ApiClient {
    constructor() {
      this.authToken = localStorage.getItem('rp_token') || null;
      this.delay = (ms = 300) => new Promise(r => setTimeout(r, ms));
    }

    setToken(t) {
      this.authToken = t;
      if (t) localStorage.setItem('rp_token', t);
      else localStorage.removeItem('rp_token');
    }

    async _mock(data, ms = 200) {
      await this.delay(ms);
      return { data, meta: { ts: Date.now() } };
    }

    // ===== Auth =====
    // POST /api/v1/auth/register
    async register({ username, password }) {
      return this._mock({ token: 'mock_jwt_token_' + Date.now(), user: { ...MOCK_USER, username } });
    }
    // POST /api/v1/auth/login
    async login({ username, password }) {
      this.setToken('mock_jwt_' + Date.now());
      return this._mock({ access_token: 'mock_jwt_' + Date.now(), refresh_token: 'mock_refresh_' + Date.now(), user: MOCK_USER });
    }
    async logout() {
      this.setToken(null);
      return this._mock({ success: true });
    }
    // GET /api/v1/auth/me
    async me() {
      if (!this.authToken) throw { code: 'AUTH_TOKEN_INVALID', message: '未登录' };
      return this._mock(MOCK_USER);
    }
    async updateProfile(data) { return this._mock({ ...MOCK_USER, ...data }); }
    async changePassword({ old_password, new_password }) { return this._mock({ success: true }); }

    // ===== GitHub =====
    async listGithubAccounts() {
      return this._mock([{ id: 'gh_001', username: 'zhang-jie', added_at: '2026-05-12T10:00:00Z', last_used_at: '2026-07-04T12:00:00Z', verified: true }]);
    }
    async bindGithub({ username, pat }) { return this._mock({ id: 'gh_001', username, verified: true }); }
    async unbindGithub(id) { return this._mock({ success: true }); }
    async listStars() {
      return this._mock(MOCK_PROJECTS.map(p => ({ owner: p.name.split('/')[0], repo: p.name.split('/')[1], description: p.description, language: p.language, stars: p.stars })));
    }
    async importProjects(repos) {
      return this._mock({ succeeded: repos.map((r, i) => ({ id: 'p_new_' + i, name: `${r.owner}/${r.repo}`, url: r.url })), failed: [], summary: { total: repos.length, succeeded: repos.length, failed: 0 } });
    }
    // GET /api/v1/github/trending?period=daily|weekly|monthly
    // 真实接口可对接 GitHub Trending API 或自建索引服务
    async listTrending({ period = 'weekly', language = 'all' } = {}) {
      let list = MOCK_TRENDING_REPOS[period] || MOCK_TRENDING_REPOS.weekly;
      if (language && language !== 'all') {
        const langLower = language.toLowerCase();
        list = list.filter(r => (r.language || '').toLowerCase() === langLower);
      }
      return this._mock({
        period,
        language,
        fetched_at: new Date().toISOString(),
        items: list
      });
    }

    // ===== Projects =====
    // GET /api/v1/projects?search=&category=&language=&progress=&tag=&sort_by=&page=&page_size=
    async listProjects(params = {}) {
      let list = [...MOCK_PROJECTS];
      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
      }
      if (params.category) list = list.filter(p => p.category_id === params.category);
      if (params.language) list = list.filter(p => p.language === params.language);
      if (params.progress) list = list.filter(p => p.progress === params.progress);
      if (params.tag) list = list.filter(p => p.tags.includes(params.tag));
      const page = params.page || 1;
      const pageSize = params.page_size || 10;
      return this._mock({ items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, page_size: pageSize });
    }
    async getProject(id) { return this._mock(MOCK_PROJECTS.find(p => p.id === id) || MOCK_PROJECTS[0]); }
    async createProject(data) { return this._mock({ id: 'p_new', ...data }); }
    async updateProject(id, data) { return this._mock({ ...MOCK_PROJECTS.find(p => p.id === id), ...data }); }
    async deleteProject(id) { return this._mock({ success: true }); }
    async updateProgress(id, progress) { return this._mock({ id, progress }); }
    async getProjectStats() {
      const stats = {
        total: MOCK_PROJECTS.length,
        by_progress: { none: 0, learning: 0, learned: 0, mastered: 0 },
        by_category: {},
        by_language: {}
      };
      MOCK_PROJECTS.forEach(p => {
        stats.by_progress[p.progress]++;
        stats.by_category[p.category_id] = (stats.by_category[p.category_id] || 0) + 1;
        stats.by_language[p.language] = (stats.by_language[p.language] || 0) + 1;
      });
      return this._mock(stats);
    }
    async exportProjects() { return this._mock(MOCK_PROJECTS); }

    // ===== Categories =====
    async listCategories() { return this._mock(MOCK_CATEGORIES); }
    async createCategory(data) { return this._mock({ id: 'cat_new', ...data, is_preset: false }); }
    async updateCategory(id, data) { return this._mock({ id, ...data }); }
    async deleteCategory(id) { return this._mock({ success: true }); }

    // ===== Tags =====
    async listTags() { return this._mock(MOCK_TAGS); }
    async createTag(data) { return this._mock({ id: 'tag_new', ...data, count: 0 }); }
    async deleteTag(id) { return this._mock({ success: true }); }
    async setProjectTags(projectId, tagIds) { return this._mock({ project_id: projectId, tag_ids: tagIds }); }

    // ===== Notes =====
    async listNotes(projectId) { return this._mock(MOCK_NOTES.filter(n => n.project_id === projectId)); }
    async listAllNotes() { return this._mock(MOCK_NOTES); }
    async getNote(id) { return this._mock(MOCK_NOTES.find(n => n.id === id)); }
    async createNote(projectId, data) { return this._mock({ id: 'n_new', project_id: projectId, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); }
    async updateNote(id, data) { return this._mock({ ...MOCK_NOTES.find(n => n.id === id), ...data, updated_at: new Date().toISOString() }); }
    async deleteNote(id) { return this._mock({ success: true }); }

    // ===== Graph =====
    async getGraph(params = {}) { return this._mock(MOCK_GRAPH); }

    // ===== Settings =====
    async getSettings() { return this._mock(MOCK_SETTINGS); }
    async updateSettings(data) { return this._mock({ ...MOCK_SETTINGS, ...data }); }
    async testLLM() {
      await this.delay(800);
      return this._mock({ success: true, latency_ms: 412, model: MOCK_SETTINGS.llm_model });
    }

    // ===== Agent =====
    async listAgentSessions() { return this._mock(MOCK_AGENT_SESSIONS); }
    async getAgentSession(id) { return this._mock({ id, messages: [] }); }
    async createAgentSession() { return this._mock({ id: 'sess_new_' + Date.now(), title: '新对话', agent: 'hub' }); }
    async deleteAgentSession(id) { return this._mock({ success: true }); }
    async getAgentProfiles() { return this._mock([
      { id: 'hub', name: 'Hub', description: '统一对话入口与路由' },
      { id: 'scout', name: 'Scout', description: '30s 快速分析项目' },
      { id: 'mentor', name: 'Mentor', description: '深度讲解 + 反问' },
      { id: 'navigator', name: 'Navigator', description: '学习路径规划' },
      { id: 'curator', name: 'Curator', description: '智能分类与标签' },
      { id: 'scribe', name: 'Scribe', description: '笔记大纲与补充' }
    ]); }
    async getUserProfile() { return this._mock(MOCK_USER_PROFILE); }
    async updateUserProfile(data) { return this._mock({ ...MOCK_USER_PROFILE, ...data }); }
    async getPermissions() { return this._mock({
      auto_classify_on_import: true,
      auto_tag_suggestion: true,
      batch_reclassify: false,
      require_confirmation: ['reclassify', 'remove_tag']
    }); }
    async analyze(projectId, agent = 'scout') {
      // 模拟 SSE 流式响应（前端用打字机效果展示）
      const stream = async function* () {
        const text = `## ${MOCK_PROJECTS.find(p => p.id === projectId)?.name || '项目'} 速览\n\n- **一句话**: 一个用于构建用户界面的 JavaScript 库\n- **核心功能**: 组件化、声明式、虚拟 DOM、Hooks\n- **技术栈**: JavaScript / TypeScript / Flow\n- **适合谁**: 前端工程师、全栈开发者\n- **学习门槛**: ⭐⭐⭐☆☆ (3/5)\n- **与你的库关联**: 与你库里的 Vue、Next.js 有强关联\n- **建议**: 学（基于你的 React 学习进度，推荐深入 Hooks）`;
        for (const ch of text) {
          await new Promise(r => setTimeout(r, 12));
          yield { event: 'text_delta', data: { delta: ch } };
        }
        yield { event: 'done', data: {} };
      };
      return stream();
    }
  }

  // 暴露到全局
  window.ApiClient = ApiClient;
})();