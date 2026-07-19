import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_EMAIL_VERIFICATION_CODE_TTL_MS,
  PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION,
  PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS,
  PATIENT_EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  canAttemptPatientEmailVerification,
  createPatientVerificationCode,
  maskPatientEmail,
  patientEmailVerificationState,
  validPatientVerificationCode,
} from '../shared/patientEmailVerificationPolicy.js';
import {
  acquirePatientEmailVerificationLock,
  releasePatientEmailVerificationLock,
} from '../shared/patientEmailVerificationLock.js';

assert.equal(PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION, 'patient-email-verification-v1');
assert.equal(PATIENT_EMAIL_VERIFICATION_CODE_TTL_MS, 15 * 60 * 1000);
assert.equal(PATIENT_EMAIL_VERIFICATION_RESEND_COOLDOWN_MS, 60 * 1000);
assert.equal(PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS, 5);
assert.equal(maskPatientEmail('client@example.com'), 'cl***@example.com');
assert.equal(maskPatientEmail('a@example.com'), 'a***@example.com');
assert.equal(maskPatientEmail(''), '');
assert.equal(validPatientVerificationCode('123456'), true);
assert.equal(validPatientVerificationCode('12345'), false);
for (let index = 0; index < 20; index += 1) assert.match(createPatientVerificationCode(), /^\d{6}$/);

const now = new Date('2026-07-19T12:00:00.000Z');
const notSent = patientEmailVerificationState({ contact_email: 'client@example.com' }, now);
assert.equal(notSent.verified, false);
assert.equal(notSent.delivery_status, 'not_sent');
assert.equal(notSent.can_resend, true);

const sent = patientEmailVerificationState({
  contact_email: 'client@example.com',
  contact_email_verification_delivery_status: 'sent',
  contact_email_verification_sent_at: '2026-07-19T11:59:30.000Z',
  contact_email_verification_expires_at: '2026-07-19T12:14:30.000Z',
  contact_email_verification_attempts: 2,
}, now);
assert.equal(sent.can_resend, false);
assert.equal(sent.code_expired, false);
assert.equal(sent.attempts_remaining, 3);
assert.equal(canAttemptPatientEmailVerification({
  contact_email_verification_delivery_status: 'sent',
  contact_email_verification_expires_at: '2026-07-19T12:14:30.000Z',
  contact_email_verification_attempts: 2,
}, now), true);

let lockToken = '';
const mockSvc = {
  entities: {
    PatientRequestContact: {
      async updateMany(query, update) {
        if (update.$set) {
          if (lockToken) return { updated: 0 };
          lockToken = update.$set.email_verification_lock_token;
          return { updated: 1 };
        }
        if (update.$unset && query.email_verification_lock_token === lockToken) {
          lockToken = '';
          return { updated: 1 };
        }
        return { updated: 0 };
      },
    },
  },
};
const [firstLock, secondLock] = await Promise.all([
  acquirePatientEmailVerificationLock(mockSvc, 'contact-1'),
  acquirePatientEmailVerificationLock(mockSvc, 'contact-1'),
]);
assert.equal([firstLock, secondLock].filter(Boolean).length, 1);
assert.equal(await releasePatientEmailVerificationLock(mockSvc, firstLock || secondLock), true);

const contactSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequestContact.jsonc', import.meta.url), 'utf8'));
assert.equal(contactSchema.rls.read.user_condition.role, 'admin');
assert.ok(contactSchema.properties.contact_email_verification_hash);
assert.ok(contactSchema.properties.contact_email_verification_expires_at);
assert.ok(contactSchema.properties.contact_email_verification_attempts);
assert.ok(contactSchema.properties.contact_email_verification_sent_at);
assert.ok(contactSchema.properties.email_verification_lock_token);
assert.equal(contactSchema.required.includes('contact_email'), false);
assert.equal(contactSchema.properties.contact_email_verification_code, undefined);

const backend = await readFile(new URL('../base44/functions/patientRequestEmailVerificationOps/entry.ts', import.meta.url), 'utf8');
const approvalBackend = await readFile(new URL('../base44/functions/managePatientContactShareApproval/entry.ts', import.meta.url), 'utf8');
const statusBackend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/intake2/PatientRequestEmailVerification.jsx', import.meta.url), 'utf8');
const responseComponent = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');
const chatComponent = await readFile(new URL('../src/components/intake2/PatientRequestChat.jsx', import.meta.url), 'utf8');
const submission = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');

assert.match(backend, /sha256\(accessToken\)/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /createPatientVerificationCode/);
assert.match(backend, /Core\.SendEmail/);
assert.match(backend, /contact_email_verified: true/);
assert.match(backend, /Aceasta cerere nu are o adresa de email asociata/);
assert.match(backend, /!clean\(checked\.contact_email, 254\)/);
assert.doesNotMatch(backend, /input\.contact_email|input\.email/);
assert.doesNotMatch(backend, /verification_code:|contact_email_verification_code/);

assert.doesNotMatch(approvalBackend, /contact_email_verified !== true/);
assert.doesNotMatch(approvalBackend, /Confirma mai intai adresa de email/);
assert.match(approvalBackend, /contact_phone/);
assert.match(statusBackend, /contact_email_verified:/);
assert.match(statusBackend, /contact_email_masked: maskPatientEmail/);
assert.doesNotMatch(statusBackend, /contact_email:/);

assert.match(client, /patientRequestEmailVerification/);
assert.match(component, /send_code/);
assert.match(component, /verify_code/);
assert.match(component, /autoComplete="one-time-code"/);
assert.match(component, /Email confirmat/);
assert.match(component, /locațiilor Pro din Top 3/);
assert.doesNotMatch(component, /contact_phone/);
assert.match(responseComponent, /controlezi separat telefonul și deschiderea chatului/);
assert.match(responseComponent, /<PatientRequestChat/);
assert.match(chatComponent, /Nu introduce telefon, email sau linkuri/);
assert.match(submission, /import PatientRequestEmailVerification/);
assert.match(submission, /hasEmail \?/);
assert.match(submission, /onVerified=\{setEmailVerified\}/);
assert.match(submission, /Poți trimite cererea și înainte de confirmarea emailului/);

console.log('Optional patient email verification and controlled chat checks passed.');
