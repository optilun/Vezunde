// base44/shared/outreachEmailPolicy.js
// Logica pura pentru modulul de outreach email VIASEE (fara efecte Base44/retea, usor testabila).
// Portata din sistemul de outreach al Optilun (base44 app 6984db05b4843f9d480897e9,
// functiile sendOutreachCampaign/resendWebhook/outreachUnsubscribe), adaptata pentru VIASEE:
// - textul legal/motivul de trimitere e specific directorului VIASEE
// - linkurile de dezabonare trec prin functia umbrela `directoryOps` (?outreach_action=unsubscribe)
// - adaugat sendBatchViaResend pentru trimitere in loturi (folosit de outreachSendOps pe cron)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SUPPRESSED_STATUSES = new Set(['unsubscribed', 'bounced', 'invalid', 'complained']);
export const DEFAULT_FROM_EMAIL = 'contact@viasee.ro';
export const DEFAULT_FROM_NAME = 'VIASEE';
export const DEFAULT_WEBSITE = 'https://viasee.ro';

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email = '') {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function getDomain(email = '') {
  return normalizeEmail(email).split('@')[1] || '';
}

function splitEnvList(value = '') {
  return String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function getAllowedSenderDomains() {
  return [
    ...splitEnvList(Deno.env.get('OUTREACH_ALLOWED_SENDER_DOMAINS')),
    ...splitEnvList(Deno.env.get('RESEND_VERIFIED_DOMAINS')),
    'viasee.ro',
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

export function getAllowedSenderEmails() {
  return [
    ...splitEnvList(Deno.env.get('OUTREACH_ALLOWED_SENDER_EMAILS')),
    DEFAULT_FROM_EMAIL,
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

export function validateSenderEmail(fromEmail = DEFAULT_FROM_EMAIL) {
  const email = normalizeEmail(fromEmail || DEFAULT_FROM_EMAIL);
  if (!isValidEmail(email)) return { ok: false, email, error: 'Adresa expeditorului nu este valida.' };
  const domain = getDomain(email);
  const allowedEmails = getAllowedSenderEmails();
  const allowedDomains = getAllowedSenderDomains();
  const allowed = allowedEmails.includes(email) || allowedDomains.includes(domain);
  if (!allowed) {
    return {
      ok: false,
      email,
      error: 'Domeniul expeditorului nu este permis. Configureaza OUTREACH_ALLOWED_SENDER_DOMAINS / RESEND_VERIFIED_DOMAINS si verifica domeniul in Resend inainte de a trimite.',
    };
  }
  return { ok: true, email, domain };
}

export function getEmailStatus(contact) {
  const explicit = contact?.email_status;
  if (SUPPRESSED_STATUSES.has(explicit)) return explicit;
  if (SUPPRESSED_STATUSES.has(contact?.status)) return contact.status;
  return 'active';
}

export function isContactSuppressed(contact) {
  return SUPPRESSED_STATUSES.has(getEmailStatus(contact));
}

export function textToHtml(text = '') {
  if (String(text).includes('<')) return String(text);
  return String(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPermanentEmailError(status, errorText = '') {
  const text = String(errorText).toLowerCase();
  return status === 422 || status === 400
    || text.includes('invalid')
    || text.includes('not a valid email')
    || text.includes('hard bounce')
    || text.includes('permanent');
}

export function renderTemplateMergeFields(bodyHtml, contact = {}) {
  const name = contact.contact_name || contact.company_name || '';
  const company = contact.company_name || '';
  const city = contact.city || '';
  const county = contact.county || '';
  return String(bodyHtml || '')
    .replace(/\[NUME\]/g, name)
    .replace(/\[NAME\]/g, name)
    .replace(/\[FIRMA\]/g, company)
    .replace(/\[ORAS\]/g, city)
    .replace(/\[JUDET\]/g, county);
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const padded = String(input).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(input).length / 4) * 4, '=');
  return atob(padded);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(sig));
}

export function getUnsubscribeSecret() {
  return Deno.env.get('OUTREACH_UNSUBSCRIBE_SECRET') || '';
}

export function getPublicBaseUrl() {
  return String(Deno.env.get('OUTREACH_PUBLIC_BASE_URL') || Deno.env.get('PUBLIC_SITE_URL') || DEFAULT_WEBSITE).replace(/\/$/, '');
}

export function getUnsubscribeEndpointBaseUrl() {
  return String(Deno.env.get('OUTREACH_UNSUBSCRIBE_ENDPOINT') || `${getPublicBaseUrl()}/api/functions/directoryOps`).replace(/\/$/, '');
}

export async function createUnsubscribeToken(email, campaignId) {
  const secret = getUnsubscribeSecret();
  if (!secret) throw new Error('OUTREACH_UNSUBSCRIBE_SECRET nu este configurat. Nu se poate trimite email promotional fara token de dezabonare securizat.');
  const payload = {
    v: 1,
    e: normalizeEmail(email),
    cid: campaignId || null,
    iat: new Date().toISOString(),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = await signValue(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifyUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();
  if (!secret) throw new Error('OUTREACH_UNSUBSCRIBE_SECRET nu este configurat.');
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Token de dezabonare invalid.');
  const expected = await signValue(parts[0], secret);
  if (!timingSafeEqual(expected, parts[1])) throw new Error('Semnatura tokenului de dezabonare este invalida.');
  const payload = JSON.parse(base64UrlDecode(parts[0]));
  const email = normalizeEmail(payload.e || payload.email);
  if (!isValidEmail(email)) throw new Error('Email invalid in token.');
  return { email, campaign_id: payload.cid || payload.campaign_id || null, token_version: payload.v || 1 };
}

export async function buildUnsubscribeUrls(email, campaignId) {
  const token = await createUnsubscribeToken(email, campaignId);
  const publicUrl = `${getPublicBaseUrl()}/dezabonare?t=${encodeURIComponent(token)}`;
  const oneClickUrl = `${getUnsubscribeEndpointBaseUrl()}?outreach_action=unsubscribe&t=${encodeURIComponent(token)}`;
  return { token, publicUrl, oneClickUrl };
}

export function legalConfig() {
  return {
    brand: Deno.env.get('OUTREACH_BRAND_NAME') || 'VIASEE',
    legalCompany: Deno.env.get('OUTREACH_LEGAL_COMPANY_NAME') || 'VIASEE',
    contactEmail: Deno.env.get('OUTREACH_CONTACT_EMAIL') || DEFAULT_FROM_EMAIL,
    website: Deno.env.get('OUTREACH_WEBSITE') || DEFAULT_WEBSITE,
    reason: Deno.env.get('OUTREACH_REASON_TEXT')
      || 'Primesti acest email pentru ca adresa ta publica de contact apare in directorul national VIASEE, ca reprezentant al unei optici, clinici sau cabinet din domeniul sanatatii vizuale.',
  };
}

export function buildEmailHtml(bodyContent, unsubscribeHtml, campaignSubject = 'VIASEE') {
  const year = new Date().getFullYear();
  const legal = legalConfig();
  return '<!DOCTYPE html>'
    + '<html lang="ro"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'
    + `<title>${campaignSubject}</title></head>`
    + '<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#121212;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f1ea;padding:28px 14px;"><tr><td align="center">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;background:#ffffff;border:1px solid #e5ddd0;border-radius:14px;overflow:hidden;">'
    + '<tr><td style="padding:28px 30px 18px;border-bottom:1px solid #eee3d3;">'
    + `<span style="font-size:16px;font-weight:800;color:#121212;">${legal.brand}</span>`
    + `<h1 style="margin:22px 0 0;font-size:24px;line-height:1.28;color:#121212;font-weight:800;">${campaignSubject}</h1>`
    + '</td></tr>'
    + `<tr><td style="padding:26px 30px 8px;"><div style="font-size:15px;line-height:1.72;color:#2a2a2a;">${bodyContent}</div></td></tr>`
    + '<tr><td style="padding:20px 30px;background:#faf8f3;border-top:1px solid #eee3d3;text-align:left;">'
    + `<p style="margin:0 0 8px;color:#6b6b6b;font-size:12px;"><strong>${legal.brand}</strong> — director national pentru servicii de sanatate vizuala.</p>`
    + `<p style="margin:0 0 8px;color:#6b6b6b;font-size:12px;">Contact: <a href="mailto:${legal.contactEmail}" style="color:#121212;text-decoration:none;">${legal.contactEmail}</a> | <a href="${legal.website}" style="color:#121212;text-decoration:none;">${legal.website}</a></p>`
    + `<p style="margin:0 0 8px;color:#8a8a8a;font-size:11px;line-height:1.5;">${legal.reason}</p>`
    + `<p style="margin:0;color:#8a8a8a;font-size:11px;">${unsubscribeHtml}</p>`
    + `<p style="margin:10px 0 0;color:#c2b8a3;font-size:10px;">&copy; ${year} ${legal.legalCompany}</p>`
    + '</td></tr></table></td></tr></table></body></html>';
}

export function buildPlainText(bodyHtml, unsubscribeUrl) {
  const legal = legalConfig();
  return [
    stripHtml(bodyHtml),
    '',
    '---',
    `${legal.brand}`,
    `Contact: ${legal.contactEmail}`,
    `Website: ${legal.website}`,
    `De ce primesti acest email: ${legal.reason}`,
    `Dezabonare: ${unsubscribeUrl}`,
  ].join('\n');
}

export function compactDetails(value) {
  try {
    const text = JSON.stringify(value || {});
    return JSON.parse(text.length > 5000 ? text.slice(0, 5000) : text);
  } catch (_) {
    return {};
  }
}

export function complianceMissing(contact) {
  const missing = [];
  if (!contact?.lawful_basis) missing.push('lawful_basis');
  if (!contact?.source_url && !contact?.source) missing.push('source_url/source');
  if (!contact?.collection_date) missing.push('collection_date');
  if (!contact?.source_type && !contact?.source) missing.push('source_type');
  return missing;
}

export async function sendViaResend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* noop */ }
  return { ok: res.ok, status: res.status, text, json };
}

// Trimitere in lot prin Resend Batch API (max 100 email-uri/apel). Fiecare `payloads[i]` are
// aceeasi forma ca payload-ul acceptat de sendViaResend. Rezultatul e in aceeasi ordine ca inputul
// cand Resend reuseste (json.data[i].id); la eroare (ok:false) ordinea rezultatelor Resend nu mai e garantata per e-mail, deci
// apelantul trebuie sa trateze intreg lotul ca esuat si sa reincerce mai tarziu.
export async function sendBatchViaResend(apiKey, payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) return { ok: true, status: 200, results: [] };
  if (payloads.length > 100) throw new Error('Resend Batch API accepta maxim 100 de email-uri per apel.');
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payloads),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* noop */ }
  const results = Array.isArray(json?.data) ? json.data : [];
  return { ok: res.ok, status: res.status, text, json, results };
}

// ── Verificare semnatura webhook Resend (Svix) — portata identic din Optilun (resendWebhook/entry.ts) ──

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifySvixSignature(payload, headers, secret) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatureHeader = headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > 5 * 60 * 1000) return false;

  const signedContent = `${id}.${timestamp}.${payload}`;
  const secretValue = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secretValue),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const candidates = signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^v\d+,/, ''));

  return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}

