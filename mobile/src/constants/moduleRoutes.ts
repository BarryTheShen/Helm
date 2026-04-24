/**
 * MODULE_TYPE_TO_ROUTE — Explicit mapping from module_type slugs to Expo Router routes.
 *
 * This constant defines how built-in module types map to static tab routes.
 * Custom modules (template_id != null) use dynamic routes instead.
 */

export const MODULE_TYPE_TO_ROUTE: Record<string, string> = {
  'home': '/(tabs)/home',
  'chat': '/(tabs)/chat',
  'modules': '/(tabs)/modules',
  'calendar': '/(tabs)/calendar',
  'forms': '/(tabs)/forms',
  'alerts': '/(tabs)/alerts',
  'settings': '/(tabs)/settings',
};

/**
 * Returns the route for a given module instance.
 *
 * Built-in modules (template_id == null) use static routes from MODULE_TYPE_TO_ROUTE.
 * Custom modules (template_id != null) use dynamic template routes.
 */
export function getRouteForModuleInstance(moduleInstance: {
  module_type: string;
  template_id: string | null;
}): string {
  // Custom modules use dynamic route
  if (moduleInstance.template_id !== null) {
    return `/template/${moduleInstance.template_id}`;
  }

  // Built-in modules use constant mapping
  return MODULE_TYPE_TO_ROUTE[moduleInstance.module_type] || '/(tabs)/home';
}
