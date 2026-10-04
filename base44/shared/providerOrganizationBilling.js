// Abonamentul pe organizatie (structura conturilor, pasul 4, 2026-10-04, aprobat de Alex).
//
// Fisier backend-only (base44/shared/). Nu face retea: functiile care ating baza de date primesc
// clientul de serviciu (svc), iar cele care ating Stripe primesc clientul Stripe ca parametru.
//
// Preturi de lansare, platite o singura data pentru toata organizatia:
// - Independent: 1 locatie activa = 49 lei/luna
// - Retea mica: 2-5 locatii active = 99 lei/luna
// - Retea: 6-15 locatii active = 199 lei/luna
// - Enterprise: peste 15 locatii = oferta cu contract, suma stabilita de VIASEE, platita lunar cu cardul
//
// In Stripe exista un singur pret „tiered / volume” (lookup_key viasee_pro_org_tiered_v1). Cantitatea
// abonamentului este numarul de locatii active; Stripe alege treapta. Ofertele Enterprise folosesc un
// pret creat la checkout (price_data) cu suma din oferta.
//
// Abonamentele vechi pe locatie (49 lei pe locatie, inainte de 2026-10-04) raman valabile pentru
// locatia lor si sunt gestionate de codul existent (billingAccountHelpers.ts, fara `scope`).
import { PROVIDER_ENTITLEMENT_VERSION, PROVIDER_PRO_FEATURE_KEYS } from './providerEntitlementPolicy.js';
import {
  isoFromUnixSeconds,
  mapStripeSubscriptionStatus,
  resolveCancelAtPeriodEnd,
  resolveStripeCustomerId,
  resolveStripePriceId,
  resolveSubscriptionPeriod,
} from './providerBillingPolicy.js';
import { PROVIDER_OWNER_ROLE, providerAccessRoleFromMembership } from './providerRolePolicy.js';

export const ORGANIZATION_BILLING_CONTRACT_VERSION = 'provider-organization-billing-v1';
export const ORGANIZATION_PRICE_LOOKUP_KEY = 'viasee_pro_org_tiered_v1';
export const ENTERPRISE_MIN_LOCATIONS = 16;

export const ORGANIZATION_PLAN_TIERS = Object.freeze([
  Object.freeze({ key: 'independent', label: 'Independent', min: 1, max: 1, amount: 4900 }),
  Object.freeze({ key: 'small_network', label: 'Rețea mică', min: 2, max: 5, amount: 9900 }),
  Object.freeze({ key: 'network', label: 'Rețea', min: 6, max: 15, amount: 19900 }),
]);
export const ENTERPRISE_TIER = Object.freeze({ key: 'enterprise', label: 'Enterprise', min: ENTERPRISE_MIN_LOCATIONS, max: null, amount: null });

// Statusurile Stripe pentru care un abonament exista inca (nu poate fi cumparat altul peste el).
export const OPEN_SUBSCRIPTION_STATUSES = Object.freeze(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']);
const LEGACY_OPEN_STATUSES = new Set(['active', 'trialing', 'grace_period', 'past_due', 'incomplete', 'suspended']);
const ENTERPRISE_MAX_MONTHLY_RON = 100000;

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function idOf(value) {
  return typeof value === 'string' ? value : clean(value?.id);
}

// O locatie se plateste cat timp nu este inchisa. Locatiile ascunse temporar raman in abonament.
export function isBillableLocation(location) {
  return Boolean(location?.id)
    && location.active_status !== 'inactiva'
    && location.status !== 'suspendata'
    && location.profile_control_status !== 'suspended';
}

export function billableLocationCount(locations = []) {
  return (Array.isArray(locations) ? locations : []).filter(isBillableLocation).length;
}

export function planTierForLocationCount(count) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  return ORGANIZATION_PLAN_TIERS.find((tier) => value <= tier.max) || ENTERPRISE_TIER;
}

export function planTierByKey(key) {
  return ORGANIZATION_PLAN_TIERS.find((tier) => tier.key === key) || (key === 'enterprise' ? ENTERPRISE_TIER : null);
}

// Suma lunara pentru o cantitate, citita din treptele pretului Stripe (sursa de adevar). Pentru un
// pret fara trepte cade pe valorile de lansare de mai sus.
export function monthlyAmountForLocationCount(price, count) {
  const value = Number(count) || 0;
  if (value <= 0) return 0;
  const tiers = Array.isArray(price?.tiers) ? price.tiers : null;
  if (!tiers || !tiers.length) return planTierForLocationCount(value)?.amount ?? null;
  const tier = tiers.find((item) => item.up_to == null || value <= Number(item.up_to)) || tiers[tiers.length - 1];
  return (Number(tier.flat_amount) || 0) + (Number(tier.unit_amount) || 0) * value;
}

// Treptele afisate in interfata, cu sumele din Stripe cand pretul le are.
export function publicPlanTiers(price) {
  return ORGANIZATION_PLAN_TIERS.map((tier) => ({ ...tier, amount: monthlyAmountForLocationCount(price, tier.max) ?? tier.amount }));
}

