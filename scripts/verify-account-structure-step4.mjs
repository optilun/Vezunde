// Structura conturilor, pasul 4 (2026-10-04, aprobat de Alex): abonamentul pe organizatie.
//
// - Pachete de lansare: 1 locatie activa 49 lei, 2-5 locatii 99 lei, 6-15 locatii 199 lei.
// - Peste 15 locatii: oferta Enterprise cu contract, platita lunar cu cardul.
// - Cantitatea abonamentului = numarul de locatii active; se aduce la zi automat.
// - Abonamentele vechi, pe locatie, raman valabile si blocheaza o plata dubla.
//
// Functiile reale ruleaza pe un Stripe fals si o baza de date falsa (nicio plata reala).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolveProviderEntitlement } from '../base44/shared/providerEntitlementPolicy.js';
import { loadProviderEntitlementRows } from '../base44/shared/providerEntitlementRows.js';
import {
  billableLocationCount,
  isViaseeOrganizationSubscription,
  monthlyAmountForLocationCount,
  organizationSubscriptionFields,
  planTierForLocationCount,
} from '../base44/shared/providerOrganizationBilling.js';

// ---------- 0. functii pure ----------
const tieredPrice = {
  id: 'price_tiered', product: 'prod_pro', currency: 'ron', active: true, recurring: { interval: 'month' }, lookup_key: 'viasee_pro_org_tiered_v1',
  tiers: [
    { up_to: 1, flat_amount: 4900, unit_amount: 0 },
    { up_to: 5, flat_amount: 9900, unit_amount: 0 },
    { up_to: 15, flat_amount: 19900, unit_amount: 0 },
    { up_to: null, flat_amount: 19900, unit_amount: 0 },
  ],
};
assert.deepEqual([1, 2, 5, 6, 15, 16].map((count) => planTierForLocationCount(count).key), ['independent', 'small_network', 'small_network', 'network', 'network', 'enterprise']);
assert.equal(planTierForLocationCount(0), null);
assert.deepEqual([1, 3, 5, 6, 15, 30].map((count) => monthlyAmountForLocationCount(tieredPrice, count)), [4900, 9900, 9900, 19900, 19900, 19900]);
assert.equal(billableLocationCount([{ id: 'a' }, { id: 'b', active_status: 'inactiva' }, { id: 'c', status: 'suspendata' }, { id: 'd', public_visibility_status: 'hidden' }]), 2, 'locatiile inchise nu se platesc, cele ascunse da');
const orgSubscription = (overrides = {}) => ({
  id: 'sub_org', customer: 'cus_org_O1', status: 'active', created: 100,
  current_period_start: 1790000000, current_period_end: 1792600000,
  metadata: { app: 'viasee', scope: 'organization', organization_id: 'O1', plan_tier: 'tiered', initiated_by_user_id: 'u1' },
  items: { data: [{ id: 'si_1', price: { id: 'price_tiered', currency: 'ron', recurring: { interval: 'month' } }, quantity: 3 }] },
  ...overrides,
});
assert.ok(isViaseeOrganizationSubscription(orgSubscription(), { organizationId: 'O1', tieredPriceId: 'price_tiered' }));
assert.ok(!isViaseeOrganizationSubscription(orgSubscription(), { organizationId: 'O2', tieredPriceId: 'price_tiered' }), 'alta organizatie');
assert.ok(!isViaseeOrganizationSubscription(orgSubscription({ items: { data: [{ price: { id: 'price_other' }, quantity: 3 }] } }), { organizationId: 'O1', tieredPriceId: 'price_tiered' }), 'alt pret');
const fields = organizationSubscriptionFields(orgSubscription(), { organizationId: 'O1' });
assert.equal(fields.subscription_scope, 'organization');
assert.equal(fields.plan_tier, 'small_network');
assert.equal(fields.billed_location_count, 3);
assert.equal(fields.location_id, undefined, 'abonamentul de organizatie nu e legat de o locatie');
assert.equal(organizationSubscriptionFields(orgSubscription({ items: { data: [{ id: 'si_1', price: { id: 'price_tiered' }, quantity: 20 }] } }), { organizationId: 'O1' }).plan_tier, 'network', 'peste 15 locatii pe trepte ramane la 199 lei');

