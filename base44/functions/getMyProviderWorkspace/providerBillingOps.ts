import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { authorizeProviderBillingOwner, resolveSubscriptionPeriod } from '../../shared/providerBillingPolicy.js';
import { assertBillingCustomer, clean, idOf, findBillingAccount, ensureBillingAccount, syncCustomerSubscriptions, isViaseeSubscription, invoiceSummary, paymentIntentSummary, validateBillingProfile,
  assertOrganizationBillingCustomer, ensureOrganizationBillingAccount, findOrganizationBillingAccount, syncOrganizationCustomerSubscriptions, syncOrganizationSubscription } from './billingAccountHelpers.ts';
import {
  ENTERPRISE_MIN_LOCATIONS,
  authorizeOrganizationBillingOwner,
  billableLocationCount,
  findOrganizationTieredPrice,
  loadActiveManualProRows,
  loadOpenLegacyLocationSubscriptions,
  monthlyAmountForLocationCount,
  planTierForLocationCount,
  planTierByKey,
  publicPlanTiers,
  subscriptionQuantity,
  syncOrganizationSubscriptionQuantity,
} from '../../shared/providerOrganizationBilling.js';

// Datele de facturare ale clientului Stripe, comune pentru organizatie si pentru locatiile vechi.
async function customerView(stripe, customer, account) {
  return { name: customer.name || '', email: customer.email || '', address: customer.address || {},
    cui: customer.metadata?.cui || account.billing_cui || '', billing_type: customer.metadata?.billing_type || account.billing_type || 'company',
    tax_ids: (await stripe.customers.listTaxIds(customer.id, { limit: 100 })).data.map(t => ({ type: t.type, value: t.value, status: t.verification?.status })) };
}

async function saveCustomerDetails(svc, stripe, account, customer, profile) {
  const taxIds = await stripe.customers.listTaxIds(customer.id, { limit: 100 });
  const conflictingVat = taxIds.data.some(tax => tax.type === 'eu_vat' &&
    (profile.billing_type === 'individual' || (profile.billing_address.country === 'RO' && tax.value.replace(/[^0-9]/g, '') !== profile.billing_cui)));
  if (conflictingVat) return Response.json({ error: 'Codul TVA salvat în Stripe nu corespunde noilor date. Actualizează-l din „Gestionează codul TVA”, apoi salvează datele firmei.' }, { status: 409 });
  const preserved = (customer.invoice_settings?.custom_fields || []).filter(field => field.name !== 'CUI');
  if (profile.billing_cui && preserved.length >= 4) return Response.json({ error: 'Datele facturii necesită verificare de către VIASEE.' }, { status: 409 });
  await stripe.customers.update(account.stripe_customer_id, {
    name: profile.billing_name, email: profile.billing_email, address: profile.billing_address,
    metadata: { cui: profile.billing_cui, billing_type: profile.billing_type },
    invoice_settings: { custom_fields: [...preserved, ...(profile.billing_cui ? [{ name: 'CUI', value: profile.billing_cui }] : [])] },
  });
  await svc.entities.ProviderBillingAccount.update(account.id, profile);
  return Response.json({ ok: true });
}

function offerView(offer) {
  return { id: offer.id, monthly_amount: Math.round(Number(offer.monthly_amount_ron) * 100), currency: 'ron', status: offer.status,
    expires_at: offer.expires_at || null, note: offer.note || '', contract_file_name: offer.contract_file_name || 'Contract.pdf',
    has_contract: Boolean(offer.contract_file_uri), contract_accepted_at: offer.contract_accepted_at || null, accepted_at: offer.accepted_at || null };
}

// Datele de facturare de pe abonamentul vechi, pe locatie. Cat timp organizatia nu are propriul
// client Stripe, se arata doar pentru citire (abonament vechi activ) sau completeaza formularul
// la trecerea pe organizatie. Nu se salveaza nimic fara confirmarea proprietarului.
async function legacyCustomerSuggestion(svc, stripe, locations) {
  for (const location of locations.slice(0, 3)) {
    try {
      const account = await findBillingAccount(svc, location.id);
      if (!account?.stripe_customer_id) continue;
      const customer = await stripe.customers.retrieve(account.stripe_customer_id);
      assertBillingCustomer(customer, location.id);
      if (!customer.name) continue;
      return { name: customer.name, email: customer.email || '', address: customer.address || {},
        cui: customer.metadata?.cui || account.billing_cui || '', billing_type: customer.metadata?.billing_type || account.billing_type || 'company' };
    } catch (_error) { /* datele vechi sunt doar informative */ }
  }
  return null;
}

