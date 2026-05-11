import { test, expect } from '@playwright/test';
import fs from 'fs';
import { qaPath } from '../utils';

// ── Registry parsing helpers ─────────────────────────────────────────────────

function parseRegistryEntries(ts: string, arrayName: string): Array<{ type: string; authorable: boolean; readOnly: boolean }> {
  const re = new RegExp(
    `(?:const|export\\s+const)\\s+${arrayName}:\\s*ComponentDefinition\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`,
  );
  const match = ts.match(re);
  if (!match) return [];
  const entries: Array<{ type: string; authorable: boolean; readOnly: boolean }> = [];
  const objRe = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let m;
  while ((m = objRe.exec(match[1])) !== null) {
    const block = m[1];
    const typeMatch = block.match(/type:\s*['"]([^'"]+)['"]/);
    if (!typeMatch) continue;
    const readOnlyMatch = block.match(/readOnly:\s*(true|false)/);
    const readOnly = readOnlyMatch ? readOnlyMatch[1] === 'true' : false;
    const authorableMatch = block.match(/authorable:\s*(true|false)/);
    const authorable = authorableMatch
      ? authorableMatch[1] === 'true'
      : !readOnly;
    entries.push({ type: typeMatch[1], authorable, readOnly });
  }
  return entries;
}

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

