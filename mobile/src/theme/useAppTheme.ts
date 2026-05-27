import { useMemo } from 'react';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { getAppColors, type AppColorPalette } from '@/theme/colors';

/**
 * Returns the active color palette from the published app config.
 * Falls back to light mode when no app is assigned yet.
 */
export function useAppTheme(): AppColorPalette {
  const darkMode = useAppConfigStore((state) => state.appConfig?.dark_mode ?? false);
  return useMemo(() => getAppColors(darkMode), [darkMode]);
}
