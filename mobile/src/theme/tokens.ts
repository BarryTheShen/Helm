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
  sm: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', elevation: 1 },
  md: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', elevation: 2 },
  lg: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)', elevation: 4 },
};

export function resolveColor(tokenOrHex: string | undefined, fallback: string = themeColors.text): string {
  if (!tokenOrHex) return fallback;
  return themeColors[tokenOrHex] ?? tokenOrHex;
}
