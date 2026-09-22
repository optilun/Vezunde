// Verifica selectia destinatarilor, categoriile (marketing / anunturi), furnizorii cu cont ca
// destinatari si raportul campaniei. Logica pura din base44/shared/outreachAudiencePolicy.js si
// handler-ele reale rulate cap-coada (baza in memorie, Resend si DNS simulate).
import assert from 'node:assert/strict';
import {
  installOutreachEnvironment,
  createStore,
  loadHandler,
  callHandler,
  runSender as runSenderWith,
  resendEvent,
  sendWebhook,
  seedContact,
} from './lib/outreachTestHarness.mjs';

const { state, webhookSecretBytes } = installOutreachEnvironment({ dns: { 'faramx.ro': { Status: 0 } } });
const audience = await import('../base44/shared/outreachAudiencePolicy.js');
const policy = await import('../base44/shared/outreachEmailPolicy.js');
const composer = await import('../base44/shared/outreachComposer.js');
const csv = await import('../src/components/admin/outreach/csv.js');

// ── 0. Adrese, caractere speciale, CSV ───────────────────────────────────────────────────────
for (const good of ['office@optica.ro', 'Programari.Centru@Clinica-Ochi.RO', "o'brien+info@firma.co.uk", 'a@xn--mnchen-3ya.de']) {
  assert.equal(policy.isSendableEmail(good), true, good);
}
for (const bad of ['office@optica.ro.', 'office@@optica.ro', 'of..fice@optica.ro', '.office@optica.ro', 'oficiu@optică.ro', 'office@optica', 'office @optica.ro', 'office@-optica.ro', 'a@b.c']) {
  assert.equal(policy.isSendableEmail(bad), false, `${bad} ar face Resend sa refuze tot lotul`);
}
{
  const html = composer.composeOutreachEmail(
    { subject: 'S', body_html: 'Buna ziua, [FIRMA] din [ORAS].', show_listing_preview: false },
    { company_name: 'Ochi & Lentile <Premium> $& $1', city: 'Targu "Mures"' },
    { unsubscribeUrl: 'https://viasee.ro/dezabonare?t=x' },
  );
  assert.ok(html.html.includes('Ochi &amp; Lentile &lt;Premium&gt; $&amp; $1'), 'numele firmei e scapat in HTML, iar $& nu e interpretat');
  assert.ok(!html.html.includes('<Premium>'));
  assert.ok(html.html.includes('Targu &quot;Mures&quot;'));
  assert.ok(html.text.includes('Buna ziua, Ochi & Lentile <Premium> $& $1 din Targu "Mures".'), 'versiunea text arata numele exact');
}
assert.equal(csv.csvCell('=HYPERLINK("http://rau")'), `"'=HYPERLINK(""http://rau"")"`, 'o formula devine text');
assert.equal(csv.csvCell('+40 721 000 000'), "'+40 721 000 000");
assert.equal(csv.csvCell('@SUM(A1)'), "'@SUM(A1)");
assert.equal(csv.csvCell('-2+3'), "'-2+3");
assert.equal(csv.csvCell('Optica; Centru'), '"Optica; Centru"');
assert.equal(csv.csvCell('office@optica.ro'), 'office@optica.ro');
assert.ok(csv.buildCsv(['a'], [['=1+1']]).startsWith('﻿a\r\n'));

// ── 1. Reguli pure ───────────────────────────────────────────────────────────────────────────
const base = {
  lawful_basis: 'legitimate_interest', source_url: 'https://x', collection_date: '2026-09-01', source_type: 'public_directory',
  county: 'Cluj', provider_type: 'optica_medicala', email_status: 'active',
};
const contacts = [
  { ...base, id: 'a', email: 'a@a.ro', company_name: 'A' },
  { ...base, id: 'b', email: 'b@b.ro', company_name: 'B', county: 'Iasi' },
  { ...base, id: 'c', email: 'c@c.ro', company_name: 'C', unsubscribed_categories: ['marketing'] },
  { ...base, id: 'd', email: 'd@faramx.ro', company_name: 'D', email_domain_status: 'no_mail_server' },
  { ...base, id: 'e', email: 'shared@x.ro', company_name: 'E director' },
  { ...base, id: 'f', email: 'shared@x.ro', company_name: 'F cont', contact_kind: 'provider_account', lawful_basis: 'contract', account_active: true },
  { ...base, id: 'g', email: 'g@g.ro', company_name: 'G cont inchis', contact_kind: 'provider_account', lawful_basis: 'contract', account_active: false },
  { ...base, id: 'h', email: 'h@h.ro', company_name: 'H fara sursa', source_url: '', source_type: '', collection_date: '' },
];

