// Verifica protectiile trimiterii de outreach (base44/shared/outreachSendSafety.js) si le ruleaza
// cap-coada prin handler-ele reale (outreachSendOps / outreachWebhookOps / outreachCampaignOps),
// cu o baza de date in memorie, Resend si DNS simulate (scripts/lib/outreachTestHarness.mjs):
// 1. limita zilnica (50 in prima zi, apoi dublu) + reluarea a doua zi la 09:00, ora Romaniei;
// 2. oprirea automata la prea multe respingeri / la o reclamatie de spam, din trimitere si din
//    webhook, socotita din jurnal (nu din contoare care pot pierde incrementari), si reluarea;
// 3. verificarea domeniului (MX): domeniile disparute / fara server de email nu primesc nimic,
//    iar o cautare DNS esuata la noi NU blocheaza trimiterea;
// 4. nimeni nu primeste acelasi email de doua ori: doar cronul (credential de serviciu) sau un admin
//    porneste trimiterea, doua rulari suprapuse trimit o singura data, o rulare care si-a pierdut
//    lock-ul nu mai trimite, un lot al carui raspuns s-a pierdut nu pleaca a doua oara;
// 5. o adresa refuzata de Resend nu blocheaza restul lotului, o campanie esuata se poate relua;
// 6. o pauza data de admin ramane pauza, chiar daca lotul in curs esueaza;
// 7. webhook-ul leaga evenimentele de campania exacta (etichete), asteapta jurnalul (503) si nu
//    coboara starea unui email la un eveniment intarziat.
import assert from 'node:assert/strict';
import {
  installOutreachEnvironment,
  createStore,
  loadHandler,
  callHandler,
  runSender as runSenderWith,
  resendEvent,
  sendWebhook as sendWebhookWith,
  seedContact,
  seedCampaign,
  SERVICE_HEADERS,
  ADMIN,
} from './lib/outreachTestHarness.mjs';

const safety = await import('../base44/shared/outreachSendSafety.js');
const audience = await import('../base44/shared/outreachAudiencePolicy.js');

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
assert.deepEqual(
  safety.withLogHealthCounters({ sent_count: 50, bounced_count: 0, complained_count: 0 }, { sent: 40, bounced: 3, complained: 1 }),
  { sent_count: 50, bounced_count: 3, complained_count: 1 },
  'protectia ia maximul dintre contoare si jurnal: o respingere pierduta dintr-un contor tot conteaza',
);

assert.equal(safety.classifyMxLookup({ Status: 0, Answer: [{ type: 15, data: '10 mx.firma.ro.' }] }), 'ok');
assert.equal(safety.classifyMxLookup({ Status: 3 }), 'domain_missing');
assert.equal(safety.classifyMxLookup({ Status: 0 }), 'no_mail_server', 'fara MX = nu primeste email');
assert.equal(safety.classifyMxLookup({ Status: 0, Answer: [{ type: 15, data: '0 .' }] }), 'no_mail_server', 'Null MX (RFC 7505)');
assert.equal(safety.classifyMxLookup({ Status: 2 }), 'dns_error');
assert.equal(safety.classifyMxLookup(null), 'lookup_failed');
assert.equal(safety.emailDomain('Office@Lensa.RO'), 'lensa.ro');

assert.equal(audience.logOutcome({ sent_at: 't', status: 'sent', bounced_at: 't2' }), 'bounced', 'un \"sent\" venit dupa \"bounced\" nu ascunde respingerea');
assert.equal(audience.logOutcome({ sent_at: 't', status: 'delivered', complained_at: 't2' }), 'complained');
assert.equal(audience.logOutcome({ sent_at: 't', status: 'unsubscribed', delivered_at: 't' }), 'unsubscribed');
assert.equal(audience.shouldReplaceLogStatus('bounced', 'delivered'), false);
assert.equal(audience.shouldReplaceLogStatus('delivered', 'sent'), false);
assert.equal(audience.shouldReplaceLogStatus('delivered', 'complained'), true);
assert.equal(audience.shouldReplaceLogStatus('complained', 'unsubscribed'), false);

