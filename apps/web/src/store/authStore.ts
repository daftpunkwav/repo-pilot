import { create } from "zustand";

interface AuthState {
  token: string | null;
  user: import("../types/user").User | null;
  setAuth: (token: string, user: import("../types/user").User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("repopilot_token"),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem("repopilot_token", token);
    set({ token, user });
  },
  clearAuth: () => {
    localStorage.removeItem("repopilot_token");
    set({ token: null, user: null });
  },
}));