{
  const result = audience.computeAudienceRows(contacts, { category: 'marketing', target_counties: ['Cluj'] });
  assert.deepEqual(result.eligible.map((c) => c.id).sort(), ['a', 'e'], 'marketing din director, doar Cluj; cei blocati sau din alte surse nu primesc');
  const reason = (id) => audience.audienceRowView(result.rows.find((row) => row.contact.id === id)).reason;
  assert.equal(reason('c'), 'unsubscribed_category');
  assert.equal(reason('d'), 'undeliverable_domain');
  assert.equal(reason('h'), 'missing_compliance');
  assert.ok(!result.rows.some((row) => row.contact.id === 'b'), 'Iasi nu se potriveste filtrului');
  assert.ok(!result.rows.some((row) => row.contact.id === 'f'), 'conturile nu intra fara sursa provider_account');
}
{
  const result = audience.computeAudienceRows(contacts, { category: 'announcement', audience_sources: ['provider_account', 'directory'] });
  const eligible = result.eligible.map((c) => c.id).sort();
  assert.ok(eligible.includes('c'), 'dezabonat doar de la marketing: primeste anunturi');
  assert.ok(eligible.includes('f') && !eligible.includes('e'), 'aceeasi adresa din doua surse: o singura data, prin cont');
  assert.equal(audience.audienceRowView(result.rows.find((row) => row.contact.id === 'e')).reason, 'duplicate');
  assert.equal(audience.audienceRowView(result.rows.find((row) => row.contact.id === 'g')).reason, 'inactive_account');
}
{
  const result = audience.computeAudienceRows(contacts, {
    category: 'marketing', target_counties: ['Cluj'], excluded_contact_ids: ['a'], included_contact_ids: ['b'],
  });
  assert.deepEqual(result.eligible.map((c) => c.id).sort(), ['b', 'e'], 'debifat = scos; adaugat de mana = inclus chiar daca nu se potriveste filtrului');
  assert.equal(result.counts.excluded, 1);
  assert.equal(result.counts.added_manually, 1);
  const manual = audience.computeAudienceRows(contacts, { category: 'marketing', audience_mode: 'manual', included_contact_ids: ['b', 'd'] });
  assert.deepEqual(manual.eligible.map((c) => c.id), ['b'], 'doar alesi de mana; cei blocati raman blocati');
}
{
  // Debifarea scoate adresa: randul duplicat cu aceeasi adresa nu ia locul celui debifat.
  const spec = { category: 'announcement', audience_sources: ['provider_account', 'directory'] };
  const withoutAccount = audience.computeAudienceRows(contacts, { ...spec, excluded_contact_ids: ['f'] });
  const eligible = withoutAccount.eligible.map((c) => c.id);
  assert.ok(!eligible.includes('e') && !eligible.includes('f'), 'shared@x.ro nu mai primeste nimic dupa debifare');
  const rowE = audience.audienceRowView(withoutAccount.rows.find((row) => row.contact.id === 'e'));
  assert.equal(rowE.excluded, true);
  assert.equal(rowE.excluded_by_address, true);
  assert.equal(withoutAccount.counts.excluded, 2);
  const withoutDirectory = audience.computeAudienceRows(contacts, { ...spec, excluded_contact_ids: ['e'] });
  assert.ok(!withoutDirectory.eligible.some((c) => c.email === 'shared@x.ro'), 'si invers: debifarea duplicatului scoate adresa');
  const invalid = audience.computeAudienceRows([{ ...base, id: 'z', email: 'oficiu@optică.ro' }], { category: 'marketing' });
  assert.equal(audience.audienceRowView(invalid.rows[0]).reason, 'invalid_email', 'adresele pe care Resend le-ar refuza nu intra in lista');
}
{
  const map = audience.buildSuppressionMap([
    { normalized_email: 'x@x.ro' },
    { normalized_email: 'y@y.ro', categories: ['marketing'] },
    { normalized_email: 'z@z.ro', categories: ['all'], is_active: false },
  ]);
  assert.equal(audience.isSuppressedFor(map, 'x@x.ro', 'announcement'), true, 'o suprimare veche (fara categorii) blocheaza tot');
  assert.equal(audience.isSuppressedFor(map, 'y@y.ro', 'marketing'), true);
  assert.equal(audience.isSuppressedFor(map, 'y@y.ro', 'announcement'), false);
  assert.equal(audience.isSuppressedFor(map, 'z@z.ro', 'marketing'), false, 'o suprimare inactiva nu blocheaza');
  assert.deepEqual(audience.mergeSuppressionCategories({ categories: ['marketing'] }, ['announcement']), ['marketing', 'announcement']);
  assert.deepEqual(audience.mergeSuppressionCategories({ categories: ['marketing'] }, ['all']), ['all']);
  assert.deepEqual(audience.mergeSuppressionCategories(null, ['marketing']), ['marketing']);
}
{
  const summary = audience.summarizeCampaignLogs([
    { status: 'delivered', sent_at: 't', delivered_at: 't' },
    { status: 'sent', sent_at: 't' },
    { status: 'bounced', sent_at: 't' },
    { status: 'unsubscribed', sent_at: 't', delivered_at: 't' },
    { status: 'invalid', reason: 'undeliverable_domain:no_mail_server' },
    { status: 'skipped', reason: 'suppressed_at_send_time' },
  ], 8);
  assert.deepEqual(
    { sent: summary.counts.sent, delivered: summary.counts.delivered, awaiting: summary.counts.awaiting, bounced: summary.counts.bounced, unsubscribed: summary.counts.unsubscribed, not_sent: summary.counts.not_sent, pending_send: summary.counts.pending_send },
    { sent: 4, delivered: 2, awaiting: 1, bounced: 1, unsubscribed: 1, not_sent: 2, pending_send: 2 },
  );
  assert.equal(summary.rates.delivered, 50);
  assert.deepEqual(summary.not_sent_by_reason, { undeliverable_domain: 1, suppressed: 1 });
}

