// Verifica protectiile trimiterii de outreach (base44/shared/outreachSendSafety.js) si le ruleaza
// cap-coada prin handler-ele reale (outreachSendOps / outreachWebhookOps / outreachCampaignOps),
// cu o baza de date in memorie, Resend si DNS simulate:
// 1. limita zilnica (50 in prima zi, apoi dublu) + reluarea a doua zi la 09:00, ora Romaniei;
// 2. oprirea automata la prea multe respingeri / la o reclamatie de spam, din trimitere si din
//    webhook, si reluarea de catre admin care porneste protectia de la zero;
// 3. verificarea domeniului (MX): domeniile disparute / fara server de email nu primesc nimic,
//    iar o cautare DNS esuata la noi NU blocheaza trimiterea.
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const safety = await import('../base44/shared/outreachSendSafety.js');

// ── 1. Functii pure ──────────────────────────────────────────────────────────────────────────
assert.equal(safety.bucharestDateKey(new Date('2026-09-21T21:30:00Z')), '2026-09-22', 'ziua se socoteste dupa ora Romaniei');
assert.equal(safety.bucharestDateKey(new Date('2026-09-21T20:59:00Z')), '2026-09-21');
assert.equal(safety.nextSendResumeAt(new Date('2026-09-21T21:30:00Z')).toISOString(), '2026-09-23T06:00:00.000Z', 'vara: 09:00 = 06:00 UTC');
assert.equal(safety.nextSendResumeAt(new Date('2026-10-24T10:00:00Z')).toISOString(), '2026-10-25T07:00:00.000Z', 'ziua schimbarii orei: 09:00 = 07:00 UTC');
assert.equal(safety.nextSendResumeAt(new Date('2026-12-31T12:00:00Z')).toISOString(), '2027-01-01T07:00:00.000Z', 'trecerea in anul urmator');

assert.deepEqual([0, 1, 2, 3].map((days) => safety.effectiveDailyLimit({}, days)), [50, 100, 200, 400], 'implicit: 50, apoi dublu in fiecare zi de trimitere');
assert.equal(safety.effectiveDailyLimit({}, 20), 2000, 'plafon 2000');
assert.equal(safety.effectiveDailyLimit({ daily_send_limit: 120, daily_send_ramp: false }, 5), 120, 'fara crestere automata limita ramane fixa');
assert.equal(safety.normalizeDailySendLimit(3), 10);
assert.equal(safety.normalizeDailySendLimit(999999), 2000);
assert.equal(safety.normalizeDailySendLimit('abc'), 50);

const summary = safety.summarizeSendsByDay([
  { sent_at: '2026-09-19T08:00:00Z' }, { sent_at: '2026-09-20T08:00:00Z' },
  { sent_at: '2026-09-21T06:00:00Z' }, { sent_at: '2026-09-21T07:00:00Z' }, { status: 'skipped' },
], new Date('2026-09-21T12:00:00Z'));
assert.equal(summary.sentToday, 2);
assert.equal(summary.priorSendingDays, 2);

assert.equal(safety.evaluateCampaignHealth({ sent_count: 20, bounced_count: 1 }).healthy, true, 'un bounce la primele 20 nu opreste campania (minim 50 pentru rata)');
assert.equal(safety.evaluateCampaignHealth({ sent_count: 100, bounced_count: 3 }).healthy, true, '3% exact nu opreste');
assert.equal(safety.evaluateCampaignHealth({ sent_count: 100, bounced_count: 4 }).reason, 'bounce_rate');
assert.equal(safety.evaluateCampaignHealth({ sent_count: 300, complained_count: 1 }).reason, 'complaints', 'o singura reclamatie de spam opreste campania');
assert.equal(safety.evaluateCampaignHealth({ sent_count: 300, bounced_count: 12, health_baseline: { sent: 100, bounced: 8 } }).healthy, true, 'dupa reluare conteaza doar ce s-a trimis de atunci');
assert.match(safety.evaluateCampaignHealth({ sent_count: 50, bounced_count: 2 }).message, /2 emailuri respinse din 50 trimise \(4,0%\)/);

assert.equal(safety.classifyMxLookup({ Status: 0, Answer: [{ type: 15, data: '10 mx.firma.ro.' }] }), 'ok');
assert.equal(safety.classifyMxLookup({ Status: 3 }), 'domain_missing');
assert.equal(safety.classifyMxLookup({ Status: 0 }), 'no_mail_server', 'fara MX = nu primeste email');
assert.equal(safety.classifyMxLookup({ Status: 0, Answer: [{ type: 15, data: '0 .' }] }), 'no_mail_server', 'Null MX (RFC 7505)');
assert.equal(safety.classifyMxLookup({ Status: 2 }), 'dns_error');
assert.equal(safety.classifyMxLookup(null), 'lookup_failed');
assert.equal(safety.emailDomain('Office@Lensa.RO'), 'lensa.ro');