// ---------- baza de date si Stripe false ----------
const location = (id, organizationId, extra = {}) => ({ id, organization_id: organizationId, name: `Locatia ${id}`, active_status: 'activa', status: 'publicata', ...extra });
function seed() {
  return {
    User: [
      { id: 'u1', email: 'proprietar1@exemplu.test', role: 'user' },
      { id: 'u2', email: 'admin1@exemplu.test', role: 'user' },
      { id: 'u3', email: 'proprietar2@exemplu.test', role: 'user' },
      { id: 'u4', email: 'proprietar3@exemplu.test', role: 'user' },
      { id: 'viasee', email: 'admin@viasee.test', role: 'admin' },
      { id: 'outsider', email: 'altcineva@exemplu.test', role: 'user' },
    ],
    ProviderOrganization: [{ id: 'O1', name: 'Retea Mica' }, { id: 'O2', name: 'Retea Mare' }, { id: 'O3', name: 'Optica Veche' }],
    ProviderLocation: [
      location('L1', 'O1'), location('L2', 'O1'), location('L3', 'O1'), location('L4', 'O1', { active_status: 'inactiva' }),
      ...Array.from({ length: 16 }, (_, index) => location(`M${index + 1}`, 'O2')),
      location('V1', 'O3'),
    ],
    ProviderMembership: [
      { id: 'm1', user_id: 'u1', organization_id: 'O1', location_id: 'L1', role: 'organization_owner', status: 'active', organization_wide_access: true },
      { id: 'm2', user_id: 'u2', organization_id: 'O1', location_id: 'L1', role: 'location_manager', organization_role: 'organization_admin', organization_wide_access: true, status: 'active' },
      { id: 'm3', user_id: 'u3', organization_id: 'O2', location_id: 'M1', role: 'organization_owner', status: 'active', organization_wide_access: true },
      { id: 'm4', user_id: 'u4', organization_id: 'O3', location_id: 'V1', role: 'organization_owner', status: 'active', organization_wide_access: true },
    ],
    ProviderSubscription: [
      { id: 'legacy-row', location_id: 'V1', organization_id: 'O3', plan_code: 'pro', status: 'active', billing_mode: 'stripe', stripe_subscription_id: 'sub_legacy', current_period_end: new Date(Date.now() + 20 * 86400000).toISOString() },
    ],
    ProviderBillingAccount: [{ id: 'acc-legacy', location_id: 'V1', organization_id: 'O3', stripe_customer_id: 'cus_legacy' }],
  };
}
const page = (data) => ({ data, has_more: false, async *[Symbol.asyncIterator]() { yield* data; } });
function createState() {
  const tables = seed();
  let counter = 0;
  const matches = (row, query = {}) => Object.entries(query).every(([key, expected]) => row[key] === expected);
  const entity = (name) => {
    const rows = () => (tables[name] ||= []);
    return {
      async filter(query = {}, _sort, limit, skip) { const found = rows().filter((row) => matches(row, query)); const start = Number(skip) || 0; return structuredClone(found.slice(start, limit == null ? undefined : start + limit)); },
      async get(id) { const row = rows().find((item) => item.id === id); if (!row) throw new Error('not found'); return structuredClone(row); },
      async create(data) { const row = { id: `${name}-${++counter}`, created_date: new Date(Date.now() + counter).toISOString(), ...structuredClone(data) }; rows().push(row); return structuredClone(row); },
      async update(id, data) { const row = rows().find((item) => item.id === id); if (!row) throw new Error('not found'); Object.assign(row, structuredClone(data)); return structuredClone(row); },
    };
  };
  const s = {
    tables, user: null, emails: [], checkoutCreates: [], subscriptionUpdates: [], portalParams: null,
    customers: { cus_legacy: { id: 'cus_legacy', name: 'Firma veche', email: 'f@exemplu.test', address: { line1: 'Str', city: 'Oras', country: 'RO' }, metadata: { app: 'viasee', location_id: 'V1', cui: '123456', billing_type: 'company' } } },
    remoteSubscriptions: [], sessions: [], returnSession: null,
  };
  s.client = {
    auth: { me: async () => s.user },
    asServiceRole: {
      entities: new Proxy({}, { get: (_target, name) => entity(String(name)) }),
      integrations: { Core: { CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: `https://files.test/${file_uri}?sig=1` }) } },
    },
    integrations: { Core: { SendEmail: async (message) => { s.emails.push(message); return { ok: true }; } } },
  };
  s.stripe = {
    prices: { list: async (params) => { assert.deepEqual(params.lookup_keys, ['viasee_pro_org_tiered_v1']); return { data: [tieredPrice] }; } },
    customers: {
      search: async () => ({ data: [] }),
      create: async (params, options) => { assert.ok(options.idempotencyKey); const id = `cus_org_${params.metadata.organization_id}`; s.customers[id] = { id, metadata: params.metadata, invoice_settings: {} }; return s.customers[id]; },
      retrieve: async (id) => structuredClone(s.customers[id]),
      update: async (id, fields) => { Object.assign(s.customers[id], fields, { metadata: { ...s.customers[id].metadata, ...fields.metadata } }); return s.customers[id]; },
      listTaxIds: async () => page([]),
    },
    subscriptions: {
      list: (params = {}) => page(s.remoteSubscriptions.filter((sub) => !params.customer || sub.customer === params.customer)),
      retrieve: async (id) => structuredClone(s.remoteSubscriptions.find((sub) => sub.id === id)),
      update: async (id, params, options) => {
        s.subscriptionUpdates.push({ id, params, options });
        const sub = s.remoteSubscriptions.find((item) => item.id === id);
        sub.items.data[0].quantity = params.items[0].quantity;
        return structuredClone(sub);
      },
    },
    checkout: { sessions: {
      list: async () => page(s.sessions),
      retrieve: async () => s.returnSession,
      create: async (params, options) => { s.checkoutCreates.push({ params, options }); return { url: 'https://checkout.stripe.test/session' }; },
    } },
    paymentMethods: { list: async () => page([]) },
    invoices: { list: async () => page([]) },
    billingPortal: { configurations: { list: () => page([{ id: 'bpc_viasee', metadata: { viasee_billing_version: '2' } }]) }, sessions: { create: async (params) => { s.portalParams = params; return { url: 'https://billing.stripe.test/portal' }; } } },
    webhooks: { constructEventAsync: async (body) => JSON.parse(body) },
  };
  globalThis.__step4 = s;
  return s;
}

