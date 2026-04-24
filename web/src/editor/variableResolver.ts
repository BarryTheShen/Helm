/**
 * Variable resolver for web admin preview.
 * Uses mustache for {{namespace.key}} resolution with mock data.
 */

import Mustache from 'mustache';

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

// Disable HTML escaping for mustache
Mustache.escape = (text) => text;

/**
 * Resolve all {{...}} expressions in a string using mustache.
 */
export function resolveVariables(text: string, customContext?: Partial<MockVariableContext>): string {
  if (!text || typeof text !== 'string') return text;
  if (!text.includes('{{')) return text;

  const context = customContext ? { ...MOCK_CONTEXT, ...customContext } : MOCK_CONTEXT;

  try {
    return Mustache.render(text, context);
  } catch (error) {
    console.error('Variable resolution error:', error);
    return text;
  }
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