// ── 2. Mediu simulat ─────────────────────────────────────────────────────────────────────────
const webhookSecretBytes = randomBytes(32);
const ENV = {
  RESEND_API_KEY: 're_test',
  OUTREACH_UNSUBSCRIBE_SECRET: 'test-unsubscribe-secret-0123456789abcdef',
  RESEND_WEBHOOK_SECRET: `whsec_${webhookSecretBytes.toString('base64')}`,
};
globalThis.Deno = { env: { get: (key) => ENV[key] } };

const DNS = {
  'disparut.ro': { Status: 3 },
  'faramx.ro': { Status: 0 },
  'servfail.ro': { Status: 2 },
};
const DNS_UNREACHABLE = new Set(['nuraspunde.ro']);
let resendBatches = [];
let messageSeq = 0;

globalThis.fetch = async (url, options = {}) => {
  const target = new URL(String(url));
  if (target.hostname === 'cloudflare-dns.com' || target.hostname === 'dns.google') {
    const name = target.searchParams.get('name');
    if (DNS_UNREACHABLE.has(name)) return new Response('unavailable', { status: 503 });
    const answer = DNS[name] || { Status: 0, Answer: [{ type: 15, data: `10 mx.${name}.` }] };
    return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/dns-json' } });
  }
  if (target.hostname === 'api.resend.com' && target.pathname === '/emails/batch') {
    const payloads = JSON.parse(options.body);
    resendBatches.push(payloads);
    return new Response(JSON.stringify({ data: payloads.map(() => ({ id: `msg-${++messageSeq}` })) }), { status: 200 });
  }
  throw new Error(`fetch neasteptat in test: ${url}`);
};

function createStore() {
  const tables = new Map();
  let seq = 0;
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const clone = (value) => (value === undefined ? value : structuredClone(value));
  const entities = new Proxy({}, {
    get: (_target, name) => ({
      async get(id) {
        const row = table(name).get(id);
        if (!row) throw new Error(`${name} ${id} nu exista`);
        return clone(row);
      },
      async filter(query = {}) {
        return [...table(name).values()].filter((row) => Object.entries(query).every(([key, value]) => row[key] === value)).map(clone);
      },
      async list() {
        return [...table(name).values()].map(clone);
      },
      async create(data) {
        seq += 1;
        const row = { id: `${name}-${seq}`, created_date: new Date().toISOString(), ...clone(data) };
        table(name).set(row.id, row);
        return clone(row);
      },
      async update(id, patch) {
        const row = table(name).get(id);
        if (!row) throw new Error(`${name} ${id} nu exista`);
        Object.assign(row, clone(patch));
        return clone(row);
      },
      async delete(id) {
        table(name).delete(id);
      },
    }),
  });
  return { rows: (name) => [...table(name).values()], row: (name, id) => table(name).get(id), svc: { entities } };
}

