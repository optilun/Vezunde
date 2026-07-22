export const PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION = 'patient-email-verification-v1';
export const PATIENT_EMAIL_VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
export const PATIENT_EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;

function clean(value, maxLength = 254) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizePatientEmail(value) {
  return clean(value).toLowerCase();
}

export function maskPatientEmail(value) {
  const [local, domain] = normalizePatientEmail(value).split('@');
  if (!local || !domain) return '';
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function validPatientVerificationCode(value) {
  return /^\d{6}$/.test(clean(value, 12));
}

export function createPatientVerificationCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
}

function parsedTime(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function patientEmailVerificationState(contact, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const sentAt = parsedTime(contact?.contact_email_verification_sent_at);
  const expiresAt = parsedTime(contact?.contact_email_verification_expires_at);
  const attempts = Math.max(0, Number(contact?.contact_email_verification_attempts) || 0);
  const verified = contact?.contact_email_verified === true;
  const canResendAtMs = sentAt === null ? safeNow : sentAt + PATIENT_EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;

  return {
    contract_version: PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION,
    email_masked: maskPatientEmail(contact?.contact_email),
    verified,
    verified_at: verified ? (contact?.contact_email_verified_at || null) : null,
    delivery_status: verified ? 'verified' : (clean(contact?.contact_email_verification_delivery_status, 40) || 'not_sent'),
    attempts,
    attempts_remaining: Math.max(0, PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS - attempts),
    code_expires_at: !verified && expiresAt !== null ? new Date(expiresAt).toISOString() : null,
    code_expired: !verified && expiresAt !== null && expiresAt <= safeNow,
    can_resend_at: new Date(canResendAtMs).toISOString(),
    can_resend: !verified && canResendAtMs <= safeNow,
  };
}

export function canAttemptPatientEmailVerification(contact, now = new Date()) {
  const state = patientEmailVerificationState(contact, now);
  return !state.verified
    && state.delivery_status === 'sent'
    && !state.code_expired
    && state.attempts < PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS;
}
