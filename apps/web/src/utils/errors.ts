import type { ApiError } from '@/api/types';

/** 判断是否为 API 错误响应 */
export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    typeof (err as ApiError).error?.message === 'string'
  );
}

/** 从未知错误中提取用户可读消息 */
export function extractErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    return err.error.message;
  }
  if (err instanceof TypeError && /fetch|network|Failed to fetch/i.test(err.message)) {
    return '无法连接后端，请确认 API 已启动（http://127.0.0.1:19876）且前端走 http://127.0.0.1:5173';
  }
  if (err instanceof Error) {
    if (/Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
      return '无法连接后端，请确认 API 已启动（http://127.0.0.1:19876）且前端走 http://127.0.0.1:5173';
    }
    return err.message;
  }
  return '未知错误，请重试';
}
