const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BACKEND_BASE = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

function authHeaders(token) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function fetchJSON(url, token) {
  try {
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) return { _error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { _error: e.message };
  }
}

async function discoverEndpoints(token) {
  const data = await fetchJSON(`${BACKEND_BASE}/openapi.json`, token);
  if (data._error || !data.paths) return [];
  return Object.entries(data.paths).flatMap(([path_, methods]) =>
    Object.keys(methods)
      .filter((m) => /^(get|post|put|patch|delete)$/i.test(m))
      .map((method) => ({ method: method.toUpperCase(), path: path_ }))
  );
}

async function discoverComponents(token) {
  return await fetchJSON(`${BACKEND_BASE}/api/components/registry`, token);
}

async function discoverTemplates(token) {
  const resp = await fetchJSON(`${BACKEND_BASE}/api/templates?limit=100`, token);
  if (resp._error) return { items: [], full: [] };
  // Handle both paginated response { items: [...] } and plain array
  const items = Array.isArray(resp) ? resp : (resp.items || []);
  if (!items.length) return { items: [], full: [] };
  const full = await Promise.all(
    items.map(item => fetchJSON(`${BACKEND_BASE}/api/templates/${item.id}`, token))
  );
  return { items, full };
}

function discoverRoutes() {
  const appFile = path.join(ROOT, 'web', 'src', 'App.tsx');
  if (!fs.existsSync(appFile)) return [];
  const content = fs.readFileSync(appFile, 'utf-8');
  const matches = content.matchAll(/path=["']([^"']+)["']/g);
  return Array.from(matches, (m) => m[1]);
}

function discoverActions() {
  const filePath = path.join(ROOT, 'backend', 'app', 'services', 'action_registry.py');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = content.matchAll(/registry\.register\("([^"]+)"/g);
  return Array.from(matches, (m) => m[1]);
}

function discoverMobileComponents() {
  const dirs = ['sdui', 'atomic', 'composite', 'structural', 'common'];
  const result = {};
  for (const dir of dirs) {
    const dirPath = path.join(ROOT, 'mobile', 'src', 'components', dir);
    if (!fs.existsSync(dirPath)) {
      result[dir] = [];
      continue;
    }
    result[dir] = fs.readdirSync(dirPath)
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .map((f) => path.basename(f, path.extname(f)));
  }
  return result;
}

function discoverValidationWhitelist() {
  const filePath = path.join(ROOT, 'backend', 'app', 'mcp', 'tools.py');
  if (!fs.existsSync(filePath)) return { types: [], legacy_map: {} };
  const content = fs.readFileSync(filePath, 'utf-8');
  const types = [];
  const fsMatch = content.match(/_VALID_V2_COMPONENT_TYPES:\s*frozenset\[\s*str\s*\]\s*=\s*frozenset\(\{([^}]+)\}\)\s*$/m);
  if (fsMatch) {
    const strMatches = fsMatch[1].matchAll(/"([^"]+)"/g);
    for (const m of strMatches) types.push(m[1]);
  }
  const legacyMap = {};
  const mapMatch = content.match(/_LEGACY_V2_TYPE_MAP:\s*dict\[\s*str,\s*str\s*\]\s*=\s*\{([^}]+)\}/);
  if (mapMatch) {
    const kvMatches = mapMatch[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g);
    for (const m of kvMatches) legacyMap[m[1]] = m[2];
  }
  return { types, legacy_map: legacyMap };
}

function discoverMobileRegistry() {
  const filePath = path.join(ROOT, 'mobile', 'src', 'renderer', 'componentRegistry.ts');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const regMatch = content.match(/const\s+registry:\s*Record<string,\s*ComponentType<any>>\s*=\s*\{([\s\S]*?)\};/);
  if (!regMatch) return [];
  const keys = [];
  const keyMatches = regMatch[1].matchAll(/^\s*(\w+)\s*:/gm);
  for (const m of keyMatches) keys.push(m[1]);
  return keys;
}

function discoverWebRegistry() {
  const filePath = path.join(ROOT, 'web', 'src', 'editor', 'types.ts');
  if (!fs.existsSync(filePath)) return { all: [], authorable: [], readOnly: [] };
  const content = fs.readFileSync(filePath, 'utf-8');

  const readOnly = [];
  const roMatch = content.match(/const\s+READ_ONLY_RUNTIME_COMPONENTS:\s*ComponentDefinition\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (roMatch) {
    for (const m of roMatch[1].matchAll(/type:\s*'([^']+)'/g)) {
      readOnly.push(m[1]);
    }
  }

  const all = [];
  const nonAuthorable = new Set();
  const regMatch = content.match(/export\s+const\s+COMPONENT_REGISTRY:\s*ComponentDefinition\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (regMatch) {
    const registryContent = regMatch[1];
    for (const m of registryContent.matchAll(/type:\s*'([^']+)'/g)) {
      all.push(m[1]);
    }
    const typePositions = [...registryContent.matchAll(/type:\s*'([^']+)'/g)];
    for (let i = 0; i < typePositions.length; i++) {
      const typeName = typePositions[i][1];
      const start = typePositions[i].index;
      const end = i + 1 < typePositions.length ? typePositions[i + 1].index : registryContent.length;
      const entryText = registryContent.slice(start, end);
      if (entryText.includes('authorable: false')) {
        nonAuthorable.add(typeName);
      }
    }
  }

  for (const t of readOnly) {
    if (!all.includes(t)) all.push(t);
  }

  const authorable = all.filter((t) => !readOnly.includes(t) && !nonAuthorable.has(t));

  return { all, authorable, readOnly };
}

