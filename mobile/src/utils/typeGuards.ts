/**
 * Type guard utilities for SDUI component types.
 *
 * These are WARNING-level checks that log unknown component types without
 * crashing the renderer. The goal is visibility: developers can see unknown
 * types in logs and fix them, while the existing "Unknown" fallback still
 * renders gracefully for end users.
 */

import { COMPONENT_MAP } from '@/renderer/componentRegistry';

/**
 * Check whether a type string matches any known component type.
 * Exact match first, then case-insensitive fallback.
 */
export function isKnownComponentType(type: string): boolean {
  if (COMPONENT_MAP[type]) return true;
  const lower = type.toLowerCase();
  return Object.keys(COMPONENT_MAP).some(k => k.toLowerCase() === lower);
}

/**
 * Assert that a component type is valid. Logs a warning if not.
 * Does NOT throw — we don't want to crash production.
 */
export function assertValidComponentType(type: string): void {
  if (!isKnownComponentType(type)) {
    console.warn(
      `[SDUI] Unknown component type: "${type}". ` +
      `Valid types: ${Object.keys(COMPONENT_MAP).join(', ')}`,
    );
  }
}
