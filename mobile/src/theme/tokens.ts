/**
 * Theme tokens — design system values referenced by component props.
 *
 * Architecture Decision: Sessions 3 & 4
 * Components use theme token names (e.g., color: "primary") instead of raw hex.
 * The renderer resolves token names to actual values via this map.
 */

export const themeColors: Record<string, string> = {
  // Brand
  primary: '#007AFF',
  primaryLight: '#E3F2FD',
  secondary: '#5856D6',

  // Semantic
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',

  // Surfaces
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',

  // Text
  text: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',

  // Borders
  border: '#C6C6C8',
  divider: '#E5E5EA',
};

export const themeShadows: Record<string, object> = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
};

export function resolveColor(tokenOrHex: string | undefined, fallback: string = themeColors.text): string {
  if (!tokenOrHex) return fallback;
  return themeColors[tokenOrHex] ?? tokenOrHex;
}
