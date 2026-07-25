import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  detectProhibitedPatientConversationOutput,
  redactPatientConversationText,
} from '../shared/patientConversationGuardrails.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationGuardrails.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationGuardrails.js', import.meta.url),
  'utf8',
);
assert.equal(sharedSource, base44Source);

for (const phone of [
  '0722 123 456',
  '+40 722 123 456',
  '+40 (722) 123 456',
  '0040 722 123 456',
  '+40 (0) 722 123 456',
  '(0722) 123 456',
  '021 123 4567',
  '+40 21 123 4567',
  '031.123.4567',
]) {
  const redacted = redactPatientConversationText(`Suna la ${phone}.`);
  assert(redacted.includes('[telefon eliminat]'), phone);
  assert.equal(redacted.includes(phone), false, phone);
  assert(
    detectProhibitedPatientConversationOutput({ value: `Suna la ${phone}.` })
      .includes('contact_details_without_consent'),
    phone,
  );
}

for (const safeText of [
  'OCT 2026',
  'presiune 21.5',
  'ora 17:30',
  'varsta 30 ani',
  'cod intern 12345678',
]) {
  assert.equal(redactPatientConversationText(safeText), safeText);
}

assert.equal(
  redactPatientConversationText('Email test@example.com si CNP 1234567890123.'),
  'Email [email eliminat] si CNP [identificator eliminat].',
);

console.log('Patient conversation privacy redaction formats verified.');
