import { test, expect } from '@playwright/test';
import fs from 'fs';
import { qaPath } from '../utils';

/**
 * Helper: recursively walk a V2 content object (and its Container children)
 * to extract all component type strings.
 */
function extractComponentTypes(content: unknown): string[] {
  if (!content || typeof content !== 'object') return [];
  const comp = content as Record<string, unknown>;
  const types: string[] = [];

  const typeVal = comp.type;
  if (typeof typeVal === 'string' && typeVal.length > 0) {
    types.push(typeVal);
  }

  // Recurse into direct children
  const children = comp.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      types.push(...extractComponentTypes(child));
    }
  }

  // Recurse into props.children (SDUI V2 Container pattern)
  const props = comp.props;
  if (props && typeof props === 'object') {
    const propsChildren = (props as Record<string, unknown>).children;
    if (Array.isArray(propsChildren)) {
      for (const child of propsChildren) {
        types.push(...extractComponentTypes(child));
      }
    }
  }

  return types;
}

/**
 * Helper: walk screen_json (V2 rows or V1 sections) to collect all
 * component types.
 */
function collectAllTypes(screen_json: unknown): string[] {
  if (!screen_json || typeof screen_json !== 'object') return [];

  const screen = screen_json as Record<string, unknown>;
  const types: string[] = [];

  // V2 row-based format
  const rows = screen.rows;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const cells = (row as Record<string, unknown>).cells;
      if (!Array.isArray(cells)) continue;
      for (const cell of cells) {
        if (!cell || typeof cell !== 'object') continue;
        const content = (cell as Record<string, unknown>).content;
        types.push(...extractComponentTypes(content));
      }
    }
    return types;
  }

  // V1 section-based format (legacy)
  const sections = screen.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (!section || typeof section !== 'object') continue;
      const comp = (section as Record<string, unknown>).component;
      if (comp && typeof comp === 'object') {
        types.push(...extractComponentTypes(comp));
      }
      const comps = (section as Record<string, unknown>).components;
      if (Array.isArray(comps)) {
        for (const c of comps) {
          types.push(...extractComponentTypes(c));
        }
      }
    }
  }

  return types;
}

/**
 * Helper: walk props looking for action references.
 * Returns function names found in server_action objects.
 *
 * Checks for:
 * - Any prop value that is { type: "server_action", function: "foo" }
 * - props.server_action as a plain string (legacy shorthand for a function name)
 * - props.action as a plain string (legacy shorthand)
 */
function collectActionFunctions(props: unknown): string[] {
  if (!props || typeof props !== 'object') return [];
  const propBag = props as Record<string, unknown>;
  const functions: string[] = [];

  for (const [key, val] of Object.entries(propBag)) {
    if (val === null || val === undefined) continue;

    // Object form: { type: "server_action", function: "..." }
    if (typeof val === 'object') {
      const valObj = val as Record<string, unknown>;
      if (valObj.type === 'server_action') {
        const func = valObj.function;
        if (typeof func === 'string' && func.length > 0) {
          functions.push(func);
        }
      }
    }

    // Plain string shorthand for key "action" or "server_action"
    if ((key === 'action' || key === 'server_action') && typeof val === 'string' && val.length > 0) {
      functions.push(val);
    }
  }

  return functions;
}

/**
 * Helper: walk screen_json to collect all action function references
 * from component props (including nested Container children).
 */
