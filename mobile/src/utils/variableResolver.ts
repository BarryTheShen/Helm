/**
 * variableResolver — resolves {{expression}} mustache templates in SDUI props.
 *
 * Expressions are dot-separated paths walked against a VariableContext.
 * Unresolvable expressions are left as-is (the original {{expression}} text).
 * Null user fields resolve to empty string. All resolution is synchronous.
 *
 * Backward compatibility: {{input}} is an alias for {{self.value}}.
 */

export interface VariableContext {
  user: Record<string, unknown>;
  component: Record<string, Record<string, unknown>>;
  self: Record<string, unknown>;
  data: Record<string, unknown>;
  env: Record<string, unknown>;
  custom: Record<string, unknown>;
}

const EXPRESSION_RE = /\{\{(.+?)\}\}/g;

/** Sentinel for "path does not exist in context" vs "exists but is null". */
const NOT_FOUND = Symbol('NOT_FOUND');

function walkPath(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const segment of path) {
    if (current == null || typeof current !== 'object') {
      return NOT_FOUND;
    }
    const record = current as Record<string, unknown>;
    if (!(segment in record)) {
      return NOT_FOUND;
    }
    current = record[segment];
  }
  return current;
}

function resolveExpressionValue(expr: string, context: VariableContext): unknown {
  const trimmed = expr.trim();

  // Backward compat: bare {{input}} → {{self.value}}
  if (trimmed === 'input') {
    return context.self.value ?? '';
  }

  const segments = trimmed.split('.');
  const scope = segments[0];
  const rest = segments.slice(1);

  switch (scope) {
    case 'user':
      return walkPath(context.user, rest);
    case 'component':
      return walkPath(context.component, rest);
    case 'self':
      return walkPath(context.self, rest);
    case 'data':
      return walkPath(context.data, rest);
    case 'env':
      return walkPath(context.env, rest);
    case 'custom':
      return walkPath(context.custom, rest);
    default:
      // Try walking the entire context as a flat namespace
      return walkPath(context as unknown as Record<string, unknown>, segments);
  }
}

export function resolveExpression(template: string, context: VariableContext): string {
  return template.replace(EXPRESSION_RE, (match, expr: string) => {
    const value = resolveExpressionValue(expr, context);
    // Unresolvable → keep original {{expression}} text
    if (value === NOT_FOUND) {
      return match;
    }
    // Null/undefined → empty string
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

function resolveValue(value: unknown, context: VariableContext): unknown {
  if (typeof value === 'string') {
    if (!value.includes('{{')) {
      return value;
    }
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