// ── 2. Handler-e reale ───────────────────────────────────────────────────────────────────────
const campaignOps = await loadHandler('base44/functions/directoryOps/outreachCampaignOps.ts');
const sendOps = await loadHandler('base44/functions/directoryOps/outreachSendOps.ts');
const webhookOps = await loadHandler('base44/functions/directoryOps/outreachWebhookOps.ts');
const unsubscribeOps = await loadHandler('base44/functions/directoryOps/outreachUnsubscribeOps.ts');

const store = createStore();
const ops = (payload) => callHandler(campaignOps, store, payload);
const runSender = () => runSenderWith(sendOps, store);

// Furnizori cu cont: un utilizator activ, unul fara acces activ.
await store.svc.entities.ProviderOrganization.create({ id: 'org-1', name: 'Optica Cont' });
await store.svc.entities.ProviderLocation.create({ id: 'loc-1', organization_id: 'org-1', name: 'Optica Cont Centru', status: 'publicata', city: 'Iasi', county_name: 'Iasi', provider_type: 'optica_medicala', profile_control_status: 'claimed', public_email: 'office@cont.ro' });
await store.svc.entities.User.create({ id: 'user-1', email: 'Owner@Cont.ro', full_name: 'Ana Pop' });
await store.svc.entities.User.create({ id: 'user-2', email: 'fost@cont.ro', full_name: 'Fost Membru' });
await store.svc.entities.ProviderMembership.create({ id: 'm-1', organization_id: 'org-1', user_id: 'user-1', status: 'active', role: 'organization_owner' });
await store.svc.entities.ProviderMembership.create({ id: 'm-2', organization_id: 'org-1', user_id: 'user-2', status: 'revoked', role: 'member' });

const accounts = await ops({ action: 'sync_provider_accounts' });
assert.equal(accounts.created, 1, JSON.stringify(accounts));
assert.equal(accounts.active_accounts, 1);
const accountContact = store.rows('OutreachContact').find((c) => c.contact_kind === 'provider_account');
assert.equal(accountContact.email, 'owner@cont.ro');
assert.equal(accountContact.lawful_basis, 'contract');
assert.equal(accountContact.company_name, 'Optica Cont');
assert.equal(accountContact.contact_name, 'Ana Pop');
assert.equal((await ops({ action: 'sync_provider_accounts' })).unchanged, 1, 'o resincronizare fara schimbari nu rescrie');