export function isEnterpriseOfferUsable(offer, organizationId, now = Date.now()) {
  if (!offer || clean(offer.organization_id) !== clean(organizationId)) return false;
  if (offer.status !== 'sent') return false;
  const amount = Number(offer.monthly_amount_ron);
  if (!Number.isFinite(amount) || amount <= 0 || amount > ENTERPRISE_MAX_MONTHLY_RON) return false;
  if (!clean(offer.contract_file_uri, 2000)) return false;
  const expiresAt = Date.parse(offer.expires_at || '');
  return !Number.isFinite(expiresAt) || expiresAt > now;
}

export function enterpriseUnitAmount(offer) {
  return Math.round(Number(offer?.monthly_amount_ron) * 100);
}

// Un abonament Stripe este al VIASEE pentru o organizatie doar daca toate semnele se potrivesc:
// metadate, un singur element si pretul asteptat (treptele) sau, pentru Enterprise, cantitatea 1.
export function isViaseeOrganizationSubscription(subscription, { organizationId, tieredPriceId } = {}) {
  const metadata = subscription?.metadata || {};
  if (!organizationId || metadata.app !== 'viasee' || metadata.scope !== 'organization' || metadata.organization_id !== organizationId) return false;
  const items = subscription?.items?.data || [];
  if (items.length !== 1) return false;
  const item = items[0];
  if (metadata.plan_tier === 'enterprise') {
    const price = typeof item.price === 'object' ? item.price : null;
    return item.quantity === 1
      && Boolean(clean(metadata.enterprise_offer_id))
      && (!price || (price.currency === 'ron' && price.recurring?.interval === 'month'));
  }
  return Boolean(tieredPriceId) && idOf(item.price) === tieredPriceId && Number(item.quantity) >= 1;
}

export function subscriptionQuantity(subscription) {
  return Number(subscription?.items?.data?.[0]?.quantity) || 0;
}

// Campurile de scris pe ProviderSubscription pentru un abonament de organizatie.
export function organizationSubscriptionFields(subscription, { organizationId, initiatedByUserId } = {}) {
  const metadata = subscription?.metadata || {};
  const period = resolveSubscriptionPeriod(subscription);
  const quantity = subscriptionQuantity(subscription);
  const enterprise = metadata.plan_tier === 'enterprise';
  const fields = {
    organization_id: clean(organizationId || metadata.organization_id, 120),
    subscription_scope: 'organization',
    plan_code: 'pro',
    plan_tier: enterprise ? 'enterprise' : (planTierForLocationCount(quantity)?.key || 'independent'),
    billed_location_count: quantity,
    status: mapStripeSubscriptionStatus(subscription?.status),
    billing_mode: 'stripe',
    entitlement_version: PROVIDER_ENTITLEMENT_VERSION,
    feature_keys: [...PROVIDER_PRO_FEATURE_KEYS],
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: resolveCancelAtPeriodEnd(subscription),
    canceled_at: isoFromUnixSeconds(subscription?.canceled_at),
    stripe_customer_id: resolveStripeCustomerId(subscription),
    stripe_subscription_id: clean(subscription?.id, 200) || null,
    stripe_price_id: resolveStripePriceId(subscription),
    status_reason: `stripe:${clean(subscription?.status, 60) || 'unknown'}`,
    source_reference: subscription?.id ? `stripe_subscription:${subscription.id}` : '',
  };
  // Pe planul Enterprise ENTERPRISE_TIER nu limiteaza locatiile; pe trepte, peste 15 locatii pretul
  // ramane cel al treptei 6-15 pana la o oferta Enterprise.
  if (fields.plan_tier === 'enterprise' && !enterprise) fields.plan_tier = 'network';
  if (enterprise) fields.enterprise_offer_id = clean(metadata.enterprise_offer_id, 120);
  const initiatedBy = clean(initiatedByUserId || metadata.initiated_by_user_id, 120);
  if (initiatedBy) fields.billing_owner_user_id = initiatedBy;
  return fields;
}

export async function upsertOrganizationSubscription(svc, subscription, options = {}) {
  const fields = organizationSubscriptionFields(subscription, options);
  if (!fields.organization_id || !fields.stripe_subscription_id) return null;
  const existing = await svc.entities.ProviderSubscription.filter({
    stripe_subscription_id: fields.stripe_subscription_id,
    billing_mode: 'stripe',
  }, '-created_date', 1);
  if (existing[0]) {
    if (clean(existing[0].organization_id) && existing[0].organization_id !== fields.organization_id) throw new Error('Stripe subscription organization mismatch');
    await svc.entities.ProviderSubscription.update(existing[0].id, fields);
    return { id: existing[0].id, ...fields };
  }
  return svc.entities.ProviderSubscription.create({ activated_at: new Date().toISOString(), ...fields });
}

