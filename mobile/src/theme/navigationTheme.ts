import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { getAppColors } from '@/theme/colors';

/** Build a React Navigation theme from the app config dark_mode flag. */
export function buildNavigationTheme(darkMode: boolean): Theme {
  const palette = getAppColors(darkMode);
  const base = darkMode ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: darkMode,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
      notification: palette.error,
    },
  };
}
