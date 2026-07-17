import { create } from 'zustand';
import type { User } from '@/api/types';
import { getApi } from '@/api/client';
import { clearLegacyTokenStorage } from '@/api/real/http';
import { extractErrorMessage } from '@/utils/errors';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const api = getApi();
      const response = await api.login({ username, password });
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: extractErrorMessage(err) });
      throw err;
    }
  },

  logout: async () => {
    try {
      const api = getApi();
      await api.logout();
    } finally {
      clearLegacyTokenStorage();
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const api = getApi();
      const response = await api.register({ username, password });
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: extractErrorMessage(err) });
      throw err;
    }
  },

  fetchMe: async () => {
    // 会话状态由 httpOnly Cookie 持有；直接探测 /auth/me
    try {
      const api = getApi();
      const response = await api.me();
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      clearLegacyTokenStorage();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  clearError: () => set({ error: null }),
}));
