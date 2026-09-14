import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { authorizeProviderBillingOwner, safeBillingReturnBaseUrl } from '../../shared/providerBillingPolicy.js';
import { clean, ensureBillingAccount, isViaseeSubscription, validateBillingProfile } from './billingAccountHelpers.ts';

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const locationId = clean(input.location_id, 120);
    if (!locationId) return Response.json({ error: 'Alege locația.' }, { status: 400 });
    const svc = base44.asServiceRole;
    const authorized = await authorizeProviderBillingOwner(svc, user, locationId);
    if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = clean(Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY'));
    if (!secretKey || !priceId) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
    const stripe = new Stripe(secretKey);
    const manual = await svc.entities.ProviderSubscription.filter({ location_id: locationId, billing_mode: 'manual', plan_code: 'pro' }, '-created_date', 100);
    if (manual.some(row => ['active','trialing','grace_period'].includes(row.status) && (!row.current_period_end || Date.parse(row.current_period_end) > Date.now()))) {
      return Response.json({ error: 'Locația are deja Pro acordat de VIASEE.' }, { status: 409 });
    }
    const account = await ensureBillingAccount(svc, stripe, authorized.location, user);
    for await (const subscription of stripe.subscriptions.list({ customer: account.stripe_customer_id, status: 'all', limit: 100 })) {
      if (isViaseeSubscription(subscription, priceId, locationId) && !['canceled','incomplete_expired'].includes(subscription.status)) {
        return Response.json({ error: 'Există deja un abonament pentru această locație. Gestionează abonamentul sau plata restantă.', code: 'subscription_exists' }, { status: 409 });
      }
    }
    const customer = await stripe.customers.retrieve(account.stripe_customer_id);
    if (customer.deleted) return Response.json({ error: 'Contul de facturare nu mai este disponibil.' }, { status: 409 });
    try {
      validateBillingProfile({ billing_type: customer.metadata?.billing_type, billing_name: customer.name,
        billing_email: customer.email, billing_cui: customer.metadata?.cui, billing_address: customer.address });
    } catch (_error) { return Response.json({ error: 'Salvează datele de facturare înainte de a continua.', code: 'billing_details_required' }, { status: 400 }); }
    const baseUrl = safeBillingReturnBaseUrl(input.return_base_url);
    const existing = await stripe.checkout.sessions.list({ customer: account.stripe_customer_id, status: 'open', limit: 100 });
    const open = existing.data.find(s => s.client_reference_id === locationId && s.mode === 'subscription' && s.metadata?.app === 'viasee');
    if (open?.url) return Response.json({ url: open.url });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: account.stripe_customer_id, client_reference_id: locationId,
      line_items: [{ price: priceId, quantity: 1 }], allow_promotion_codes: true,
      payment_method_collection: 'always', billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' }, tax_id_collection: { enabled: true },
      metadata: { app: 'viasee', location_id: locationId },
      subscription_data: { metadata: { location_id: locationId, organization_id: clean(authorized.location.organization_id), app: 'viasee', initiated_by_user_id: clean(user.id) } },
      locale: 'ro',
      success_url: baseUrl + '/contul-meu?s=settings&tab=billing&location=' + encodeURIComponent(locationId) + '&billing=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: baseUrl + '/contul-meu?s=settings&tab=billing&location=' + encodeURIComponent(locationId) + '&billing=cancelled',
    }, { idempotencyKey: 'viasee-checkout-v2-' + account.stripe_customer_id + '-' + Math.floor(Date.now() / 3600000) });
    if (!session.url) throw new Error('Missing checkout URL');
    return Response.json({ url: session.url });
  } catch (_error) { return Response.json({ error: 'Sesiunea de plată nu a putut fi creată. Reîncearcă.' }, { status: 502 }); }
}
