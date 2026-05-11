/**
 * Type guard utilities for the SDUI editor component registry.
 *
 * These are WARNING-level checks that log unregistered component types
 * without crashing the editor. This catches cases where a template or
 * saved screen references a type not in the registry.
 */
import { COMPONENT_REGISTRY } from './types';

const registryTypes = new Set(COMPONENT_REGISTRY.map(c => c.type));
const registryTypesLower = new Set(COMPONENT_REGISTRY.map(c => c.type.toLowerCase()));

/**
 * Check whether a type string is in the component registry.
 * Exact match first, then case-insensitive fallback.
 */
export function isRegisteredComponentType(type: string): boolean {
  return registryTypes.has(type) || registryTypesLower.has(type.toLowerCase());
}

/**
 * Assert that a component type is registered. Logs a warning if not.
 * Does NOT throw — we don't want to crash the editor.
 */
export function assertRegisteredComponentType(type: string): void {
  if (!isRegisteredComponentType(type)) {
    console.warn(
      `[Editor] Unregistered component type: "${type}". ` +
      `This component may not render correctly.`,
    );
  }
}