async function loadHandler(relativePath) {
  const result = await build({
    entryPoints: [path.join(root, relativePath)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [{
      name: 'stub-base44-sdk',
      setup(builder) {
        builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export function createClientFromRequest(req) { return globalThis.__outreachTestClient(req); }',
          loader: 'js',
        }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const sendOps = await loadHandler('base44/functions/directoryOps/outreachSendOps.ts');
const webhookOps = await loadHandler('base44/functions/directoryOps/outreachWebhookOps.ts');
const campaignOps = await loadHandler('base44/functions/directoryOps/outreachCampaignOps.ts');

function useStore(store, user = null) {
  globalThis.__outreachTestClient = () => ({ asServiceRole: store.svc, auth: { me: async () => user } });
}

async function runSender(store) {
  useStore(store);
  const response = await sendOps.handle(new Request('https://viasee.test/api', {
    method: 'POST',
    body: JSON.stringify({ action: 'advance_campaign_sends', __automation_trigger: true }),
  }));
  return response.json();
}

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@viasee.test' };
async function callCampaignOps(store, payload) {
  useStore(store, ADMIN);
  const response = await campaignOps.handle(new Request('https://viasee.test/api', { method: 'POST', body: JSON.stringify(payload) }));
  return response.json();
}

async function sendWebhook(store, event) {
  useStore(store);
  const body = JSON.stringify(event);
  const id = `evt_${randomBytes(6).toString('hex')}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', webhookSecretBytes).update(`${id}.${timestamp}.${body}`).digest('base64');
  const response = await webhookOps.handle(new Request('https://viasee.test/api', {
    method: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` },
    body,
  }));
  return response.json();
}

async function seedContact(store, email, extra = {}) {
  return store.svc.entities.OutreachContact.create({
    email,
    normalized_email: email,
    company_name: `Firma ${email}`,
    city: 'Cluj-Napoca',
    status: 'new',
    email_status: 'active',
    lawful_basis: 'legitimate_interest',
    source_url: 'https://registru.test',
    collection_date: '2026-09-01T00:00:00.000Z',
    source_type: 'public_directory',
    ...extra,
  });
}

async function seedCampaign(store, contactIds, extra = {}) {
  return store.svc.entities.OutreachCampaign.create({
    name: 'Test',
    subject: 'Profilul dumneavoastra',
    body_html: 'Buna ziua, [FIRMA].',
    from_email: 'contact@mail.viasee.ro',
    status: 'ready',
    recipient_contact_ids: contactIds,
    recipient_count: contactIds.length,
    current_cursor: 0,
    sent_count: 0,
    ...extra,
  });
}

const sentRecipients = () => resendBatches.flat().map((payload) => payload.to[0]);

// ── 3. Limita zilnica + verificarea domeniului ─────────────────────────────────────────────────
{
  const store = createStore();
  resendBatches = [];
  const special = [
    'office@disparut.ro', // domeniul nu exista
    'office@faramx.ro', // domeniul exista, dar nu primeste email
    'office@servfail.ro', // DNS-ul domeniului da eroare
    'office@nuraspunde.ro', // noi n-am putut intreba DNS-ul: se trimite
  ];
  const emails = [...special, ...Array.from({ length: 66 }, (_, i) => `contact${i}@optica${i}.ro`)];
  const contacts = [];
  for (const email of emails) contacts.push(await seedContact(store, email));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));

  const first = await runSender(store);
  assert.equal(first.processed, true, JSON.stringify(first));
  assert.equal(first.outcome.sent, 50, 'prima zi: exact 50 de emailuri trimise');
  assert.equal(first.outcome.daily_limit, 50);
  assert.equal(first.outcome.daily_limit_reached, true);
  const recipients = sentRecipients();
  assert.equal(recipients.length, 50);
  assert.ok(!recipients.includes('office@disparut.ro') && !recipients.includes('office@faramx.ro') && !recipients.includes('office@servfail.ro'), 'domeniile care nu pot primi email nu primesc nimic');
  assert.ok(recipients.includes('office@nuraspunde.ro'), 'o cautare DNS esuata la noi nu blocheaza trimiterea');

  const logs = store.rows('OutreachCampaignLog');
  const byEmail = (email) => logs.find((log) => log.email === email);
  assert.equal(byEmail('office@disparut.ro').status, 'invalid');
  assert.equal(byEmail('office@disparut.ro').reason, 'undeliverable_domain:domain_missing');
  assert.equal(byEmail('office@faramx.ro').reason, 'undeliverable_domain:no_mail_server');
  assert.equal(byEmail('office@servfail.ro').status, 'skipped');
  assert.equal(byEmail('office@servfail.ro').reason, 'domain_dns_error');

  assert.equal(store.row('OutreachContact', contacts[0].id).email_domain_status, 'domain_missing', 'rezultatul ramane pe contact');
  assert.equal(store.row('OutreachContact', contacts[1].id).email_domain_status, 'no_mail_server');
  assert.equal(store.row('OutreachContact', contacts[2].id).email_domain_status, 'dns_error');
  assert.equal(store.row('OutreachContact', contacts[3].id).email_domain_status, undefined, 'lookup_failed nu se scrie pe contact');

  const afterFirst = store.row('OutreachCampaign', campaign.id);
  assert.equal(afterFirst.status, 'sending');
  assert.equal(afterFirst.sent_count, 50);
  assert.equal(afterFirst.current_cursor, 53, '50 trimise + 3 sarite');
  assert.equal(afterFirst.next_send_after, safety.nextSendResumeAt(new Date()).toISOString(), 'reluare maine la 09:00, ora Romaniei');
  assert.equal(afterFirst.execution_lock_token, '', 'lock-ul e eliberat');

  const second = await runSender(store);
  assert.equal(second.processed, false, 'in aceeasi zi campania nu mai e preluata de cron');
  assert.equal(sentRecipients().length, 50);

  // A doua zi: jurnalul de ieri, asteptarea expirata -> limita 100, se termina restul de 17.
  for (const log of store.rows('OutreachCampaignLog')) {
    if (log.sent_at) log.sent_at = new Date(new Date(log.sent_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
  store.row('OutreachCampaign', campaign.id).next_send_after = new Date(Date.now() - 60 * 1000).toISOString();
  const third = await runSender(store);
  assert.equal(third.outcome.daily_limit, 100, 'a doua zi de trimitere: limita dubla');
  assert.equal(third.outcome.sent, 17);
  assert.equal(third.outcome.finished, true);
  const done = store.row('OutreachCampaign', campaign.id);
  assert.equal(done.status, 'sent');
  assert.equal(done.next_send_after, null);
  assert.equal(new Set(sentRecipients()).size, 67, 'fiecare adresa trimisa o singura data');
}

// ── 4. Oprirea automata din trimitere + reluarea de catre admin ─────────────────────────────────
{
  const store = createStore();
  resendBatches = [];
  const contacts = [];
  for (let i = 0; i < 10; i += 1) contacts.push(await seedContact(store, `rest${i}@clinica${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id), { status: 'sending', sent_count: 60, bounced_count: 3 });

  const paused = await runSender(store);
  assert.equal(paused.outcome.auto_paused, 'bounce_rate', JSON.stringify(paused));
  assert.equal(resendBatches.length, 0, 'peste prag nu mai pleaca niciun email');
  const afterPause = store.row('OutreachCampaign', campaign.id);
  assert.equal(afterPause.status, 'paused');
  assert.equal(afterPause.pause_reason, 'bounce_rate');
  assert.match(afterPause.failure_message, /3 emailuri respinse din 60 trimise \(5,0%\)/);
  assert.equal(afterPause.execution_lock_token, '');
  assert.ok(store.rows('DirectoryAuditRecord').some((row) => row.action_type === 'outreach_campaign_auto_paused' && row.entity_id === campaign.id), 'oprirea automata apare in audit');

  const resumed = await callCampaignOps(store, { action: 'resume_campaign', id: campaign.id });
  assert.ok(!resumed.error, resumed.error);
  const afterResume = store.row('OutreachCampaign', campaign.id);
  assert.equal(afterResume.status, 'ready');
  assert.equal(afterResume.pause_reason, '');
  assert.equal(afterResume.failure_message, '');
  assert.equal(afterResume.health_baseline.sent, 60);
  assert.equal(afterResume.health_baseline.bounced, 3);

  const continued = await runSender(store);
  assert.equal(continued.outcome.sent, 10, 'dupa reluare trimiterea continua');
  assert.equal(store.row('OutreachCampaign', campaign.id).status, 'sent');

  // O pauza pusa de admin nu reseteaza protectia.
  const other = await seedCampaign(store, [contacts[0].id], { status: 'sending', sent_count: 10 });
  await callCampaignOps(store, { action: 'pause_campaign', id: other.id });
  assert.equal(store.row('OutreachCampaign', other.id).pause_reason, 'admin');
  await callCampaignOps(store, { action: 'resume_campaign', id: other.id });
  assert.equal(store.row('OutreachCampaign', other.id).health_baseline, undefined);
}

// ── 5. Oprirea automata din webhook (respingere / reclamatie) ───────────────────────────────────
{
  const store = createStore();
  const contact = await seedContact(store, 'office@respins.ro');
  const campaign = await seedCampaign(store, [contact.id], { status: 'sending', sent_count: 49, bounced_count: 1 });
  await store.svc.entities.OutreachCampaignLog.create({
    campaign_id: campaign.id, contact_id: contact.id, email: 'office@respins.ro', normalized_email: 'office@respins.ro',
    status: 'sent', resend_message_id: 'msg-bounce', sent_at: new Date().toISOString(),
  });
  const bounced = await sendWebhook(store, {
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: { email_id: 'msg-bounce', to: ['office@respins.ro'], bounce: { type: 'Permanent', message: 'Mailbox does not exist' } },
  });
  assert.equal(bounced.processed, true, JSON.stringify(bounced));
  const afterBounce = store.row('OutreachCampaign', campaign.id);
  assert.equal(afterBounce.bounced_count, 2);
  assert.equal(afterBounce.status, 'paused', '2 respinse din 49 (peste 3%) opresc campania imediat');
  assert.equal(afterBounce.pause_reason, 'bounce_rate');

  const complainContact = await seedContact(store, 'office@reclamatie.ro');
  const quiet = await seedCampaign(store, [complainContact.id], { status: 'sending', sent_count: 200 });
  await store.svc.entities.OutreachCampaignLog.create({
    campaign_id: quiet.id, contact_id: complainContact.id, email: 'office@reclamatie.ro', normalized_email: 'office@reclamatie.ro',
    status: 'delivered', resend_message_id: 'msg-complaint', sent_at: new Date().toISOString(),
  });
  await sendWebhook(store, {
    type: 'email.complained',
    created_at: new Date().toISOString(),
    data: { email_id: 'msg-complaint', to: ['office@reclamatie.ro'] },
  });
  assert.equal(store.row('OutreachCampaign', quiet.id).pause_reason, 'complaints', 'o reclamatie de spam opreste campania');

  // O campanie deja terminata nu e atinsa de un bounce venit tarziu.
  const finished = await seedCampaign(store, [contact.id], { status: 'sent', sent_count: 10, bounced_count: 0 });
  await store.svc.entities.OutreachCampaignLog.create({
    campaign_id: finished.id, contact_id: contact.id, email: 'late@tarziu.ro', normalized_email: 'late@tarziu.ro',
    status: 'sent', resend_message_id: 'msg-late', sent_at: new Date().toISOString(),
  });
  await sendWebhook(store, { type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: 'msg-late', to: ['late@tarziu.ro'] } });
  assert.equal(store.row('OutreachCampaign', finished.id).status, 'sent');
}

// ── 6. Aprobare, sincronizare si schimbarea ritmului ───────────────────────────────────────────
{
  const store = createStore();
  await seedContact(store, 'a@optica-a.ro', { email_domain_status: 'ok' });
  await seedContact(store, 'b@optica-b.ro');
  await seedContact(store, 'c@faramx.ro', { email_domain_status: 'no_mail_server' });
  const draft = await store.svc.entities.OutreachCampaign.create({
    name: 'Pilot', subject: 'S', body_html: 'B', from_email: 'contact@mail.viasee.ro', status: 'draft',
  });
  const approval = await callCampaignOps(store, { action: 'approve_campaign', id: draft.id, confirmation_text: '' });
  assert.equal(approval.recipient_count, 2, 'adresele pe domenii fara email nu intra in lista la aprobare');
  assert.equal(approval.expected_confirmation, 'TRIMITE Pilot 2');

  const updated = await callCampaignOps(store, { action: 'update_campaign', id: draft.id, daily_send_limit: '5', daily_send_ramp: false });
  assert.equal(updated.campaign.daily_send_limit, 10, 'limita e adusa in intervalul permis');
  assert.equal(updated.campaign.daily_send_ramp, false);

  store.row('OutreachCampaign', draft.id).status = 'sending';
  store.row('OutreachCampaign', draft.id).next_send_after = new Date(Date.now() + 3600 * 1000).toISOString();
  const changed = await callCampaignOps(store, { action: 'set_daily_send_limit', id: draft.id, daily_send_limit: 200, daily_send_ramp: true });
  assert.equal(changed.campaign.daily_send_limit, 200);
  assert.equal(changed.campaign.next_send_after, null, 'o limita noua anuleaza asteptarea pana maine');
  assert.ok(store.rows('DirectoryAuditRecord').some((row) => row.action_type === 'outreach_campaign_daily_limit_changed'));

  const syncStore = createStore();
  await syncStore.svc.entities.ProviderOrganization.create({ name: 'Org' });
  await syncStore.svc.entities.ProviderLocation.create({ name: 'Optica Buna', status: 'publicata', public_email: 'office@buna.ro', city: 'Iasi', provider_type: 'optica_medicala' });
  await syncStore.svc.entities.ProviderLocation.create({ name: 'Optica Inchisa', status: 'publicata', public_email: 'office@disparut.ro', city: 'Iasi', provider_type: 'optica_medicala' });
  const sync = await callCampaignOps(syncStore, { action: 'sync_contacts_from_directory', cursor: 0 });
  assert.equal(sync.created, 2, JSON.stringify(sync));
  assert.equal(sync.undeliverable_domains, 1);
  const synced = syncStore.rows('OutreachContact');
  assert.equal(synced.find((c) => c.email === 'office@disparut.ro').email_domain_status, 'domain_missing');
  assert.equal(synced.find((c) => c.email === 'office@buna.ro').email_domain_status, 'ok');
  const resync = await callCampaignOps(syncStore, { action: 'sync_contacts_from_directory', cursor: 0 });
  assert.equal(resync.unchanged, 2, 'o resincronizare fara schimbari nu rescrie nimic');
}

console.log(JSON.stringify({
  outreach_send_safety: ['daily_limit_ramp', 'auto_pause_sender', 'auto_pause_webhook', 'recipient_domain_mx'],
  daily_limit_default: safety.DAILY_SEND_LIMIT_DEFAULT,
  health_limits: safety.CAMPAIGN_HEALTH_LIMITS,
}));
