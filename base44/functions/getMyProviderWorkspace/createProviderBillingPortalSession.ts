// Buton "Gestioneaza abonamentul" - Stripe Billing Portal (2026-09-11).
//
// Doar pentru locatii cu billing_mode: 'stripe' si un stripe_customer_id cunoscut. Un plan Pro
// acordat manual de admin (billing_mode: 'manual') nu are customer Stripe, deci nu are ce
// gestiona aici - proprietarul vede planul in workspace, dar administrarea ramane la admin,
// exact ca inainte de Stripe.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { authorizeProviderBillingOwner, safeBillingReturnBaseUrl } from '../../shared/providerBillingPolicy.js';

import { assertBillingCustomer, findBillingAccount } from './billingAccountHelpers.ts';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const locationId = clean(input.location_id, 120);
    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);

    const authorized = await authorizeProviderBillingOwner(svc, user, locationId);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) return res({ error: 'Facturarea Stripe nu este configurata complet.' }, 500);

    const account = await findBillingAccount(svc, locationId);
    const stripeCustomerId = account?.stripe_customer_id;
    if (!stripeCustomerId) return res({ error: 'Aceasta locatie nu are inca un abonament Stripe activ.' }, 404);

    const stripe = new Stripe(secretKey);
    assertBillingCustomer(await stripe.customers.retrieve(stripeCustomerId), locationId);
    const baseUrl = safeBillingReturnBaseUrl(input.return_base_url);
    let configuration = Deno.env.get('STRIPE_BILLING_PORTAL_CONFIG_ID');
    if (!configuration) {
      for await (const config of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
        if (config.metadata?.viasee_billing_version === '2') { configuration = config.id; break; }
      }
      if (!configuration) {
        const config = await stripe.billingPortal.configurations.create({
          metadata: { viasee_billing_version: '2' },
          business_profile: { headline: 'VIASEE — abonament și facturare' },
          features: {
            customer_update: { enabled: true, allowed_updates: ['name', 'email', 'address', 'phone', 'tax_id'] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: 'at_period_end' },
            subscription_update: { enabled: false },
          },
        }, { idempotencyKey: 'viasee-portal-configuration-v2' });
        configuration = config.id;
      }
    }
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/contul-meu?s=settings&tab=billing&location=${encodeURIComponent(locationId)}&billing=portal_return`,
      configuration,
      ...(input.flow === 'payment_method_update' ? { flow_data: { type: 'payment_method_update' } } : {}),
    });

    if (!portalSession.url) return res({ error: 'Sesiunea de gestionare a abonamentului nu a putut fi creata.' }, 502);
    return res({ url: portalSession.url });
  } catch (_error) {
    return res({ error: 'Sesiunea de gestionare a abonamentului nu a putut fi creata.' }, 500);
  }
}