// Sincronizarea din director nu atinge contactul de cont, chiar daca locatia are alta adresa.
const directorySync = await ops({ action: 'sync_contacts_from_directory', cursor: 0 });
assert.equal(directorySync.created, 1);
assert.equal(store.rows('OutreachContact').filter((c) => c.contact_kind === 'provider_account').length, 1);

const directoryA = await seedContact(store, 'a@optica-a.ro', { contact_kind: 'directory' });
const directoryB = await seedContact(store, 'b@optica-b.ro', { contact_kind: 'directory', county: 'Timis' });
const onlyMarketingOff = await seedContact(store, 'fara-prezentari@optica-c.ro', { contact_kind: 'directory', unsubscribed_categories: ['marketing'] });

// Sabloane pe categorii; campanie noua din sablon.
const marketingTemplate = (await ops({ action: 'create_template', name: 'Revendicare', category: 'marketing', subject: 'Profilul [FIRMA]', body: 'Buna ziua, [FIRMA] din [ORAS].', cta_label: 'Revendica', cta_url: 'https://viasee.ro/adauga-sau-revendica' })).template;
const announcementTemplate = (await ops({ action: 'create_template', name: 'Functii noi', category: 'announcement', subject: 'Noutati VIASEE', body: 'Buna ziua, avem noutati.' })).template;
assert.equal(announcementTemplate.category, 'announcement');

const mismatch = await ops({ action: 'create_campaign', name: 'Gresit', category: 'announcement', template_id: marketingTemplate.id });
assert.match(mismatch.error, /alta categorie/, 'nu poti porni un anunt dintr-un sablon de marketing');

const announcement = (await ops({ action: 'create_campaign', name: 'Anunt octombrie', category: 'announcement', template_id: announcementTemplate.id })).campaign;
assert.equal(announcement.subject, 'Noutati VIASEE', 'subiectul vine din sablon');
assert.equal(announcement.body_html, 'Buna ziua, avem noutati.');
assert.equal(announcement.show_listing_preview, false, 'anunturile nu arata fisa din director');
assert.deepEqual(announcement.audience_sources, ['provider_account', 'directory'], 'anunturile pleaca implicit si catre conturi');
assert.equal(announcement.from_email, 'contact@mail.viasee.ro');

const marketing = (await ops({ action: 'create_campaign', name: 'Revendicare Cluj', category: 'marketing', template_id: marketingTemplate.id })).campaign;
assert.equal(marketing.cta_label, 'Revendica');
assert.deepEqual(marketing.audience_sources, ['directory']);

// Lista de destinatari = aprobarea.
const list = await ops({ action: 'list_recipients', category: 'marketing', audience_sources: ['directory'], excluded_contact_ids: [directoryB.id] });
const listed = (email) => list.rows.find((row) => row.email === email);
assert.equal(listed('b@optica-b.ro').excluded, true);
assert.equal(listed('fara-prezentari@optica-c.ro').reason, 'unsubscribed_category');
assert.ok(list.facets.counties.includes('Timis'));
assert.equal(list.facets.sources.provider_account, 1);
const beforeExclusion = store.row('OutreachCampaign', marketing.id).recipient_count;
const edited = await ops({ action: 'update_campaign', id: marketing.id, excluded_contact_ids: [directoryB.id] });
assert.equal(edited.campaign.recipient_count, beforeExclusion - 1, 'numarul de destinatari al ciornei urmeaza bifele');
assert.equal(edited.campaign.recipient_count, list.counts.eligible);
const approval = await ops({ action: 'approve_campaign', id: marketing.id, confirmation_text: '' });
assert.equal(approval.recipient_count, list.counts.eligible, 'aprobarea numara exact ce arata lista');

const search = await ops({ action: 'search_contacts', query: 'cont' });
assert.ok(search.contacts.some((c) => c.kind === 'provider_account'));

const preview = await ops({ action: 'render_preview', id: announcement.id, contact_id: accountContact.id, subject: 'Subiect din ciorna' });
assert.equal(preview.subject, 'Subiect din ciorna', 'previzualizarea foloseste ciorna nesalvata');
assert.match(preview.html, /Anunt VIASEE/);
assert.match(preview.html, /Dezaboneaza-te de la anunturi/);
assert.match(preview.html, /ai un cont de furnizor pe VIASEE/, 'subsolul spune de ce primeste: contul');