// ── 2. Mediu simulat ─────────────────────────────────────────────────────────────────────────
const { env, state, webhookSecretBytes } = installOutreachEnvironment({
  dns: {
    'disparut.ro': { Status: 3 },
    'faramx.ro': { Status: 0 },
    'servfail.ro': { Status: 2 },
  },
  dnsUnreachable: ['nuraspunde.ro'],
});

const sendOps = await loadHandler('base44/functions/directoryOps/outreachSendOps.ts');
const webhookOps = await loadHandler('base44/functions/directoryOps/outreachWebhookOps.ts');
const campaignOps = await loadHandler('base44/functions/directoryOps/outreachCampaignOps.ts');

const runSender = (store, options) => runSenderWith(sendOps, store, options);
const callCampaignOps = (store, payload) => callHandler(campaignOps, store, payload, { user: ADMIN });
const sendWebhook = (store, event) => sendWebhookWith(webhookOps, store, webhookSecretBytes, event);
const resetResend = () => {
  state.resendBatches = [];
  state.resendSingles = [];
  state.idempotencyKeys = [];
  state.idempotentReplays = 0;
  state.rejectAddresses = new Set();
  state.failNextBatches = [];
  state.loseNextResponse = false;
  state.rejectAll = '';
  state.onBatch = null;
  state.onDns = null;
  state.clearIdempotency();
};
const sentRecipients = () => [...state.resendBatches.flat(), ...state.resendSingles].map((payload) => payload.to[0]);

async function seedSentLog(store, campaign, contact, extra = {}) {
  return store.svc.entities.OutreachCampaignLog.create({
    campaign_id: campaign.id, contact_id: contact.id, email: contact.email, normalized_email: contact.email,
    status: 'sent', sent_at: new Date().toISOString(), resend_message_id: `seed-${contact.id}`, ...extra,
  });
}

