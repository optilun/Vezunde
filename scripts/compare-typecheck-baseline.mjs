import fs from 'node:fs';

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error('Usage: node scripts/compare-typecheck-baseline.mjs <base.log> <head.log>');
  process.exit(2);
}

const errorPattern = /^(.+?)\(\d+,\d+\): error (TS\d+): (.+)$/;

function readErrors(filePath) {
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const errors = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(errorPattern);
    if (!match) continue;
    const normalizedFile = match[1].replaceAll('\\', '/').replace(/^.*\/Vezunde\//, '');
    errors.push({
      key: `${normalizedFile}|${match[2]}|${match[3]}`,
      line,
    });
  }
  return errors;
}

const baseErrors = new Set(readErrors(basePath).map((error) => error.key));
const headErrors = readErrors(headPath);
const newErrors = headErrors.filter((error) => !baseErrors.has(error.key));

if (newErrors.length > 0) {
  console.error(`Au aparut ${newErrors.length} erori TypeScript noi fata de main:`);
  for (const error of newErrors) console.error(error.line);
  process.exit(1);
}

console.log(`Nu exista erori TypeScript noi fata de main. Erori existente in head: ${headErrors.length}.`);