// Trimitere: anuntul ajunge si la cel dezabonat doar de la marketing, iar contul primeste o data.
const announcementApproval = await ops({ action: 'approve_campaign', id: announcement.id, confirmation_text: '' });
await ops({ action: 'approve_campaign', id: announcement.id, confirmation_text: announcementApproval.expected_confirmation });
state.resendBatches = [];
const sent = await runSender();
assert.equal(sent.outcome.finished, true, JSON.stringify(sent));
const recipients = state.resendBatches.flat().map((payload) => payload.to[0]);
assert.ok(recipients.includes('fara-prezentari@optica-c.ro'), 'dezabonat de la marketing, primeste anunturi');
assert.ok(recipients.includes('owner@cont.ro'));
const accountEmail = state.resendBatches.flat().find((payload) => payload.to[0] === 'owner@cont.ro');
assert.match(accountEmail.html, /ai un cont de furnizor pe VIASEE/);
assert.match(accountEmail.html, /Dezaboneaza-te de la anunturi/);

// Raport: o livrare si o respingere prin webhook, restul neconfirmate.
const logFor = (email) => store.rows('OutreachCampaignLog').find((log) => log.campaign_id === announcement.id && log.email === email);
for (const [type, email, tagsAsList] of [['email.delivered', 'owner@cont.ro', false], ['email.bounced', 'a@optica-a.ro', true], ['email.delivered', 'fara-prezentari@optica-c.ro', false]]) {
  const event = resendEvent(state, type, email, { tagsAsList, messageId: logFor(email).resend_message_id });
  const result = await sendWebhook(webhookOps, store, webhookSecretBytes, event);
  assert.equal(result.processed, true, JSON.stringify(result));
}
const report = await ops({ action: 'campaign_report', id: announcement.id });
assert.equal(report.summary.counts.sent, recipients.length);
assert.equal(report.summary.counts.delivered, 2);
assert.equal(report.summary.counts.bounced, 1);
assert.equal(report.summary.counts.awaiting, recipients.length - 3);
const listed2 = await ops({ action: 'list_campaigns' });
const listedAnnouncement = listed2.campaigns.find((campaign) => campaign.id === announcement.id);
assert.equal(listedAnnouncement.delivered_count, 2, 'lista de campanii numara din jurnal');
assert.equal(listedAnnouncement.bounced_count, 1);
assert.equal(report.rows.find((row) => row.email === 'owner@cont.ro').outcome, 'delivered');
assert.equal(report.rows.find((row) => row.email === 'owner@cont.ro').kind, 'provider_account');
const bouncedSuppression = store.rows('OutreachSuppression').find((row) => row.normalized_email === 'a@optica-a.ro');
assert.deepEqual(bouncedSuppression.categories, ['all'], 'o respingere blocheaza toate categoriile');

// Dezabonare pe categorie, apoi de la tot.
const token = await policy.createUnsubscribeToken('fara-prezentari@optica-c.ro', announcement.id);
const unsubUrl = `https://viasee.test/api?outreach_action=unsubscribe&t=${encodeURIComponent(token)}`;

// Deschiderea linkului (un scaner de linkuri, un preview) nu dezaboneaza: redirect la pagina.
const opened = await callHandler(unsubscribeOps, store, null, { user: null, url: unsubUrl, method: 'GET', raw: true });
assert.equal(opened.status, 302);
assert.equal(opened.headers.get('location'), `https://viasee.ro/dezabonare?t=${encodeURIComponent(token)}`);
const inspected = await callHandler(unsubscribeOps, store, { mode: 'inspect' }, { user: null, url: unsubUrl });
assert.equal(inspected.scope, 'announcement');
assert.equal(inspected.email, 'fara-prezentari@optica-c.ro');
assert.equal(store.row('OutreachContact', onlyMarketingOff.id).unsubscribed_categories.includes('announcement'), false, 'verificarea paginii nu dezaboneaza');
assert.ok(!store.rows('OutreachSuppression').some((row) => row.normalized_email === 'fara-prezentari@optica-c.ro'));