// ── 3. Limita zilnica + verificarea domeniului ─────────────────────────────────────────────────
{
  const store = createStore();
  resetResend();
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

  const firstPayload = state.resendBatches[0][0];
  assert.deepEqual(firstPayload.tags.map((tag) => tag.name), ['viasee_campaign', 'viasee_contact'], 'fiecare email poarta campania si contactul');
  assert.equal(firstPayload.tags[0].value, campaign.id);
  assert.ok(state.idempotencyKeys.every((key) => key.startsWith(`viasee-outreach-${campaign.id}-`)), 'fiecare lot pleaca cu cheie de idempotenta');

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
  resetResend();
  const contacts = [];
  for (let i = 0; i < 10; i += 1) contacts.push(await seedContact(store, `rest${i}@clinica${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id), { status: 'sending', sent_count: 60, bounced_count: 3 });

  const paused = await runSender(store);
  assert.equal(paused.outcome.auto_paused, 'bounce_rate', JSON.stringify(paused));
  assert.equal(state.resendBatches.length, 0, 'peste prag nu mai pleaca niciun email');
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
{
  // Contoarele salvate raman in urma (webhook-uri simultane), jurnalul arata 3 respinse din 50:
  // campania se opreste oricum.
  const store = createStore();
  const stale = [];
  for (let i = 0; i < 51; i += 1) stale.push(await seedContact(store, `stale${i}@firma${i}.ro`));
  const staleCampaign = await seedCampaign(store, stale.map((c) => c.id), { status: 'sending', sent_count: 50, bounced_count: 0, current_cursor: 50 });
  for (let i = 0; i < 50; i += 1) {
    await seedSentLog(store, staleCampaign, stale[i], i < 3 ? { status: 'bounced', bounced_at: new Date().toISOString() } : { status: 'delivered', delivered_at: new Date().toISOString() });
  }
  resetResend();
  const fromLogs = await runSender(store);
  assert.equal(fromLogs.outcome.auto_paused, 'bounce_rate', 'respingerile se numara din jurnal, nu doar din contor');
  assert.equal(state.resendBatches.length, 0);
}

// ── 5. Oprirea automata din webhook (respingere / reclamatie) ───────────────────────────────────
{
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 50; i += 1) contacts.push(await seedContact(store, `livrat${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id), { status: 'sending', sent_count: 50, bounced_count: 1, current_cursor: 50 });
  for (let i = 0; i < 48; i += 1) await seedSentLog(store, campaign, contacts[i], { status: 'delivered', delivered_at: new Date().toISOString() });
  await seedSentLog(store, campaign, contacts[48], { status: 'bounced', bounced_at: new Date().toISOString() });
  await seedSentLog(store, campaign, contacts[49], { resend_message_id: 'msg-bounce' });

  const tags = (c, contact) => ({ viasee_campaign: c.id, viasee_contact: contact.id });
  const bounced = await sendWebhook(store, {
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: { email_id: 'msg-bounce', to: [contacts[49].email], tags: tags(campaign, contacts[49]), bounce: { type: 'Permanent', message: 'Mailbox does not exist' } },
  });
  assert.equal(bounced.processed, true, JSON.stringify(bounced));
  const afterBounce = store.row('OutreachCampaign', campaign.id);
  assert.equal(afterBounce.bounced_count, 2, 'respingerile se renumara din jurnal');
  assert.equal(afterBounce.status, 'paused', '2 respinse din 50 (peste 3%) opresc campania imediat');
  assert.equal(afterBounce.pause_reason, 'bounce_rate');

  // Un \"delivered\" intarziat nu sterge respingerea.
  const lateDelivered = await sendWebhook(store, { type: 'email.delivered', created_at: new Date().toISOString(), data: { email_id: 'msg-bounce', to: [contacts[49].email], tags: tags(campaign, contacts[49]) } });
  assert.equal(lateDelivered.processed, true);
  const bouncedLog = store.rows('OutreachCampaignLog').find((log) => log.resend_message_id === 'msg-bounce');
  assert.equal(bouncedLog.status, 'bounced');
  assert.equal(audience.logOutcome(bouncedLog), 'bounced');

  const complainContact = await seedContact(store, 'office@reclamatie.ro');
  const quiet = await seedCampaign(store, [complainContact.id], { status: 'sending', sent_count: 200 });
  await seedSentLog(store, quiet, complainContact, { status: 'delivered', resend_message_id: 'msg-complaint', delivered_at: new Date().toISOString() });
  await sendWebhook(store, {
    type: 'email.complained',
    created_at: new Date().toISOString(),
    data: { email_id: 'msg-complaint', to: ['office@reclamatie.ro'], tags: [{ name: 'viasee_campaign', value: quiet.id }, { name: 'viasee_contact', value: complainContact.id }] },
  });
  assert.equal(store.row('OutreachCampaign', quiet.id).pause_reason, 'complaints', 'o reclamatie de spam opreste campania (etichete in forma de lista)');

  // O campanie deja terminata nu e atinsa de un bounce venit tarziu.
  const lateContact = await seedContact(store, 'late@tarziu.ro');
  const finished = await seedCampaign(store, [lateContact.id], { status: 'sent', sent_count: 10, bounced_count: 0 });
  await seedSentLog(store, finished, lateContact, { resend_message_id: 'msg-late' });
  await sendWebhook(store, { type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: 'msg-late', to: ['late@tarziu.ro'], tags: tags(finished, lateContact) } });
  assert.equal(store.row('OutreachCampaign', finished.id).status, 'sent');
}

