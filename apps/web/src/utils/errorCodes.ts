/**
 * 报错码映射表 —— 与 docs/architecture/decoupling/ERROR_CODES.md 同步。
 * 新增码时两处都改。
 */

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorCodeDesc {
  title: string;
  hint: string;
  severity: ErrorSeverity;
}

export const ERROR_CODES: Record<string, ErrorCodeDesc> = {
  MODULE_LOAD_FAILED: {
    title: '模块加载失败',
    hint: '某后端模块启动异常，部分功能不可用',
    severity: 'error',
  },
  AGENT_MODULE_DOWN: {
    title: 'Agent 模块未就绪',
    hint: 'Agent 服务启动失败，请检查日志或重启',
    severity: 'error',
  },
  AGENT_LLM_UNAVAILABLE: {
    title: 'Agent 服务暂不可用',
    hint: '未配置 LLM API Key 或连接失败，已切换手动模式',
    severity: 'warning',
  },
  AGENT_ANALYZE_FAILED: {
    title: '项目分析失败',
    hint: '分析过程异常，请查看日志或稍后重试',
    severity: 'error',
  },
  AGENT_CHAT_FAILED: {
    title: '对话失败',
    hint: 'Agent 对话异常，请稍后重试',
    severity: 'error',
  },
  AGENT_IMPORT_ASSIST_FAILED: {
    title: '导入助手失败',
    hint: '助手不可用，可继续手动导入',
    severity: 'warning',
  },
  AGENT_TRENDING_FAILED: {
    title: '趋势扫描失败',
    hint: 'GitHub API 限流或 LLM 失败',
    severity: 'error',
  },
  AGENT_CLASSIFY_FAILED: {
    title: '分类失败',
    hint: '自动分类异常，可手动设置分类',
    severity: 'error',
  },
  AGENT_NOTE_FAILED: {
    title: '笔记生成失败',
    hint: '自动生成笔记异常，可手动编写',
    severity: 'error',
  },
  GRAPH_MODULE_DOWN: {
    title: '图谱模块未就绪',
    hint: '图谱服务不可用，项目/笔记功能不受影响',
    severity: 'warning',
  },
  GRAPH_NOT_INDEXED: {
    title: '项目尚未索引',
    hint: '请先构建代码图谱',
    severity: 'info',
  },
  PROJECT_NOT_FOUND: {
    title: '项目不存在',
    hint: '项目 ID 错误或不存在',
    severity: 'error',
  },
  NOTE_NOT_FOUND: {
    title: '笔记不存在',
    hint: '笔记 ID 错误或不存在',
    severity: 'error',
  },
  VALIDATION_ERROR: {
    title: '参数校验失败',
    hint: '请求参数不符合要求',
    severity: 'warning',
  },
  RATE_LIMITED: {
    title: '请求过于频繁',
    hint: '请稍后重试',
    severity: 'warning',
  },
  GITHUB_API_RATE_LIMIT: {
    title: 'GitHub API 限流',
    hint: '匿名请求超额；配置 GitHub PAT 提升配额',
    severity: 'warning',
  },
  GITHUB_PAT_INVALID: {
    title: 'GitHub PAT 无效',
    hint: 'PAT 已过期或无权限；请重新绑定',
    severity: 'error',
  },
  LLM_KEY_MISSING: {
    title: '未配置 LLM Key',
    hint: '请前往设置页配置 API Key',
    severity: 'warning',
  },
  LLM_DECRYPT_FAILED: {
    title: 'LLM Key 解密失败',
    hint: '密钥变更导致密文无法解密；请重新配置 Key',
    severity: 'error',
  },
  SYSTEM_SECRET_KEY_WEAK: {
    title: '密钥强度不足',
    hint: 'SECRET_KEY 过短，请生成强随机密钥',
    severity: 'error',
  },
};

const FALLBACK: ErrorCodeDesc = {
  title: '发生错误',
  hint: '请稍后重试或查看日志',
  severity: 'error',
};

export function describeError(code: string): ErrorCodeDesc {
  return ERROR_CODES[code] ?? FALLBACK;
}

/** 生成 toast 展示文案：[CODE] 标题 */
export function formatErrorToast(code: string, fallbackMessage?: string): string {
  const desc = describeError(code);
  const title = ERROR_CODES[code] ? desc.title : (fallbackMessage || desc.title);
  return `[${code}] ${title}`;
}
