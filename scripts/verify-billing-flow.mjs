import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const files = [
  'createProviderCheckoutSession', 'syncProviderStripeSubscription', 'providerBillingOps',
  'reconcileProviderStripeSubscriptions', 'billingAccountHelpers',
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
    charges: { list: async () => page([]) },
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
const panel = await readFile('src/components/workspace/provider/leads/ProviderBillingPanel.jsx', 'utf8');
assert.ok(panel.indexOf('await invoke("syncProviderStripeSubscription"') < panel.indexOf('next.delete("session_id")'));
assert.match(panel, /request !== sequence.current/);
assert.match(panel, /if \(lock.current\) return/);
console.log('Billing flow: authorization, duplicate protection, retry, return validation, recovery, history and fiscal input checks passed (mock Stripe only).');
