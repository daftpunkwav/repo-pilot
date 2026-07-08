import { create } from 'zustand';
import type { Settings } from '@/api/types';
import { getApi } from '@/api/client';
import { extractErrorMessage } from '@/utils/errors';

interface SettingsState {
  settings: Settings | null;
  isLoading: boolean;
  isTestingLLM: boolean;
  testResult: { success: boolean; latency_ms: number } | null;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
  testLLM: () => Promise<void>;
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

  testLLM: async () => {
    set({ isTestingLLM: true, testResult: null });
    try {
      const api = getApi();
      const response = await api.testLLM();
      set({
        isTestingLLM: false,
        testResult: {
          success: response.data.success,
          latency_ms: response.data.latency_ms,
        },
      });
      await get().loadSettings();
    } catch (err) {
      set({
        isTestingLLM: false,
        testResult: { success: false, latency_ms: 0 },
        error: extractErrorMessage(err),
      });
    }
  },
}));
