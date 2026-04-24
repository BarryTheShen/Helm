/**
 * Variable resolver for web admin preview.
 * Resolves {{namespace.key}} expressions with mock data for preview purposes.
 */

interface MockVariableContext {
  user: Record<string, unknown>;
  component: Record<string, Record<string, unknown>>;
  self: Record<string, unknown>;
  data: Record<string, unknown>;
  env: Record<string, unknown>;
  custom: Record<string, unknown>;
  connection: Record<string, unknown>;
}

// Mock data for preview
const MOCK_CONTEXT: MockVariableContext = {
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    id: '1',
  },
  component: {},
  self: {
    value: 'Sample Value',
  },
  data: {},
  env: {},
  custom: {
    greeting: 'Hello',
    appName: 'Helm',
  },
  connection: {},
};

/**
 * Resolve a single {{namespace.key}} expression.
 */
function resolveExpression(expr: string, context: MockVariableContext): string {
  const parts = expr.trim().split('.');
  if (parts.length < 2) return `{{${expr}}}`;

  const [namespace, ...keyParts] = parts;
  const key = keyParts.join('.');

  // Navigate the context
  let value: any = context[namespace as keyof MockVariableContext];

  if (!value) return `{{${expr}}}`;

  // Walk the key path
  const keys = key.split('.');
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return `{{${expr}}}`;
    }
  }

  return value !== null && value !== undefined ? String(value) : `{{${expr}}}`;
}

/**
 * Resolve all {{...}} expressions in a string.
 */
export function resolveVariables(text: string, customContext?: Partial<MockVariableContext>): string {
  if (!text || !text.includes('{{')) return text;

  const context = customContext ? { ...MOCK_CONTEXT, ...customContext } : MOCK_CONTEXT;
  const regex = /\{\{([^}]+)\}\}/g;

  return text.replace(regex, (match, expr) => {
    return resolveExpression(expr, context);
  });
}

/**
 * Check if a string contains unresolved variables.
 */
export function hasUnresolvedVariables(text: string): boolean {
  return text.includes('{{') && text.includes('}}');
}

/**
 * Extract all variable expressions from a string.
 */
export function extractVariables(text: string): string[] {
  if (!text || !text.includes('{{')) return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}
