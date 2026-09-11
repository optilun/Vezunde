// Buton "Gestioneaza abonamentul" - Stripe Billing Portal (2026-09-11).
//
// Doar pentru locatii cu billing_mode: 'stripe' si un stripe_customer_id cunoscut. Un plan Pro
// acordat manual de admin (billing_mode: 'manual') nu are customer Stripe, deci nu are ce
// gestiona aici - proprietarul vede planul in workspace, dar administrarea ramane la admin,
// exact ca inainte de Stripe.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { authorizeProviderBillingOwner, safeBillingReturnBaseUrl } from '../../shared/providerBillingPolicy.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const locationId = clean(input.location_id, 120);
    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);

    const authorized = await authorizeProviderBillingOwner(svc, user, locationId);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) return res({ error: 'Facturarea Stripe nu este configurata complet.' }, 500);

    const subscriptions = await svc.entities.ProviderSubscription.filter({
      location_id: locationId,
      billing_mode: 'stripe',
    }, '-created_date', 5);
    const stripeCustomerId = clean(subscriptions.find((row) => row.stripe_customer_id)?.stripe_customer_id, 200);
    if (!stripeCustomerId) return res({ error: 'Aceasta locatie nu are inca un abonament Stripe activ.' }, 404);

    const stripe = new Stripe(secretKey);
    const baseUrl = safeBillingReturnBaseUrl(input.return_base_url);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/contul-meu?s=leads&location=${encodeURIComponent(locationId)}&billing=portal_return`,
    });

    if (!portalSession.url) return res({ error: 'Sesiunea de gestionare a abonamentului nu a putut fi creata.' }, 502);
    return res({ url: portalSession.url });
  } catch (_error) {
    return res({ error: 'Sesiunea de gestionare a abonamentului nu a putut fi creata.' }, 500);
  }
}
