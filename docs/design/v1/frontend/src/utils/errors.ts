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
  if (err instanceof Error) {
    return err.message;
  }
  return '未知错误，请重试';
}
