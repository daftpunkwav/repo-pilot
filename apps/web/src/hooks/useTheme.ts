import { useUIStore } from '@/stores/uiStore';

/**
 * 主题与字体缩放
 *
 * 状态来自 UI store（持久化），与 LLM settings 无关。
 * 2026-07-09 review 后从 useSettings.ts 独立成模块。
 */
export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontScale = useUIStore((s) => s.fontScale);
  const setFontScale = useUIStore((s) => s.setFontScale);

  return { theme, setTheme, fontScale, setFontScale };
}
