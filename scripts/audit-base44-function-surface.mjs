import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS_ROOT = path.join(ROOT, 'base44', 'functions');
const SCAN_ROOTS = ['src', 'base44', 'shared', 'scripts'].map((part) => path.join(ROOT, part));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', 'artifacts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function readRouteMap() {
  const file = path.join(ROOT, 'src', 'api', 'base44FunctionRouting.js');
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/export const BASE44_FUNCTION_ROUTES\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return {};
  try { return JSON.parse(match[1]); } catch { return {}; }
}

const functionDirs = fs.existsSync(FUNCTIONS_ROOT)
  ? fs.readdirSync(FUNCTIONS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(FUNCTIONS_ROOT, entry.name, 'entry.ts')))
      .map((entry) => entry.name)
      .sort()
  : [];
const routeMap = readRouteMap();

const references = new Map();
const patterns = [
  /\.functions\s*\.\s*invoke\s*\(\s*['"]([^'"]+)['"]/g,
  /\bfunctions\s*\.\s*invoke\s*\(\s*['"]([^'"]+)['"]/g,
];

for (const file of SCAN_ROOTS.flatMap(walk)) {
  if (!/\.(?:js|jsx|mjs|ts|tsx)$/.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const name = match[1];
      const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
      if (!references.has(name)) references.set(name, new Set());
      references.get(name).add(rel);
    }
  }
}

const referencedNames = [...references.keys()].sort();
const available = (name) => functionDirs.includes(name) || Boolean(routeMap[name] && functionDirs.includes(routeMap[name]));
const missingDirectories = referencedNames.filter((name) => !available(name));
const invalidRoutes = Object.entries(routeMap).filter(([, router]) => !functionDirs.includes(router));
const directlyReferencedDirectories = new Set(referencedNames.map((name) => routeMap[name] || name));
const unreferencedDirectories = functionDirs.filter((name) => !directlyReferencedDirectories.has(name));

const report = {
  generated_at: new Date().toISOString(),
  function_count: functionDirs.length,
  route_count: Object.keys(routeMap).length,
  referenced_function_count: referencedNames.length,
  function_directories: functionDirs,
  function_routes: routeMap,
  referenced_functions: Object.fromEntries(referencedNames.map((name) => [name, [...references.get(name)].sort()])),
  missing_directories: missingDirectories,
  invalid_routes: invalidRoutes,
  unreferenced_directories: unreferencedDirectories,
};

fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', 'base44-function-surface.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Base44 function directories: ${functionDirs.length}`);
console.log(`Consolidated aliases: ${Object.keys(routeMap).length}`);
console.log(`Statically referenced functions: ${referencedNames.length}`);
console.log('\nREFERENCED WITHOUT FUNCTION OR ROUTE');
console.log(missingDirectories.join('\n') || '(none)');
console.log('\nINVALID ROUTES');
console.log(invalidRoutes.map(([name, router]) => `${name} -> ${router}`).join('\n') || '(none)');
console.log('\nDIRECTORIES WITHOUT STATIC INVOCATION');
console.log(unreferencedDirectories.join('\n') || '(none)');

if (routeMap && Object.keys(routeMap).length && functionDirs.length > 45) {
  console.error(`Function budget exceeded: ${functionDirs.length} > 45`);
  process.exitCode = 1;
}
if (missingDirectories.length || invalidRoutes.length) process.exitCode = 1;
