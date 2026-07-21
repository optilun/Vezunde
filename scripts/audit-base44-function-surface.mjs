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

const functionDirs = fs.existsSync(FUNCTIONS_ROOT)
  ? fs.readdirSync(FUNCTIONS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(FUNCTIONS_ROOT, entry.name, 'entry.ts')))
      .map((entry) => entry.name)
      .sort()
  : [];

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
const missingDirectories = referencedNames.filter((name) => !functionDirs.includes(name));
const unreferencedDirectories = functionDirs.filter((name) => !references.has(name));

const report = {
  generated_at: new Date().toISOString(),
  function_count: functionDirs.length,
  referenced_function_count: referencedNames.length,
  function_directories: functionDirs,
  referenced_functions: Object.fromEntries(referencedNames.map((name) => [name, [...references.get(name)].sort()])),
  missing_directories: missingDirectories,
  unreferenced_directories: unreferencedDirectories,
};

fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', 'base44-function-surface.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Base44 function directories: ${functionDirs.length}`);
console.log(`Statically referenced functions: ${referencedNames.length}`);
console.log('\nFUNCTION DIRECTORIES');
console.log(functionDirs.join('\n'));
console.log('\nREFERENCED FUNCTIONS');
for (const name of referencedNames) console.log(`${name}: ${[...references.get(name)].sort().join(', ')}`);
console.log('\nREFERENCED WITHOUT DIRECTORY');
console.log(missingDirectories.join('\n') || '(none)');
console.log('\nDIRECTORIES WITHOUT STATIC INVOCATION');
console.log(unreferencedDirectories.join('\n') || '(none)');

if (missingDirectories.length) process.exitCode = 1;
