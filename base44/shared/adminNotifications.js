import { renderAutomaticEmail } from './automaticEmailRuntime.js';
import { DEFAULT_FROM_NAME, sendViaResend } from './outreachEmailPolicy.js';

// 2026-10-10 (Alex: „tot ce intra, se completeaza, se revendica [...] sa ma notifice in panoul de admin”).
// Fiecare intrare noua care asteapta decizia adminului devine un AdminNotification (clopotelul din
// panoul de admin) si pleaca pe email catre utilizatorii cu rol admin.
//
// Reguli:
// - Nu blocheaza niciodata actiunea utilizatorului: orice eroare se inghite si se scrie in consola.
// - Un anunt per intrare (dedupe_key = eveniment:id), chiar daca functia e apelata de mai multe ori.
// - Emailul nu contine date de contact ale pacientilor si nici text liber scris de utilizatori;
//   `details` vine doar din campuri sigure (nume de locatie, oras, serviciu, numar de locatii).
// - Cel mult ADMIN_EMAIL_HOURLY_LIMIT emailuri pe ora; peste limita anuntul ramane in clopotel.

export const ADMIN_NOTIFICATION_VERSION = 'admin-notifications-v1';
export const ADMIN_SITE_URL = 'https://viasee.ro';
export const ADMIN_PANEL_PATH = '/admin/operatiuni';
export const ADMIN_EMAIL_TEMPLATE_KEY = 'admin_new_activity';
export const ADMIN_EMAIL_HOURLY_LIMIT = 30;
// 2026-10-10: implicit anunturile pleaca prin Core.SendEmail (Base44). Decizia lui Alex: cota Resend
// (planul gratuit: 100/zi, 3.000/luna) ramane pentru emailurile catre clienti. Resend se poate porni
// doar pentru anunturi cu secretul ADMIN_NOTIFICATIONS_EMAIL_PROVIDER=resend; atunci pleaca de pe
// mail.viasee.ro, iar Core.SendEmail ramane rezerva.
export const ADMIN_EMAIL_FROM = 'anunturi@mail.viasee.ro';
const MAX_ADMIN_RECIPIENTS = 10;

const event = (category, title, section, tab = '') => Object.freeze({ category, title, section, tab });

export const ADMIN_NOTIFICATION_EVENTS = Object.freeze({
  claim_submitted: event('provider', 'Revendicare nouă', 'revendicari'),
  new_location_claim: event('provider', 'Locație nouă propusă la revendicare', 'revendicari'),
  location_create_submitted: event('provider', 'Locație nouă adăugată de un furnizor', 'workspace_reviews', 'locations'),
  existing_location_link_submitted: event('provider', 'Furnizor care cere un profil existent', 'workspace_reviews', 'locations'),
  location_lifecycle_submitted: event('provider', 'Cerere de schimbare a stării unei locații', 'workspace_reviews', 'lifecycle'),
  workspace_change_submitted: event('provider', 'Modificare de profil de verificat', 'workspace_reviews', 'workspace'),
  services_submitted: event('provider', 'Servicii trimise spre verificare', 'workspace_reviews', 'workspace'),
  photo_submitted: event('provider', 'Fotografie trimisă spre verificare', 'workspace_reviews', 'workspace'),
  organization_profile_submitted: event('provider', 'Profil de organizație trimis spre verificare', 'workspace_reviews', 'workspace'),
  logo_submitted: event('provider', 'Logo trimis spre verificare', 'profiluri'),
  professional_profile_submitted: event('provider', 'Profil de specialist trimis spre verificare', 'workspace_reviews', 'professionals'),
  directory_correction_submitted: event('directory', 'Sesizare nouă pentru director', 'corectii'),
  support_ticket_created: event('support', 'Tichet de suport nou', 'support_tickets'),
  account_deletion_requested: event('support', 'Cerere de ștergere a contului', 'support_tickets'),
  user_feedback_created: event('support', 'Feedback nou', 'support_tickets', 'feedback'),
  patient_request_saved: event('patient', 'Cerere nouă de la un pacient', 'cereri_pacienti'),
  patient_request_undelivered: event('patient', 'Cerere de pacient care n-a ajuns la nicio locație', 'cereri_pacienti'),
  patient_recovery_requested: event('patient', 'Pacient care cere ajutor pentru o cerere', 'workspace_reviews', 'patient_requests'),
  search_contact_left: event('patient', 'Contact nou lăsat la o căutare', 'contacte_pacienti'),
});

