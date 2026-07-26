import fs from 'node:fs';

const path = 'scripts/apply-pr266-post-evaluation-patch.mjs';
const source = fs.readFileSync(path, 'utf8');
const before = `for (const relativePath of [
  'shared/patientConversationEvaluation.js',
  'base44/shared/patientConversationEvaluation.js',
]) {`;
const after = `for (const relativePath of [
  'shared/patientConversationEvaluation.js',
]) {`;

if (source.includes(after)) {
  console.log('PR266 post-evaluation applicator already targets the canonical evaluator only.');
  process.exit(0);
}

if (!source.includes(before)) {
  throw new Error('Expected evaluator target list was not found in the PR266 applicator.');
}

fs.writeFileSync(path, source.replace(before, after));
console.log('Removed the nonexistent Base44 evaluator copy from the PR266 applicator.');
