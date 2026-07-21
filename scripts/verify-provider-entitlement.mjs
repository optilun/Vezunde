import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_ENTITLEMENT_VERSION,
  PROVIDER_PRO_FEATURE_KEYS,
  hasProviderFeature,
  resolveProviderEntitlement,
} from '../shared/providerEntitlementPolicy.js';

const now = new Date('2026-07-19T12:00:00.000Z');

const free = resolveProviderEntitlement([], now);
assert.equal(free.entitlement_version, PROVIDER_ENTITLEMENT_VERSION);
assert.equal(free.plan_code, 'free');
assert.deepEqual(free.feature_keys, []);
assert.equal(hasProviderFeature(free, 'provider_leads.respond'), false);

const activePro = resolveProviderEntitlement([{
  id: 'sub-1',
  plan_code: 'pro',
  status: 'active',
  billing_mode: 'manual',
  current_period_end: '2026-08-19T12:00:00.000Z',
  created_date: '2026-07-01T12:00:00.000Z',
}], now);
assert.equal(activePro.plan_code, 'pro');
assert.equal(activePro.status, 'active');
assert.equal(activePro.billing_mode, 'manual');
assert.deepEqual(activePro.feature_keys, PROVIDER_PRO_FEATURE_KEYS);
assert.equal(hasProviderFeature(activePro, 'provider_leads.respond'), true);
assert.equal(hasProviderFeature(activePro, 'unknown.feature'), false);

const expired = resolveProviderEntitlement([{
  plan_code: 'pro',
  status: 'active',
  current_period_end: '2026-07-18T12:00:00.000Z',
}], now);
assert.equal(expired.plan_code, 'free');

const expiredTrial = resolveProviderEntitlement([{
  plan_code: 'pro',
  status: 'trialing',
  trial_ends_at: '2026-07-18T12:00:00.000Z',
}], now);
assert.equal(expiredTrial.plan_code, 'free');

const canceledAtPeriodEnd = resolveProviderEntitlement([{
  plan_code: 'pro',
  status: 'active',
  cancel_at_period_end: true,
  current_period_end: '2026-07-20T12:00:00.000Z',
}], now);
assert.equal(canceledAtPeriodEnd.plan_code, 'pro');
assert.equal(canceledAtPeriodEnd.cancel_at_period_end, true);

const configuredFeatures = resolveProviderEntitlement([{
  plan_code: 'pro',
  status: 'active',
  feature_keys: ['provider_leads.respond', 'unknown.feature', 'provider_leads.respond'],
}], now);
assert.deepEqual(configuredFeatures.feature_keys, ['provider_leads.respond']);

const schema = JSON.parse(await readFile(new URL('../base44/entities/ProviderSubscription.jsonc', import.meta.url), 'utf8'));
assert.equal(schema.rls.read.user_condition.role, 'admin');
assert.equal(schema.properties.location_id.type, 'string');
assert.ok(schema.properties.plan_code.enum.includes('pro'));
assert.ok(schema.properties.billing_mode.enum.includes('manual'));
assert.ok(schema.properties.billing_mode.enum.includes('stripe'));
assert.equal(schema.properties.price_amount, undefined);
assert.equal(schema.properties.currency, undefined);

const backend = await readFile(new URL('../base44/function_modules/getProviderEntitlement.ts', import.meta.url), 'utf8');
assert.match(backend, /base44\.auth\.me\(\)/);
assert.match(backend, /ProviderMembership\.filter/);
assert.match(backend, /user_id: user\.id/);
assert.match(backend, /location_id: locationId/);
assert.match(backend, /status: 'active'/);
assert.match(backend, /ProviderSubscription\.filter/);
assert.match(backend, /resolveProviderEntitlement/);
assert.doesNotMatch(backend, /input\.plan_code/);
assert.doesNotMatch(backend, /ProviderSubscription\.(create|update|delete)/);
assert.doesNotMatch(backend, /stripe_customer_id|stripe_subscription_id|stripe_price_id/);

console.log('Provider entitlement checks passed.');
