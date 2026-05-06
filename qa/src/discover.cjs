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
  return await fetchJSON(`${BACKEND_BASE}/api/templates`, token);
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

async function discover(token) {
  console.log('QA Discovery — scanning project...');

  const [endpoints, components, templates, routes, actions, mobile] = await Promise.all([
    discoverEndpoints(token),
    discoverComponents(token),
    discoverTemplates(token),
    Promise.resolve(discoverRoutes()),
    Promise.resolve(discoverActions()),
    Promise.resolve(discoverMobileComponents()),
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
    summary: {
      total_endpoints: endpoints.length,
      total_routes: routes.length,
      total_actions: actions.length,
      mobile_component_count: Object.values(mobile).reduce((s, a) => s + a.length, 0),
    },
  };

  const outputPath = path.join(__dirname, 'discovered.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Discovery complete — written to ${outputPath}`);
  console.log(`  Endpoints: ${output.summary.total_endpoints}`);
  console.log(`  Routes: ${output.summary.total_routes}`);
  console.log(`  Actions: ${output.summary.total_actions}`);
  console.log(`  Mobile components: ${output.summary.mobile_component_count}`);
}

module.exports = { discover };