// Butonul Dezabonare din Gmail/Outlook (one-click, RFC 8058): imediat.
const logsBefore = store.rows('OutreachCampaignLog').length;
const byCategory = await callHandler(unsubscribeOps, store, null, { user: null, url: unsubUrl, rawBody: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
assert.equal(byCategory.scope, 'announcement', JSON.stringify(byCategory));
let unsubscribed = store.row('OutreachContact', onlyMarketingOff.id);
assert.deepEqual(unsubscribed.unsubscribed_categories.sort(), ['announcement', 'marketing']);
assert.equal(unsubscribed.email_status, 'active', 'dezabonarea dintr-o categorie nu e dezabonare totala');
assert.deepEqual(store.rows('OutreachSuppression').find((row) => row.normalized_email === 'fara-prezentari@optica-c.ro').categories, ['announcement']);
assert.equal(store.rows('OutreachSuppression').find((row) => row.normalized_email === 'fara-prezentari@optica-c.ro').source, 'one_click_signed_token');
const unsubLog = logFor('fara-prezentari@optica-c.ro');
assert.equal(unsubLog.status, 'unsubscribed');
assert.ok(unsubLog.unsubscribed_at && unsubLog.delivered_at, 'livrat, apoi dezabonat');
assert.equal(store.rows('OutreachCampaignLog').length, logsBefore, 'nicio intrare de jurnal inventata');

// Dezabonarea unei adrese respinse nu transforma respingerea in dezabonare.
const bouncedToken = await policy.createUnsubscribeToken('a@optica-a.ro', announcement.id);
await callHandler(unsubscribeOps, store, {}, { user: null, url: `https://viasee.test/api?outreach_action=unsubscribe&t=${encodeURIComponent(bouncedToken)}` });
assert.equal(logFor('a@optica-a.ro').status, 'bounced');
assert.equal(audience.logOutcome(logFor('a@optica-a.ro')), 'bounced');
assert.equal(store.rows('OutreachSuppression').find((row) => row.normalized_email === 'a@optica-a.ro').status, 'bounced', 'motivul suprimarii ramane respingerea');

// Un token de test (emailul de test al campaniei) nu atinge jurnalul campaniei.
const testToken = await policy.createUnsubscribeToken('b@optica-b.ro', `test:${announcement.id}`);
const testUnsub = await callHandler(unsubscribeOps, store, {}, { user: null, url: `https://viasee.test/api?outreach_action=unsubscribe&t=${encodeURIComponent(testToken)}` });
assert.equal(testUnsub.scope, 'announcement');
assert.equal(logFor('b@optica-b.ro').status, 'sent');
assert.ok(!logFor('b@optica-b.ro').unsubscribed_at);
assert.equal(store.rows('OutreachCampaignLog').length, logsBefore);
const everything = await callHandler(unsubscribeOps, store, { scope: 'all' }, { user: null, url: `https://viasee.test/api?outreach_action=unsubscribe&t=${encodeURIComponent(token)}` });
assert.equal(everything.scope, 'all');
unsubscribed = store.row('OutreachContact', onlyMarketingOff.id);
assert.equal(unsubscribed.email_status, 'unsubscribed');
assert.deepEqual(store.rows('OutreachSuppression').find((row) => row.normalized_email === 'fara-prezentari@optica-c.ro').categories, ['all']);

// Un utilizator care pierde accesul nu mai primeste campanii.
store.row('ProviderMembership', 'm-1').status = 'revoked';
const afterRevoke = await ops({ action: 'sync_provider_accounts' });
assert.equal(afterRevoke.deactivated, 1);
assert.equal(store.row('OutreachContact', accountContact.id).account_active, false);
const withInactive = await ops({ action: 'list_recipients', category: 'announcement', audience_sources: ['provider_account'] });
assert.equal(withInactive.rows[0].reason, 'inactive_account');

const overview = await ops({ action: 'outreach_overview' });
assert.equal(overview.by_category.announcement.campaigns, 1);
assert.equal(overview.by_category.marketing.campaigns, 1);
assert.equal(overview.contacts.provider_account, 0, 'conturile inactive nu se numara ca destinatari disponibili');

console.log(JSON.stringify({
  outreach_audience: ['categories', 'provider_accounts', 'manual_selection', 'report', 'category_unsubscribe', 'preview'],
  categories: audience.OUTREACH_CATEGORIES,
  sources: audience.AUDIENCE_SOURCES,
}));
