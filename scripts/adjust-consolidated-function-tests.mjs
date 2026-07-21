import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const routingFile = path.join(ROOT, 'src', 'api', 'base44FunctionRouting.js');
if (!fs.existsSync(routingFile)) process.exit(0);

const routingText = fs.readFileSync(routingFile, 'utf8');
const routeMatch = routingText.match(/export const BASE44_FUNCTION_ROUTES\s*=\s*(\{[\s\S]*?\});/);
const routes = routeMatch ? JSON.parse(routeMatch[1]) : {};
const consolidatedNames = new Set([...Object.keys(routes), ...Object.values(routes)]);
const scriptsDir = path.join(ROOT, 'scripts');
let changedFiles = 0;

for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(?:mjs|js)$/.test(entry.name)) continue;
  const file = path.join(scriptsDir, entry.name);
  const original = fs.readFileSync(file, 'utf8');
  let next = original;
  for (const name of consolidatedNames) {
    next = next
      .replaceAll(`../base44/functions/${name}/entry.ts`, `../base44/function_modules/${name}.ts`)
      .replaceAll(`base44/functions/${name}/entry.ts`, `base44/function_modules/${name}.ts`);
  }
  if (next !== original) {
    fs.writeFileSync(file, next);
    changedFiles += 1;
  }
}

console.log(`Regression paths adjusted in ${changedFiles} files.`);
