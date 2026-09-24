import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolveProviderEntitlement } from '../base44/shared/providerEntitlementPolicy.js';

const files = [
  'createProviderCheckoutSession', 'syncProviderStripeSubscription', 'providerBillingOps',
  'reconcileProviderStripeSubscriptions', 'billingAccountHelpers', 'createProviderBillingPortalSession',
];
const modules = {};
for (const file of files) {
  const output = await build({
    entryPoints: ['base44/functions/getMyProviderWorkspace/' + file + '.ts'],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'billing-test-mocks', setup(builder) {
      builder.onResolve({ filter: /^npm:/ }, args => ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({
        contents: args.path.includes('@base44/sdk')
          ? 'export const createClientFromRequest = () => globalThis.__billingTest.client;'
          : 'export default class Stripe { constructor() { globalThis.__billingTest.stripeCalls++; return globalThis.__billingTest.stripe; } }',
        loader: 'js',
      }));
    }}],
  });
  modules[file] = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
}
globalThis.Deno = { env: { get: key => ({ STRIPE_SECRET_KEY: 'fake-unit-test-key', STRIPE_PRICE_ID_PRO_MONTHLY: 'price_pro' })[key] } };
const subscription = overrides => ({
  id: 'sub_current', customer: 'cus_location', status: 'active', created: 10,
  metadata: { app: 'viasee', location_id: 'loc_a', organization_id: 'org_a' },
  items: { data: [{ price: { id: 'price_pro' }, quantity: 1 }] }, ...overrides,
});
const page = data => ({ data, has_more: false, async *[Symbol.asyncIterator]() { yield* data; } });
function state() {
  const rows = [], accounts = [{ id: 'account_a', location_id: 'loc_a', stripe_customer_id: 'cus_location', organization_id: 'org_a' }];
  const s = {
    user: { id: 'owner_a', email: 'owner@example.test', role: 'user' }, owner: true, stripeCalls: 0,
    rows, accounts, remoteSubscriptions: [], sessions: [], checkoutCreates: [], savedCustomers: [],
    customer: { id: 'cus_location', name: 'Test company', email: 'billing@example.test',
      address: { line1: 'Test address', city: 'Test city', country: 'RO' },
      metadata: { app: 'viasee', location_id: 'loc_a', cui: '12345678', billing_type: 'company' }, invoice_settings: {} },
  };
  const entity = data => ({
    filter: async query => data.filter(row => Object.entries(query).every(([k,v]) => row[k] === v)),
    create: async fields => { const row = { id: 'row_' + data.length, ...fields }; data.push(row); return row; },
    update: async (id, fields) => { const row = data.find(r => r.id === id); Object.assign(row,fields); return row; },
  });
  s.client = {
    auth: { me: async () => s.user },
    asServiceRole: { entities: {
      ProviderLocation: { get: async id => ({ id, organization_id: 'org_a', name: 'Test location' }) },
      ProviderMembership: { filter: async () => s.owner ? [{ role: 'organization_owner' }] : [] },
      ProviderBillingAccount: entity(accounts), ProviderSubscription: entity(rows),
    } },
  };
  s.stripe = {
    customers: {
      retrieve: async () => s.customer, listTaxIds: async () => page([]),
      update: async (id, fields) => { s.savedCustomers.push({ id, fields }); return s.customer; },
    },
    subscriptions: {
      list: () => page(s.remoteSubscriptions),
      retrieve: async id => s.remoteSubscriptions.find(sub => sub.id === id),
    },
    checkout: { sessions: {
      list: async () => page(s.sessions),
      retrieve: async () => s.returnSession,
      create: async (params, options) => { s.checkoutCreates.push({ params, options }); return { url: 'https://checkout.stripe.test/session' }; },
    } },
    prices: { retrieve: async () => ({ id: 'price_pro', unit_amount: 4900, currency: 'ron', active: true, recurring: { interval: 'month' } }) },
    paymentMethods: { list: async () => page([]) },
    invoices: { list: async () => page([]) },
    paymentIntents: { list: async () => page([]) },
    billingPortal: { configurations: { list: () => page([{ id: 'bpc_viasee', metadata: { viasee_billing_version: '2' } }]) }, sessions: { create: async params => { s.portalParams = params; return { url: 'https://billing.stripe.test/portal' }; } } },
  };
  globalThis.__billingTest = s;
  return s;
}
async function call(name, payload = {}, headers = {}) {
  const response = await modules[name].handle(new Request('https://example.test', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ location_id: 'loc_a', ...payload }),
  }));
  return { status: response.status, body: await response.json() };
}
for (const handler of ['createProviderCheckoutSession','syncProviderStripeSubscription','providerBillingOps']) {
  const s = state(); s.user = null;
  assert.equal((await call(handler)).status, 401);
  assert.equal(s.stripeCalls, 0, handler + ' must authenticate before Stripe access');
  s.user = { id: 'outsider', role: 'user' }; s.owner = false;
  assert.equal((await call(handler)).status, 403);
  assert.equal(s.stripeCalls, 0, handler + ' must authorize location ownership');
}
{
  const s = state();
  assert.equal((await call('providerBillingOps', { action: 'admin_list' })).status, 403);
  assert.equal(s.stripeCalls, 0);
  s.user = null;
  assert.equal((await call('reconcileProviderStripeSubscriptions', { __automation_trigger: true })).status, 403);
  assert.equal(s.stripeCalls, 0, 'A forged automation flag must not read Stripe');
}
for (const status of ['active','trialing','past_due','unpaid','incomplete','paused']) {
  const s = state(); s.remoteSubscriptions = [subscription({ status })];
  assert.equal((await call('createProviderCheckoutSession')).status, 409, 'Do not duplicate ' + status);
  assert.equal(s.checkoutCreates.length, 0);
}
{
  const s = state(); s.remoteSubscriptions = [subscription({ status: 'canceled' })];
  const result = await call('createProviderCheckoutSession', { price: 'price_attacker', return_base_url: 'https://evil.example' });
  assert.equal(result.status, 200);
  assert.equal(s.checkoutCreates[0].params.line_items[0].price, 'price_pro');
  assert.ok(s.checkoutCreates[0].params.success_url.startsWith('https://viasee.ro/contul-meu?s=settings&tab=billing'));
  assert.equal(s.checkoutCreates[0].params.billing_address_collection, 'required');
  assert.equal(s.checkoutCreates[0].params.automatic_tax.enabled, false, 'Do not charge automatic VAT for the non-registered issuer');
  assert.equal(s.checkoutCreates[0].params.payment_method_collection, 'always');
  assert.ok(s.checkoutCreates[0].options.idempotencyKey);
}
{
  const s = state(); s.sessions = [{ id: 'cs_open', status: 'open', client_reference_id: 'loc_a', mode: 'subscription', metadata: { app: 'viasee' }, url: 'https://checkout.stripe.test/existing' }];
  assert.equal((await call('createProviderCheckoutSession')).body.url, s.sessions[0].url);
  assert.equal(s.checkoutCreates.length, 0, 'Reuse an open checkout');
}
{
  const s = state(); s.customer.metadata.cui = '';
  assert.equal((await call('createProviderCheckoutSession')).status, 400);
  assert.equal(s.checkoutCreates.length, 0, 'Billing details required before checkout');
}
for (const invalid of [
  { client_reference_id: 'other_location', status: 'complete', subscription: 'sub_current' },
  { client_reference_id: 'loc_a', status: 'open', subscription: null },
]) {
  const s = state(); s.returnSession = { mode: 'subscription', customer: 'cus_location', ...invalid };
  assert.ok([403,409].includes((await call('syncProviderStripeSubscription', { session_id: 'cs_test' })).status));
  assert.equal(s.rows.length, 0, 'Never grant Pro for a wrong or unfinished checkout');
}
{
  const s = state(); s.returnSession = { mode: 'subscription', customer: 'cus_location', client_reference_id: 'loc_a', status: 'complete', subscription: 'sub_current' };
  s.remoteSubscriptions = [subscription({ items: { data: [{ price: { id: 'price_other' }, quantity: 1 }] } })];
  assert.equal((await call('syncProviderStripeSubscription', { session_id: 'cs_test' })).status, 409);
  assert.equal(s.rows.length, 0);
}
{
  const s = state(); s.remoteSubscriptions = [subscription()];
  assert.equal((await call('syncProviderStripeSubscription')).status, 200);
  assert.equal(s.rows[0].status, 'active', 'Recover subscription even without a return session');
  s.remoteSubscriptions = [subscription({ id: 'sub_new', created: 20 }), subscription({ status: 'canceled' })];
  await call('syncProviderStripeSubscription');
  assert.equal(s.rows.length, 2, 'Preserve independent subscription history');
  assert.equal(s.rows.find(r => r.stripe_subscription_id === 'sub_new').status, 'active');
}
{
  const h = modules.billingAccountHelpers;
  assert.equal(h.isViaseeSubscription(subscription(), 'price_pro', 'loc_a'), true);
  assert.equal(h.isViaseeSubscription(subscription(), 'price_other', 'loc_a'), false);
  assert.equal(h.isViaseeSubscription(subscription({ metadata: { app: 'other', location_id: 'loc_a' } }), 'price_pro', 'loc_a'), false);
  assert.throws(() => h.validateBillingProfile({}), /Completează/);
  const profile = h.validateBillingProfile({ billing_type: 'company', billing_name: 'ACME', billing_email: 'billing@example.test', billing_cui: 'RO 12345678', billing_address: { line1: 'Street', city: 'Town', country: 'ro' } });
  assert.equal(profile.billing_cui, '12345678');
  assert.equal(profile.billing_address.country, 'RO');
  assert.equal(h.paymentSummary({ status: 'failed', outcome: { type: 'blocked' } }).status, 'blocked');
  assert.equal(h.paymentSummary({ status: 'succeeded', amount_refunded: 20 }).status, 'partially_refunded');
  assert.equal(h.paymentSummary({ status: 'succeeded', refunded: true }).status, 'refunded');
}
{
  const s = state();
  s.remoteSubscriptions = [subscription({ items: { data: [{ price: { id: 'price_pro' }, quantity: 2 }] } })];
  assert.equal((await call('createProviderCheckoutSession')).status, 409, 'Do not charge again when an existing subscription needs quantity review');
}
{
  const s = state();
  const result = await call('createProviderBillingPortalSession', { flow: 'payment_method_update', return_base_url: 'https://evil.example' });
  assert.equal(result.status, 200);
  assert.equal(s.portalParams.customer, 'cus_location');
  assert.equal(s.portalParams.configuration, 'bpc_viasee');
  assert.equal(s.portalParams.flow_data.type, 'payment_method_update');
  assert.ok(s.portalParams.return_url.startsWith('https://viasee.ro/'));
  const h = modules.billingAccountHelpers;
  assert.equal(h.paymentIntentSummary({ id: 'pi_1', status: 'canceled', latest_charge: { status: 'failed' } }).status, 'canceled');
  assert.equal(h.paymentIntentSummary({ id: 'pi_2', status: 'requires_action', latest_charge: { status: 'pending' } }).status, 'requires_action');
}
{
  const s = state(); s.user.role = 'admin';
  s.stripe.paymentIntents.list = () => page([
    { id: 'pi_viasee', customer: 'cus_location', status: 'canceled', created: 1, amount: 4900, currency: 'ron', livemode: false },
    { id: 'pi_other', customer: 'cus_other', status: 'succeeded', created: 1, amount: 9999, currency: 'ron', livemode: false },
  ]);
  s.stripe.customers.retrieve = async id => id === 'cus_location' ? s.customer : { id, metadata: { app: 'another_app' } };
  const result = await call('providerBillingOps', { action: 'admin_list', view: 'payments' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.rows.map(row => row.id), ['pi_viasee'], 'Exclude unrelated businesses from admin billing');
  assert.equal(result.body.rows[0].status, 'canceled');
}
{
  const s = state();
  const profile = { action: 'save_details', billing_type: 'company', billing_name: 'New company', billing_email: 'billing@example.test', billing_cui: '12345678', billing_address: { line1: 'Street', city: 'Town', country: 'RO' } };
  assert.equal((await call('providerBillingOps', profile)).status, 200);
  assert.deepEqual(s.savedCustomers[0].fields.invoice_settings.custom_fields, [{ name: 'CUI', value: '12345678' }]);
  s.stripe.customers.listTaxIds = async () => page([{ type: 'eu_vat', value: 'RO99999999' }]);
  assert.equal((await call('providerBillingOps', profile)).status, 409, 'Do not combine new billing details with another VAT identity');
  assert.equal(s.savedCustomers.length, 1);
}
{
  const s = state();
  s.stripe.billingPortal.configurations.list = () => page([]);
  s.stripe.billingPortal.configurations.create = async (params, options) => { s.portalConfig = params; assert.ok(options.idempotencyKey); return { id: 'bpc_new' }; };
  assert.equal((await call('createProviderBillingPortalSession')).status, 200);
  assert.equal(s.portalConfig.features.subscription_update.enabled, false);
  assert.equal(s.portalConfig.features.payment_method_update.enabled, true);
  assert.equal(s.portalParams.configuration, 'bpc_new');
}

for (const items of [
  { data: [{ price: { id: 'price_other' }, quantity: 1 }] },
  { data: [{ price: { id: 'price_pro' }, quantity: 2 }] },
]) {
  const s = state(); s.remoteSubscriptions = [subscription()];
  await call('syncProviderStripeSubscription');
  s.rows.push({ id: 'manual_a', location_id: 'loc_a', billing_mode: 'manual', status: 'active', stripe_subscription_id: 'sub_current' });
  s.remoteSubscriptions = [subscription({ items })];
  const result = await call('providerBillingOps');
  assert.equal(result.status, 200);
  assert.equal(s.rows.find(r => r.billing_mode === 'stripe').status, 'suspended', 'Changed price/quantity must revoke stale Stripe entitlement');
  assert.equal(s.rows.find(r => r.billing_mode === 'manual').status, 'active', 'Manual entitlement must remain independent');
  s.remoteSubscriptions = [subscription()];
  await call('syncProviderStripeSubscription');
  assert.equal(s.rows.find(r => r.billing_mode === 'stripe').status, 'active', 'Corrected configuration restores Stripe entitlement');
}
for (const metadata of [{ app: 'other', location_id: 'loc_a' }, { app: 'viasee', location_id: 'other_location' }]) {
  for (const handler of ['providerBillingOps', 'createProviderCheckoutSession', 'createProviderBillingPortalSession', 'syncProviderStripeSubscription']) {
    const s = state(); s.customer.metadata = metadata;
    let reads = 0;
    s.stripe.invoices.list = async () => { reads++; return page([]); };
    const result = await call(handler);
    assert.ok(result.status >= 400, handler + ' must reject mismatched Stripe customer');
    assert.equal(reads, 0, 'Do not expose invoices from a mismatched customer');
    assert.equal(s.checkoutCreates.length, 0);
    assert.equal(s.portalParams, undefined);
    assert.equal(s.rows.length, 0);
  }
  const s = state(); s.customer.metadata = metadata;
  const result = await call('providerBillingOps', { action: 'save_details', billing_type: 'company', billing_name: 'ACME', billing_email: 'billing@example.test', billing_cui: '12345678', billing_address: { line1: 'Street', city: 'Town', country: 'RO' } });
  assert.ok(result.status >= 400);
  assert.equal(s.savedCustomers.length, 0, 'Do not update a mismatched customer');
}
{
  const s = state(); s.remoteSubscriptions = [subscription()];
  await call('syncProviderStripeSubscription');
  s.user.role = 'admin';
  s.remoteSubscriptions = [subscription({ items: { data: [{ price: { id: 'price_other' }, quantity: 1 }] } })];
  s.stripe.subscriptions.list = params => {
    assert.equal(params.price, undefined, 'Reconciliation must discover changed-price subscriptions');
    return page(s.remoteSubscriptions);
  };
  const result = await call('reconcileProviderStripeSubscriptions');
  assert.equal(result.status, 200);
  assert.equal(result.body.synced, 1);
  assert.equal(s.rows[0].status, 'suspended');
}
assert.equal(modules.billingAccountHelpers.isViaseeSubscription(subscription(), 'price_pro', undefined), false);

for (const handler of ['providerBillingOps', 'createProviderCheckoutSession', 'createProviderBillingPortalSession', 'syncProviderStripeSubscription']) {
  for (const member of [
    { role: 'location_manager', status: 'active', user_id: 'owner_a', location_id: 'loc_a' },
    { role: 'staff', status: 'active', user_id: 'owner_a', location_id: 'loc_a' },
    { role: 'organization_owner', status: 'inactive', user_id: 'owner_a', location_id: 'loc_a' },
    { role: 'organization_owner', status: 'active', user_id: 'other_user', location_id: 'loc_a' },
    { role: 'organization_owner', status: 'active', user_id: 'owner_a', location_id: 'other_location' },
  ]) {
    const s = state();
    s.client.asServiceRole.entities.ProviderMembership.filter = async query => {
      assert.deepEqual(query, { user_id: s.user.id, location_id: 'loc_a', status: 'active' });
      return Object.entries(query).every(([key, value]) => member[key] === value) ? [member] : [];
    };
    assert.equal((await call(handler)).status, 403, handler + ' rejects unauthorized membership even with the account email unchanged');
    assert.equal(s.stripeCalls, 0);
  }
}
{
  const s = state(); s.user.email = 'changed-email@example.test';
  assert.equal((await call('createProviderBillingPortalSession')).status, 200, 'An authenticated active owner keeps access after changing email');
}
// Exercise the real sync handler and effective entitlement together. Stripe responses are
// fixtures: this does not execute payments, 3DS, card updates or portal actions at Stripe.
{
  const s = state();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const periodEnd = nowSeconds + 30 * 24 * 60 * 60;
  s.returnSession = { mode: 'subscription', customer: 'cus_location', client_reference_id: 'loc_a', status: 'complete', subscription: 'sub_current' };
  const lifecycle = [
    { label: 'Initial payment declined', status: 'incomplete', payment: 'requires_payment_method', plan: 'free', checkout: true },
    { label: 'Initial payment awaiting 3DS', status: 'incomplete', payment: 'requires_action', plan: 'free', checkout: true },
    { label: 'Successful initial payment', status: 'active', payment: 'succeeded', plan: 'pro', checkout: true },
    { label: 'Successful renewal extends access', status: 'active', payment: 'succeeded', plan: 'pro', periodEnd: periodEnd + 30 * 24 * 60 * 60 },
    { label: 'Failed renewal removes Pro', status: 'past_due', payment: 'requires_payment_method', plan: 'free' },
    { label: 'Exhausted payment retries keep Pro blocked', status: 'unpaid', payment: 'requires_payment_method', plan: 'free' },
    { label: 'Payment recovery restores Pro', status: 'active', payment: 'succeeded', plan: 'pro' },
    { label: 'End-of-period cancellation keeps current access', status: 'active', plan: 'pro', cancel: true },
    { label: 'Resuming before period end clears cancellation', status: 'active', plan: 'pro', cancel: false },
    { label: 'Completed cancellation removes Pro', status: 'canceled', plan: 'free' },
  ];
  for (const scenario of lifecycle) {
    s.remoteSubscriptions = [subscription({
      status: scenario.status,
      current_period_start: nowSeconds - 60,
      current_period_end: scenario.periodEnd || periodEnd,
      cancel_at_period_end: scenario.cancel === true,
      latest_invoice: { payment_intent: { status: scenario.payment } },
    })];
    const result = await call('syncProviderStripeSubscription', scenario.checkout ? { session_id: 'cs_test' } : {});
    assert.equal(result.status, 200, scenario.label);
    assert.equal(s.rows.length, 1, scenario.label + ': preserve one row for the same subscription');
    const entitlement = resolveProviderEntitlement(s.rows, new Date(nowSeconds * 1000));
    assert.equal(entitlement.plan_code, scenario.plan, scenario.label);
    if (scenario.plan === 'pro') {
      assert.equal(entitlement.cancel_at_period_end, scenario.cancel === true, scenario.label);
      assert.equal(entitlement.current_period_end, new Date((scenario.periodEnd || periodEnd) * 1000).toISOString());
    } else {
      assert.deepEqual(entitlement.feature_keys, [], scenario.label + ': no Pro features');
    }
  }
  // Another independently granted entitlement must survive Stripe cancellation.
  s.rows.push({ id: 'manual_grant', location_id: 'loc_a', billing_mode: 'manual', plan_code: 'pro', status: 'active', current_period_end: new Date(periodEnd * 1000).toISOString() });
  await call('syncProviderStripeSubscription');
  assert.equal(resolveProviderEntitlement(s.rows).billing_mode, 'manual');
  assert.equal(s.rows.find(row => row.id === 'manual_grant').status, 'active');
  console.log('Billing lifecycle: 10 subscription transitions and independent manual access passed (Stripe fixtures only).');
}
{
  const s = state();
  s.remoteSubscriptions = [subscription({ default_payment_method: 'pm_new' })];
  s.stripe.paymentMethods.list = async () => page([
    { id: 'pm_old', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 }, billing_details: { name: 'Not needed in card response' } },
    { id: 'pm_new', card: { brand: 'mastercard', last4: '4444', exp_month: 1, exp_year: 2031 }, billing_details: { name: 'Not needed in card response' } },
  ]);
  const result = await call('providerBillingOps');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.methods, [
    { id: 'pm_old', brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, is_default: false },
    { id: 'pm_new', brand: 'mastercard', last4: '4444', exp_month: 1, exp_year: 2031, is_default: true },
  ], 'Refresh after a card change exposes only masked card details and the current default');
}
const panel = await readFile('src/components/workspace/provider/leads/ProviderBillingPanel.jsx', 'utf8');
assert.ok(panel.indexOf('await invoke("syncProviderStripeSubscription"') < panel.indexOf('next.delete("session_id")'));
assert.match(panel, /request !== sequence.current/);
assert.match(panel, /if \(!profileInitialized.current\)/, "Pagination must preserve unsaved billing details");
assert.match(panel, /if \(lock.current \|\| !mounted.current\) return/);
console.log('Billing flow: authorization, duplicate protection, retry, return validation, recovery, history and fiscal input checks passed (mock Stripe only).');
