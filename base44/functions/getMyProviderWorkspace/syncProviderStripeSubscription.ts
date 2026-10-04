import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { authorizeProviderBillingOwner } from '../../shared/providerBillingPolicy.js';
import { assertBillingCustomer, syncVerifiedBillingSubscription, clean, idOf, findBillingAccount, syncCustomerSubscriptions, isViaseeSubscription,
  assertOrganizationBillingCustomer, findOrganizationBillingAccount, syncOrganizationCustomerSubscriptions, syncOrganizationSubscription } from './billingAccountHelpers.ts';
import { authorizeOrganizationBillingOwner, findOrganizationTieredPrice } from '../../shared/providerOrganizationBilling.js';

// 2026-10-04 (structura conturilor, pasul 4): cu organization_id se sincronizeaza abonamentul
// organizatiei; fara el, abonamentul vechi al unei locatii (ca inainte).
async function syncOrganization(svc, user, input) {
  const authorized = await authorizeOrganizationBillingOwner(svc, user, { organizationId: clean(input.organization_id, 120) });
  if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
  const organizationId = authorized.organization.id;
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
  const stripe = new Stripe(secret);
  const tieredPrice = await findOrganizationTieredPrice(stripe);
  if (!tieredPrice?.id) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
  const account = await findOrganizationBillingAccount(svc, organizationId);
  if (account) assertOrganizationBillingCustomer(await stripe.customers.retrieve(account.stripe_customer_id), organizationId);
  let subscription = null;
  if (input.session_id) {
    const session = await stripe.checkout.sessions.retrieve(clean(input.session_id));
    if (session.client_reference_id !== organizationId || !account || idOf(session.customer) !== account.stripe_customer_id) {
      return Response.json({ error: 'Sesiunea nu corespunde organizației.' }, { status: 403 });
    }
    if (session.mode !== 'subscription' || session.status !== 'complete' || !session.subscription) {
      return Response.json({ error: 'Plata nu este încă finalizată. Reîncearcă verificarea.' }, { status: 409 });
    }
    subscription = await syncOrganizationSubscription(svc, await stripe.subscriptions.retrieve(idOf(session.subscription)), { organizationId, tieredPriceId: tieredPrice.id });
    if (!subscription || subscription.billing_requires_review) return Response.json({ error: 'Abonamentul nu corespunde planului VIASEE Pro.' }, { status: 409 });
  } else if (account) subscription = await syncOrganizationCustomerSubscriptions(svc, stripe, account, tieredPrice.id);
  return Response.json({ ok: true, status: subscription?.status || null });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    if (clean(input.organization_id, 120)) return await syncOrganization(svc, user, input);
    const locationId = clean(input.location_id, 120);
    const authorized = await authorizeProviderBillingOwner(svc, user, locationId);
    if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY');
    if (!secret || !priceId) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
    const stripe = new Stripe(secret);
    const account = await findBillingAccount(svc, locationId);
    if (account) assertBillingCustomer(await stripe.customers.retrieve(account.stripe_customer_id), locationId);
    let subscription;
    if (input.session_id) {
      const session = await stripe.checkout.sessions.retrieve(clean(input.session_id));
      if (session.client_reference_id !== locationId || (account && idOf(session.customer) !== account.stripe_customer_id)) {
        return Response.json({ error: 'Sesiunea nu corespunde locației.' }, { status: 403 });
      }
      if (session.mode !== 'subscription' || session.status !== 'complete' || !session.subscription) {
        return Response.json({ error: 'Plata nu este încă finalizată. Reîncearcă verificarea.' }, { status: 409 });
      }
      subscription = await stripe.subscriptions.retrieve(idOf(session.subscription));
      await syncVerifiedBillingSubscription(svc, subscription, priceId, locationId, authorized.location.organization_id);
      if (!isViaseeSubscription(subscription, priceId, locationId)) return Response.json({ error: 'Abonamentul nu corespunde planului VIASEE Pro.' }, { status: 409 });
    } else if (account) subscription = await syncCustomerSubscriptions(svc, stripe, account, priceId);
    return Response.json({ ok: true, status: subscription?.status || null });
  } catch (_error) { return Response.json({ error: 'Nu am putut confirma abonamentul. Reîncearcă verificarea.' }, { status: 502 }); }
}
