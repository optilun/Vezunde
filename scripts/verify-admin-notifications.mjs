// 2026-10-10 (Alex: tot ce intra, se completeaza sau se revendica trebuie sa ajunga la admin si sa-l
// anunte). Verifica:
// - anunturile pentru admin (AdminNotification + email catre adminii aplicatiei), cu limita pe ora,
//   fara dubluri si fara sa blocheze actiunea utilizatorului;
// - ca fiecare traseu care asteapta o decizie trimite anuntul potrivit;
// - clopotelul din panoul de admin si ecranul nou „Cereri pacienti”.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ADMIN_EMAIL_HOURLY_LIMIT,
  ADMIN_NOTIFICATION_EVENTS,
  adminEmailRecipients,
  adminNotificationDetails,
  adminNotificationPath,
  buildAdminNotificationRecord,
  notifyAdmins,
} from '../base44/shared/adminNotifications.js';
import { AUTOMATIC_EMAIL_BY_KEY, validateAutomaticEmailTemplate } from '../base44/shared/automaticEmailCatalog.js';
import * as frontCatalog from '../shared/automaticEmailCatalog.js';
import {
  classifyPatientRequestForAdmin,
  adminPatientRequestRow,
  summarizeAdminPatientRequests,
} from '../base44/shared/adminPatientRequestView.js';
import { ADMIN_SECTIONS } from '../src/lib/adminNavConfig.js';
import { OTHER_QUEUES, sidebarBadgeFor, summarizeCounts } from '../src/lib/adminCounts.js';
import { parseServerDate, relativeTime } from '../src/lib/adminFormat.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// --- Catalogul de evenimente: fiecare duce intr-o sectiune reala a panoului
for (const [key, definition] of Object.entries(ADMIN_NOTIFICATION_EVENTS)) {
  assert.ok(ADMIN_SECTIONS.has(definition.section), `${key}: sectiunea ${definition.section} nu exista in panoul de admin`);
  assert.ok(definition.title.length > 5, `${key}: titlu lipsa`);
}
assert.equal(adminNotificationPath('revendicari'), '/admin/operatiuni?s=revendicari');
assert.equal(adminNotificationPath('workspace_reviews', 'locations'), '/admin/operatiuni?s=workspace_reviews&t=locations');
assert.equal(adminNotificationDetails('Optica X', '', 'Optica X', 'Cluj\nNapoca'), 'Optica X · Cluj Napoca');
assert.equal(buildAdminNotificationRecord('nu_exista'), null);
const record = buildAdminNotificationRecord('claim_submitted', { details: 'a\nb', entityId: 'c1', entityType: 'ProviderClaimRequest' });
assert.equal(record.details, 'a b');
assert.equal(record.dedupe_key, 'claim_submitted:c1');
assert.equal(record.admin_section, 'revendicari');
assert.deepEqual(adminEmailRecipients([
  { role: 'admin', email: 'A@x.ro' }, { role: 'admin', email: 'a@x.ro' }, { role: 'user', email: 'u@x.ro' }, { role: 'admin', email: 'nu-e-email' },
]), ['a@x.ro'], 'emailul pleaca doar la admini, o singura data');

// --- Sablonul de email: editabil din „Emailuri automate”, identic in ambele copii ale catalogului
const template = AUTOMATIC_EMAIL_BY_KEY.admin_new_activity;
assert.ok(template, 'sablonul admin_new_activity lipseste');
assert.equal(validateAutomaticEmailTemplate(template, template.subject, template.body), '');
assert.deepEqual(frontCatalog.AUTOMATIC_EMAIL_BY_KEY.admin_new_activity, template, 'cele doua copii ale catalogului difera');

// --- notifyAdmins: un anunt, email la admini, fara dubluri, limita pe ora, nu arunca niciodata
function fakeService({ sentLastHour = 0, failEmail = false, throwOnCreate = false } = {}) {
  const rows = [];
  const emails = [];
  const svc = {
    entities: {
      // Fara `count`: SDK-ul din functiile de backend (0.8.31) nu il are (gasit la testul live 2026-10-10).
      AdminNotification: {
        filter: async (query) => (query.dedupe_key
          ? rows.filter((row) => row.dedupe_key === query.dedupe_key)
          : Array.from({ length: sentLastHour }, (_, index) => ({ id: `sent${index}`, email_status: 'sent' }))),
        create: async (data) => {
          if (throwOnCreate) throw new Error('platforma indisponibila');
          const row = { id: `n${rows.length + 1}`, ...data };
          rows.push(row);
          return row;
        },
        update: async (id, data) => Object.assign(rows.find((row) => row.id === id), data),
      },
      User: { filter: async () => [{ role: 'admin', email: 'admin@viasee.test' }, { role: 'user', email: 'pacient@viasee.test' }] },
      AutomaticEmailTemplate: { filter: async () => [] },
    },
    integrations: {
      Core: {
        SendEmail: async (message) => {
          if (failEmail) throw new Error('smtp');
          emails.push(message);
        },
      },
    },
  };
  return { svc, rows, emails };
}