function collectAllActionFunctions(screen_json: unknown): string[] {
  if (!screen_json || typeof screen_json !== 'object') return [];

  const screen = screen_json as Record<string, unknown>;
  const functions: string[] = [];

  function walkContent(content: unknown): void {
    if (!content || typeof content !== 'object') return;
    const comp = content as Record<string, unknown>;

    // Extract action functions from this component's props
    const props = comp.props;
    if (props && typeof props === 'object') {
      functions.push(...collectActionFunctions(props));
    }

    // Recurse into children
    const children = comp.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        walkContent(child);
      }
    }

    // Recurse into props.children (SDUI V2 Container pattern)
    const compProps = comp.props;
    if (compProps && typeof compProps === 'object') {
      const propsChildren = (compProps as Record<string, unknown>).children;
      if (Array.isArray(propsChildren)) {
        for (const child of propsChildren) {
          walkContent(child);
        }
      }
    }
  }

  // V2 row-based
  const rows = screen.rows;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const cells = (row as Record<string, unknown>).cells;
      if (!Array.isArray(cells)) continue;
      for (const cell of cells) {
        if (!cell || typeof cell !== 'object') continue;
        walkContent((cell as Record<string, unknown>).content);
      }
    }
    return functions;
  }

  // V1 section-based
  const sections = screen.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (!section || typeof section !== 'object') continue;
      const comp = (section as Record<string, unknown>).component;
      if (comp && typeof comp === 'object') walkContent(comp);
      const comps = (section as Record<string, unknown>).components;
      if (Array.isArray(comps)) {
        for (const c of comps) walkContent(c);
      }
    }
  }

  return functions;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

