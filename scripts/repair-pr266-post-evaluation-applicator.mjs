import fs from 'node:fs';

const path = 'scripts/apply-pr266-post-evaluation-patch.mjs';
const source = fs.readFileSync(path, 'utf8');
const repairedTarget = `for (const relativePath of [
  'shared/patientConversationEvaluation.js',
]) {`;

if (source.includes(repairedTarget)) {
  console.log('PR266 post-evaluation applicator already targets the canonical evaluator only.');
  process.exit(0);
}

const pattern = /for \(const relativePath of \[\r?\n\s*'shared\/patientConversationEvaluation\.js',\r?\n\s*'base44\/shared\/patientConversationEvaluation\.js',\r?\n\s*\]\) \{/;
const next = source.replace(pattern, repairedTarget);

if (next === source || !next.includes(repairedTarget)) {
  throw new Error('Expected evaluator target list was not found in the PR266 applicator.');
}

fs.writeFileSync(path, next);
console.log('Removed the nonexistent Base44 evaluator copy from the PR266 applicator.');
