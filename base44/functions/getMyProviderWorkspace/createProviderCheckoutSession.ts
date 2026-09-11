// Checkout self-service pentru planul Pro (2026-09-11).
//
// Creeaza o sesiune Stripe Checkout (hosted) pentru locatia ceruta si intoarce URL-ul catre
// care frontend-ul face redirect. Nu scrie nimic in ProviderSubscription aici - starea reala
// se sincronizeaza abia dupa ce Stripe confirma plata, prin syncProviderStripeSubscription.ts
// (apelat de frontend la intoarcerea pe success_url, cu session_id-ul de mai jos) si, ca
// plasa de siguranta secundara, prin stripeBillingWebhook.ts. Asta inseamna ca un checkout
// abandonat sau esuat nu lasa niciun rand orfan sau incorect.
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
    const priceId = clean(Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY'), 200);
    if (!secretKey || !priceId) return res({ error: 'Facturarea Stripe nu este configurata complet.' }, 500);

    const organizationId = clean(authorized.location.organization_id, 120);

    // Reutilizam un customer Stripe existent daca locatia a mai avut vreodata un abonament
    // Stripe (chiar anulat) - evita clienti Stripe duplicati la un checkout reincercat.
    const existingStripeRows = await svc.entities.ProviderSubscription.filter({
      location_id: locationId,
      billing_mode: 'stripe',
    }, '-created_date', 5);
    const existingCustomerId = clean(
      existingStripeRows.find((row) => row.stripe_customer_id)?.stripe_customer_id,
      200,
    );

    const stripe = new Stripe(secretKey);
    const customerId = existingCustomerId || (await stripe.customers.create({
      email: clean(user.email, 200) || undefined,
      name: clean(authorized.location.public_display_name || authorized.location.name, 200) || undefined,
      metadata: { location_id: locationId, organization_id: organizationId, app: 'viasee' },
    })).id;

    const baseUrl = safeBillingReturnBaseUrl(input.return_base_url);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: locationId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Daca un cod promotional (sau orice alt discount viitor) duce totalul de azi la 0, nu are
      // sens sa mai cerem card - Stripe il colecteaza oricum la urmatoarea reinnoire, cand chiar
      // e nevoie de el.
      payment_method_collection: 'if_required',
      subscription_data: {
        metadata: {
          location_id: locationId,
          organization_id: organizationId,
          app: 'viasee',
          initiated_by_user_id: clean(user.id, 120),
        },
      },
      locale: 'ro',
      success_url: `${baseUrl}/contul-meu?s=leads&location=${encodeURIComponent(locationId)}&billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/contul-meu?s=leads&location=${encodeURIComponent(locationId)}&billing=cancelled`,
    });

    if (!session.url) return res({ error: 'Sesiunea de plata nu a putut fi creata.' }, 502);
    return res({ url: session.url });
  } catch (_error) {
    return res({ error: 'Sesiunea de plata Stripe nu a putut fi creata.' }, 500);
  }
}
