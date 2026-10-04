// Signed Stripe webhook; never accept an unsigned event.
// Base44 also validates signatures at its gateway. Valid event delivery must be verified
// separately; return synchronization and scheduled reconciliation are recovery paths.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { syncOrganizationSubscription, syncVerifiedBillingSubscription } from './billingAccountHelpers.ts';
import { findOrganizationTieredPrice } from '../../shared/providerOrganizationBilling.js';

// 2026-10-04 (structura conturilor, pasul 4): abonamentele noi sunt pe organizatie
// (metadata scope: organization). Cele vechi, pe locatie, se sincronizeaza ca inainte.
async function syncOrganizationEvent(svc, stripe, subscription) {
  const tieredPrice = await findOrganizationTieredPrice(stripe);
  return syncOrganizationSubscription(svc, subscription, { organizationId: subscription.metadata?.organization_id, tieredPriceId: tieredPrice?.id || '' });
}

function res(body, status = 200) {
  return Response.json(body, { status });
}

export async function handle(req: Request) {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('stripe-signature');
  if (!secretKey || !webhookSecret || !signature) return res({ error: 'Webhook Stripe indisponibil.' }, 400);

  const rawBody = await req.text();
  const stripe = new Stripe(secretKey);

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (_error) {
    return res({ error: 'Semnatura webhook Stripe este invalida.' }, 400);
  }

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const priceId = Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY');
    if (!priceId) return res({ error: 'Prețul Pro nu este configurat.' }, 503);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (subscription.metadata?.scope === 'organization') {
          if (session.client_reference_id === subscription.metadata?.organization_id) await syncOrganizationEvent(svc, stripe, subscription);
        } else {
          await syncVerifiedBillingSubscription(svc, subscription, priceId, session.client_reference_id, subscription.metadata?.organization_id);
        }
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
      if (subscription.metadata?.scope === 'organization') await syncOrganizationEvent(svc, stripe, subscription);
      else await syncVerifiedBillingSubscription(svc, subscription, priceId, subscription.metadata?.location_id, subscription.metadata?.organization_id);
    }
    // Orice alt tip de eveniment este ignorat explicit - endpoint-ul este inregistrat in Stripe
    // Dashboard doar pentru cele trei de mai sus, dar un handler robust nu trebuie sa esueze
    // daca Stripe trimite si altceva in viitor.
  } catch (error) {
    console.error('[VIASEE] stripeBillingWebhook procesare esuata', event?.type, error?.message);
    return res({ error: 'Evenimentul Stripe nu a putut fi procesat.' }, 500);
  }

  return res({ received: true });
}