function discoverWebSchemas() {
  const filePath = path.join(ROOT, 'web', 'src', 'editor', 'componentSchemas.ts');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/COMPONENT_SCHEMAS:\s*Record<string,\s*FieldSchema\[\]>\s*=\s*\{([\s\S]*?)\};/);
  if (!match) return [];
  const keys = [];
  const lines = match[1].split('\n');
  let depth = 0;
  for (const line of lines) {
    const keyMatch = line.match(/^\s*(\w+)\s*:\s*\[/);
    if (keyMatch && depth === 0) {
      keys.push(keyMatch[1]);
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
  }
  return keys;
}

function discoverPreviewRenderers() {
  const filePath = path.join(ROOT, 'web', 'src', 'editor', 'EditorCanvas.tsx');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/const\s+PREVIEW_RENDERERS:\s*Record<string,\s*\(props:\s*any\)\s*=>\s*JSX\.Element>\s*=\s*\{([\s\S]*?)\};/);
  if (!match) return [];
  const keys = [];
  for (const m of match[1].matchAll(/^\s+(\w+)\s*:/gm)) {
    keys.push(m[1]);
  }
  return keys;
}

function discoverLocalTemplates() {
  const filePath = path.join(ROOT, 'web', 'src', 'editor', 'templateLibrary.ts');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const types = new Set();
  for (const m of content.matchAll(/createCell\('([^']+)',/g)) {
    types.add(m[1]);
  }
  return [...types].sort();
}

async function discover(token) {
  console.log('QA Discovery — scanning project...');

  const [endpoints, components, templates, routes, actions, mobile, validationWhitelist, mobileRegistry, webRegistry, webSchemas, webPreview, localTemplates] = await Promise.all([
    discoverEndpoints(token),
    discoverComponents(token),
    discoverTemplates(token),
    Promise.resolve(discoverRoutes()),
    Promise.resolve(discoverActions()),
    Promise.resolve(discoverMobileComponents()),
    Promise.resolve(discoverValidationWhitelist()),
    Promise.resolve(discoverMobileRegistry()),
    Promise.resolve(discoverWebRegistry()),
    Promise.resolve(discoverWebSchemas()),
    Promise.resolve(discoverPreviewRenderers()),
    Promise.resolve(discoverLocalTemplates()),
  ]);

  const output = {
    generated_at: new Date().toISOString(),
    backend_url: BACKEND_BASE,
    endpoints,
    components,
    templates,
    routes,
    actions,
    mobile_components: mobile,
    validation_whitelist: validationWhitelist,
    mobile_registry_types: mobileRegistry,
    web_registry_types: webRegistry,
    web_schema_types: webSchemas,
    web_preview_types: webPreview,
    local_template_types: localTemplates,
    summary: {
      total_endpoints: endpoints.length,
      total_routes: routes.length,
      total_actions: actions.length,
      total_templates: (templates.items || []).length,
      mobile_component_count: Object.values(mobile).reduce((s, a) => s + a.length, 0),
      validation_types: validationWhitelist.types.length,
      mobile_registry_types: mobileRegistry.length,
      web_registry_all: webRegistry.all.length,
      web_registry_authorable: webRegistry.authorable.length,
      web_registry_readOnly: webRegistry.readOnly.length,
      web_schema_types: webSchemas.length,
      web_preview_types: webPreview.length,
      local_template_types: localTemplates.length,
    },
  };

  const outputPath = path.join(__dirname, 'discovered.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Discovery complete — written to ${outputPath}`);
  console.log(`  Endpoints: ${output.summary.total_endpoints}`);
  console.log(`  Routes: ${output.summary.total_routes}`);
  console.log(`  Actions: ${output.summary.total_actions}`);
  console.log(`  Templates: ${output.summary.total_templates}`);
  console.log(`  Mobile components: ${output.summary.mobile_component_count}`);
  console.log(`  Valid types: ${output.summary.validation_types}`);
  console.log(`  Mobile registry types: ${output.summary.mobile_registry_types}`);
  console.log(`  Web registry (all): ${output.summary.web_registry_all}`);
  console.log(`  Web registry (authorable): ${output.summary.web_registry_authorable}`);
  console.log(`  Web registry (readOnly): ${output.summary.web_registry_readOnly}`);
  console.log(`  Web schema types: ${output.summary.web_schema_types}`);
  console.log(`  Web preview types: ${output.summary.web_preview_types}`);
  console.log(`  Local template types: ${output.summary.local_template_types}`);
}

module.exports = { discover };