// ── 6. Webhook: campania exacta, asteptarea jurnalului, emailurile de test ────────────────────
{
  const store = createStore();
  resetResend();
  const contact = await seedContact(store, 'aceeasi@adresa.ro');
  const first = await seedCampaign(store, [contact.id], { status: 'sent' });
  const second = await seedCampaign(store, [contact.id], { status: 'sending', sent_count: 1 });
  await seedSentLog(store, first, contact, { resend_message_id: 'msg-first', status: 'delivered', delivered_at: new Date().toISOString() });

  // Evenimentul pentru a doua campanie vine inaintea jurnalului ei: 503, Resend il retrimite.
  const early = { type: 'email.delivered', created_at: new Date().toISOString(), data: { email_id: 'msg-second', to: ['aceeasi@adresa.ro'], tags: { viasee_campaign: second.id, viasee_contact: contact.id } } };
  const waiting = await sendWebhook(store, early);
  assert.equal(waiting.__status, 503, 'fara jurnal inca: Resend trebuie sa reincerce');
  assert.equal(waiting.retry, true);
  assert.equal(store.rows('OutreachCampaignLog').length, 1, 'nicio intrare inventata');
  assert.equal(store.rows('OutreachCampaignLog')[0].status, 'delivered', 'jurnalul altei campanii cu aceeasi adresa nu e atins');

  await seedSentLog(store, second, contact, { resend_message_id: 'msg-second' });
  const retried = await sendWebhook(store, early);
  assert.equal(retried.processed, true, JSON.stringify(retried));
  const secondLog = store.rows('OutreachCampaignLog').find((log) => log.campaign_id === second.id);
  assert.equal(secondLog.status, 'delivered');

  // Bounce pe prima campanie: doar jurnalul ei, desi adresa e aceeasi.
  await sendWebhook(store, { type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: 'msg-first', to: ['aceeasi@adresa.ro'], tags: { viasee_campaign: first.id, viasee_contact: contact.id } } });
  assert.equal(store.rows('OutreachCampaignLog').find((log) => log.campaign_id === first.id).status, 'bounced');
  assert.equal(store.rows('OutreachCampaignLog').find((log) => log.campaign_id === second.id).status, 'delivered');

  // Email de test (fara eticheta de campanie): niciun jurnal, dar respingerea blocheaza adresa.
  const testBounce = await sendWebhook(store, { type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: 'msg-test', to: ['test@inexistent.ro'], tags: { viasee_test: first.id } } });
  assert.equal(testBounce.tracked, false);
  assert.ok(!store.rows('OutreachCampaignLog').some((log) => log.email === 'test@inexistent.ro'), 'un test nu apare in rapoarte');
  assert.ok(store.rows('OutreachSuppression').some((row) => row.normalized_email === 'test@inexistent.ro'), 'adresa respinsa ramane blocata');

  // Un eveniment etichetat, dar vechi de ore, fara jurnal: nu mai asteptam, doar suprimarea.
  const old = await sendWebhook(store, { type: 'email.bounced', created_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString(), data: { email_id: 'msg-lost', to: ['pierdut@firma.ro'], tags: { viasee_campaign: second.id, viasee_contact: 'necunoscut' } } });
  assert.equal(old.orphan, true, JSON.stringify(old));
  assert.ok(store.rows('OutreachSuppression').some((row) => row.normalized_email === 'pierdut@firma.ro'));
}

// ── 7. Cine poate porni trimiterea ────────────────────────────────────────────────────────────
{
  const store = createStore();
  resetResend();
  const contact = await seedContact(store, 'office@acces.ro');
  const campaign = await seedCampaign(store, [contact.id]);

  const anonymous = await runSender(store, { headers: {} });
  assert.equal(anonymous.__status, 403, 'un apel anonim cu __automation_trigger nu porneste nimic');
  const halfForged = await runSender(store, { headers: { authorization: SERVICE_HEADERS.authorization } });
  assert.equal(halfForged.__status, 403);
  const forged = await runSender(store, { rejectServiceRole: true });
  assert.equal(forged.__status, 403, 'un credential de serviciu inventat nu trece de citirea de validare');
  const nonAdmin = await runSender(store, { headers: {}, user: { id: 'u', role: 'user' } });
  assert.equal(nonAdmin.__status, 403);
  assert.equal(state.resendBatches.length, 0);
  assert.equal(store.row('OutreachCampaign', campaign.id).status, 'ready');

  const byCron = await runSender(store);
  assert.equal(byCron.outcome.finished, true, JSON.stringify(byCron));
  assert.deepEqual(sentRecipients(), ['office@acces.ro']);

  const other = await seedCampaign(store, [(await seedContact(store, 'office@admin.ro')).id]);
  const byAdmin = await runSender(store, { headers: {}, user: ADMIN });
  assert.equal(byAdmin.outcome.campaign_id, other.id, 'un admin poate porni trimiterea manual');
}

