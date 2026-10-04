// Plata abonamentului VIASEE Pro (Stripe Checkout).
//
// 2026-10-04 (structura conturilor, pasul 4): abonamentul se plateste pe organizatie. Cantitatea este
// numarul de locatii active, iar pretul pe trepte (viasee_pro_org_tiered_v1) alege suma: 1 locatie
// 49 lei, 2-5 locatii 99 lei, 6-15 locatii 199 lei. Peste 15 locatii plata se face doar printr-o
// oferta Enterprise (suma din oferta, contract acceptat inainte de plata).
// Se poate trimite organization_id sau, ca inainte, location_id (organizatia se deduce din locatie).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { safeBillingReturnBaseUrl } from '../../shared/providerBillingPolicy.js';
import {
  ENTERPRISE_MIN_LOCATIONS,
  OPEN_SUBSCRIPTION_STATUSES,
  authorizeOrganizationBillingOwner,
  billableLocationCount,
  enterpriseUnitAmount,
  findOrganizationTieredPrice,
  isEnterpriseOfferUsable,
  loadActiveManualProRows,
  loadOpenLegacyLocationSubscriptions,
} from '../../shared/providerOrganizationBilling.js';
import { assertOrganizationBillingCustomer, clean, ensureOrganizationBillingAccount, validateBillingProfile } from './billingAccountHelpers.ts';

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const organizationId = clean(input.organization_id, 120);
    const locationId = clean(input.location_id, 120);
    if (!organizationId && !locationId) return Response.json({ error: 'Alege organizația.' }, { status: 400 });
    const svc = base44.asServiceRole;
    const authorized = await authorizeOrganizationBillingOwner(svc, user, { organizationId, locationId });
    if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
    const organization = authorized.organization;
    const activeCount = billableLocationCount(authorized.locations);
    if (activeCount < 1) return Response.json({ error: 'Organizația nu are nicio locație activă.' }, { status: 409 });

    const offerId = clean(input.offer_id, 120);
    let offer = null;
    if (offerId) {
      offer = await svc.entities.ProviderEnterpriseOffer.get(offerId).catch(() => null);
      if (!isEnterpriseOfferUsable(offer, organization.id)) return Response.json({ error: 'Oferta nu mai este valabilă. Cere o ofertă nouă.', code: 'offer_unavailable' }, { status: 409 });
      if (input.contract_accepted !== true) return Response.json({ error: 'Citește și acceptă contractul înainte de plată.', code: 'contract_not_accepted' }, { status: 400 });
    } else if (activeCount >= ENTERPRISE_MIN_LOCATIONS) {
      return Response.json({ error: `Pentru ${activeCount} locații abonamentul se face printr-o ofertă Enterprise. Cere o ofertă VIASEE.`, code: 'enterprise_required' }, { status: 409 });
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
    const stripe = new Stripe(secretKey);
    const tieredPrice = await findOrganizationTieredPrice(stripe);
    if (!tieredPrice?.id) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });

    const manual = await loadActiveManualProRows(svc, organization.id, authorized.locations);
    if (manual.length) return Response.json({ error: 'Organizația are deja Pro acordat de VIASEE.' }, { status: 409 });
    const legacy = await loadOpenLegacyLocationSubscriptions(svc, authorized.locations);
    if (legacy.length) {
      return Response.json({ error: 'Există deja un abonament activ pentru o locație a organizației. Îl poți gestiona din „Gestionează abonamentul”; trecerea la plata pe organizație o facem împreună.', code: 'legacy_subscription' }, { status: 409 });
    }

    const account = await ensureOrganizationBillingAccount(svc, stripe, organization, user);
    for await (const subscription of stripe.subscriptions.list({ customer: account.stripe_customer_id, status: 'all', limit: 100 })) {
      if (subscription.metadata?.app === 'viasee' && subscription.metadata?.organization_id === organization.id
        && OPEN_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
        return Response.json({
          error: offer
            ? 'Organizația are deja un abonament. Contactează VIASEE pentru trecerea la oferta Enterprise.'
            : 'Există deja un abonament pentru această organizație. Gestionează abonamentul sau plata restantă.',
          code: 'subscription_exists',
        }, { status: 409 });
      }
    }
    const customer = await stripe.customers.retrieve(account.stripe_customer_id);
    if (customer.deleted) return Response.json({ error: 'Contul de facturare nu mai este disponibil.' }, { status: 409 });
    assertOrganizationBillingCustomer(customer, organization.id);
    try {
      validateBillingProfile({ billing_type: customer.metadata?.billing_type, billing_name: customer.name,
        billing_email: customer.email, billing_cui: customer.metadata?.cui, billing_address: customer.address });
    } catch (_error) { return Response.json({ error: 'Salvează datele de facturare înainte de a continua.', code: 'billing_details_required' }, { status: 400 }); }

    const planTier = offer ? 'enterprise' : 'tiered';
    const baseUrl = safeBillingReturnBaseUrl(input.return_base_url);
    const existing = await stripe.checkout.sessions.list({ customer: account.stripe_customer_id, limit: 100 });
    const open = existing.data.find(s => s.status === 'open' && s.client_reference_id === organization.id && s.mode === 'subscription'
      && s.metadata?.app === 'viasee' && s.metadata?.scope === 'organization' && (s.metadata?.enterprise_offer_id || '') === (offer?.id || '')
      && (offer || Number(s.metadata?.billed_location_count) === activeCount));
    if (open?.url) return Response.json({ url: open.url });

    if (offer) {
      await svc.entities.ProviderEnterpriseOffer.update(offer.id, { contract_accepted_at: new Date().toISOString(), contract_accepted_by_user_id: clean(user.id) });
    }
    const lineItem = offer
      ? { price_data: { currency: 'ron', product: typeof tieredPrice.product === 'string' ? tieredPrice.product : tieredPrice.product?.id, unit_amount: enterpriseUnitAmount(offer), recurring: { interval: 'month' } }, quantity: 1 }
      : { price: tieredPrice.id, quantity: activeCount };
    const metadata = {
      app: 'viasee', scope: 'organization', organization_id: organization.id, plan_tier: planTier,
      billed_location_count: String(offer ? 0 : activeCount), ...(offer ? { enterprise_offer_id: offer.id } : {}),
    };
    const returnPath = baseUrl + '/contul-meu?s=settings&tab=billing&organization=' + encodeURIComponent(organization.id);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: account.stripe_customer_id, client_reference_id: organization.id,
      line_items: [lineItem], allow_promotion_codes: !offer,
      payment_method_collection: 'always', billing_address_collection: 'required',
      // Seller confirmed non-VAT-registered; do not enable Stripe Tax for this checkout.
      automatic_tax: { enabled: false },
      customer_update: { address: 'auto', name: 'auto' }, tax_id_collection: { enabled: true },
      metadata,
      subscription_data: { metadata: { ...metadata, initiated_by_user_id: clean(user.id) } },
      locale: 'ro',
      success_url: returnPath + '&billing=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: returnPath + '&billing=cancelled',
    }, { idempotencyKey: 'viasee-org-checkout-v1-' + account.stripe_customer_id + '-' + (existing.data[0]?.id || 'first') + '-' + (offer ? 'offer-' + offer.id : 'qty-' + activeCount) });
    if (!session.url) throw new Error('Missing checkout URL');
    return Response.json({ url: session.url });
  } catch (_error) { return Response.json({ error: 'Sesiunea de plată nu a putut fi creată. Reîncearcă.' }, { status: 502 }); }
}