const singleLine = (value, max) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

// O linie scurta din bucati sigure: goale si duplicate ies, restul se leaga cu „ · ”.
export function adminNotificationDetails(...parts) {
  const seen = new Set();
  const kept = [];
  for (const part of parts.flat()) {
    const text = singleLine(part, 120);
    const key = text.toLocaleLowerCase('ro-RO');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    kept.push(text);
  }
  return kept.join(' · ').slice(0, 240);
}

export function adminNotificationPath(section = '', tab = '') {
  const params = new URLSearchParams();
  if (section && section !== 'dashboard') params.set('s', section);
  if (tab) params.set('t', tab);
  const query = params.toString();
  return query ? `${ADMIN_PANEL_PATH}?${query}` : ADMIN_PANEL_PATH;
}

export function adminNotificationLink(record = {}) {
  return `${ADMIN_SITE_URL}${adminNotificationPath(record.admin_section, record.admin_tab)}`;
}

export function adminNotificationDedupeKey(eventType, entityId, explicitKey = '') {
  const key = singleLine(explicitKey, 160) || (entityId ? `${eventType}:${singleLine(entityId, 80)}` : '');
  return key.slice(0, 160);
}

export function buildAdminNotificationRecord(eventType, { details = '', entityType = '', entityId = '', dedupeKey = '' } = {}) {
  const definition = ADMIN_NOTIFICATION_EVENTS[eventType];
  if (!definition) return null;
  return {
    event_type: eventType,
    category: definition.category,
    title: definition.title,
    details: singleLine(details, 240),
    admin_section: definition.section,
    admin_tab: definition.tab,
    source_entity_type: singleLine(entityType, 80),
    source_entity_id: singleLine(entityId, 80),
    dedupe_key: adminNotificationDedupeKey(eventType, entityId, dedupeKey),
    email_status: 'pending',
    email_recipient_count: 0,
  };
}