// Fara RESEND_API_KEY (ca in Node): pleaca prin Core.SendEmail, ca rezerva.
{
  const { svc, rows, emails } = fakeService();
  const first = await notifyAdmins(svc, { event: 'claim_submitted', entityId: 'c1', details: 'Optica Exemplu · Cluj-Napoca' }, { resendApiKey: '' });
  assert.equal(rows[0].email_provider, 'base44');
  assert.equal(first.status, 'created');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email_status, 'sent');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'admin@viasee.test');
  assert.match(emails[0].subject, /Revendicare nouă/);
  assert.match(emails[0].body, /https:\/\/viasee\.ro\/admin\/operatiuni\?s=revendicari/);
  const again = await notifyAdmins(svc, { event: 'claim_submitted', entityId: 'c1' });
  assert.equal(again.status, 'duplicate', 'aceeasi intrare nu se anunta de doua ori');
  assert.equal(emails.length, 1);
}
// 2026-10-10: emailul prin Core.SendEmail nu a ajuns in Inbox. Cu cheia Resend, pleaca de pe mail.viasee.ro.
{
  const { svc, rows, emails } = fakeService();
  const resendCalls = [];
  const sendResend = async (apiKey, payload, options) => { resendCalls.push({ apiKey, payload, options }); return { ok: true, status: 200 }; };
  await notifyAdmins(svc, { event: 'support_ticket_created', entityId: 't9', details: 'Problemă tehnică' }, { resendApiKey: 're_test', sendResend });
  assert.equal(resendCalls.length, 1);
  assert.equal(resendCalls[0].payload.from, 'VIASEE <anunturi@mail.viasee.ro>');
  assert.deepEqual(resendCalls[0].payload.to, ['admin@viasee.test']);
  assert.match(resendCalls[0].payload.text, /https:\/\/viasee\.ro\/admin\/operatiuni\?s=support_tickets/);
  assert.equal(resendCalls[0].options.idempotencyKey, 'admin-notification:support_ticket_created:t9:admin@viasee.test');
  assert.equal(emails.length, 0, 'Core.SendEmail nu se mai foloseste cand Resend a reusit');
  assert.equal(rows[0].email_status, 'sent');
  assert.equal(rows[0].email_provider, 'resend');
}
// Resend refuza -> rezerva Core.SendEmail, emailul tot pleaca.
{
  const { svc, rows, emails } = fakeService();
  const sendResend = async () => ({ ok: false, status: 422, text: 'domain not verified' });
  await notifyAdmins(svc, { event: 'support_ticket_created', entityId: 't10' }, { resendApiKey: 're_test', sendResend });
  assert.equal(emails.length, 1);
  assert.equal(rows[0].email_status, 'sent');
  assert.equal(rows[0].email_provider, 'base44');
}
{
  const { svc, rows, emails } = fakeService({ sentLastHour: ADMIN_EMAIL_HOURLY_LIMIT });
  await notifyAdmins(svc, { event: 'support_ticket_created', entityId: 't1' });
  assert.equal(rows[0].email_status, 'skipped');
  assert.equal(rows[0].email_skip_reason, 'hourly_limit');
  assert.equal(emails.length, 0, 'peste limita pe ora anuntul ramane doar in clopotel');
}
{
  const { svc, rows } = fakeService({ failEmail: true });
  const result = await notifyAdmins(svc, { event: 'feedback_nu_exista' });
  assert.equal(result.status, 'unknown_event');
  await notifyAdmins(svc, { event: 'user_feedback_created', entityId: 'f1' });
  assert.equal(rows[0].email_status, 'failed', 'un email esuat ramane vizibil in clopotel');
}
{
  const { svc } = fakeService({ throwOnCreate: true });
  const result = await notifyAdmins(svc, { event: 'claim_submitted', entityId: 'c2' });
  assert.equal(result.status, 'failed', 'o eroare nu ajunge la utilizator');
}