// 2026-10-04 (structura conturilor, pasul 4): abonamentul si facturarea pe organizatie.
async function handleOrganization(svc, user, input, action) {
  const authorized = await authorizeOrganizationBillingOwner(svc, user, { organizationId: clean(input.organization_id, 120), locationId: clean(input.location_id, 120) });
  if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
  const organization = authorized.organization;
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
  const stripe = new Stripe(secret);
  const tieredPrice = await findOrganizationTieredPrice(stripe);
  if (!tieredPrice?.id) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });

  if (action === 'save_details') {
    let profile;
    try { profile = validateBillingProfile(input); }
    catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
    const account = await ensureOrganizationBillingAccount(svc, stripe, organization, user);
    const customer = await stripe.customers.retrieve(account.stripe_customer_id);
    if (customer.deleted) return Response.json({ error: 'Contul de facturare nu mai este disponibil. Contactează VIASEE.' }, { status: 409 });
    assertOrganizationBillingCustomer(customer, organization.id);
    return saveCustomerDetails(svc, stripe, account, customer, profile);
  }
  if (action !== 'get') return Response.json({ error: 'Acțiune necunoscută.' }, { status: 400 });

  const activeCount = billableLocationCount(authorized.locations);
  const tier = planTierForLocationCount(activeCount);
  const pricing = {
    scope: 'organization', currency: tieredPrice.currency || 'ron', interval: tieredPrice.recurring?.interval || 'month', active: tieredPrice.active !== false,
    tiers: publicPlanTiers(tieredPrice), active_location_count: activeCount,
    current_tier: tier ? { key: tier.key, label: tier.label, amount: tier.key === 'enterprise' ? null : monthlyAmountForLocationCount(tieredPrice, activeCount) } : null,
    enterprise_required: activeCount >= ENTERPRISE_MIN_LOCATIONS, enterprise_min_locations: ENTERPRISE_MIN_LOCATIONS,
    issuer_vat_registered: false, fiscal_mode: 'manual',
  };
  const [manualRows, legacy, offers] = await Promise.all([
    loadActiveManualProRows(svc, organization.id, authorized.locations),
    loadOpenLegacyLocationSubscriptions(svc, authorized.locations),
    svc.entities.ProviderEnterpriseOffer.filter({ organization_id: organization.id }, '-created_date', 20).catch(() => []),
  ]);
  const now = Date.now();
  const enterpriseOffers = offers.filter(offer => offer.status === 'accepted' || (offer.status === 'sent' && (!offer.expires_at || Date.parse(offer.expires_at) > now))).map(offerView);
  const legacySubscriptions = legacy.map(({ row, location }) => ({ location_id: location.id, location_name: location.public_display_name || location.name || 'Locație',
    status: row.status, current_period_end: row.current_period_end || null, cancel_at_period_end: row.cancel_at_period_end === true }));
  const base = { scope: 'organization', organization: { id: organization.id, name: organization.public_display_name || organization.name || 'Organizație' },
    pricing, manual: manualRows[0] || null, legacy_subscriptions: legacySubscriptions, enterprise_offers: enterpriseOffers };

  const account = await findOrganizationBillingAccount(svc, organization.id);
  if (!account) return Response.json({ ...base, customer_suggestion: await legacyCustomerSuggestion(svc, stripe, legacy.length ? legacy.map((item) => item.location) : authorized.locations),
    subscription: null, customer: null, methods: [], invoices: [], has_more: false });
  assertOrganizationBillingCustomer(await stripe.customers.retrieve(account.stripe_customer_id), organization.id);
  let latest = await syncOrganizationCustomerSubscriptions(svc, stripe, account, tieredPrice.id);
  // Numarul de locatii active se aduce la zi si cand proprietarul deschide facturarea, nu doar la
  // resincronizarea programata (la 30 de minute).
  if (latest && !latest.billing_requires_review) {
    const quantity = await syncOrganizationSubscriptionQuantity(stripe, latest, activeCount);
    if (quantity.changed) latest = await syncOrganizationSubscription(svc, quantity.subscription, { organizationId: organization.id, tieredPriceId: tieredPrice.id }) || latest;
  }
  const [customer, methods, invoices] = await Promise.all([
    stripe.customers.retrieve(account.stripe_customer_id),
    stripe.paymentMethods.list({ customer: account.stripe_customer_id, type: 'card', limit: 100 }),
    stripe.invoices.list({ customer: account.stripe_customer_id, limit: 20, ...(input.cursor ? { starting_after: clean(input.cursor) } : {}) }),
  ]);
  if (customer.deleted) return Response.json({ error: 'Contul de facturare a fost șters. Contactează VIASEE.' }, { status: 409 });
  const defaultId = idOf(latest?.default_payment_method) || idOf(customer.invoice_settings?.default_payment_method);
  const planTier = latest?.metadata?.plan_tier === 'enterprise' ? planTierByKey('enterprise') : planTierForLocationCount(subscriptionQuantity(latest));
  return Response.json({
    ...base,
    subscription: latest ? { id: latest.id, status: latest.billing_requires_review ? 'configuration_review' : latest.status, cancel_at_period_end: latest.cancel_at_period_end || Boolean(latest.cancel_at),
      ...resolveSubscriptionPeriod(latest), trial_end: latest.trial_end, plan_tier: latest.metadata?.plan_tier === 'enterprise' ? 'enterprise' : (planTier?.key === 'enterprise' ? 'network' : planTier?.key || null),
      billed_location_count: latest.metadata?.plan_tier === 'enterprise' ? null : subscriptionQuantity(latest),
      amount: latest.metadata?.plan_tier === 'enterprise' ? Number(latest.items?.data?.[0]?.price?.unit_amount) || null : monthlyAmountForLocationCount(tieredPrice, subscriptionQuantity(latest)) } : null,
    customer: await customerView(stripe, customer, account),
    methods: methods.data.map(m => ({ id: m.id, brand: m.card?.brand, last4: m.card?.last4, exp_month: m.card?.exp_month, exp_year: m.card?.exp_year, is_default: m.id === defaultId })),
    invoices: invoices.data.map(invoiceSummary), has_more: invoices.has_more, next_cursor: invoices.data.at(-1)?.id || null,
  });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const action = clean(input.action) || 'get';
    if (action !== 'admin_list' && clean(input.organization_id, 120)) return await handleOrganization(svc, user, input, action);
    const locationId = clean(input.location_id, 120);
    if (action === 'admin_list' && user.role !== 'admin') return Response.json({ error: 'Acces rezervat administratorului.' }, { status: 403 });
    let authorized;
    if (action !== 'admin_list') {
      if (!locationId) return Response.json({ error: 'Alege locația.' }, { status: 400 });
      authorized = await authorizeProviderBillingOwner(svc, user, locationId);
      if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
    }
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY');
    if (!secret || !priceId) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
    const stripe = new Stripe(secret);
    if (action === 'admin_list') {
      const payments = input.view === 'payments';
      const subscriptions = input.view === 'subscriptions';
      const params = { limit: 30, ...(input.cursor ? { starting_after: clean(input.cursor) } : {}) };
      const page = subscriptions ? await stripe.subscriptions.list({ ...params, status: 'all' }) : payments ? await stripe.paymentIntents.list({ ...params, expand: ['data.latest_charge'] }) : await stripe.invoices.list(params);
      const customers = new Map();
      const rows = [];
      let organizationTieredPrice;
      for (const item of page.data) {
        const customerId = idOf(item.customer);
        if (!customerId) continue;
        if (!customers.has(customerId)) customers.set(customerId, await stripe.customers.retrieve(customerId));
        const customer = customers.get(customerId);
        // 2026-10-04 (pasul 4): clientii noi sunt pe organizatie (metadata scope: organization).
        const organizationCustomer = customer.metadata?.scope === 'organization' && Boolean(customer.metadata?.organization_id);
        if (customer.deleted || customer.metadata?.app !== 'viasee' || (!customer.metadata.location_id && !organizationCustomer)) continue;
        if (organizationCustomer) {
          if (subscriptions && (item.metadata?.app !== 'viasee' || item.metadata?.organization_id !== customer.metadata.organization_id)) continue;
          const organization = await svc.entities.ProviderOrganization.get(customer.metadata.organization_id).catch(() => null);
          const quantity = item.items?.data?.[0]?.quantity || 1;
          if (subscriptions && organizationTieredPrice === undefined) organizationTieredPrice = await findOrganizationTieredPrice(stripe).catch(() => null);
          rows.push({
            ...(subscriptions ? { id: item.id, created: item.created, status: item.status, amount: item.metadata?.plan_tier === 'enterprise' ? item.items.data[0]?.price?.unit_amount : monthlyAmountForLocationCount(organizationTieredPrice, quantity), quantity, plan_tier: item.metadata?.plan_tier || 'tiered', currency: item.currency, cancel_at_period_end: item.cancel_at_period_end || Boolean(item.cancel_at) } : payments ? paymentIntentSummary(item) : invoiceSummary(item)),
            customer_id: customerId, organization_id: customer.metadata.organization_id,
            location_name: (organization?.public_display_name || organization?.name || customer.metadata.organization_id) + ' (organizație)',
            billing_name: (!payments && !subscriptions ? item.customer_name : customer.name) || customer.name,
            billing_cui: (!payments && !subscriptions ? item.custom_fields?.find(field => field.name === 'CUI')?.value : customer.metadata?.cui) || '',
            dashboard_url: 'https://dashboard.stripe.com/' + (item.livemode ? '' : 'test/') + (subscriptions ? 'subscriptions/' + item.id : payments ? 'payments/' + item.id : 'invoices/' + item.id),
          });
          continue;
        }
        const location = await svc.entities.ProviderLocation.get(customer.metadata.location_id).catch(() => null);
        if (subscriptions && (item.metadata?.app !== 'viasee' || item.metadata?.location_id !== customer.metadata.location_id)) continue;
        rows.push({
          ...(subscriptions ? { id: item.id, created: item.created, status: isViaseeSubscription(item, priceId, customer.metadata.location_id) ? item.status : 'configuration_review', amount: item.items.data[0]?.price?.unit_amount, currency: item.currency, cancel_at_period_end: item.cancel_at_period_end || Boolean(item.cancel_at) } : payments ? paymentIntentSummary(item) : invoiceSummary(item)),
          customer_id: customerId, location_id: customer.metadata.location_id,
          location_name: location?.public_display_name || location?.name || customer.metadata.location_id,
          billing_name: (!payments && !subscriptions ? item.customer_name : customer.name) || customer.name,
          billing_cui: (!payments && !subscriptions ? item.custom_fields?.find(field => field.name === 'CUI')?.value : customer.metadata?.cui) || '',
          dashboard_url: 'https://dashboard.stripe.com/' + (item.livemode ? '' : 'test/') + (subscriptions ? 'subscriptions/' + item.id : payments ? 'payments/' + item.id : 'invoices/' + item.id),
        });
      }
      return Response.json({ rows, has_more: page.has_more, next_cursor: page.data.at(-1)?.id || null });
    }
    if (action === 'save_details') {
      let profile;
      try { profile = validateBillingProfile(input); }
      catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
      const account = await ensureBillingAccount(svc, stripe, authorized.location, user);
      const customer = await stripe.customers.retrieve(account.stripe_customer_id);
      if (customer.deleted) return Response.json({ error: 'Contul de facturare nu mai este disponibil. Contactează VIASEE.' }, { status: 409 });
      assertBillingCustomer(customer, locationId);
      const taxIds = await stripe.customers.listTaxIds(customer.id, { limit: 100 });
      const conflictingVat = taxIds.data.some(tax => tax.type === 'eu_vat' &&
        (profile.billing_type === 'individual' || (profile.billing_address.country === 'RO' && tax.value.replace(/[^0-9]/g, '') !== profile.billing_cui)));
      if (conflictingVat) return Response.json({ error: 'Codul TVA salvat în Stripe nu corespunde noilor date. Actualizează-l din „Gestionează codul TVA”, apoi salvează datele firmei.' }, { status: 409 });
      const preserved = (customer.invoice_settings?.custom_fields || []).filter(field => field.name !== 'CUI');
      if (profile.billing_cui && preserved.length >= 4) return Response.json({ error: 'Datele facturii necesită verificare de către VIASEE.' }, { status: 409 });
      await stripe.customers.update(account.stripe_customer_id, {
        name: profile.billing_name, email: profile.billing_email, address: profile.billing_address,
        metadata: { cui: profile.billing_cui, billing_type: profile.billing_type },
        invoice_settings: { custom_fields: [...preserved, ...(profile.billing_cui ? [{ name: 'CUI', value: profile.billing_cui }] : [])] },
      });
      await svc.entities.ProviderBillingAccount.update(account.id, profile);
      return Response.json({ ok: true });
    }
    if (action !== 'get') return Response.json({ error: 'Acțiune necunoscută.' }, { status: 400 });
    const account = await findBillingAccount(svc, locationId);
    const price = await stripe.prices.retrieve(priceId);
    const localRows = await svc.entities.ProviderSubscription.filter({ location_id: locationId }, '-created_date', 100);
    const manual = localRows.find(row => row.billing_mode === 'manual' && ['active','trialing','grace_period'].includes(row.status) &&
      (!row.current_period_end || Date.parse(row.current_period_end) > Date.now()) && row.plan_code === 'pro');
    const pricing = { amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval, active: price.active, issuer_vat_registered: false, fiscal_mode: 'manual' };
    if (!account) return Response.json({ pricing, manual: manual || null, subscription: null, customer: null, methods: [], invoices: [], has_more: false });
    assertBillingCustomer(await stripe.customers.retrieve(account.stripe_customer_id), locationId);
    const latest = await syncCustomerSubscriptions(svc, stripe, account, priceId);
    const [customer, methods, invoices] = await Promise.all([
      stripe.customers.retrieve(account.stripe_customer_id),
      stripe.paymentMethods.list({ customer: account.stripe_customer_id, type: 'card', limit: 100 }),
      stripe.invoices.list({ customer: account.stripe_customer_id, limit: 20, ...(input.cursor ? { starting_after: clean(input.cursor) } : {}) }),
    ]);
    if (customer.deleted) return Response.json({ error: 'Contul de facturare a fost șters. Contactează VIASEE.' }, { status: 409 });
    const defaultId = idOf(latest?.default_payment_method) || idOf(customer.invoice_settings?.default_payment_method);
    return Response.json({
      pricing, manual: manual || null,
      subscription: latest ? { id: latest.id, status: latest.billing_requires_review ? 'configuration_review' : latest.status, cancel_at_period_end: latest.cancel_at_period_end || Boolean(latest.cancel_at),
        ...resolveSubscriptionPeriod(latest), trial_end: latest.trial_end } : null,
      customer: { name: customer.name || '', email: customer.email || '', address: customer.address || {},
        cui: customer.metadata?.cui || account.billing_cui || '', billing_type: customer.metadata?.billing_type || account.billing_type || 'company',
        tax_ids: (await stripe.customers.listTaxIds(customer.id, { limit: 100 })).data.map(t => ({ type: t.type, value: t.value, status: t.verification?.status })) },
      methods: methods.data.map(m => ({ id: m.id, brand: m.card?.brand, last4: m.card?.last4, exp_month: m.card?.exp_month, exp_year: m.card?.exp_year, is_default: m.id === defaultId })),
      invoices: invoices.data.map(invoiceSummary), has_more: invoices.has_more, next_cursor: invoices.data.at(-1)?.id || null,
    });
  } catch (_error) {
    return Response.json({ error: 'Datele de facturare nu au putut fi actualizate. Reîncearcă.' }, { status: 502 });
  }
}
