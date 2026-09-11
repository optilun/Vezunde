// Politica de facturare Stripe pentru planul Pro (2026-09-11).
//
// Fisier backend-only (base44/shared/, fara pereche in shared/ - vezi P-CRIT-1): logica de
// mapare/validare de aici nu are nevoie de SDK-ul Stripe si nu face retea, ca sa poata fi
// testata direct din scripts/verify-provider-billing.mjs. Singurele functii care ating baza
// de date iau clientul de serviciu (svc) ca parametru, exact ca restul codebase-ului.
//
// Nu schimba nimic din providerEntitlementPolicy.js: un rand de ProviderSubscription cu
// billing_mode: 'stripe' este deja recunoscut corect de resolveProviderEntitlement, fara nicio
// modificare acolo. Aici doar construim campurile acelui rand pornind de la un obiect Stripe
// Subscription.
import { PROVIDER_ENTITLEMENT_VERSION, PROVIDER_PRO_FEATURE_KEYS } from './providerEntitlementPolicy.js';
import { ORGANIZATION_OWNER_ROLE } from './providerOrganizationOwnerScope.js';

export const PROVIDER_BILLING_CONTRACT_VERSION = 'provider-billing-v1';

export const PROVIDER_PRO_PLAN = Object.freeze({
  planCode: 'pro',
  priceRon: 49,
  currency: 'ron',
  productName: 'VIASEE Pro',
  interval: 'month',
});

// Stripe poate trimite si statusuri pe care nu le asteptam (schimbari viitoare de API) - orice
// status necunoscut cade pe 'incomplete', nu pe 'active', ca sa nu acordam acces gratuit din
// eroare. mapStripeSubscriptionStatus nu decide niciodata plan_code, doar status.
const STRIPE_STATUS_TO_PROVIDER_STATUS = Object.freeze({
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'suspended',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'grace_period',
});

export function mapStripeSubscriptionStatus(stripeStatus) {
  const normalized = String(stripeStatus || '').trim();
  return STRIPE_STATUS_TO_PROVIDER_STATUS[normalized] || 'incomplete';
}

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isoFromUnixSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

// Din 2025-03-31.basil, current_period_start/end s-au mutat de pe subscription pe primul
// subscription item; conturile mai vechi (sau pe API version clasic) inca le au pe subscription.
// Citim ambele locuri, in aceasta ordine, ca sincronizarea sa functioneze indiferent de API
// version-ul activ pe cont.
export function resolveSubscriptionPeriod(subscription) {
  const item = subscription?.items?.data?.[0];
  const start = subscription?.current_period_start ?? item?.current_period_start ?? null;
  const end = subscription?.current_period_end ?? item?.current_period_end ?? null;
  return {
    start: isoFromUnixSeconds(start),
    end: isoFromUnixSeconds(end),
  };
}

function resolveStripeCustomerId(subscription) {
  const customer = subscription?.customer;
  if (typeof customer === 'string') return customer;
  return clean(customer?.id, 200) || null;
}

function resolveStripePriceId(subscription) {
  const price = subscription?.items?.data?.[0]?.price;
  if (typeof price === 'string') return price;
  return clean(price?.id, 200) || null;
}

// Construieste campurile de scris pe ProviderSubscription pornind de la un obiect Stripe
// Subscription (venit fie direct dintr-un eveniment customer.subscription.*, fie recuperat
// explicit dupa checkout.session.completed). Nu seteaza niciodata organization_id sau
// billing_owner_user_id daca nu sunt cunoscute - apelantul completeaza ce stie in plus.
export function providerSubscriptionFieldsFromStripeSubscription(subscription, { locationId, organizationId } = {}) {
  const period = resolveSubscriptionPeriod(subscription);
  const status = mapStripeSubscriptionStatus(subscription?.status);
  const fields = {
    location_id: clean(locationId, 120),
    plan_code: 'pro',
    status,
    billing_mode: 'stripe',
    entitlement_version: PROVIDER_ENTITLEMENT_VERSION,
    feature_keys: [...PROVIDER_PRO_FEATURE_KEYS],
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: subscription?.cancel_at_period_end === true,
    canceled_at: isoFromUnixSeconds(subscription?.canceled_at),
    stripe_customer_id: resolveStripeCustomerId(subscription),
    stripe_subscription_id: clean(subscription?.id, 200) || null,
    stripe_price_id: resolveStripePriceId(subscription),
    status_reason: `stripe:${clean(subscription?.status, 60) || 'unknown'}`,
    source_reference: subscription?.id ? `stripe_subscription:${subscription.id}` : '',
  };
  if (organizationId) fields.organization_id = clean(organizationId, 120);
  return fields;
}