// --- Fiecare traseu trimite anuntul potrivit
const hooks = [
  ['base44/functions/submitProviderScopedClaim/entry.ts', ['claim_submitted']],
  ['base44/functions/submitProviderClaim/entry.ts', ['new_location_claim', 'claim_submitted']],
  ['base44/functions/providerLocationExpansionOps/entry.ts', ['location_create_submitted']],
  ['base44/functions/providerLocationIdentityResolutionOps/entry.ts', ['existing_location_link_submitted']],
  ['base44/functions/providerLocationLifecycleOps/entry.ts', ['location_lifecycle_submitted']],
  ['base44/functions/manageMyProfessionalProfile/entry.ts', ['professional_profile_submitted']],
  ['base44/functions/providerServiceConfigurationOps/submitProviderWorkspaceChange.ts', ['services_submitted', 'photo_submitted', 'workspace_change_submitted']],
  ['base44/functions/providerServiceConfigurationOps/providerServiceConfigurationOps.ts', ['services_submitted']],
  ['base44/functions/providerServiceConfigurationOps/locationPhotoOps.ts', ['photo_submitted']],
  ['base44/functions/providerServiceConfigurationOps/submitProviderLogoForReview.ts', ['logo_submitted']],
  ['base44/functions/providerServiceConfigurationOps/manageProviderOrganizationProfile.ts', ['organization_profile_submitted']],
  ['base44/functions/submitDirectoryCorrection/entry.ts', ['directory_correction_submitted']],
  ['base44/functions/getMyProviderWorkspace/getMyAccountDeletionEligibility.ts', ['account_deletion_requested']],
  ['base44/functions/createPatientRequest/entry.ts', ['patient_request_saved', 'search_contact_left']],
  ['base44/functions/authorizePatientRequestDistribution/entry.ts', ['patient_request_undelivered']],
  ['base44/functions/getPatientRequestStatus/entry.ts', ['patient_recovery_requested']],
  ['base44/functions/directoryOps/adminNotificationOps.ts', ['support_ticket_created', 'user_feedback_created', 'account_deletion_requested']],
];
const covered = new Set();
for (const [path, events] of hooks) {
  const source = await read(path);
  assert.match(source, /import \{ adminNotificationDetails, notifyAdmins \} from '\.\.\/\.\.\/shared\/adminNotifications\.js';/, `${path}: lipseste importul`);
  for (const event of events) {
    assert.ok(source.includes(`'${event}'`), `${path}: nu trimite ${event}`);
    covered.add(event);
  }
}
for (const event of Object.keys(ADMIN_NOTIFICATION_EVENTS)) assert.ok(covered.has(event), `evenimentul ${event} nu e trimis de niciun traseu`);

// Distribuirea cererii: anuntul e doar pe ramura „0 locatii”, fara alta schimbare.
const distribution = await read('base44/functions/authorizePatientRequestDistribution/entry.ts');
assert.match(distribution, /\} else \{\n\s+\/\/ 2026-10-10: pacientul a cerut trimiterea, dar nicio locatie nu o poate primi/);

// Tichetele si feedback-ul se creeaza din browser: anuntul pleaca prin report_submission.
const help = await read('src/pages/HelpSupport.jsx');
assert.match(help, /action: "report_submission", entity_type: "SupportTicket", id: created\.id \}\)\.catch\(\(\) => null\)/);
const feedback = await read('src/components/account/FeedbackDialog.jsx');
assert.match(feedback, /action: "report_submission", entity_type: "UserFeedback", id: created\.id \}\)\.catch\(\(\) => null\)/);
const ops = await read('base44/functions/directoryOps/adminNotificationOps.ts');
assert.match(ops, /ticket\.requester_user_id !== user\.id/, 'un utilizator poate anunta doar propriul tichet');
assert.match(ops, /feedback\.user_id !== user\.id/, 'un utilizator poate anunta doar propriul feedback');
assert.match(ops, /if \(user\.role !== 'admin'\) return Response\.json\(\{ error: 'Acces interzis: doar administratori' \}, \{ status: 403 \}\);/);

// Entitatea: doar adminii o pot citi sau schimba.
const entity = JSON.parse((await read('base44/entities/AdminNotification.jsonc')).replace(/\/\/.*$/gm, ''));
for (const operation of ['read', 'create', 'update', 'delete']) assert.equal(entity.rls[operation].user_condition.role, 'admin');

