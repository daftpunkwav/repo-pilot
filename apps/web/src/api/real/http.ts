/** HTTP 客户端 —— 真实后端请求；凭证走 httpOnly Cookie + credentials */
import type { ApiResponse } from '@/api/types';

const API_PREFIX = '/api/v1';

/** @deprecated 历史 localStorage 键；仅用于清理遗留数据，不再写入 */
export const TOKEN_KEY = 'rp_token';
/** @deprecated 历史 localStorage 键；仅用于清理遗留数据，不再写入 */
export const REFRESH_KEY = 'rp_refresh';

/** 统一的 API 错误类，便于 ErrorBoundary / Sentry 捕获 */
export class ApiRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

function baseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${baseUrl()}${API_PREFIX}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** 清除历史 localStorage 凭证（迁移后不应再依赖） */
export function clearLegacyTokenStorage(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* 隐私模式等 */
  }
}

/** 解析 FastAPI / 统一错误体 */
function extractApiErrorMessage(json: unknown): string {
  if (typeof json !== 'object' || json === null) return '请求失败';
  const obj = json as Record<string, unknown>;
  const err = obj.error;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  const detail = obj.detail;
  if (typeof detail === 'object' && detail !== null && 'message' in detail) {
    return String((detail as { message: unknown }).message);
  }
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
    const first = detail[0] as { msg?: string };
    if (first.msg) return first.msg;
  }
  if (typeof detail === 'string') return detail;
  return '请求失败';
}

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  const json: unknown = await res.json();
  if (!res.ok) {
    throw new ApiRequestError('API_ERROR', extractApiErrorMessage(json));
  }
  return json as ApiResponse<T>;
}

/** 全局 refresh 锁，防止并发 401 触发多次 refresh */
let refreshPromise: Promise<boolean> | null = null;

async function doRefreshAccessToken(): Promise<boolean> {
  try {
    // 依赖 httpOnly Cookie；body 可空
    const res = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    });
    if (!res.ok) {
      clearLegacyTokenStorage();
      return false;
    }
    clearLegacyTokenStorage();
    return true;
  } catch {
    return false;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function buildRequestInit(options: RequestInit, headers: Headers): RequestInit {
  return {
    ...options,
    headers,
    credentials: 'include',
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | undefined>
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(buildUrl(path, params), buildRequestInit(options, headers));
  if (res.status === 401 && path !== '/auth/refresh' && (await refreshAccessToken())) {
    const retryHeaders = new Headers(options.headers);
    if (options.body && !retryHeaders.has('Content-Type')) {
      retryHeaders.set('Content-Type', 'application/json');
    }
    res = await fetch(buildUrl(path, params), buildRequestInit(options, retryHeaders));
  }
  if (res.status === 401) {
    clearLegacyTokenStorage();
  }
  return parseJson<T>(res);
}

export async function apiSSE(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Response> {
  const buildHeaders = (): Headers => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    });
    return headers;
  };

  let res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal,
    credentials: 'include',
  });

  // 与 apiRequest 对齐：401 时单飞 refresh 后重试一次
  if (res.status === 401 && (await refreshAccessToken())) {
    res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal,
      credentials: 'include',
    });
  }

  if (!res.ok) {
    let message = '请求失败';
    try {
      const json = await res.json();
      message = extractApiErrorMessage(json);
    } catch {
      /* 非 JSON 错误体 */
    }
    if (res.status === 401) {
      clearLegacyTokenStorage();
    }
    throw new ApiRequestError('API_ERROR', message);
  }
  return res;
}