const handlers = {};
for (const file of ['providerBillingOps', 'createProviderCheckoutSession', 'syncProviderStripeSubscription', 'createProviderBillingPortalSession', 'reconcileProviderStripeSubscriptions', 'stripeBillingWebhook', 'providerEnterpriseOfferOps']) {
  const output = await build({
    entryPoints: [`base44/functions/getMyProviderWorkspace/${file}.ts`], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'step4-mocks', setup(builder) {
      builder.onResolve({ filter: /^npm:/ }, (args) => ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
        contents: args.path.includes('@base44/sdk')
          ? 'export const createClientFromRequest = () => globalThis.__step4.client;'
          : 'export default class Stripe { constructor() { return globalThis.__step4.stripe; } static createSubtleCryptoProvider() { return {}; } }',
        loader: 'js',
      }));
    } }],
  });
  handlers[file] = (await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`)).handle;
}
globalThis.Deno = { env: { get: (key) => ({ STRIPE_SECRET_KEY: 'fake-key', STRIPE_PRICE_ID_PRO_MONTHLY: 'price_pro', STRIPE_WEBHOOK_SECRET: 'whsec_fake' })[key] } };

async function call(s, name, userId, payload = {}, headers = {}) {
  s.user = s.tables.User.find((row) => row.id === userId) || null;
  const response = await handlers[name](new Request('https://viasee.test/fn', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) }));
  return { status: response.status, body: await response.json() };
}
const profile = { billing_type: 'company', billing_name: 'Retea Mica SRL', billing_email: 'facturi@exemplu.test', billing_cui: '12345678', billing_address: { line1: 'Strada 1', city: 'Timisoara', country: 'RO' } };

// ---------- 1. pachetul dupa locatiile active ----------
{
  const s = createState();
  let result = await call(s, 'providerBillingOps', 'u2', { organization_id: 'O1' });
  assert.equal(result.status, 403, 'abonamentul il gestioneaza doar proprietarul');
  result = await call(s, 'providerBillingOps', 'outsider', { organization_id: 'O1' });
  assert.equal(result.status, 403);
  result = await call(s, 'providerBillingOps', 'u1', { organization_id: 'O1' });
  assert.equal(result.status, 200);
  assert.equal(result.body.scope, 'organization');
  assert.equal(result.body.pricing.active_location_count, 3, 'locatia inchisa nu se numara');
  assert.deepEqual(result.body.pricing.current_tier, { key: 'small_network', label: 'Rețea mică', amount: 9900 });
  assert.deepEqual(result.body.pricing.tiers.map((tier) => tier.amount), [4900, 9900, 19900]);
  assert.equal(result.body.subscription, null);

  // date de facturare -> client Stripe pe organizatie
  result = await call(s, 'providerBillingOps', 'u1', { organization_id: 'O1', action: 'save_details', ...profile });
  assert.equal(result.status, 200);
  assert.equal(s.customers.cus_org_O1.metadata.scope, 'organization');
  assert.equal(s.customers.cus_org_O1.metadata.organization_id, 'O1');
  assert.equal(s.tables.ProviderBillingAccount.find((row) => row.organization_id === 'O1' && row.account_scope === 'organization')?.stripe_customer_id, 'cus_org_O1');

  // plata: o singura linie, cantitatea = locatiile active
  result = await call(s, 'createProviderCheckoutSession', 'u1', { organization_id: 'O1', price: 'price_attacker', return_base_url: 'https://evil.example' });
  assert.equal(result.status, 200);
  const params = s.checkoutCreates[0].params;
  assert.deepEqual(params.line_items, [{ price: 'price_tiered', quantity: 3 }]);
  assert.equal(params.client_reference_id, 'O1');
  assert.equal(params.subscription_data.metadata.scope, 'organization');
  assert.equal(params.subscription_data.metadata.plan_tier, 'tiered');
  assert.ok(params.success_url.startsWith('https://viasee.ro/contul-meu?mode=provider&s=settings&tab=billing&organization=O1'));
  assert.equal(params.automatic_tax.enabled, false);
  assert.equal(params.allow_promotion_codes, true);

  // intoarcerea din plata: abonamentul devine randul organizatiei
  s.remoteSubscriptions = [orgSubscription()];
  s.returnSession = { mode: 'subscription', status: 'complete', subscription: 'sub_org', customer: 'cus_org_O1', client_reference_id: 'O2' };
  result = await call(s, 'syncProviderStripeSubscription', 'u1', { organization_id: 'O1', session_id: 'cs_1' });
  assert.equal(result.status, 403, 'sesiunea altei organizatii nu da acces');
  s.returnSession.client_reference_id = 'O1';
  result = await call(s, 'syncProviderStripeSubscription', 'u1', { organization_id: 'O1', session_id: 'cs_1' });
  assert.equal(result.status, 200);
  const row = s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_org');
  assert.equal(row.subscription_scope, 'organization');
  assert.equal(row.plan_tier, 'small_network');
  assert.equal(row.billed_location_count, 3);

  // toate locatiile organizatiei primesc Pro
  for (const locationId of ['L1', 'L2', 'L3']) {
    const entitlement = resolveProviderEntitlement(await loadProviderEntitlementRows(s.client.asServiceRole, { locationId }), new Date(1791000000 * 1000));
    assert.equal(entitlement.plan_code, 'pro', `${locationId} are Pro prin organizatie`);
  }
  const otherOrganization = resolveProviderEntitlement(await loadProviderEntitlementRows(s.client.asServiceRole, { locationId: 'M1' }));
  assert.equal(otherOrganization.plan_code, 'free', 'alta organizatie nu primeste Pro');

  // nu se poate plati a doua oara
  s.checkoutCreates.length = 0;
  result = await call(s, 'createProviderCheckoutSession', 'u1', { organization_id: 'O1' });
  assert.equal(result.status, 409);
  assert.equal(s.checkoutCreates.length, 0);

  // o locatie noua: cantitatea se aduce la zi cand proprietarul deschide facturarea
  s.tables.ProviderLocation.push(location('L5', 'O1'));
  result = await call(s, 'providerBillingOps', 'u1', { organization_id: 'O1' });
  assert.equal(result.status, 200);
  assert.equal(s.subscriptionUpdates.length, 1);
  assert.deepEqual(s.subscriptionUpdates[0].params, { items: [{ id: 'si_1', quantity: 4 }], proration_behavior: 'create_prorations' });
  assert.ok(s.subscriptionUpdates[0].options.idempotencyKey);
  assert.equal(result.body.subscription.billed_location_count, 4);
  assert.equal(result.body.subscription.amount, 9900);
  assert.equal(s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_org').billed_location_count, 4);

  // resincronizarea programata face acelasi lucru (locatia 6 -> pachetul Retea)
  s.tables.ProviderLocation.push(location('L6', 'O1'), location('L7', 'O1'));
  result = await call(s, 'reconcileProviderStripeSubscriptions', 'viasee', {});
  assert.equal(result.status, 200);
  assert.equal(result.body.quantity_updated, 1);
  assert.equal(s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_org').plan_tier, 'network');

  // portalul deschide clientul organizatiei
  result = await call(s, 'createProviderBillingPortalSession', 'u1', { organization_id: 'O1', return_base_url: 'https://viasee.ro' });
  assert.equal(result.status, 200);
  assert.equal(s.portalParams.customer, 'cus_org_O1');
  assert.ok(s.portalParams.return_url.includes('organization=O1'));

  // un pret schimbat in afara aplicatiei suspenda accesul
  s.remoteSubscriptions[0].items.data[0].price = { id: 'price_other' };
  await call(s, 'syncProviderStripeSubscription', 'u1', { organization_id: 'O1' });
  assert.equal(s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_org').status, 'suspended');

  // webhook-ul trimite abonamentele de organizatie pe drumul nou
  s.remoteSubscriptions[0].items.data[0].price = { id: 'price_tiered', currency: 'ron', recurring: { interval: 'month' } };
  s.remoteSubscriptions[0].status = 'past_due';
  result = await call(s, 'stripeBillingWebhook', null, { type: 'customer.subscription.updated', data: { object: { id: 'sub_org' } } }, { 'stripe-signature': 't=1,v1=fake' });
  assert.equal(result.status, 200);
  assert.equal(s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_org').status, 'past_due');
}

// ---------- 2. Enterprise ----------
{
  const s = createState();
  let result = await call(s, 'createProviderCheckoutSession', 'u3', { organization_id: 'O2' });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'enterprise_required', 'peste 15 locatii: doar oferta Enterprise');

  result = await call(s, 'providerEnterpriseOfferOps', 'u3', { action: 'admin_create', organization_id: 'O2', monthly_amount_ron: 450, contract_file_uri: 'private/contract.pdf' });
  assert.equal(result.status, 403, 'doar adminul VIASEE face oferte');
  result = await call(s, 'providerEnterpriseOfferOps', 'viasee', { action: 'admin_create', organization_id: 'O2', monthly_amount_ron: '450', valid_days: 30 });
  assert.equal(result.status, 400, 'contractul e obligatoriu');
  result = await call(s, 'providerEnterpriseOfferOps', 'viasee', { action: 'admin_search_organizations', q: 'mare' });
  assert.deepEqual(result.body.organizations.map((item) => [item.id, item.active_location_count]), [['O2', 16]]);
  result = await call(s, 'providerEnterpriseOfferOps', 'viasee', { action: 'admin_create', organization_id: 'O2', monthly_amount_ron: '450', valid_days: 30, contract_file_uri: 'private/contract.pdf', contract_file_name: 'Contract Retea Mare.pdf', note: 'Include toate locatiile.' });
  assert.equal(result.status, 200);
  const offerId = result.body.offer.id;
  assert.equal(result.body.notified_owner_count, 1);
  assert.match(s.emails[0].body, /450 lei pe luna/);
  assert.match(s.emails[0].body, /organization=O2/);

  // proprietarul vede oferta si contractul
  result = await call(s, 'providerBillingOps', 'u3', { organization_id: 'O2', action: 'save_details', ...profile });
  assert.equal(result.status, 200);
  result = await call(s, 'providerBillingOps', 'u3', { organization_id: 'O2' });
  assert.equal(result.body.pricing.enterprise_required, true);
  assert.deepEqual(result.body.enterprise_offers.map((offer) => [offer.id, offer.monthly_amount, offer.status]), [[offerId, 45000, 'sent']]);
  result = await call(s, 'providerEnterpriseOfferOps', 'u3', { action: 'contract_url', offer_id: offerId });
  assert.equal(result.status, 200);
  assert.match(result.body.url, /^https:\/\/files\.test\/private\/contract\.pdf/);
  result = await call(s, 'providerEnterpriseOfferOps', 'outsider', { action: 'contract_url', offer_id: offerId });
  assert.equal(result.status, 403, 'contractul il vede doar proprietarul organizatiei');

  // plata cere acceptarea contractului; suma vine din oferta, nu din cerere
  result = await call(s, 'createProviderCheckoutSession', 'u3', { organization_id: 'O2', offer_id: offerId });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'contract_not_accepted');
  result = await call(s, 'createProviderCheckoutSession', 'u3', { organization_id: 'O2', offer_id: offerId, contract_accepted: true, unit_amount: 1 });
  assert.equal(result.status, 200);
  const params = s.checkoutCreates[0].params;
  assert.deepEqual(params.line_items, [{ price_data: { currency: 'ron', product: 'prod_pro', unit_amount: 45000, recurring: { interval: 'month' } }, quantity: 1 }]);
  assert.equal(params.subscription_data.metadata.plan_tier, 'enterprise');
  assert.equal(params.subscription_data.metadata.enterprise_offer_id, offerId);
  assert.equal(params.allow_promotion_codes, false);
  assert.ok(s.tables.ProviderEnterpriseOffer.find((offer) => offer.id === offerId).contract_accepted_at, 'acceptarea contractului este inregistrata');

  // dupa plata: abonamentul Enterprise da Pro si oferta devine acceptata
  const enterprise = orgSubscription({ id: 'sub_ent', customer: 'cus_org_O2', metadata: { app: 'viasee', scope: 'organization', organization_id: 'O2', plan_tier: 'enterprise', enterprise_offer_id: offerId },
    items: { data: [{ id: 'si_e', price: { id: 'price_inline', unit_amount: 45000, currency: 'ron', recurring: { interval: 'month' } }, quantity: 1 }] } });
  s.remoteSubscriptions = [enterprise];
  result = await call(s, 'syncProviderStripeSubscription', 'u3', { organization_id: 'O2' });
  assert.equal(result.status, 200);
  const row = s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_ent');
  assert.equal(row.plan_tier, 'enterprise');
  assert.equal(row.status, 'active');
  assert.equal(s.tables.ProviderEnterpriseOffer.find((offer) => offer.id === offerId).status, 'accepted');
  result = await call(s, 'reconcileProviderStripeSubscriptions', 'viasee', {});
  assert.equal(s.subscriptionUpdates.length, 0, 'Enterprise nu are cantitate pe locatii');
  result = await call(s, 'providerEnterpriseOfferOps', 'viasee', { action: 'admin_cancel', offer_id: offerId });
  assert.equal(result.status, 409, 'o oferta acceptata nu se retrage din aplicatie');

  // o suma schimbata in Stripe nu mai da acces
  s.remoteSubscriptions[0].items.data[0].price.unit_amount = 30000;
  await call(s, 'syncProviderStripeSubscription', 'u3', { organization_id: 'O2' });
  assert.equal(s.tables.ProviderSubscription.find((item) => item.stripe_subscription_id === 'sub_ent').status, 'suspended');
}

// ---------- 3. abonamentul vechi, pe locatie ----------
{
  const s = createState();
  let result = await call(s, 'providerBillingOps', 'u4', { organization_id: 'O3' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.legacy_subscriptions.map((item) => item.location_id), ['V1']);
  assert.equal(result.body.customer, null);
  assert.equal(result.body.customer_suggestion?.name, 'Firma veche', 'datele de pe abonamentul vechi se arata, nu par pierdute');
  assert.equal(result.body.customer_suggestion?.cui, '123456');
  result = await call(s, 'providerBillingOps', 'u4', { organization_id: 'O3', action: 'save_details', ...profile });
  result = await call(s, 'createProviderCheckoutSession', 'u4', { organization_id: 'O3' });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'legacy_subscription', 'nu se plateste de doua ori');
  result = await call(s, 'createProviderBillingPortalSession', 'u4', { organization_id: 'O3', legacy_location_id: 'V1' });
  assert.equal(result.status, 200);
  assert.equal(s.portalParams.customer, 'cus_legacy', 'abonamentul vechi se gestioneaza din clientul locatiei');
  assert.equal(resolveProviderEntitlement(await loadProviderEntitlementRows(s.client.asServiceRole, { locationId: 'V1' })).plan_code, 'pro', 'abonamentul vechi ramane valabil');
}

// ---------- 4. interfata ----------
const [panel, admin, settings, inbox, entities] = await Promise.all([
  readFile('src/components/workspace/provider/leads/ProviderBillingPanel.jsx', 'utf8'),
  readFile('src/components/admin/billing/AdminEnterpriseOffers.jsx', 'utf8'),
  readFile('src/components/workspace/provider/ProviderSettings.jsx', 'utf8'),
  readFile('src/components/workspace/provider/ProviderLeadInbox.jsx', 'utf8'),
  readFile('base44/entities/ProviderEnterpriseOffer.jsonc', 'utf8'),
]);
assert.match(panel, /Accept și plătesc cu cardul/);
assert.match(panel, /Am citit și accept contractul/);
assert.match(panel, /contract_accepted: true/);
assert.match(panel, /legacy_location_id/);
assert.match(panel, /profileFrom\(result\.customer \|\| result\.customer_suggestion\)/, 'formularul se completeaza din datele vechi');
assert.match(panel, /const legacyOnly = organizationScope && legacy\.length > 0 && !data\?\.customer/);
assert.match(panel, /\(!organizationScope \|\| activeCount > 0\)/, 'fara locatii active nu se porneste plata');
assert.match(panel, /if \(!activeCount\) return `Organizația nu are încă locații active/, 'fara locatii active textul nu ramane gol');
assert.match(admin, /UploadPrivateFile/);
assert.match(admin, /admin_create/);
assert.match(settings, /organizationId=\{selectedLocation\.organization_id/);
assert.doesNotMatch(inbox, /<ProviderBillingPanel/, 'facturarea nu se mai dubleaza in Cereri (audit #7)');
assert.match(entities, /"contract_file_uri"/);

console.log('Account structure step 4: OK');