export function extractResendMessageId(event) {
  const data = event?.data || {};
  return data.email_id || data.id || data.message_id || data.email?.id || event?.email_id || event?.message_id || '';
}

export function extractResendRecipientEmail(event) {
  const data = event?.data || {};
  const raw = Array.isArray(data.to) ? data.to[0] : data.to || data.recipient || data.email || data.rcpt_to || '';
  if (typeof raw !== 'string') return '';
  const match = raw.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : raw);
}

export function resendEventTime(event) {
  return event?.created_at || event?.data?.created_at || new Date().toISOString();
}

export function compactRawEvent(event) {
  const raw = JSON.stringify(event || {});
  if (raw.length <= 12000) return event;
  const data = event?.data || {};
  return {
    truncated: true,
    type: event?.type,
    created_at: event?.created_at,
    data: {
      email_id: data.email_id || data.id,
      message_id: data.message_id,
      to: data.to,
      subject: data.subject,
      bounce: data.bounce,
      click: data.click,
      open: data.open,
      error: data.error || data.message || data.reason,
      tags: data.tags,
    },
  };
}

function permanentFailure(event) {
  const data = event?.data || {};
  const bounce = data.bounce || {};
  const text = JSON.stringify({ bounce, error: data.error, message: data.message, reason: data.reason, status: data.status }).toLowerCase();
  return event?.type === 'email.bounced'
    || bounce.type === 'Permanent'
    || text.includes('permanent')
    || text.includes('hard bounce')
    || text.includes('suppressed')
    || text.includes('invalid recipient')
    || text.includes('invalid email')
    || text.includes('recipient address');
}

export function statusForResendEvent(event) {
  switch (event?.type) {
    case 'email.sent': return 'sent';
    case 'email.delivered': return 'delivered';
    case 'email.delivery_delayed': return 'delivery_delayed';
    case 'email.opened': return 'opened';
    case 'email.clicked': return 'clicked';
    case 'email.bounced': return 'bounced';
    case 'email.complained': return 'complained';
    case 'email.failed': return permanentFailure(event) ? 'bounced' : 'failed';
    default: return 'unknown';
  }
}

export function timestampFieldForStatus(status) {
  if (status === 'sent') return 'sent_at';
  if (status === 'delivered') return 'delivered_at';
  if (status === 'delivery_delayed') return 'delivery_delayed_at';
  if (status === 'bounced') return 'bounced_at';
  if (status === 'complained') return 'complained_at';
  if (status === 'failed') return 'failed_at';
  return 'created_at';
}

export function getResendErrorMessage(event) {
  const data = event?.data || {};
  if (typeof data.error === 'string') return data.error;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.reason === 'string') return data.reason;
  if (data.bounce?.message) return data.bounce.message;
  return '';
}
