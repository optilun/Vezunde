export const PROVIDER_ENTITLEMENT_VERSION = 'provider-entitlement-v1';

export const PROVIDER_PRO_FEATURE_KEYS = Object.freeze([
  'provider_leads.full_details',
  'provider_leads.respond',
  'provider_leads.request_details',
  'provider_leads.history',
  'provider_leads.notifications',
  'provider_chat.access',
  'provider_contact.access_after_consent',
]);

const KNOWN_FEATURE_KEYS = new Set(PROVIDER_PRO_FEATURE_KEYS);
const ACTIVE_PRO_STATUSES = new Set(['active', 'trialing', 'grace_period']);

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function timeValid(subscription, nowMs) {
  const periodEnd = timestamp(subscription?.current_period_end);
  const trialEnd = timestamp(subscription?.trial_ends_at);
  if (subscription?.status === 'trialing' && trialEnd !== null && trialEnd <= nowMs) return false;
  if (periodEnd !== null && periodEnd <= nowMs) return false;
  return true;
}

function activeProSubscription(subscription, nowMs) {
  return subscription?.plan_code === 'pro'
    && ACTIVE_PRO_STATUSES.has(subscription?.status)
    && timeValid(subscription, nowMs);
}

function featureKeys(subscription) {
  const configured = Array.isArray(subscription?.feature_keys)
    ? [...new Set(subscription.feature_keys.map((item) => clean(item, 120)).filter((item) => KNOWN_FEATURE_KEYS.has(item)))]
    : [];
  return configured.length > 0 ? configured : [...PROVIDER_PRO_FEATURE_KEYS];
}

function sortValue(subscription) {
  return timestamp(subscription?.updated_date)
    ?? timestamp(subscription?.created_date)
    ?? timestamp(subscription?.activated_at)
    ?? 0;
}

export function resolveProviderEntitlement(subscriptions, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const active = (Array.isArray(subscriptions) ? subscriptions : [])
    .filter((subscription) => activeProSubscription(subscription, safeNow))
    .sort((left, right) => sortValue(right) - sortValue(left));
  const subscription = active[0] || null;

  if (!subscription) {
    return {
      entitlement_version: PROVIDER_ENTITLEMENT_VERSION,
      plan_code: 'free',
      status: 'free',
      billing_mode: 'none',
      feature_keys: [],
      current_period_end: null,
      trial_ends_at: null,
      cancel_at_period_end: false,
    };
  }

  return {
    entitlement_version: PROVIDER_ENTITLEMENT_VERSION,
    plan_code: 'pro',
    status: clean(subscription.status, 80),
    billing_mode: clean(subscription.billing_mode, 80) || 'manual',
    feature_keys: featureKeys(subscription),
    current_period_end: subscription.current_period_end || null,
    trial_ends_at: subscription.trial_ends_at || null,
    cancel_at_period_end: subscription.cancel_at_period_end === true,
  };
}

export function hasProviderFeature(entitlement, featureKey) {
  return entitlement?.plan_code === 'pro'
    && Array.isArray(entitlement?.feature_keys)
    && entitlement.feature_keys.includes(featureKey);
}
