import { upsertProviderSubscriptionFromStripeSubscription } from '../../shared/providerBillingPolicy.js';

export const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
export const idOf = (value) => typeof value === 'string' ? value : value?.id || '';
export function isViaseeSubscription(subscription, priceId, locationId) {
  return Boolean(priceId && subscription?.metadata?.app === 'viasee' &&
    subscription?.metadata?.location_id === locationId &&
    subscription?.items?.data?.length === 1 &&
    idOf(subscription.items.data[0].price) === priceId &&
    subscription.items.data[0].quantity === 1);
}
export async function findBillingAccount(svc, locationId) {
  const rows = await svc.entities.ProviderBillingAccount.filter({ location_id: locationId }, 'created_date', 1);
  if (rows[0]) return rows[0];
  const legacy = await svc.entities.ProviderSubscription.filter({ location_id: locationId, billing_mode: 'stripe' }, '-created_date', 100);
  const row = legacy.find(r => r.stripe_customer_id);
  return row ? { location_id: locationId, stripe_customer_id: row.stripe_customer_id, organization_id: row.organization_id } : null;
}
export async function ensureBillingAccount(svc, stripe, location, user) {
  const found = await findBillingAccount(svc, location.id);
  if (found?.id) return found;
  // Search is for legacy recovery; stable idempotency also covers concurrent first requests.
  const matched = found?.stripe_customer_id ? null : await stripe.customers.search({
    query: "metadata['app']:'viasee' AND metadata['location_id']:'" + clean(location.id).replace(/[^a-zA-Z0-9_-]/g, '') + "'", limit: 1,
  });
  const customerId = found?.stripe_customer_id || matched?.data?.[0]?.id || (await stripe.customers.create({
    email: clean(user.email) || undefined,
    metadata: { app: 'viasee', location_id: location.id, organization_id: clean(location.organization_id) },
  }, { idempotencyKey: 'viasee-customer-v2-' + location.id })).id;
  // No access entitlement is created until a genuine Stripe subscription exists.
  return svc.entities.ProviderBillingAccount.create({
    location_id: location.id, organization_id: clean(location.organization_id), stripe_customer_id: customerId,
  });
}
export async function syncCustomerSubscriptions(svc, stripe, account, priceId) {
  let latest = null;
  for await (const subscription of stripe.subscriptions.list({ customer: account.stripe_customer_id, status: 'all', limit: 100 })) {
    if (!isViaseeSubscription(subscription, priceId, account.location_id)) continue;
    await upsertProviderSubscriptionFromStripeSubscription(svc, subscription, { locationId: account.location_id, organizationId: account.organization_id });
    const terminal = value => ['canceled', 'incomplete_expired'].includes(value?.status);
    if (!latest || (terminal(latest) && !terminal(subscription)) ||
      (terminal(latest) === terminal(subscription) && subscription.created > latest.created)) latest = subscription;
  }
  return latest;
}
export function invoiceSummary(invoice) {
  return {
    id: invoice.id, number: invoice.number, created: invoice.created, status: invoice.status,
    currency: invoice.currency, total: invoice.total, amount_paid: invoice.amount_paid,
    amount_remaining: invoice.amount_remaining, due_date: invoice.due_date,
    attempted: invoice.attempted, attempt_count: invoice.attempt_count,
    next_payment_attempt: invoice.next_payment_attempt,
    hosted_invoice_url: invoice.hosted_invoice_url, invoice_pdf: invoice.invoice_pdf,
    customer_name: invoice.customer_name, customer_email: invoice.customer_email,
    custom_fields: invoice.custom_fields || [],
  };
}
export function paymentSummary(charge) {
  const status = charge.disputed ? 'disputed' : charge.refunded ? 'refunded' :
    charge.amount_refunded > 0 ? 'partially_refunded' : charge.outcome?.type === 'blocked' ? 'blocked' : charge.status;
  return { id: charge.id, created: charge.created, status, amount: charge.amount, amount_refunded: charge.amount_refunded,
    currency: charge.currency, failure_code: charge.failure_code,
    failure_message: charge.failure_message, receipt_url: charge.receipt_url,
    card: charge.payment_method_details?.card ? { brand: charge.payment_method_details.card.brand, last4: charge.payment_method_details.card.last4 } : null };
}
export function paymentIntentSummary(intent) {
  const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  const details = charge ? paymentSummary(charge) : {};
  const immediate = ['canceled', 'requires_action', 'processing', 'requires_capture'].includes(intent.status);
  return {
    ...details, id: intent.id, created: intent.created, amount: intent.amount, currency: intent.currency,
    status: immediate ? intent.status : details.status || intent.status,
    failure_code: intent.last_payment_error?.code || details.failure_code || null,
    failure_message: intent.last_payment_error?.message || details.failure_message || null,
  };
}
export function validateBillingProfile(input) {
  const type = input.billing_type === 'individual' ? 'individual' : 'company';
  const name = clean(input.billing_name), email = clean(input.billing_email);
  const cui = type === 'company' ? clean(input.billing_cui, 16).toUpperCase().replace(/^RO/, '').replace(/\s/g, '') : '';
  const source = input.billing_address || {};
  const address = Object.fromEntries(['line1','city','state','postal_code','country'].map(key => [key, clean(source[key], 150)]));
  address.country = address.country.toUpperCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !address.line1 || !address.city || !/^[A-Z]{2}$/.test(address.country)) {
    throw new Error('Completează numele, emailul și adresa de facturare.');
  }
  if (type === 'company' && !/^[0-9]{2,10}$/.test(cui)) throw new Error('Introdu CUI-ul firmei (2–10 cifre).');
  return { billing_type: type, billing_name: name, billing_email: email, billing_cui: cui, billing_address: address };
}
