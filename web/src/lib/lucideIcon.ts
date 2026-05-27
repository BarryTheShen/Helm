import { createElement, type ComponentType, type ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';

/** Convert kebab-case icon names (IconPicker) to Lucide PascalCase exports. */
export function getLucideIcon(iconName: string) {
  const pascalCase = iconName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return (LucideIcons as Record<string, unknown>)[pascalCase] ?? null;
}

export function renderLucideIcon(
  iconName: string | undefined,
  size: number,
  className?: string,
  fallback = '⭐',
): ReactNode {
  const name = iconName?.trim();
  if (!name) return fallback;

  const IconComponent = getLucideIcon(name);
  if (IconComponent) {
    return createElement(IconComponent as ComponentType<{ size: number; className?: string }>, {
      size,
      className,
    });
  }

  return fallback;
}
