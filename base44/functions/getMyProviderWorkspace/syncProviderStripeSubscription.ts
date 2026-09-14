import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { authorizeProviderBillingOwner, upsertProviderSubscriptionFromStripeSubscription } from '../../shared/providerBillingPolicy.js';
import { clean, idOf, findBillingAccount, syncCustomerSubscriptions, isViaseeSubscription } from './billingAccountHelpers.ts';

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const locationId = clean(input.location_id, 120);
    const svc = base44.asServiceRole;
    const authorized = await authorizeProviderBillingOwner(svc, user, locationId);
    if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY');
    if (!secret || !priceId) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
    const stripe = new Stripe(secret);
    const account = await findBillingAccount(svc, locationId);
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
      if (!isViaseeSubscription(subscription, priceId, locationId)) return Response.json({ error: 'Abonamentul nu corespunde planului VIASEE Pro.' }, { status: 409 });
      await upsertProviderSubscriptionFromStripeSubscription(svc, subscription, { locationId, organizationId: authorized.location.organization_id });
    } else if (account) subscription = await syncCustomerSubscriptions(svc, stripe, account, priceId);
    return Response.json({ ok: true, status: subscription?.status || null });
  } catch (_error) { return Response.json({ error: 'Nu am putut confirma abonamentul. Reîncearcă verificarea.' }, { status: 502 }); }
}
