import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const entrypoints = ['src/main.jsx'];
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css'];
const failOnFound = process.argv.includes('--fail');
const jsonOutput = process.argv.includes('--json');

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }
    if (extensions.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeRelative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function importSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) specifiers.add(match[1]);
  }
  return [...specifiers];
}

async function resolveLocalImport(importer, specifier) {
  if (!specifier || specifier.startsWith('http:') || specifier.startsWith('https:')) return null;

  let basePath;
  if (specifier.startsWith('@/')) {
    basePath = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(importer), specifier);
  } else {
    return null;
  }

  const candidates = [];
  if (path.extname(basePath)) candidates.push(basePath);
  else {
    candidates.push(basePath);
    for (const extension of extensions) candidates.push(`${basePath}${extension}`);
    for (const extension of extensions) candidates.push(path.join(basePath, `index${extension}`));
  }

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

const allFiles = await collectFiles(sourceRoot);
const allSet = new Set(allFiles.map((filePath) => path.resolve(filePath)));
const reachable = new Set();
const unresolved = [];
const queue = entrypoints.map((entry) => path.resolve(root, entry));

while (queue.length > 0) {
  const current = queue.shift();
  if (!current || reachable.has(current) || !allSet.has(current)) continue;
  reachable.add(current);

  const source = await readFile(current, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    const resolved = await resolveLocalImport(current, specifier);
    if (resolved && allSet.has(path.resolve(resolved))) {
      queue.push(path.resolve(resolved));
    } else if ((specifier.startsWith('.') || specifier.startsWith('@/')) && !resolved) {
      unresolved.push({ importer: normalizeRelative(current), specifier });
    }
  }
}

const unreachable = [...allSet]
  .filter((filePath) => !reachable.has(filePath))
  .map(normalizeRelative)
  .sort();
const result = {
  scanned: allSet.size,
  reachable: reachable.size,
  unreachable,
  unresolved,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Frontend dead-code audit: ${result.reachable}/${result.scanned} fisiere accesibile din ${entrypoints.join(', ')}.`);
  if (unresolved.length > 0) {
    console.log('\nImporturi locale nerezolvate:');
    for (const item of unresolved) console.log(`- ${item.importer}: ${item.specifier}`);
  }
  if (unreachable.length > 0) {
    console.log('\nCandidati neaccesibili din entrypoint:');
    for (const filePath of unreachable) console.log(`- ${filePath}`);
  } else {
    console.log('\nNu au fost gasiti candidati frontend neaccesibili.');
  }
}

if (failOnFound && (unreachable.length > 0 || unresolved.length > 0)) process.exitCode = 1;
