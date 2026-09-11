// Webhook Stripe pentru sincronizarea abonamentului Pro (2026-09-11).
//
// Singurul loc din tot codebase-ul unde NU folosim base44.auth.me() - Stripe nu trimite
// niciodata o sesiune Base44, iar securitatea vine exclusiv din verificarea semnaturii
// (stripe-signature + STRIPE_WEBHOOK_SECRET). router.ts directioneaza aici orice request care
// are header-ul stripe-signature, inainte de orice parsare __function.
//
// IMPORTANT (descoperit 2026-09-11, testat live): platforma Base44 intercepteaza la nivel de
// gateway orice request catre un function endpoint care are header-ul stripe-signature, INAINTE
// sa ajunga la acest cod - raspunde ea insasi cu o eroare despre "niciun secret de webhook
// Stripe configurat pentru aceasta aplicatie" (mecanism legat de integrarea nativa Base44
// Payments, indisponibila in Romania). In consecinta, acest handler ramane ca sincronizare de
// tip best-effort/secundara - NU este garantat ca va primi vreodata un eveniment real de la
// Stripe pe acest cont. Sincronizarea primara, care functioneaza garantat, este
// syncProviderStripeSubscription.ts (confirmare sincrona la intoarcerea din Checkout/Billing
// Portal, cat timp utilizatorul e autentificat - exact tiparul recomandat de Base44 in
// documentatia proprie: "instead of relying on webhooks alone") si
// reconcileProviderStripeSubscriptions.ts (resincronizare periodica, rulata de un workflow).
//
// Foloseste constructEventAsync + createSubtleCryptoProvider (Web Crypto), nu constructEvent
// sincron: pe Deno nu presupunem disponibilitatea completa a modulului node:crypto, iar varianta
// async cu Web Crypto e cea recomandata de Stripe pentru runtime-uri de tip edge.
//
// Scrierea efectiva (gasire/creare/actualizare rand) e in
// upsertProviderSubscriptionFromStripeSubscription din providerBillingPolicy.js - aceeasi
// functie folosita si de syncProviderStripeSubscription.ts si de
// reconcileProviderStripeSubscriptions.ts, ca sa nu existe trei copii ale logicii care pot
// diverge. Nu atinge niciodata un rand cu billing_mode: 'manual' (planuri Pro acordate de admin).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { upsertProviderSubscriptionFromStripeSubscription } from '../../shared/providerBillingPolicy.js';

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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertProviderSubscriptionFromStripeSubscription(svc, subscription, {
          locationId: session.client_reference_id,
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await upsertProviderSubscriptionFromStripeSubscription(svc, subscription, {});
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
