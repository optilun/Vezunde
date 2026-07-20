import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_STATUS_CENTER_CONTRACT_VERSION,
  buildProviderStatusCenter,
} from '../shared/providerStatusCenter.js';

assert.equal(PROVIDER_STATUS_CENTER_CONTRACT_VERSION, 'provider-status-center-v1');

const free = buildProviderStatusCenter({
  location: { status: 'publicata', is_active: true, profile_control_status: 'claimed' },
  entitlement: { plan_code: 'free', status: 'free', feature_keys: [] },
  counters: { active: 3, new: 1, history: 4 },
});
assert.equal(free.overall_state, 'limited');
assert.equal(free.profile.controlled, true);
assert.equal(free.plan.code, 'free');
assert.ok(free.blockers.includes('Planul curent este Free.'));
assert.equal(free.capabilities.find((item) => item.key === 'lead_preview')?.state, 'active');
assert.equal(free.capabilities.find((item) => item.key === 'lead_response')?.state, 'limited');

const pro = buildProviderStatusCenter({
  location: { status: 'publicata', is_active: true, profile_control_status: 'verified' },
  entitlement: {
    plan_code: 'pro',
    status: 'active',
    feature_keys: ['provider_leads.respond', 'provider_leads.full_details', 'provider_chat.access', 'provider_contact.access_after_consent'],
  },
});
assert.equal(pro.overall_state, 'ready');
assert.equal(pro.capabilities.find((item) => item.key === 'lead_response')?.state, 'active');
assert.equal(pro.capabilities.find((item) => item.key === 'full_details')?.state, 'conditional');
assert.equal(pro.capabilities.find((item) => item.key === 'controlled_chat')?.state, 'conditional');
assert.equal(pro.capabilities.find((item) => item.key === 'phone_access')?.state, 'conditional');

const suspended = buildProviderStatusCenter({
  location: { status: 'publicata', is_active: true, profile_control_status: 'suspended' },
  entitlement: { plan_code: 'pro', status: 'active', feature_keys: ['provider_leads.respond'] },
});
assert.equal(suspended.overall_state, 'blocked');
assert.equal(suspended.capabilities.find((item) => item.key === 'directory_visibility')?.state, 'blocked');

const policy = await readFile(new URL('../shared/providerStatusCenter.js', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/components/workspace/provider/ProviderStatusCenter.jsx', import.meta.url), 'utf8');
const inbox = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');

assert.match(panel, /Nu modifica planul, eligibilitatea Top 3, acordul clientului sau starea profilului/);
assert.match(inbox, /ProviderStatusCenter/);
assert.match(inbox, /providerLeadInboxOps/);
assert.match(inbox, /providerLeadResponseOps/);
assert.match(inbox, /ProviderNotificationCenter/);
assert.match(inbox, /id=\{`provider-lead-\$\{lead\.id\}`\}/);
assert.doesNotMatch(policy, /recommendation_score|bucket_rank|paid_visibility|ranking/);

console.log('Provider status center verified.');