// --- Clopotelul din antetul panoului
const shell = await read('src/components/admin/shell/AdminAppShell.jsx');
assert.match(shell, /<AdminNotificationBell \/>/);
const bell = await read('src/components/admin/shell/AdminNotificationBell.jsx');
assert.match(bell, /adminNotificationOps", \{ action: "list" \}/);
assert.match(bell, /mark_all_read/);
assert.match(bell, /go\(item\.admin_section \|\| "dashboard", item\.admin_tab \|\| ""\)/);

// --- „Cereri pacienti”: stari corecte, fara date personale
const base = { id: 'r1', match_count: 4, lifecycle_state: 'active', status: 'salvata' };
assert.equal(classifyPatientRequestForAdmin({ request: base }).state, 'not_sent');
assert.equal(classifyPatientRequestForAdmin({ request: base, distributionConsent: true }).state, 'undelivered');
assert.equal(classifyPatientRequestForAdmin({ request: base, distributionConsent: true }).attention, true);
assert.equal(classifyPatientRequestForAdmin({ request: base, distributionConsent: true, recoveryStatus: 'queued' }).attention, false);
assert.equal(classifyPatientRequestForAdmin({ request: { ...base, match_count: 0 } }).state, 'no_results');
assert.equal(classifyPatientRequestForAdmin({ request: base, distributionConsent: true, leadCount: 3 }).state, 'waiting');
assert.equal(classifyPatientRequestForAdmin({ request: base, distributionConsent: true, leadCount: 3, responseCount: 1 }).state, 'answered');
assert.equal(classifyPatientRequestForAdmin({ request: { ...base, lifecycle_state: 'closed' }, distributionConsent: true }).state, 'closed');
const row = adminPatientRequestRow(
  { ...base, original_message: 'text privat', detailed_message: 'text privat', client_address_text: 'adresa', service_keys: ['eyeglasses'] },
  classifyPatientRequestForAdmin({ request: base }),
  { serviceLabel: () => 'Ochelari de vedere' },
);
for (const forbidden of ['original_message', 'detailed_message', 'client_address_text', 'contact_email', 'contact_phone', 'contact_name']) {
  assert.ok(!(forbidden in row), `randul de admin nu trebuie sa contina ${forbidden}`);
}
assert.deepEqual(row.services, ['Ochelari de vedere']);
assert.equal(summarizeAdminPatientRequests([row, { ...row, state: 'undelivered', attention: true }]).attention, 1);
const requestOps = await read('base44/functions/directoryOps/adminPatientRequestOps.ts');
assert.doesNotMatch(requestOps, /contact_email|contact_phone|contact_name|original_message|detailed_message/);
assert.ok(ADMIN_SECTIONS.has('cereri_pacienti'));
const kpis = await read('src/components/admin/dashboard/KpiGrid.jsx');
assert.match(kpis, /value: stats\?\.patientRequests, section: "cereri_pacienti"/, 'cifra „Cereri pacienti” duce la ecranul cererilor');

// --- Panoul si meniul arata si ce lipsea
for (const key of ['patient_requests_attention', 'feedback', 'search_contacts']) {
  assert.ok(OTHER_QUEUES.some((queue) => queue.key === key), `${key} lipseste din „De rezolvat acum”`);
}
const counts = { review: {}, claims: 0, tickets: 1, corrections: 0, feedback: 2, email_failures: 0, import_attention: 0, campaigns_attention: 0, payments_attention: 0, patient_requests_attention: 3, search_contacts: 4 };
assert.equal(sidebarBadgeFor(counts, 'support_tickets'), 3, 'tichete + feedback nou');
assert.equal(sidebarBadgeFor(counts, 'cereri_pacienti'), 3);
assert.equal(sidebarBadgeFor(counts, 'contacte_pacienti'), 4);
const summary = summarizeCounts(counts);
assert.ok(summary.rows.some((item) => item.key === 'patient_requests_attention' && item.count === 3));

// --- Datele din functiile de backend vin in UTC fara „Z” (testul live: „acum 3 ore” in loc de „acum 3 min”)
assert.equal(parseServerDate('2026-10-10T17:55:29.046000').toISOString(), '2026-10-10T17:55:29.046Z');
assert.equal(parseServerDate('2026-10-10T17:55:29.000Z').toISOString(), '2026-10-10T17:55:29.000Z');
assert.equal(relativeTime('2026-10-10T17:55:29.046000', Date.parse('2026-10-10T17:58:30Z')), 'acum 3 min');

console.log('Admin notifications + cereri pacienti: OK');