test.describe('Template Quality', () => {
  let templatesFull: any[];
  let whitelistTypes: string[];
  let legacyMap: Record<string, string>;
  let actions: Set<string>;
  let mobileRegistryTypes: Set<string>;

  test.beforeAll(() => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));

    templatesFull = discovered.templates?.full || [];

    const vw = discovered.validation_whitelist || {};
    whitelistTypes = Array.isArray(vw.types) ? vw.types : [];
    legacyMap = (vw.legacy_map || {}) as Record<string, string>;

    const rawActions = discovered.actions || [];
    actions = new Set(Array.isArray(rawActions) ? rawActions : []);

    const rawMobileTypes = discovered.mobile_registry_types || [];
    mobileRegistryTypes = new Set(Array.isArray(rawMobileTypes) ? rawMobileTypes : []);
  });

  test('all seed template component types exist in validation whitelist', async () => {
    if (templatesFull.length === 0) {
      console.log('No full templates (templates.full) in discovered.json — skipping');
      return;
    }

    const invalidTypes: string[] = [];

    for (const tmpl of templatesFull) {
      const name = tmpl.name || tmpl.id || 'unknown';
      const screenJson = tmpl.screen_json;
      if (!screenJson) continue;

      const types = unique(collectAllTypes(screenJson));
      for (const typeName of types) {
        // Check direct whitelist membership
        const inWhitelist = whitelistTypes.includes(typeName);
        // Check legacy map: if it's a key in legacy_map, the mapped value is valid
        const legacyMapped = legacyMap[typeName];
        const inLegacyMap = legacyMapped !== undefined && whitelistTypes.includes(legacyMapped);

        if (!inWhitelist && !inLegacyMap) {
          invalidTypes.push(`Template "${name}": component type "${typeName}" not in validation whitelist`);
        }
      }
    }

    expect(
      invalidTypes.length,
      invalidTypes.join('\n'),
    ).toBe(0);
  });

  test('all seed template action references are registered', async () => {
    if (templatesFull.length === 0) {
      console.log('No full templates (templates.full) in discovered.json — skipping');
      return;
    }

    const invalidActions: string[] = [];

    for (const tmpl of templatesFull) {
      const name = tmpl.name || tmpl.id || 'unknown';
      const screenJson = tmpl.screen_json;
      if (!screenJson) continue;

      const funcs = unique(collectAllActionFunctions(screenJson));
      for (const func of funcs) {
        if (!actions.has(func)) {
          invalidActions.push(`Template "${name}": action "${func}" not registered`);
        }
      }
    }

    expect(
      invalidActions.length,
      invalidActions.join('\n'),
    ).toBe(0);
  });

  test('seed template component types exist in web component registry', async () => {
    if (templatesFull.length === 0) {
      console.log('No full templates (templates.full) in discovered.json — skipping');
      return;
    }

    // Read web component registry from source
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');

    // Reusable helper to extract type strings from a ComponentDefinition[] array
    function extractTypesFromArray(ts: string, arrayName: string): string[] {
      const re = new RegExp(
        `(?:const|export\\s+const)\\s+${arrayName}:\\s*ComponentDefinition\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`,
      );
      const match = ts.match(re);
      if (!match) return [];
      const types: string[] = [];
      const tm = match[1].matchAll(/type:\s*['"]([^'"]+)['"]/g);
      for (const m of tm) types.push(m[1]);
      return types;
    }

    const webTypes = [
      ...extractTypesFromArray(typesSrc, 'READ_ONLY_RUNTIME_COMPONENTS'),
      ...extractTypesFromArray(typesSrc, 'COMPONENT_REGISTRY'),
    ];
    const webRegistryTypes = new Set(webTypes);

    if (webRegistryTypes.size === 0) {
      console.log('Could not parse web component registry from types.ts — skipping');
      return;
    }

    const unresolvedTypes: string[] = [];

    for (const tmpl of templatesFull) {
      const name = tmpl.name || tmpl.id || 'unknown';
      const screenJson = tmpl.screen_json;
      if (!screenJson) continue;

      const types = unique(collectAllTypes(screenJson));
      for (const typeName of types) {
        // Exact match
        if (webRegistryTypes.has(typeName)) continue;
        // Case-insensitive match
        const lower = typeName.toLowerCase();
        const caseInsensitiveMatch = [...webRegistryTypes].some(
          (t) => t.toLowerCase() === lower,
        );
        if (caseInsensitiveMatch) continue;

        unresolvedTypes.push(`Template "${name}": component type "${typeName}" not in web component registry`);
      }
    }

    expect(
      unresolvedTypes.length,
      unresolvedTypes.join('\n'),
    ).toBe(0);
  });

  test('seed template component types are resolvable by mobile renderer', async () => {
    if (templatesFull.length === 0) {
      console.log('No full templates (templates.full) in discovered.json — skipping');
      return;
    }

    if (mobileRegistryTypes.size === 0) {
      console.log('No mobile_registry_types in discovered.json — skipping mobile registry check');
      return;
    }

    const unresolvableTypes: string[] = [];

    for (const tmpl of templatesFull) {
      const name = tmpl.name || tmpl.id || 'unknown';
      const screenJson = tmpl.screen_json;
      if (!screenJson) continue;

      const types = unique(collectAllTypes(screenJson));
      for (const typeName of types) {
        // Exact match
        if (mobileRegistryTypes.has(typeName)) continue;
        // Case-insensitive match
        const lower = typeName.toLowerCase();
        const caseInsensitiveMatch = [...mobileRegistryTypes].some(
          (t) => t.toLowerCase() === lower,
        );
        if (caseInsensitiveMatch) continue;

        unresolvableTypes.push(`Template "${name}": component type "${typeName}" not in mobile registry`);
      }
    }

    expect(
      unresolvableTypes.length,
      unresolvableTypes.join('\n'),
    ).toBe(0);
  });

  test('no template uses standalone Divider component', async () => {
    // --- Check seed templates from discovered.json ---
    const hasDividerInTemplates: string[] = [];
    for (const tmpl of templatesFull) {
      const name = tmpl.name || tmpl.id || 'unknown';
      const screenJson = tmpl.screen_json;
      if (!screenJson) continue;
      const types = unique(collectAllTypes(screenJson));
      if (types.includes('Divider') || types.includes('divider')) {
        hasDividerInTemplates.push(name);
      }
    }

    // --- Check local templates from templateLibrary.ts ---
    const tplSrc = fs.readFileSync(qaPath('../web/src/editor/templateLibrary.ts'), 'utf-8');
    // Find all createCell() calls and check for Divider type argument
    const createCellDividerMatch = tplSrc.match(/createCell\(\s*['"]Divider['"]\s*,/g);
    if (createCellDividerMatch && createCellDividerMatch.length > 0) {
      hasDividerInTemplates.push('(local template library uses createCell(\'Divider\', ...))');
    }

    // The row-level divider at templateLibrary.ts:62 is correct — it uses row.type = 'divider',
    // NOT a standalone component. This test only catches component-level Divider usage.

    expect(
      hasDividerInTemplates,
      hasDividerInTemplates.length > 0
        ? `Templates using standalone Divider component: ${hasDividerInTemplates.join(', ')}`
        : 'No templates use standalone Divider component',
    ).toEqual([]);
  });

  test('active module states do not use deprecated component types', async () => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));
    const moduleStateTypes = discovered.module_state_types || {};

    const entries = Object.entries(moduleStateTypes) as [string, {
      has_screen: boolean;
      types: string[];
      draft_types?: string[];
      hasDivider: boolean;
    }][];

    const modulesWithScreens = entries.filter(([, v]) => v.has_screen || v.draft_types);
    if (modulesWithScreens.length === 0) {
      console.log('No module states with screens found in discovered.json — skipping');
      return;
    }

    // Deprecated component-level types that should only appear as row-level properties
    const deprecatedTypes = ['Divider'];

    const violations: string[] = [];

    for (const [moduleId, state] of modulesWithScreens) {
      // Check live screen types
      if (state.has_screen && Array.isArray(state.types)) {
        for (const typeName of state.types) {
          if (deprecatedTypes.includes(typeName)) {
            violations.push(
              `Module "${moduleId}" live screen uses deprecated component type "${typeName}". `
              + `Use row-level type "divider" instead.`
            );
          }
        }
      }

      // Check draft types
      if (Array.isArray(state.draft_types)) {
        for (const typeName of state.draft_types) {
          if (deprecatedTypes.includes(typeName)) {
            violations.push(
              `Module "${moduleId}" draft screen uses deprecated component type "${typeName}". `
              + `Use row-level type "divider" instead.`
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      console.log('DEPRECATED COMPONENT TYPES FOUND IN MODULE STATES:');
      for (const v of violations) {
        console.log(`  ❌ ${v}`);
      }
    }

    expect(
      violations.length,
      violations.length > 0
        ? `Deprecated component types in module states:\n${violations.join('\n')}`
        : 'No deprecated component types found in active module states',
    ).toBe(0);
  });

  test('backend validation whitelist types exist in web component registry', async () => {
    const vw = (JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8')).validation_whitelist || {});
    const backendTypes = Array.isArray(vw.types) ? vw.types : [];

    if (backendTypes.length === 0) {
      console.log('No validation_whitelist types in discovered.json — skipping');
      return;
    }

    // Read web component registry from source
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');

    // Reusable helper to extract type strings from a ComponentDefinition[] array
    function extractTypesFromArray(ts: string, arrayName: string): string[] {
      const re = new RegExp(
        `(?:const|export\\s+const)\\s+${arrayName}:\\s*ComponentDefinition\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`,
      );
      const match = ts.match(re);
      if (!match) return [];
      const types: string[] = [];
      const tm = match[1].matchAll(/type:\s*['"]([^'"]+)['"]/g);
      for (const m of tm) types.push(m[1]);
      return types;
    }

    const webTypes = [
      ...extractTypesFromArray(typesSrc, 'READ_ONLY_RUNTIME_COMPONENTS'),
      ...extractTypesFromArray(typesSrc, 'COMPONENT_REGISTRY'),
    ];
    const webRegistryTypes = new Set(webTypes);

    if (webRegistryTypes.size === 0) {
      console.log('Could not parse web component registry from types.ts — skipping');
      return;
    }

    const missingTypes: string[] = [];

    for (const typeName of backendTypes) {
      // Exact match
      if (webRegistryTypes.has(typeName)) continue;
      // Case-insensitive match (legacy runtime components use lowercase like "alert", "badge")
      const lower = typeName.toLowerCase();
      const caseInsensitiveMatch = [...webRegistryTypes].some(
        (t) => t.toLowerCase() === lower,
      );
      if (caseInsensitiveMatch) continue;

      missingTypes.push(`Backend whitelist type "${typeName}" is missing from web component registry`);
    }

    expect(
      missingTypes.length,
      missingTypes.join('\n'),
    ).toBe(0);
  });
});
