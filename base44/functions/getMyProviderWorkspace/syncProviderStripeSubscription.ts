// Sincronizare sincrona la intoarcerea din Stripe (Checkout sau Billing Portal), 2026-09-11.
//
// De ce exista pe langa webhook: Base44 intercepteaza la nivel de platforma orice request catre
// un endpoint de functie care are header-ul stripe-signature, inainte sa ajunga la codul din
// stripeBillingWebhook.ts (confirmat printr-un test live - raspunsul e generat de platforma, nu
// de aplicatie, si mentioneaza lipsa unui "secret de webhook Stripe configurat pentru aceasta
// aplicatie", mecanism legat de integrarea nativa Base44 Payments, indisponibila in Romania).
// Asta inseamna ca webhook-ul catre Stripe-ul propriu al VIASEE nu poate fi considerat sursa
// garantata de sincronizare.
//
// Solutia recomandata chiar de Base44 (docs.base44.com, "Setting up payment flows"): confirmarea
// platii se face pe pagina de succes, cat timp utilizatorul e inca autentificat, "instead of
// relying on webhooks alone". Acest endpoint acopera ambele intoarceri posibile din Stripe:
// - dupa Checkout: primeste session_id (din URL-ul de succes) si confirma sesiunea direct la
//   Stripe inainte sa scrie ceva - un utilizator nu poate confirma orice session_id, pentru ca
//   verificam ca session.client_reference_id se potriveste cu locatia pentru care are deja
//   autorizare de owner (authorizeProviderBillingOwner).
// - dupa Billing Portal (anulare, schimbare card, upgrade) sau ca reincercare manuala: fara
//   session_id, doar re-citeste direct de la Stripe abonamentul deja cunoscut
//   (stripe_subscription_id existent pe rand) si suprascrie starea.
//
// Scrierea propriu-zisa e in upsertProviderSubscriptionFromStripeSubscription
// (providerBillingPolicy.js), aceeasi functie folosita si de stripeBillingWebhook.ts si de
// reconcileProviderStripeSubscriptions.ts.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import {
  authorizeProviderBillingOwner,
  findExistingStripeSubscriptionRow,
  upsertProviderSubscriptionFromStripeSubscription,
} from '../../shared/providerBillingPolicy.js';

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
    const stripe = new Stripe(secretKey);

    const sessionId = clean(input.session_id, 300);
    let subscription = null;

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'subscription.items.data.price'],
      }).catch(() => null);
      if (!session) return res({ error: 'Sesiunea de plata nu a putut fi gasita la Stripe.' }, 404);
      if (clean(session.client_reference_id, 120) !== locationId) {
        return res({ error: 'Sesiunea de plata nu corespunde acestei locatii.' }, 403);
      }
      if (session.mode === 'subscription' && session.subscription && typeof session.subscription !== 'string') {
        subscription = session.subscription;
      }
    }

    if (!subscription) {
      const existing = await findExistingStripeSubscriptionRow(svc, { locationId });
      if (!existing?.stripe_subscription_id) {
        return res({ error: 'Aceasta locatie nu are inca un abonament Stripe de sincronizat.' }, 404);
      }
      subscription = await stripe.subscriptions.retrieve(existing.stripe_subscription_id, {
        expand: ['items.data.price'],
      });
    }

    const organizationId = clean(authorized.location.organization_id, 120) || null;
    const saved = await upsertProviderSubscriptionFromStripeSubscription(svc, subscription, {
      locationId,
      organizationId,
      initiatedByUserId: user.id,
    });

    return res({ ok: true, plan_code: saved?.plan_code || 'pro', status: saved?.status || null });
  } catch (_error) {
    return res({ error: 'Sincronizarea abonamentului Stripe a esuat.' }, 500);
  }
}
