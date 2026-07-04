import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';

export function useSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const testLLM = useSettingsStore((s) => s.testLLM);
  const isTestingLLM = useSettingsStore((s) => s.isTestingLLM);
  const testResult = useSettingsStore((s) => s.testResult);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    loadSettings,
    updateSettings,
    testLLM,
    isTestingLLM,
    testResult,
  };
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontScale = useUIStore((s) => s.fontScale);
  const setFontScale = useUIStore((s) => s.setFontScale);

  return { theme, setTheme, fontScale, setFontScale };
}
