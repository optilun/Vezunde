import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PATIENT_EMAIL_VERIFICATION_CODE_TTL_MS,
  PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION,
  PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS,
  canAttemptPatientEmailVerification,
  createPatientVerificationCode,
  patientEmailVerificationState,
  validPatientVerificationCode,
} from '../../shared/patientEmailVerificationPolicy.js';
import {
  acquirePatientEmailVerificationLock,
  releasePatientEmailVerificationLock,
} from '../../shared/patientEmailVerificationLock.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeResumeUrl(value) {
  const raw = clean(value, 2000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowedHost = host === 'viasee.ro'
      || host === 'www.viasee.ro'
      || host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.base44.app');
    const localHttp = (host === 'localhost' || host === '127.0.0.1') && url.protocol === 'http:';
    if (!allowedHost || (url.protocol !== 'https:' && !localHttp)) return '';
    if (url.pathname !== '/cerere' || !url.searchParams.get('ref')) return '';
    const accessToken = new URLSearchParams(url.hash.replace(/^#/, '')).get('access') || '';
    if (!accessToken) return '';
    return url.toString();
  } catch (_error) {
    return '';
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

async function authorizeRequest(svc, requestId, accessToken) {
  const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
  if (!request) return { error: 'Cererea nu a fost gasita.', status: 404 };
  const tokenHash = await sha256(accessToken);
  const contacts = await svc.entities.PatientRequestContact.filter({
    request_id: requestId,
    access_token_hash: tokenHash,
    status: 'active',
  }, null, 2);
  const contact = contacts[0];
  if (!contact) return { error: 'Accesul la cerere nu este valid.', status: 403 };
  return { request, contact };
}

async function reloadContact(svc, contactId) {
  return svc.entities.PatientRequestContact.get(contactId).catch(() => null);
}

function verificationEmail({ code, publicReference, resumeUrl }) {
  const lines = [
    'Buna ziua,',
    '',
    'Foloseste codul de mai jos pentru a confirma adresa de email asociata cererii tale VIASEE:',
    '',
    code,
    '',
    'Codul este valabil 15 minute.',
  ];
  if (resumeUrl) {
    lines.push(
      '',
      'Poti reveni la cerere de pe orice dispozitiv folosind linkul securizat:',
      resumeUrl,
      '',
      'Linkul contine cheia privata de acces. Nu il publica si nu il transmite unei persoane necunoscute.',
    );
  }
  lines.push(
    '',
    'Nu transmite codul unei alte persoane. VIASEE nu iti va cere codul prin telefon sau chat.',
    '',
    'Echipa VIASEE',
  );
  return {
    subject: `Cod de verificare VIASEE${publicReference ? ` - ${publicReference}` : ''}`,
    body: lines.join('\n'),
  };
}

async function sendCode(base44, svc, request, contact, accessToken, resumeUrl) {
  const lock = await acquirePatientEmailVerificationLock(svc, contact.id);
  if (!lock) return { error: 'Verificarea emailului este actualizata in alta sesiune. Reincearca.', status: 409 };
  try {
    const checked = await reloadContact(svc, contact.id);
    if (!checked || checked.status !== 'active') return { error: 'Datele de contact nu mai sunt active.', status: 409 };
    const state = patientEmailVerificationState(checked);
    if (!clean(checked.contact_email, 254)) {
      return { error: 'Aceasta cerere nu are o adresa de email asociata.', status: 409, state };
    }
    if (state.verified) return { state, idempotent_replay: true };
    if (!state.can_resend) {
      return { error: 'Un cod a fost trimis recent. Asteapta inainte sa soliciti altul.', status: 429, state };
    }

    const code = createPatientVerificationCode();
    const verificationHash = await sha256(`${request.id}:${accessToken}:${code}`);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PATIENT_EMAIL_VERIFICATION_CODE_TTL_MS).toISOString();
    await svc.entities.PatientRequestContact.update(checked.id, {
      contact_email_verified: false,
      contact_email_verification_hash: verificationHash,
      contact_email_verification_expires_at: expiresAt,
      contact_email_verification_attempts: 0,
      contact_email_verification_sent_at: now.toISOString(),
      contact_email_verification_delivery_status: 'pending',
      contact_email_verification_provider: 'base44',
      contact_email_verification_error: '',
    });

    const email = verificationEmail({
      code,
      publicReference: request.public_reference || '',
      resumeUrl,
    });
    try {
      await base44.integrations.Core.SendEmail({
        to: checked.contact_email,
        subject: email.subject,
        body: email.body,
        from_name: 'VIASEE',
      });
      const updated = await svc.entities.PatientRequestContact.update(checked.id, {
        contact_email_verification_delivery_status: 'sent',
        contact_email_verification_provider: 'base44',
        contact_email_verification_error: '',
      });
      return { state: patientEmailVerificationState(updated), idempotent_replay: false };
    } catch (deliveryError) {
      const updated = await svc.entities.PatientRequestContact.update(checked.id, {
        contact_email_verification_delivery_status: 'failed',
        contact_email_verification_provider: 'base44',
        contact_email_verification_error: clean(deliveryError?.message || 'Trimiterea codului a esuat.'),
      });
      return {
        error: 'Codul nu a putut fi trimis. Reincearca mai tarziu.',
        status: 502,
        state: patientEmailVerificationState(updated),
      };
    }
  } finally {
    await releasePatientEmailVerificationLock(svc, lock);
  }
}

async function verifyCode(svc, request, contact, accessToken, submittedCode) {
  if (!validPatientVerificationCode(submittedCode)) {
    return { error: 'Introdu un cod valid de 6 cifre.', status: 400 };
  }
  const lock = await acquirePatientEmailVerificationLock(svc, contact.id);
  if (!lock) return { error: 'Verificarea emailului este actualizata in alta sesiune. Reincearca.', status: 409 };
  try {
    const checked = await reloadContact(svc, contact.id);
    if (!checked || checked.status !== 'active') return { error: 'Datele de contact nu mai sunt active.', status: 409 };
    const state = patientEmailVerificationState(checked);
    if (!clean(checked.contact_email, 254)) {
      return { error: 'Aceasta cerere nu are o adresa de email asociata.', status: 409, state };
    }
    if (state.verified) return { state, idempotent_replay: true };
    if (!canAttemptPatientEmailVerification(checked)) {
      const message = state.attempts >= PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS
        ? 'Ai depasit numarul de incercari. Solicita un cod nou.'
        : state.code_expired
          ? 'Codul a expirat. Solicita un cod nou.'
          : 'Solicita mai intai un cod de verificare.';
      return { error: message, status: 409, state };
    }

    const submittedHash = await sha256(`${request.id}:${accessToken}:${submittedCode}`);
    if (!safeEqual(submittedHash, checked.contact_email_verification_hash)) {
      const attempts = Math.min(
        PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS,
        (Number(checked.contact_email_verification_attempts) || 0) + 1,
      );
      const updated = await svc.entities.PatientRequestContact.update(checked.id, {
        contact_email_verification_attempts: attempts,
        contact_email_verification_error: 'Cod incorect.',
      });
      return {
        error: attempts >= PATIENT_EMAIL_VERIFICATION_MAX_ATTEMPTS
          ? 'Cod incorect. Ai depasit numarul de incercari; solicita un cod nou.'
          : 'Codul introdus nu este corect.',
        status: 400,
        state: patientEmailVerificationState(updated),
      };
    }

    const now = new Date().toISOString();
    const updated = await svc.entities.PatientRequestContact.update(checked.id, {
      contact_email_verified: true,
      contact_email_verified_at: now,
      contact_email_verification_hash: '',
      contact_email_verification_attempts: 0,
      contact_email_verification_delivery_status: 'verified',
      contact_email_verification_error: '',
    });
    return { state: patientEmailVerificationState(updated), idempotent_replay: false };
  } finally {
    await releasePatientEmailVerificationLock(svc, lock);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'status', 40);
    const requestId = clean(input.request_id, 120);
    const accessToken = clean(input.request_access_token, 160);
    if (!requestId || !accessToken) return res({ error: 'request_id si tokenul de acces sunt obligatorii.' }, 400);

    const authorized = await authorizeRequest(svc, requestId, accessToken);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    if (action === 'status') {
      return res({
        contract_version: PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION,
        verification: patientEmailVerificationState(authorized.contact),
      });
    }
    if (action === 'send_code') {
      const result = await sendCode(
        base44,
        svc,
        authorized.request,
        authorized.contact,
        accessToken,
        safeResumeUrl(input.resume_url),
      );
      if (result.error) return res({ error: result.error, verification: result.state || null }, result.status);
      return res({
        contract_version: PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION,
        verification: result.state,
        idempotent_replay: result.idempotent_replay === true,
      });
    }
    if (action === 'verify_code') {
      const result = await verifyCode(
        svc,
        authorized.request,
        authorized.contact,
        accessToken,
        clean(input.code, 12),
      );
      if (result.error) return res({ error: result.error, verification: result.state || null }, result.status);
      return res({
        contract_version: PATIENT_EMAIL_VERIFICATION_CONTRACT_VERSION,
        verification: result.state,
        idempotent_replay: result.idempotent_replay === true,
      });
    }
    return res({ error: 'Actiune necunoscuta.' }, 400);
  } catch (_error) {
    return res({ error: 'Verificarea emailului nu a putut fi procesata.' }, 500);
  }
});
