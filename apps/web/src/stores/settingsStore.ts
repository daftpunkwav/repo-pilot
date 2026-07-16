import { create } from 'zustand';
import type { Settings } from '@/api/types';
import { getApi } from '@/api/client';
import { extractErrorMessage } from '@/utils/errors';

export interface LlmTestResult {
  success: boolean;
  latency_ms: number;
  model?: string;
  reply?: string;
  error?: string;
  litellm_model?: string;
}

interface SettingsState {
  settings: Settings | null;
  isLoading: boolean;
  isTestingLLM: boolean;
  testResult: LlmTestResult | null;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
  testLLM: (model?: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  isTestingLLM: false,
  testResult: null,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const api = getApi();
      const response = await api.getSettings();
      set({ settings: response.data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractErrorMessage(err) });
    }
  },

  updateSettings: async (data) => {
    const prev = get().settings;
    if (prev) {
      const optimistic = { ...prev, ...data };
      if (data.llm_default_model !== undefined) {
        optimistic.llm_model = data.llm_default_model;
      }
      set({ settings: optimistic });
    }
    try {
      const api = getApi();
      const response = await api.updateSettings(data);
      set({ settings: response.data });
    } catch (err) {
      if (prev) set({ settings: prev });
      set({ error: extractErrorMessage(err) });
      throw err;
    }
  },

  testLLM: async (model) => {
    set({ isTestingLLM: true, testResult: null, error: null });
    const started = performance.now();
    try {
      const api = getApi();
      const target =
        model ||
        get().settings?.llm_default_model ||
        get().settings?.llm_model;
      const response = await api.testLLM({ model: target });
      const clientMs = Math.round(performance.now() - started);
      // 优先用服务端耗时；若异常偏小则回退客户端墙钟时间
      const serverMs = response.data.latency_ms;
      const latency_ms =
        typeof serverMs === 'number' && serverMs >= 50 ? serverMs : clientMs;
      set({
        isTestingLLM: false,
        testResult: {
          success: response.data.success,
          latency_ms,
          model: response.data.model || target,
          reply: response.data.reply,
          error: response.data.error,
          litellm_model: response.data.litellm_model,
        },
      });
      // 刷新设置，但保留本次 testResult
      const prevResult = get().testResult;
      await get().loadSettings();
      if (prevResult) set({ testResult: prevResult });
    } catch (err) {
      const clientMs = Math.round(performance.now() - started);
      set({
        isTestingLLM: false,
        testResult: {
          success: false,
          latency_ms: clientMs,
          model,
          error: extractErrorMessage(err),
        },
        error: extractErrorMessage(err),
      });
    }
  },
}));
