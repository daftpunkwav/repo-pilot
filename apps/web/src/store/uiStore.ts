import { create } from "zustand";

interface UiState {
  theme: string;
  zoom: number;
  fontScale: number;
  viewMode: "list" | "card";
  sidebarWidth: number;
  setTheme: (theme: string) => void;
  setZoom: (zoom: number) => void;
  setFontScale: (scale: number) => void;
  setViewMode: (mode: "list" | "card") => void;
  setSidebarWidth: (width: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: localStorage.getItem("repopilot_theme") || "dark",
  zoom: Number(localStorage.getItem("repopilot_zoom") || "1"),
  fontScale: Number(localStorage.getItem("repopilot_font_scale") || "1"),
  viewMode: (localStorage.getItem("repopilot_view_mode") as "list" | "card") || "list",
  sidebarWidth: Number(localStorage.getItem("repopilot_sidebar_width") || "260"),
  setTheme: (theme) => {
    localStorage.setItem("repopilot_theme", theme);
    set({ theme });
  },
  setZoom: (zoom) => {
    localStorage.setItem("repopilot_zoom", String(zoom));
    set({ zoom });
  },
  setFontScale: (fontScale) => {
    localStorage.setItem("repopilot_font_scale", String(fontScale));
    set({ fontScale });
  },
  setViewMode: (viewMode) => {
    localStorage.setItem("repopilot_view_mode", viewMode);
    set({ viewMode });
  },
  setSidebarWidth: (sidebarWidth) => {
    localStorage.setItem("repopilot_sidebar_width", String(sidebarWidth));
    set({ sidebarWidth });
  },
}));
