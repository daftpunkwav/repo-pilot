/**
 * 子域共享的 HTTP 上下文 — 由 RealApiClient 注入 apiRequest / apiSSE / clearLegacyTokenStorage
 * 仅暴露子类用到的最小必要 surface;apiRequest 与 apiSSE 复用 ./http 的实现
 */
import type { apiRequest, apiSSE, clearLegacyTokenStorage } from '../http';

export interface HttpCtx {
  apiRequest: typeof apiRequest;
  apiSSE: typeof apiSSE;
  clearLegacyTokenStorage: typeof clearLegacyTokenStorage;
}