// Gaseste randul ProviderSubscription care corespunde unui abonament Stripe: mai intai dupa
// stripe_subscription_id (cazul obisnuit - abonamentul exista deja), altfel dupa location_id +
// billing_mode: 'stripe' (primul eveniment/prima sincronizare pentru acea locatie). Nu se uita
// niciodata la randuri billing_mode: 'manual' - un plan Pro acordat manual de admin nu este
// niciodata gasit sau atins de aceasta functie.
export async function findExistingStripeSubscriptionRow(svc, { locationId, stripeSubscriptionId } = {}) {
  if (stripeSubscriptionId) {
    const bySubscriptionId = await svc.entities.ProviderSubscription.filter({
      stripe_subscription_id: stripeSubscriptionId,
    }, '-created_date', 1);
    if (bySubscriptionId[0]) return bySubscriptionId[0];
  }
  if (!locationId) return null;
  const byLocation = await svc.entities.ProviderSubscription.filter({
    location_id: locationId,
    billing_mode: 'stripe',
  }, '-created_date', 1);
  return byLocation[0] || null;
}

// Punct unic de scriere pentru orice sincronizare Stripe -> ProviderSubscription, folosit din
// trei locuri (stripeBillingWebhook.ts, syncProviderStripeSubscription.ts si
// reconcileProviderStripeSubscriptions.ts), ca sa nu existe trei copii ale aceleiasi logici de
// gasire/creare/actualizare care pot diverge in timp. Idempotent by design: fiecare apel doar
// suprascrie starea curenta pornind de la ce spune Stripe acum, nu incrementeaza nimic.
export async function upsertProviderSubscriptionFromStripeSubscription(svc, subscription, {
  locationId, organizationId, initiatedByUserId,
} = {}) {
  const resolvedLocationId = clean(locationId || subscription?.metadata?.location_id, 120);
  if (!resolvedLocationId) return null;
  const resolvedOrganizationId = clean(organizationId || subscription?.metadata?.organization_id, 120) || null;
  const resolvedInitiatedBy = clean(initiatedByUserId || subscription?.metadata?.initiated_by_user_id, 120) || null;

  const fields = providerSubscriptionFieldsFromStripeSubscription(subscription, {
    locationId: resolvedLocationId,
    organizationId: resolvedOrganizationId,
  });
  if (resolvedInitiatedBy) fields.billing_owner_user_id = resolvedInitiatedBy;

  const existing = await findExistingStripeSubscriptionRow(svc, {
    locationId: resolvedLocationId,
    stripeSubscriptionId: subscription?.id,
  });
  if (existing) {
    await svc.entities.ProviderSubscription.update(existing.id, fields);
    return { id: existing.id, ...fields };
  }
  return svc.entities.ProviderSubscription.create({
    activated_at: new Date().toISOString(),
    ...fields,
  });
}

// Doar owner de organizatie (sau admin VIASEE) poate cumpara sau administra abonamentul unei
// locatii - mai strict decat canAccessProviderLeadInbox (care permite si manager/staff), pentru
// ca billing-ul e o actiune cu bani reali, nu operationala.
export async function authorizeProviderBillingOwner(svc, user, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  if (user?.role === 'admin') return { location };

  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  const isOwner = memberships.some((membership) => membership.role === ORGANIZATION_OWNER_ROLE);
  if (!isOwner) return { error: 'Doar un owner al organizatiei poate administra abonamentul acestei locatii.', status: 403 };
  return { location };
}

// URL-ul de intoarcere (success/cancel din Checkout, return din Billing Portal) vine din
// window.location.origin trimis de frontend (acelasi tipar ca invitation_base_url in
// ProviderAccess.jsx/ProviderTeam.jsx). Nu are voie sa devina un vector de redirect arbitrar,
// deci acceptam doar https, plus http://localhost pentru dezvoltare; orice altceva cade pe
// domeniul de productie.
const DEFAULT_BILLING_RETURN_BASE_URL = 'https://viasee.ro';

export function safeBillingReturnBaseUrl(candidate) {
  const value = clean(candidate, 300);
  if (!value) return DEFAULT_BILLING_RETURN_BASE_URL;
  try {
    const url = new URL(value);
    const isHttps = url.protocol === 'https:';
    const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) return DEFAULT_BILLING_RETURN_BASE_URL;
    return `${url.protocol}//${url.host}`;
  } catch (_error) {
    return DEFAULT_BILLING_RETURN_BASE_URL;
  }
}
