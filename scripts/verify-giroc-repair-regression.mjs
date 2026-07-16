import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INTENTS } from '../src/lib/intentRegistry.js';
import {
  GENERIC_REPAIR_MATCHING_POLICY,
  getGenericRepairEligibility,
} from '../base44/functions/matchProvidersSemantic/genericRepairPolicy.js';

const damageQuestion = INTENTS.reparatii_ochelari.questions.find((question) => question.key === 'ce_deteriorat');
const brokenFrame = damageQuestion?.options?.find((option) => option.key === 'rama_rupta');

assert.ok(brokenFrame, 'Optiunea Rama rupta trebuie sa existe.');
assert.deepEqual(
  brokenFrame.service_keys,
  ['frame_repair'],
  'Rama rupta trebuie sa ceara explicit reparatia ramei.',
);

assert.deepEqual(
  GENERIC_REPAIR_MATCHING_POLICY.service_keys,
  ['eyeglasses_repair', 'frame_repair'],
);
assert.equal(getGenericRepairEligibility({
  canonicalKey: 'frame_repair',
  confirmationLevel: 'provider_confirmed',
  exposeFullDetails: true,
}), true, 'Un profil administrat poate fi eligibil pentru reparatia generica confirmata.');
assert.equal(getGenericRepairEligibility({
  canonicalKey: 'eyeglasses_repair',
  confirmationLevel: 'vezunde_verified',
  exposeFullDetails: true,
}), true);
assert.equal(getGenericRepairEligibility({
  canonicalKey: 'frame_repair',
  confirmationLevel: 'not_confirmed',
  exposeFullDetails: true,
}), false, 'Serviciile neconfirmate nu devin eligibile.');
assert.equal(getGenericRepairEligibility({
  canonicalKey: 'frame_repair',
  confirmationLevel: 'provider_confirmed',
  exposeFullDetails: false,
}), false, 'Profilurile din director nu pot confirma reparatii.');
assert.equal(getGenericRepairEligibility({
  canonicalKey: 'metal_frame_soldering',
  confirmationLevel: 'provider_confirmed',
  exposeFullDetails: true,
}), null, 'Operatiunile tehnice specializate raman in motorul strict de prerequisite.');

const semanticEntry = await readFile(
  new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url),
  'utf8',
);
assert.match(semanticEntry, /getGenericRepairEligibility/);
assert.match(semanticEntry, /genericRepairResult !== null/);
assert.match(semanticEntry, /evaluateServicePrerequisites/);

console.log('Giroc frame repair regression checks passed.');