// ── 8. Doua rulari suprapuse, lock pierdut, raspuns pierdut ───────────────────────────────────
{
  // Doua invocari simultane; scrierea lock-ului primei ajunge cu intarziere (ordinea scrierilor nu
  // e garantata). Confirmarea dubla lasa o singura rulare sa trimita.
  const store = createStore();
  resetResend();
  env.OUTREACH_LOCK_CONFIRM_MS = '25';
  const contacts = [];
  for (let i = 0; i < 12; i += 1) contacts.push(await seedContact(store, `paralel${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  let delayed = false;
  store.hooks.beforeUpdate = async (entity, _id, patch) => {
    if (entity === 'OutreachCampaign' && patch.execution_lock_token && !delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  const [a, b] = await Promise.all([runSender(store), runSender(store)]);
  store.hooks.beforeUpdate = null;
  env.OUTREACH_LOCK_CONFIRM_MS = '0';
  assert.equal([a, b].filter((result) => result.processed).length, 1, `o singura rulare preia campania: ${JSON.stringify([a, b])}`);
  const recipients = sentRecipients();
  assert.equal(recipients.length, 12);
  assert.equal(new Set(recipients).size, 12, 'fiecare adresa o singura data');
  assert.equal(store.row('OutreachCampaign', campaign.id).status, 'sent');
  assert.equal(store.rows('OutreachCampaignLog').filter((log) => log.status === 'sent').length, 12);
}
{
  // Lock-ul expira in timpul pregatirii lotului si e preluat de alta invocare: rularea veche nu
  // mai trimite si nu scrie nimic peste cea noua.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 3; i += 1) contacts.push(await seedContact(store, `preluat${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  state.onDns = async () => {
    const row = store.row('OutreachCampaign', campaign.id);
    row.execution_lock_token = 'alta-invocare';
    row.execution_lock_expires_at = new Date(Date.now() + 60000).toISOString();
  };
  const lost = await runSender(store);
  state.onDns = null;
  assert.equal(lost.outcome.lost_lock, true, JSON.stringify(lost));
  assert.equal(state.resendBatches.length, 0, 'fara lock nu pleaca nimic');
  assert.equal(store.row('OutreachCampaign', campaign.id).execution_lock_token, 'alta-invocare', 'lock-ul noii rulari ramane neatins');
  assert.equal(store.row('OutreachCampaign', campaign.id).current_cursor, 0);
}
{
  // Resend a trimis lotul, dar raspunsul s-a pierdut (timeout). Reincercarea compune exact acelasi
  // lot, cu aceeasi cheie: Resend intoarce raspunsul initial si nu trimite a doua oara.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 4; i += 1) contacts.push(await seedContact(store, `timeout${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  state.loseNextResponse = true;
  const firstTry = await runSender(store);
  assert.equal(firstTry.outcome.retry_scheduled, true, JSON.stringify(firstTry));
  assert.equal(store.row('OutreachCampaign', campaign.id).current_cursor, 0, 'cursorul ramane pe loc');
  assert.equal(store.row('OutreachCampaign', campaign.id).status, 'sending');
  const retry = await runSender(store);
  assert.equal(retry.outcome.finished, true, JSON.stringify(retry));
  assert.equal(state.idempotentReplays, 1, 'a doua cerere a primit raspunsul primei');
  assert.equal(state.idempotencyKeys[0], state.idempotencyKeys[1], 'acelasi lot, aceeasi cheie');
  assert.equal(state.resendBatches.length, 1, 'lotul a plecat o singura data');
  assert.equal(new Set(sentRecipients()).size, 4);
  assert.ok(store.rows('OutreachCampaignLog').every((log) => log.resend_message_id), 'jurnalul are id-urile primei trimiteri');
  assert.equal(store.row('OutreachCampaign', campaign.id).consecutive_send_failures, 0);
  assert.equal(store.row('OutreachCampaign', campaign.id).inflight_batch, null, 'lotul nu mai e "in aer"');
}
{
  // Raspuns pierdut, apoi intre doua rulari un destinatar se dezaboneaza chiar din emailul primit,
  // iar jurnalul unui alt destinatar apucase sa fie scris. Lotul se retrimite IDENTIC (fara
  // refiltrare), deci Resend il recunoaste: nimeni nu primeste de doua ori.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 4; i += 1) contacts.push(await seedContact(store, `aer${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  state.loseNextResponse = true;
  const firstTry = await runSender(store);
  assert.equal(firstTry.outcome.retry_scheduled, true, JSON.stringify(firstTry));
  const inflight = store.row('OutreachCampaign', campaign.id).inflight_batch;
  assert.deepEqual(inflight.contact_ids, contacts.map((c) => c.id), 'lotul nesigur e notat pe campanie');
  await store.svc.entities.OutreachSuppression.create({ email: contacts[0].email, normalized_email: contacts[0].email, status: 'unsubscribed', categories: ['all'], is_active: true });
  await seedSentLog(store, campaign, contacts[1], { resend_message_id: '' });
  const retry = await runSender(store);
  assert.equal(retry.outcome.finished, true, JSON.stringify(retry));
  assert.equal(state.resendBatches.length, 1, 'lotul a plecat o singura data');
  assert.equal(state.idempotentReplays, 1);
  const logsFor = (contact) => store.rows('OutreachCampaignLog').filter((log) => log.contact_id === contact.id);
  assert.equal(logsFor(contacts[1]).length, 1, 'jurnalul scris deja nu se dubleaza');
  assert.equal(logsFor(contacts[0])[0].status, 'sent', 'cel dezabonat a primit emailul la prima incercare si asa apare');
  assert.equal(store.row('OutreachCampaign', campaign.id).inflight_batch, null);
}
{
  // Lot nesigur, iar intre timp datele unui destinatar s-au schimbat (resincronizare): alt
  // continut sub aceeasi cheie => Resend spune ca cheia a fost folosita, deci lotul plecase.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 3; i += 1) contacts.push(await seedContact(store, `schimbat${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id), { body_html: 'Buna ziua, [FIRMA].' });
  state.loseNextResponse = true;
  await runSender(store);
  store.row('OutreachContact', contacts[2].id).company_name = 'Nume nou dupa sincronizare';
  const retry = await runSender(store);
  assert.equal(retry.outcome.finished, true, JSON.stringify(retry));
  assert.equal(state.resendBatches.length, 1, 'nu se trimite a doua oara');
  assert.equal(store.rows('OutreachCampaignLog').filter((log) => log.status === 'sent').length, 3);
}
{
  // O citire esuata (jurnal sau suprimari) nu devine o lista goala: rularea se opreste inainte de
  // orice trimitere, lock-ul se elibereaza, iar ciclul urmator continua normal.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 2; i += 1) contacts.push(await seedContact(store, `citire${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  for (const entity of ['OutreachCampaignLog', 'OutreachSuppression']) {
    store.hooks.failReads = new Set([entity]);
    const aborted = await runSender(store);
    assert.equal(aborted.outcome.retry_scheduled, true, `${entity}: ${JSON.stringify(aborted)}`);
    assert.equal(state.resendBatches.length, 0, `${entity}: nimic nu pleaca fara datele complete`);
    assert.equal(store.row('OutreachCampaign', campaign.id).execution_lock_token, '', 'lock-ul e eliberat');
  }
  store.hooks.failReads = new Set();
  const recovered = await runSender(store);
  assert.equal(recovered.outcome.finished, true);
  assert.equal(new Set(sentRecipients()).size, 2);
}

// ── 9. Adresa refuzata de Resend, campanie esuata, reluare ─────────────────────────────────────
{
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 5; i += 1) contacts.push(await seedContact(store, `lot${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  state.rejectAddresses = new Set(['lot2@firma2.ro']);
  const result = await runSender(store);
  assert.equal(result.outcome.finished, true, JSON.stringify(result));
  assert.equal(result.outcome.sent, 4, 'restul lotului pleaca');
  assert.deepEqual(state.resendSingles.map((p) => p.to[0]).sort(), ['lot0@firma0.ro', 'lot1@firma1.ro', 'lot3@firma3.ro', 'lot4@firma4.ro']);
  const rejectedLog = store.rows('OutreachCampaignLog').find((log) => log.email === 'lot2@firma2.ro');
  assert.equal(rejectedLog.reason, 'rejected_by_provider');
  const report = await callCampaignOps(store, { action: 'campaign_report', id: campaign.id });
  assert.equal(report.summary.not_sent_by_reason.rejected_by_provider, 1);
  assert.equal(report.summary.counts.sent, 4);
}
{
  // Ultimul destinatar, singur in lot, e refuzat: se trece in raport si campania se incheie, nu
  // ramane blocata in 'failed'.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 26; i += 1) contacts.push(await seedContact(store, `ultim${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  state.rejectAddresses = new Set(['ultim25@firma25.ro']);
  const result = await runSender(store);
  assert.equal(result.outcome.finished, true, JSON.stringify(result));
  assert.equal(store.row('OutreachCampaign', campaign.id).status, 'sent');
  assert.equal(store.rows('OutreachCampaignLog').find((log) => log.email === 'ultim25@firma25.ro').reason, 'rejected_by_provider');
}
{
  // Resend refuza TOT (ex. expeditor gresit): nicio adresa nu e marcata, campania se opreste, iar
  // dupa remediere adminul o reia din acelasi punct.
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 3; i += 1) contacts.push(await seedContact(store, `toate${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  state.rejectAll = 'Invalid `from` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.';
  const failed = await runSender(store);
  assert.match(failed.outcome.error, /eroare permanenta/, JSON.stringify(failed));
  const afterFail = store.row('OutreachCampaign', campaign.id);
  assert.equal(afterFail.status, 'failed');
  assert.equal(afterFail.current_cursor, 0);
  assert.equal(store.rows('OutreachCampaignLog').length, 0, 'nicio adresa nu e trecuta ca refuzata cand problema e a campaniei');

  assert.ok(store.row('OutreachCampaign', campaign.id).send_key_salt, 'dupa un refuz explicit, cheile se schimba');
  assert.equal(store.row('OutreachCampaign', campaign.id).inflight_batch, null);
  const resumed = await callCampaignOps(store, { action: 'resume_campaign', id: campaign.id });
  assert.ok(!resumed.error, resumed.error);
  assert.equal(store.row('OutreachCampaign', campaign.id).status, 'ready');
  assert.equal(store.row('OutreachCampaign', campaign.id).failure_message, '');
  assert.equal(store.row('OutreachCampaign', campaign.id).consecutive_send_failures, 0);
  state.rejectAll = '';
  const after = await runSender(store);
  assert.equal(after.outcome.finished, true);
  assert.equal(new Set(sentRecipients()).size, 3);

  const toCancel = await seedCampaign(store, [contacts[0].id], { status: 'failed', failure_message: 'x' });
  const cancelled = await callCampaignOps(store, { action: 'cancel_campaign', id: toCancel.id });
  assert.ok(!cancelled.error, cancelled.error);
  assert.equal(store.row('OutreachCampaign', toCancel.id).status, 'cancelled', 'o campanie esuata se poate anula');
}

// ── 10. Pauza adminului ramane pauza ───────────────────────────────────────────────────────────
{
  const store = createStore();
  resetResend();
  const contacts = [];
  for (let i = 0; i < 3; i += 1) contacts.push(await seedContact(store, `pauza${i}@firma${i}.ro`));
  const campaign = await seedCampaign(store, contacts.map((c) => c.id));
  // Adminul apasa Pauza chiar cand lotul pleaca, iar lotul esueaza tranzitoriu.
  state.onBatch = async () => {
    const row = store.row('OutreachCampaign', campaign.id);
    row.status = 'paused';
    row.pause_reason = 'admin';
  };
  state.failNextBatches = [{ status: 503, message: 'Service unavailable' }];
  const result = await runSender(store);
  state.onBatch = null;
  const after = store.row('OutreachCampaign', campaign.id);
  assert.equal(after.status, 'paused', `pauza ramane: ${JSON.stringify(result)}`);
  assert.equal(after.pause_reason, 'admin');
  assert.ok(!after.failure_message, 'mesajul lotului esuat nu acopera pauza');
  assert.equal(after.execution_lock_token, '');
  assert.equal(after.current_cursor, 0);

  // Pauza data chiar cand cronul preia campania (citire, apoi scriere 'sending'): Pauza verifica
  // dupa o clipa si scrie oprirea din nou.
  const racing = await seedCampaign(store, [contacts[0].id], { status: 'ready' });
  let overwritten = false;
  env.OUTREACH_LOCK_CONFIRM_MS = '5';
  store.hooks.beforeUpdate = async (entity, id, patch) => {
    if (entity === 'OutreachCampaign' && id === racing.id && patch.status === 'paused' && !overwritten) {
      overwritten = true;
      setTimeout(() => { store.row('OutreachCampaign', racing.id).status = 'sending'; }, 0);
    }
  };
  await callCampaignOps(store, { action: 'pause_campaign', id: racing.id });
  store.hooks.beforeUpdate = null;
  env.OUTREACH_LOCK_CONFIRM_MS = '0';
  assert.ok(overwritten);
  assert.equal(store.row('OutreachCampaign', racing.id).status, 'paused', 'o pauza acoperita de cron e rescrisa');

  // O anulare acoperita de o pauza automata (webhook) sau de un esec e rescrisa: altfel campania
  // anulata s-ar putea relua.
  for (const overwrittenBy of ['paused', 'failed']) {
    const target = await seedCampaign(store, [contacts[0].id], { status: 'sending' });
    let done = false;
    env.OUTREACH_LOCK_CONFIRM_MS = '5';
    store.hooks.beforeUpdate = async (entity, id, patch) => {
      if (entity === 'OutreachCampaign' && id === target.id && patch.status === 'cancelled' && !done) {
        done = true;
        setTimeout(() => { store.row('OutreachCampaign', target.id).status = overwrittenBy; }, 0);
      }
    };
    await callCampaignOps(store, { action: 'cancel_campaign', id: target.id });
    store.hooks.beforeUpdate = null;
    env.OUTREACH_LOCK_CONFIRM_MS = '0';
    assert.equal(store.row('OutreachCampaign', target.id).status, 'cancelled', `anularea ramane dupa ${overwrittenBy}`);
  }
}

// ── 11. Aprobare, sincronizare si schimbarea ritmului ───────────────────────────────────────────
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
  outreach_send_safety: [
    'daily_limit_ramp', 'auto_pause_sender', 'auto_pause_webhook', 'health_from_logs', 'recipient_domain_mx',
    'automation_auth', 'overlapping_runs', 'lost_lock', 'idempotent_retry', 'provider_rejection_isolation',
    'resume_failed', 'admin_pause_preserved', 'webhook_campaign_tags', 'webhook_status_precedence',
  ],
  daily_limit_default: safety.DAILY_SEND_LIMIT_DEFAULT,
  health_limits: safety.CAMPAIGN_HEALTH_LIMITS,
}));