export function adminNotificationEmailFallback(record = {}) {
  const link = adminNotificationLink(record);
  return {
    subject: singleLine(`VIASEE admin: ${record.title || 'activitate nouă'}`, 180),
    body: [
      'Buna ziua,',
      '',
      record.title || 'Activitate noua in VIASEE.',
      record.details || '',
      '',
      'Deschide panoul de administrare:',
      link,
      '',
      'Mesaj automat trimis administratorilor VIASEE. Nu contine datele de contact ale pacientilor.',
      '',
      'Echipa VIASEE',
    ].join('\n'),
  };
}

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export function adminEmailRecipients(users = []) {
  const seen = new Set();
  const result = [];
  for (const user of Array.isArray(users) ? users : []) {
    if (user?.role !== 'admin') continue;
    const email = String(user?.email || '').trim().toLowerCase();
    if (!validEmail(email) || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result.slice(0, MAX_ADMIN_RECIPIENTS);
}

function envValue(name) {
  try {
    return typeof Deno !== 'undefined' ? String(Deno.env.get(name) || '') : '';
  } catch (_error) {
    return '';
  }
}

// 'base44' (implicit) sau 'resend'.
export function adminEmailProvider(value = envValue('ADMIN_NOTIFICATIONS_EMAIL_PROVIDER')) {
  return String(value || '').trim().toLowerCase() === 'resend' ? 'resend' : 'base44';
}

// Intoarce furnizorul care a trimis: 'resend' sau 'base44'. Arunca doar daca niciunul nu a reusit.
async function sendOne(base44, svc, message, { apiKey = '', resend = sendViaResend, idempotencyKey = '' } = {}) {
  let lastError = null;
  if (apiKey) {
    try {
      const result = await resend(apiKey, {
        from: `${DEFAULT_FROM_NAME} <${ADMIN_EMAIL_FROM}>`,
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }, { idempotencyKey });
      if (result?.ok) return 'resend';
      lastError = new Error(`Resend ${result?.status || ''}: ${String(result?.text || '').slice(0, 160)}`);
    } catch (error) {
      lastError = error;
    }
  }
  const clients = [svc?.integrations?.Core, base44?.integrations?.Core].filter((core, index, list) => core?.SendEmail && list.indexOf(core) === index);
  for (const core of clients) {
    try {
      await core.SendEmail({ ...message, from_name: 'VIASEE' });
      return 'base44';
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('SendEmail indisponibil');
}

async function emailAdmins(base44, svc, record, options = {}) {
  const entity = svc.entities.AdminNotification;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  // 2026-10-10: `filter` + lungime, nu `count` - SDK-ul din functiile de backend (0.8.31) nu are `count`
  // (testul live: "r.count is not a function", emailul nu a plecat).
  const recentRows = await entity.filter({ email_status: 'sent', created_date: { $gte: since } }, '-created_date', ADMIN_EMAIL_HOURLY_LIMIT).catch(() => []);
  const recentSent = Array.isArray(recentRows) ? recentRows.length : 0;
  if (recentSent >= ADMIN_EMAIL_HOURLY_LIMIT) {
    return { email_status: 'skipped', email_skip_reason: 'hourly_limit', email_recipient_count: 0 };
  }
  const users = await svc.entities.User.filter({ role: 'admin' }, '-created_date', MAX_ADMIN_RECIPIENTS).catch(() => []);
  const recipients = adminEmailRecipients(users);
  if (!recipients.length) return { email_status: 'skipped', email_skip_reason: 'no_admin_recipients', email_recipient_count: 0 };

  const fallback = adminNotificationEmailFallback(record);
  const rendered = await renderAutomaticEmail({
    svc,
    key: ADMIN_EMAIL_TEMPLATE_KEY,
    fallback,
    variables: { event_title: record.title || '', details: record.details || '', admin_link: adminNotificationLink(record) },
  }).catch(() => fallback);

  const useResend = adminEmailProvider(options.provider ?? envValue('ADMIN_NOTIFICATIONS_EMAIL_PROVIDER')) === 'resend';
  const apiKey = useResend ? (options.resendApiKey ?? envValue('RESEND_API_KEY')) : '';
  let sent = 0;
  let lastError = '';
  const providers = new Set();
  for (const to of recipients) {
    try {
      const provider = await sendOne(base44, svc, { to, subject: singleLine(rendered.subject, 180), body: String(rendered.body || '').slice(0, 6000) }, {
        apiKey,
        resend: options.sendResend || sendViaResend,
        idempotencyKey: `admin-notification:${record.dedupe_key || record.event_type}:${to}`,
      });
      providers.add(provider);
      sent += 1;
    } catch (error) {
      lastError = singleLine(error?.message || 'Email netrimis', 300);
    }
  }
  const status = sent === recipients.length ? 'sent' : sent > 0 ? 'partial' : 'failed';
  return { email_status: status, email_recipient_count: sent, email_error: lastError, email_skip_reason: '', email_provider: [...providers].join(',') };
}

// Punctul unic de intrare. `base44` = clientul cererii (createClientFromRequest).
// `options` (doar pentru teste): { provider, resendApiKey, sendResend }.
export async function notifyAdmins(base44, { event: eventType, details = '', entityType = '', entityId = '', dedupeKey = '' } = {}, options = {}) {
  try {
    const record = buildAdminNotificationRecord(eventType, { details, entityType, entityId, dedupeKey });
    if (!record) return { status: 'unknown_event' };
    const svc = base44?.asServiceRole || base44;
    const entity = svc?.entities?.AdminNotification;
    if (!entity?.create) return { status: 'unavailable' };
    if (record.dedupe_key) {
      const existing = await entity.filter({ dedupe_key: record.dedupe_key }, '-created_date', 1).catch(() => []);
      if (existing?.[0]) return { status: 'duplicate', notification_id: existing[0].id };
    }
    const created = await entity.create(record);
    const email = await emailAdmins(base44, svc, record, options).catch((error) => ({
      email_status: 'failed',
      email_recipient_count: 0,
      email_error: singleLine(error?.message || 'Email netrimis', 300),
    }));
    if (created?.id) await entity.update(created.id, email).catch(() => null);
    return { status: 'created', notification_id: created?.id || '', email_status: email.email_status };
  } catch (error) {
    console.warn('[adminNotifications] anuntul pentru admin nu a putut fi salvat', eventType, error?.message || error);
    return { status: 'failed' };
  }
}
