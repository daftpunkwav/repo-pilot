export const THEMES = {
  dark: {
    name: "午夜",
    colors: { bg: "#09090d", surface: "#16161f", primary: "#6b8cff", text: "#e2e2ee", muted: "#a0a0b8", border: "#26262f" },
  },
  light: {
    name: "默认浅色",
    colors: { bg: "#f3f3f7", surface: "#ffffff", primary: "#3b6cf4", text: "#1a1a26", muted: "#6b6b7b", border: "#e3e3ec" },
  },
} as const;

export type ThemeKey = keyof typeof THEMES;
