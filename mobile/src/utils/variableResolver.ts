/**
 * variableResolver — resolves {{expression}} mustache templates in SDUI props.
 *
 * Uses the mustache library for template rendering. Unresolvable expressions
 * are preserved as-is (the original {{expression}} text) via a Proxy-based
 * view that intercepts missing key lookups and returns the original token.
 *
 * Backward compatibility: {{input}} is an alias for {{self.value}}.
 */

import Mustache from 'mustache';

export interface VariableContext {
  user: Record<string, unknown>;
  component: Record<string, Record<string, unknown>>;
  self: Record<string, unknown>;
  data: Record<string, unknown>;
  env: Record<string, unknown>;
  custom: Record<string, unknown>;
  date: Record<string, unknown>;
}

/**
 * Wrap a plain object in a Proxy so that any missing key lookup returns a
 * function that Mustache calls as a lambda — the lambda returns the original
 * {{key}} text, preserving unresolvable expressions.
 *
 * Mustache resolves dot-paths by walking nested objects, so we apply the
 * proxy recursively to every nested object value.
 */
function makeNotFoundProxy(obj: Record<string, unknown>, pathPrefix: string): Record<string, unknown> {
  return new Proxy(obj, {
    get(target, prop: string) {
      if (prop in target) {
        const val = target[prop];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          return makeNotFoundProxy(val as Record<string, unknown>, `${pathPrefix}.${prop}`);
        }
        return val;
      }
      // Missing key — return the original {{path.prop}} text as a lambda so
      // Mustache renders it literally instead of empty string.
      const fullPath = pathPrefix ? `${pathPrefix}.${prop}` : prop;
      return () => `{{${fullPath}}}`;
    },
  });
}

/**
 * Build the mustache view from a VariableContext.
 * Each top-level scope becomes a nested object wrapped in a not-found proxy.
 */
function buildMustacheView(context: VariableContext): Record<string, unknown> {
  const view: Record<string, unknown> = {
    user: makeNotFoundProxy(context.user, 'user'),
    component: makeNotFoundProxy(context.component as unknown as Record<string, unknown>, 'component'),
    self: makeNotFoundProxy(context.self, 'self'),
    data: makeNotFoundProxy(context.data, 'data'),
    env: makeNotFoundProxy(context.env, 'env'),
    custom: makeNotFoundProxy(context.custom, 'custom'),
    date: makeNotFoundProxy(context.date, 'date'),
  };

  // Backward compat: bare {{input}} → self.value
  const selfValue = context.self.value;
  view['input'] = selfValue !== undefined && selfValue !== null ? selfValue : () => '{{input}}';

  return new Proxy(view, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // Unknown top-level scope — return a proxy that preserves {{scope.x}}
      return makeNotFoundProxy({}, prop);
    },
  });
}

export function resolveExpression(template: string, context: VariableContext): string {
  if (!template.includes('{{')) return template;
  // Disable HTML escaping — SDUI values are plain text, not HTML
  Mustache.escape = (s: string) => s;
  return Mustache.render(template, buildMustacheView(context));
}

function resolveValue(value: unknown, context: VariableContext): unknown {
  if (typeof value === 'string') {
    if (!value.includes('{{')) return value;
    return resolveExpression(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, context));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveValue(v, context);
    }
    return result;
  }
  return value;
}

export function resolveProps(
  props: Record<string, unknown>,
  context: VariableContext,
): Record<string, unknown> {
  return resolveValue(props, context) as Record<string, unknown>;
}

/** Generic recursive resolver — walks objects/arrays, resolving all {{expression}} strings. */
export function resolveAllExpressions<T>(payload: T, context: VariableContext): T {
  return resolveValue(payload, context) as T;
}