function extractObjectLiteralKeys(ts: string, constName: string): string[] {
  // Search for the const declaration by name
  const constRe = new RegExp(`(?:const|export\\s+const)\\s+${constName}\\b`);
  const startMatch = ts.match(constRe);
  if (!startMatch) return [];
  const startIdx = startMatch.index;

  // Find the opening '{' after the = sign (handles => in type annotations)
  const eqIdx = ts.indexOf('=', startIdx);
  if (eqIdx < 0) return [];
  const openBrace = ts.indexOf('{', eqIdx);
  if (openBrace < 0) return [];

  // Match braces to find the closing '}'
  let depth = 1;
  let closeIdx = openBrace + 1;
  while (depth > 0 && closeIdx < ts.length) {
    const ch = ts[closeIdx];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    closeIdx++;
  }
  if (depth !== 0) return [];

  const content = ts.substring(openBrace + 1, closeIdx - 1);
  const keys: string[] = [];
  const keyRe = /^\s*['"]?(\w+)['"]?\s*:/gm;
  let km;
  while ((km = keyRe.exec(content)) !== null) {
    keys.push(km[1]);
  }
  return keys;
}

test.describe('Schema Reconciliation', () => {
  // ── Step 1.1 — Web/backend component registry alignment ─────────────────
  test('web and backend component registries are aligned', async ({ request }) => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));

    // Get backend component registry
    const auth = JSON.parse(fs.readFileSync(qaPath('src/.qa-auth.json'), 'utf-8'));
    const res = await request.get('http://127.0.0.1:8000/api/components/registry', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!res.ok()) {
      test.info().annotations.push({ type: 'skip', description: 'Could not fetch component registry — backend may not be running' });
      return;
    }

    const backendComponents = await res.json();
    const backendTypes = new Set(
      (backendComponents as any[])
        .map((c: any) => (c.type || c.name).toLowerCase().replace(/_/g, '')),
    );

    // Read web registry from source via static file
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');
    const webTypes: string[] = [];

    const typeMatches = typesSrc.matchAll(/type:\s*['"]([^'"]+)['"]/g);
    for (const m of typeMatches) {
      webTypes.push(m[1]);
    }

    // Web layout-only types that don't have backend component counterparts
    const layoutOnly = new Set(['row', 'icon_button', 'spacer', 'card', 'list', 'form', 'list_item',
      'alert', 'badge', 'stat', 'stats_row', 'progress', 'container']);

    // Normalize web type names to match backend convention
    // e.g. CalendarModule → calendar, TextInput → textinput, TodoList → todolist
    const toBackendName = (s: string) => {
      // Strip _Module suffix (CalendarModule → Calendar, ChatModule → Chat, NotesModule → Notes)
      let n = s.replace(/Module$/, '');
      // PascalCase → lowercase (Calendar → calendar, TextInput → textinput)
      n = n.toLowerCase();
      return n;
    };

    const webSet = new Set(webTypes.map(toBackendName).filter(t => !layoutOnly.has(t)));
    const backendSet = backendTypes;

    const missingInBackend = [...webSet].filter((t) => !backendSet.has(t));
    const missingInWeb = [...backendSet].filter((t) => !webSet.has(t));

    if (missingInBackend.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Web components missing in backend: ${missingInBackend.join(', ')}` });
    }
    if (missingInWeb.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Backend components missing in web: ${missingInWeb.join(', ')}` });
    }

    // Known drift — web-to-backend direction:
    //   richtext:  web has RichText alias, backend doesn't
    //   empty:     web has Empty in COMPONENT_REGISTRY, backend DB seed doesn't
    const expectedDrift = ['richtext', 'empty'];
    const actualDrift = missingInBackend.filter((t) => !expectedDrift.includes(t));

    expect(actualDrift.length, `Unexpected drift: web components not in backend: ${actualDrift.join(', ')}`).toBe(0);

    // Reverse direction — backend-to-web drift:
    //   divider:   backend DB seed still has Divider, web COMPONENT_REGISTRY removed it
    const expectedBackendDrift = ['divider'];
    const actualBackendDrift = missingInWeb.filter((t) => !expectedBackendDrift.includes(t));

    expect(actualBackendDrift.length, `Unexpected drift: backend components not in web: ${actualBackendDrift.join(', ')}`).toBe(0);
  });

  // ── Step 1.2 — COMPONENT_REGISTRY ↔ COMPONENT_SCHEMAS sync ──────────────
  test('all COMPONENT_REGISTRY types have COMPONENT_SCHEMAS entries', () => {
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');
    const schemasSrc = fs.readFileSync(qaPath('../web/src/editor/componentSchemas.ts'), 'utf-8');

    // Get non-read-only COMPONENT_REGISTRY types (read-only legacy types
    // like icon_button, card, etc. are not expected to have schemas)
    const registryTypes = parseRegistryEntries(typesSrc, 'COMPONENT_REGISTRY');
    const nonReadOnlyTypes = registryTypes
      .filter((e) => e.readOnly !== true)
      .map((e) => e.type);

    // Get all COMPONENT_SCHEMAS keys
    const schemaKeys = extractObjectLiteralKeys(schemasSrc, 'COMPONENT_SCHEMAS');

    // Find non-read-only types missing a schema entry
    const missingSchemas = nonReadOnlyTypes.filter((t) => !schemaKeys.includes(t));

    expect(
      missingSchemas,
      missingSchemas.length > 0
        ? `Component type(s) missing from COMPONENT_SCHEMAS: ${missingSchemas.join(', ')}`
        : 'All non-read-only COMPONENT_REGISTRY types have entries in COMPONENT_SCHEMAS',
    ).toEqual([]);
  });

  // ── Step 1.3 — COMPONENT_REGISTRY ↔ PREVIEW_RENDERERS sync ─────────────
  test('all COMPONENT_REGISTRY types have PREVIEW_RENDERERS entries', () => {
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');
    const canvasSrc = fs.readFileSync(qaPath('../web/src/editor/EditorCanvas.tsx'), 'utf-8');

    // Get ALL COMPONENT_REGISTRY types (including read-only)
    const registryTypes = parseRegistryEntries(typesSrc, 'COMPONENT_REGISTRY');
    const allRegistryTypes = new Set(registryTypes.map((e) => e.type));

    // The COMPONENT_REGISTRY array spreads READ_ONLY_RUNTIME_COMPONENTS,
    // which are not captured by parseRegistryEntries. Parse them separately.
    const readOnlyTypes = parseRegistryEntries(typesSrc, 'READ_ONLY_RUNTIME_COMPONENTS');
    for (const entry of readOnlyTypes) {
      allRegistryTypes.add(entry.type);
    }

    // Get PREVIEW_RENDERERS keys
    const rendererKeys = extractObjectLiteralKeys(canvasSrc, 'PREVIEW_RENDERERS');

    // Assert every COMPONENT_REGISTRY type has a preview renderer
    const missingRenderers = [...allRegistryTypes].filter((t) => !rendererKeys.includes(t));
    expect(
      missingRenderers,
      missingRenderers.length > 0
        ? `Component type(s) missing from PREVIEW_RENDERERS: ${missingRenderers.join(', ')}`
        : 'All COMPONENT_REGISTRY types have entries in PREVIEW_RENDERERS',
    ).toEqual([]);

    // Report PREVIEW_RENDERERS entries NOT in COMPONENT_REGISTRY (potential dead code
    // or backward-compat aliases). These are informational — Divider is expected
    // dead code from the removal, and snake_case/lowercase names are compat aliases.
    const extraRenderers = rendererKeys.filter((k) => !allRegistryTypes.has(k));
    if (extraRenderers.length > 0) {
      test.info().annotations.push({
        type: 'info',
        description: `PREVIEW_RENDERERS entries not in COMPONENT_REGISTRY (may be dead code or backward-compat aliases): ${extraRenderers.join(', ')}`,
      });
    }
  });

  // ── Existing: removed component types are not re-introduced ────────────
  test('removed component types are not re-introduced', async () => {
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');

    const entries = parseRegistryEntries(typesSrc, 'COMPONENT_REGISTRY');

    // These types were explicitly removed per architecture decisions
    // (standalone Divider → replaced by row-level dividers)
    const removedTypes = ['Divider'];

    for (const removed of removedTypes) {
      const found = entries.find((e) => e.type === removed && e.authorable);
      expect(
        found,
        `Component type "${removed}" was removed per architecture decisions but found in COMPONENT_REGISTRY as authorable`,
      ).toBeUndefined();
    }
  });

  // ── Existing: all backend actions are registered ───────────────────────
  test('all backend actions are registered', async () => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));
    const actions = discovered.actions || [];
    expect(actions.length).toBeGreaterThan(0);

    // Check no duplicate action names
    const unique = new Set(actions);
    expect(unique.size).toBe(actions.length);
  });

  // ── Step 1.4 — Backend validation whitelist ↔ mobile registry sync ─────
  test('all backend validation types exist in mobile registry', () => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));

    if (!discovered.validation_whitelist || !discovered.mobile_registry_types) {
      test.info().annotations.push({
        type: 'skip',
        description: 'discovered.json missing validation_whitelist or mobile_registry_types. Re-run discovery.',
      });
      return;
    }

    const vw = discovered.validation_whitelist as { types: string[]; legacy_map: Record<string, string> };
    const validationTypes = vw.types;
    const legacyMap = vw.legacy_map;

    const mobileRegistryTypes = discovered.mobile_registry_types as string[];

    // Normalize mobile types to lowercase for case-insensitive matching
    const mobileSet = new Set(mobileRegistryTypes.map((t: string) => t.toLowerCase()));

    // Check every backend validation type exists in mobile registry
    const missing: string[] = [];
    for (const vType of validationTypes) {
      const vLower = vType.toLowerCase();

      // Direct match (case-insensitive)
      if (mobileSet.has(vLower)) continue;

      // Legacy map: check if legacy_map maps TO this type,
      // and the legacy key exists as a mobile registry entry
      const legacyEntry = Object.entries(legacyMap).find(
        ([, mappedTo]) => mappedTo.toLowerCase() === vLower,
      );
      if (legacyEntry && mobileSet.has(legacyEntry[0].toLowerCase())) continue;

      missing.push(vType);
    }

    expect(
      missing,
      missing.length > 0
        ? `Backend validation type(s) not found in mobile component registry (case-insensitive): ${missing.join(', ')}`
        : 'All backend validation types exist in mobile component registry',
    ).toEqual([]);
  });

  // ── Existing: validation/DB/mobile/web registry consistency ────────────
  // (updated: console.log → test.info())
  test('validation whitelist, DB seed, mobile registry, and web registry are consistent', async () => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));

    // Guard: the discovery script must have been re-run after discover.cjs gained
    // validation_whitelist / mobile_registry_types support (around May 2026).
    if (!discovered.validation_whitelist || !discovered.mobile_registry_types) {
      test.info().annotations.push({
        type: 'skip',
        description: 'discovered.json missing validation_whitelist or mobile_registry_types. Re-run discovery.',
      });
      return;
    }

    const vw = discovered.validation_whitelist as { types: string[]; legacy_map: Record<string, string> };
    const validationTypes = vw.types;
    const validationLegacyMap = vw.legacy_map;

    const dbComponents = (discovered.components ?? []) as any[];
    const mobileRegistryTypes = discovered.mobile_registry_types as string[];

    // ---- Parse web registry from source ----
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');
    const webTypes = [
      ...extractTypesFromArray(typesSrc, 'READ_ONLY_RUNTIME_COMPONENTS'),
      ...extractTypesFromArray(typesSrc, 'COMPONENT_REGISTRY'),
    ];

    // ---- Normalize all sets to lowercase ----
    const toLower = (s: string) => s.toLowerCase();
    const validationSet = new Set(validationTypes.map(toLower));
    const dbSet = new Set(dbComponents.map((c: any) => toLower(c.type || c.name)));
    const mobileSet = new Set(mobileRegistryTypes.map(toLower));
    const webSet = new Set(webTypes.map(toLower));

    // ---- Helper: check if a lowercase type maps through legacy_map to a target set ----
    const mapsThroughLegacy = (typeLower: string, targetSet: Set<string>): boolean => {
      const matchedKey = Object.keys(validationLegacyMap).find(
        (k) => k.toLowerCase() === typeLower,
      );
      if (!matchedKey) return false;
      return targetSet.has(validationLegacyMap[matchedKey].toLowerCase());
    };

    // ---- Compute discrepancies ----
    const inValidationNotInDB = [...validationSet].filter((t) => !dbSet.has(t));
    const inDBNotInValidation = [...dbSet].filter((t) => !validationSet.has(t));
    const inValidationNotInMobile = [...validationSet].filter((t) => !mobileSet.has(t));
    const inMobileNotInValidation = [...mobileSet].filter((t) => !validationSet.has(t));
    const inWebNotInValidation = [...webSet].filter((t) => !validationSet.has(t));
    const inValidationNotInWeb = [...validationSet].filter((t) => !webSet.has(t));

    // ---- Expected drift allowlist ----
    // These are known inconsistencies that are expected due to backward compatibility
    const EXPECTED_DRIFT = {
      // DB seed has lowercase/snake_case duplicates for backward compat
      // Divider removed from COMPONENT_REGISTRY — DB seed preserves lowercase for existing screens
      dbLowercaseDuplicates: ['calendar', 'chat', 'notes', 'inputbar', 'divider'],
      // DB seed has snake_case variants that need legacy mappings (known gap)
      dbSnakeCaseVariants: ['article_card', 'rich_text_renderer'],
      // Mobile has PascalCase module aliases
      mobileModuleAliases: ['todomodule', 'articlecardmodule'],
      // Mobile has snake_case renderer aliases and backward-compat Divider
      mobileRendererAliases: ['richtextrenderer', 'article_card', 'rich_text_renderer', 'divider'],
      // Web has read-only runtime types not in validation whitelist by design
      // Divider is being removed as a standalone component — may be removed from backend before web
      webReadOnly: ['icon_button', 'spacer', 'card', 'list', 'form', 'list_item', 'alert', 'badge', 'stat', 'stats_row', 'progress', 'richtextrenderer', 'divider'],
    };

    // ---- Filter unexpected drift ----
    const unexpectedDbTypes = inDBNotInValidation.filter(
      (t) => !EXPECTED_DRIFT.dbLowercaseDuplicates.includes(t)
          && !EXPECTED_DRIFT.dbSnakeCaseVariants.includes(t)
          && !mapsThroughLegacy(t, validationSet),
    );

    const unexpectedMobileTypes = inMobileNotInValidation.filter(
      (t) => !EXPECTED_DRIFT.mobileModuleAliases.includes(t)
          && !EXPECTED_DRIFT.mobileRendererAliases.includes(t)
          && !mapsThroughLegacy(t, validationSet),
    );

    const unexpectedWebTypes = inWebNotInValidation.filter(
      (t) => !EXPECTED_DRIFT.webReadOnly.includes(t)
          && !mapsThroughLegacy(t, validationSet),
    );

    // ---- Log informational discrepancies ----
    test.info().annotations.push({ type: 'info', description: `Validation: ${validationTypes.length} types` });
    test.info().annotations.push({ type: 'info', description: `DB seed: ${dbComponents.length} components` });
    test.info().annotations.push({ type: 'info', description: `Mobile registry: ${mobileRegistryTypes.length} types` });
    test.info().annotations.push({ type: 'info', description: `Web registry: ${webTypes.length} types` });

    if (inValidationNotInDB.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Validation types NOT in DB seed: ${inValidationNotInDB.join(', ')}` });
    }
    if (inValidationNotInMobile.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Validation types NOT in mobile registry: ${inValidationNotInMobile.join(', ')}` });
    }
    if (inValidationNotInWeb.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Validation types NOT in web registry: ${inValidationNotInWeb.join(', ')}` });
    }
    if (inDBNotInValidation.length > 0) {
      test.info().annotations.push({ type: 'info', description: `DB seed types NOT in validation: ${inDBNotInValidation.join(', ')}` });
    }
    if (inMobileNotInValidation.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Mobile registry types NOT in validation: ${inMobileNotInValidation.join(', ')}` });
    }
    if (inWebNotInValidation.length > 0) {
      test.info().annotations.push({ type: 'info', description: `Web registry types NOT in validation: ${inWebNotInValidation.join(', ')}` });
    }

    // ---- Assert unexpected drift is empty ----
    const failures: string[] = [];
    if (unexpectedDbTypes.length > 0) {
      failures.push(`DB seed types not in validation whitelist (unexpected): ${unexpectedDbTypes.join(', ')}`);
    }
    if (unexpectedMobileTypes.length > 0) {
      failures.push(`Mobile registry types not in validation whitelist (unexpected): ${unexpectedMobileTypes.join(', ')}`);
    }
    if (unexpectedWebTypes.length > 0) {
      failures.push(`Web registry types not in validation whitelist (unexpected): ${unexpectedWebTypes.join(', ')}`);
    }

    expect(
      failures,
      failures.length > 0 ? failures.join('\n') : 'All component registries are consistent',
    ).toEqual([]);
  });
});