// Un abonament cu pret sau cantitate schimbate in afara aplicatiei nu mai da acces pana la verificare.
export async function suspendOrganizationSubscriptionRows(svc, subscriptionId, organizationId, reason = 'stripe:configuration_mismatch') {
  if (!subscriptionId) return 0;
  const rows = await svc.entities.ProviderSubscription.filter({ stripe_subscription_id: subscriptionId, billing_mode: 'stripe' }, '-created_date', 100);
  let count = 0;
  for (const row of rows) {
    if (clean(row.organization_id) && row.organization_id !== organizationId) continue;
    await svc.entities.ProviderSubscription.update(row.id, { status: 'suspended', status_reason: reason });
    count++;
  }
  return count;
}

export async function loadOrganizationLocations(svc, organizationId) {
  if (!organizationId) return [];
  const rows = [];
  for (let skip = 0; skip < 5000; skip += 500) {
    const page = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500, skip);
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

// Abonamentul il administreaza doar proprietarul organizatiei (matricea din providerRolePolicy.js,
// `organization.manage_billing`) sau un admin VIASEE.
export async function authorizeOrganizationBillingOwner(svc, user, { organizationId, locationId } = {}) {
  let resolvedOrganizationId = clean(organizationId, 120);
  if (!resolvedOrganizationId && clean(locationId, 120)) {
    const location = await svc.entities.ProviderLocation.get(clean(locationId, 120)).catch(() => null);
    resolvedOrganizationId = clean(location?.organization_id, 120);
  }
  if (!resolvedOrganizationId) return { error: 'Organizația nu a fost găsită.', status: 404 };
  const organization = await svc.entities.ProviderOrganization.get(resolvedOrganizationId).catch(() => null);
  if (!organization) return { error: 'Organizația nu a fost găsită.', status: 404 };
  const locations = await loadOrganizationLocations(svc, resolvedOrganizationId);
  if (user?.role === 'admin') return { organization, locations };
  const locationIds = new Set(locations.map((location) => location.id));
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: user?.id, status: 'active' }, '-created_date', 500);
  const isOwner = memberships.some((membership) => membership.status === 'active'
    && providerAccessRoleFromMembership(membership) === PROVIDER_OWNER_ROLE
    && membership.organization_wide_access !== false
    && (membership.organization_id === resolvedOrganizationId || locationIds.has(membership.location_id)));
  if (!isOwner) return { error: 'Doar proprietarul organizației poate administra abonamentul.', status: 403 };
  return { organization, locations };
}

// Abonamentele vechi, pe locatie, inca deschise in organizatie (nu se cumpara unul nou peste ele).
export async function loadOpenLegacyLocationSubscriptions(svc, locations = []) {
  const result = [];
  for (const location of locations) {
    const rows = await svc.entities.ProviderSubscription.filter({ location_id: location.id, billing_mode: 'stripe' }, '-created_date', 20);
    const open = rows.find((row) => row.subscription_scope !== 'organization' && LEGACY_OPEN_STATUSES.has(row.status)
      && (!row.current_period_end || Date.parse(row.current_period_end) > Date.now()));
    if (open) result.push({ row: open, location });
  }
  return result;
}

export async function loadActiveManualProRows(svc, organizationId, locations = []) {
  const now = Date.now();
  const active = (row) => row.billing_mode === 'manual' && row.plan_code === 'pro'
    && ['active', 'trialing', 'grace_period'].includes(row.status)
    && (!row.current_period_end || Date.parse(row.current_period_end) > now);
  const rows = (await svc.entities.ProviderSubscription.filter({ organization_id: organizationId, billing_mode: 'manual' }, '-created_date', 100)).filter(active);
  for (const location of locations) {
    const locationRows = await svc.entities.ProviderSubscription.filter({ location_id: location.id, billing_mode: 'manual' }, '-created_date', 20);
    for (const row of locationRows.filter(active)) if (!rows.some((item) => item.id === row.id)) rows.push(row);
  }
  return rows;
}

export async function findOrganizationTieredPrice(stripe) {
  const prices = await stripe.prices.list({ lookup_keys: [ORGANIZATION_PRICE_LOOKUP_KEY], active: true, expand: ['data.tiers'], limit: 1 });
  return prices?.data?.[0] || null;
}

// Cantitatea abonamentului pe trepte urmeaza numarul de locatii active. Stripe calculeaza diferenta
// (proratare) pe factura urmatoare. Enterprise si abonamentele inchise nu se ating.
export async function syncOrganizationSubscriptionQuantity(stripe, subscription, activeCount) {
  const count = Number(activeCount) || 0;
  if (count < 1 || subscription?.metadata?.plan_tier === 'enterprise') return { changed: false, subscription };
  if (!['active', 'trialing', 'past_due'].includes(subscription?.status)) return { changed: false, subscription };
  const item = subscription?.items?.data?.[0];
  if (!item?.id || Number(item.quantity) === count) return { changed: false, subscription };
  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, quantity: count }],
    proration_behavior: 'create_prorations',
  }, { idempotencyKey: `viasee-org-quantity-v1-${subscription.id}-${item.quantity}-${count}` });
  return { changed: true, subscription: updated, previous_quantity: Number(item.quantity), quantity: count };
}
