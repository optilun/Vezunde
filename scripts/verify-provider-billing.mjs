import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_BILLING_CONTRACT_VERSION,
  PROVIDER_PRO_PLAN,
  authorizeProviderBillingOwner,
  findExistingStripeSubscriptionRow,
  mapStripeSubscriptionStatus,
  providerSubscriptionFieldsFromStripeSubscription,
  resolveSubscriptionPeriod,
  safeBillingReturnBaseUrl,
  upsertProviderSubscriptionFromStripeSubscription,
} from '../base44/shared/providerBillingPolicy.js';
import { PROVIDER_ENTITLEMENT_VERSION } from '../base44/shared/providerEntitlementPolicy.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES } from '../base44/shared/providerWorkspaceFunctionRouting.js';

// --- mapStripeSubscriptionStatus -------------------------------------------------------------
assert.equal(mapStripeSubscriptionStatus('active'), 'active');
assert.equal(mapStripeSubscriptionStatus('trialing'), 'trialing');
assert.equal(mapStripeSubscriptionStatus('past_due'), 'past_due');
assert.equal(mapStripeSubscriptionStatus('canceled'), 'canceled');
assert.equal(mapStripeSubscriptionStatus('unpaid'), 'suspended');
assert.equal(mapStripeSubscriptionStatus('incomplete'), 'incomplete');
assert.equal(mapStripeSubscriptionStatus('incomplete_expired'), 'canceled');
assert.equal(mapStripeSubscriptionStatus('paused'), 'grace_period');
// Un status necunoscut (schimbare viitoare de API Stripe) nu are voie sa cada pe 'active'.
assert.equal(mapStripeSubscriptionStatus('some_future_status'), 'incomplete');
assert.equal(mapStripeSubscriptionStatus(undefined), 'incomplete');

// --- resolveSubscriptionPeriod ----------------------------------------------------------------
const classicShape = resolveSubscriptionPeriod({
  current_period_start: 1750000000,
  current_period_end: 1752678400,
});
assert.equal(classicShape.start, new Date(1750000000 * 1000).toISOString());
assert.equal(classicShape.end, new Date(1752678400 * 1000).toISOString());

// Din 2025-03-31.basil, current_period_start/end s-au mutat pe primul subscription item.
const itemLevelShape = resolveSubscriptionPeriod({
  items: { data: [{ current_period_start: 1750000000, current_period_end: 1752678400 }] },
});
assert.equal(itemLevelShape.start, new Date(1750000000 * 1000).toISOString());
assert.equal(itemLevelShape.end, new Date(1752678400 * 1000).toISOString());

const missingShape = resolveSubscriptionPeriod({});
assert.equal(missingShape.start, null);
assert.equal(missingShape.end, null);

// --- providerSubscriptionFieldsFromStripeSubscription ------------------------------------------
const fields = providerSubscriptionFieldsFromStripeSubscription({
  id: 'sub_123',
  status: 'active',
  customer: 'cus_123',
  cancel_at_period_end: false,
  canceled_at: null,
  current_period_start: 1750000000,
  current_period_end: 1752678400,
  items: { data: [{ price: { id: 'price_123' } }] },
}, { locationId: 'loc-1', organizationId: 'org-1' });
assert.equal(fields.location_id, 'loc-1');
assert.equal(fields.organization_id, 'org-1');
assert.equal(fields.plan_code, 'pro');
assert.equal(fields.status, 'active');
assert.equal(fields.billing_mode, 'stripe');
assert.equal(fields.entitlement_version, PROVIDER_ENTITLEMENT_VERSION);
assert.equal(fields.stripe_customer_id, 'cus_123');
assert.equal(fields.stripe_subscription_id, 'sub_123');
assert.equal(fields.stripe_price_id, 'price_123');
assert.equal(fields.status_reason, 'stripe:active');
assert.equal(fields.source_reference, 'stripe_subscription:sub_123');
assert.ok(Array.isArray(fields.feature_keys) && fields.feature_keys.length > 0);

// Fara organizationId, campul nu trebuie setat deloc (nu trebuie sa suprascrie o organizatie
// deja cunoscuta cu un string gol).
const fieldsWithoutOrg = providerSubscriptionFieldsFromStripeSubscription({ id: 'sub_456', status: 'active' }, { locationId: 'loc-2' });
assert.equal('organization_id' in fieldsWithoutOrg, false);

// Confirmat live 2026-09-11: pe conturile cu billing_mode Stripe 'flexible', o anulare din
// Billing Portal seteaza cancel_at (timestamp) in loc de boolean-ul clasic cancel_at_period_end,
// care ramane 'false'. Fara acest fallback, un abonament programat sa se anuleze arata incorect
// ca activ/reinnoibil automat.
const flexibleCancelFields = providerSubscriptionFieldsFromStripeSubscription({
  id: 'sub_flexible_cancel',
  status: 'active',
  cancel_at_period_end: false,
  cancel_at: 1791750507,
  canceled_at: 1789158684,
}, { locationId: 'loc-3' });
assert.equal(flexibleCancelFields.cancel_at_period_end, true, 'cancel_at (billing_mode flexible) trebuie tratat ca echivalent lui cancel_at_period_end: true');

const classicCancelFields = providerSubscriptionFieldsFromStripeSubscription({
  id: 'sub_classic_cancel',
  status: 'active',
  cancel_at_period_end: true,
}, { locationId: 'loc-4' });
assert.equal(classicCancelFields.cancel_at_period_end, true, 'Boolean-ul clasic cancel_at_period_end trebuie sa functioneze in continuare');

const noCancelFields = providerSubscriptionFieldsFromStripeSubscription({
  id: 'sub_no_cancel',
  status: 'active',
}, { locationId: 'loc-5' });
assert.equal(noCancelFields.cancel_at_period_end, false);

// --- safeBillingReturnBaseUrl (anti open-redirect) ---------------------------------------------
assert.equal(safeBillingReturnBaseUrl('https://viasee.ro/contul-meu?s=leads'), 'https://viasee.ro');
assert.equal(safeBillingReturnBaseUrl('http://localhost:5173/contul-meu'), 'http://localhost:5173');
assert.equal(safeBillingReturnBaseUrl('https://evil.example.com'), 'https://evil.example.com');
// http (non-local) si scheme-uri straine cad pe domeniul de productie.
assert.equal(safeBillingReturnBaseUrl('http://viasee.ro'), 'https://viasee.ro');
assert.equal(safeBillingReturnBaseUrl('javascript:alert(1)'), 'https://viasee.ro');
assert.equal(safeBillingReturnBaseUrl(''), 'https://viasee.ro');
assert.equal(safeBillingReturnBaseUrl(undefined), 'https://viasee.ro');
assert.equal(safeBillingReturnBaseUrl('not a url'), 'https://viasee.ro');

// --- PROVIDER_PRO_PLAN / contract version -------------------------------------------------------
assert.equal(PROVIDER_PRO_PLAN.planCode, 'pro');
assert.equal(PROVIDER_PRO_PLAN.priceRon, 49);
assert.equal(PROVIDER_PRO_PLAN.currency, 'ron');
assert.equal(PROVIDER_PRO_PLAN.interval, 'month');
assert.equal(typeof PROVIDER_BILLING_CONTRACT_VERSION, 'string');

// --- upsertProviderSubscriptionFromStripeSubscription / findExistingStripeSubscriptionRow ------
function makeFakeSvc(initialRows = []) {
  const rows = new Map(initialRows.map((row, index) => [row.id || `row-${index}`, { ...row }]));
  let counter = 0;
  return {
    entities: {
      ProviderSubscription: {
        async filter(query = {}) {
          return Array.from(rows.values()).filter((row) =>
            Object.entries(query).every(([key, value]) => row[key] === value));
        },
        async create(data) {
          counter += 1;
          const id = `created-${counter}`;
          const row = { id, ...data };
          rows.set(id, row);
          return row;
        },
        async update(id, data) {
          const existing = rows.get(id);
          if (!existing) throw new Error(`Rand inexistent: ${id}`);
          const updated = { ...existing, ...data };
          rows.set(id, updated);
          return updated;
        },
      },
    },
    __rows: rows,
  };
}

// Prima sincronizare pentru o locatie noua: trebuie sa creeze un rand nou.
{
  const svc = makeFakeSvc();
  const created = await upsertProviderSubscriptionFromStripeSubscription(svc, {
    id: 'sub_first',
    status: 'active',
    customer: 'cus_first',
    items: { data: [{ price: { id: 'price_1' } }] },
  }, { locationId: 'loc-a', organizationId: 'org-a', initiatedByUserId: 'user-a' });
  assert.ok(created?.id);
  assert.equal(svc.__rows.size, 1);
  assert.equal(created.billing_mode, 'stripe');
  assert.equal(created.billing_owner_user_id, 'user-a');
}

// A doua sincronizare pentru ACELASI abonament (retry de webhook, reconciliere, sync la
// intoarcere) trebuie sa actualizeze randul existent, nu sa creeze un al doilea.
{
  const svc = makeFakeSvc();
  await upsertProviderSubscriptionFromStripeSubscription(svc, {
    id: 'sub_repeat',
    status: 'active',
    customer: 'cus_repeat',
  }, { locationId: 'loc-b' });
  assert.equal(svc.__rows.size, 1);
  await upsertProviderSubscriptionFromStripeSubscription(svc, {
    id: 'sub_repeat',
    status: 'past_due',
    customer: 'cus_repeat',
  }, { locationId: 'loc-b' });
  assert.equal(svc.__rows.size, 1, 'Un abonament re-sincronizat nu trebuie sa duplice randul');
  const [row] = await svc.entities.ProviderSubscription.filter({ stripe_subscription_id: 'sub_repeat' });
  assert.equal(row.status, 'past_due');
}

// Un rand billing_mode: 'manual' preexistent (plan acordat de admin) nu trebuie NICIODATA atins
// sau folosit ca tinta de update de catre sincronizarea Stripe pentru o alta locatie.
{
  const svc = makeFakeSvc([{ id: 'manual-row', location_id: 'loc-c', billing_mode: 'manual', plan_code: 'pro', status: 'active' }]);
  await upsertProviderSubscriptionFromStripeSubscription(svc, {
    id: 'sub_new_for_c',
    status: 'active',
    customer: 'cus_new',
  }, { locationId: 'loc-c' });
  assert.equal(svc.__rows.size, 2, 'Un plan manual existent nu trebuie suprascris - trebuie creat un rand Stripe separat');
  const manualRow = svc.__rows.get('manual-row');
  assert.equal(manualRow.billing_mode, 'manual', 'Randul manual trebuie sa ramana neschimbat');
  const found = await findExistingStripeSubscriptionRow(svc, { locationId: 'loc-c' });
  assert.equal(found.billing_mode, 'stripe', 'findExistingStripeSubscriptionRow nu trebuie sa gaseasca niciodata un rand manual');
}

// --- authorizeProviderBillingOwner --------------------------------------------------------------
{
  const allMemberships = [
    { user_id: 'user-owner', location_id: 'loc-x', status: 'active', role: 'organization_owner' },
    { user_id: 'user-staff', location_id: 'loc-x', status: 'active', role: 'location_staff' },
  ];
  const svc = {
    entities: {
      ProviderLocation: { async get(id) { return id === 'loc-x' ? { id: 'loc-x', organization_id: 'org-x' } : null; } },
      ProviderMembership: {
        async filter(query = {}) {
          return allMemberships.filter((membership) =>
            Object.entries(query).every(([key, value]) => membership[key] === value));
        },
      },
    },
  };
  const adminResult = await authorizeProviderBillingOwner(svc, { role: 'admin', id: 'admin-1' }, 'loc-x');
  assert.equal(adminResult.error, undefined);
  const ownerResult = await authorizeProviderBillingOwner(svc, { role: 'user', id: 'user-owner' }, 'loc-x');
  assert.equal(ownerResult.error, undefined);
  const staffResult = await authorizeProviderBillingOwner(svc, { role: 'user', id: 'user-staff' }, 'loc-x');
  assert.equal(staffResult.status, 403);
  const missingLocationResult = await authorizeProviderBillingOwner(svc, { role: 'user', id: 'user-owner' }, 'loc-missing');
  assert.equal(missingLocationResult.status, 404);
}

// --- Rute Base44: cele 4 functii noi trebuie inregistrate pe bridge-ul getMyProviderWorkspace,
// iar webhook-ul (dispatch direct pe header, nu prin __function) nu trebuie sa fie in rute. -----
const PROVIDER_WORKSPACE_FUNCTION_ENDPOINT = 'getMyProviderWorkspace';
for (const logicalName of [
  'createProviderCheckoutSession',
  'createProviderBillingPortalSession',
  'syncProviderStripeSubscription',
  'reconcileProviderStripeSubscriptions',
]) {
  assert.equal(PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName], PROVIDER_WORKSPACE_FUNCTION_ENDPOINT, `${logicalName} trebuie sa fie rutat catre ${PROVIDER_WORKSPACE_FUNCTION_ENDPOINT}`);
}
assert.equal(PROVIDER_WORKSPACE_FUNCTION_ROUTES.stripeBillingWebhook, undefined, 'stripeBillingWebhook nu se apeleaza niciodata prin __function - Stripe il loveste direct, pe baza header-ului stripe-signature');

// --- Verificari structurale pe fisierele sursa ---------------------------------------------------
async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

// Elimina liniile-comentariu (// ...) inainte de o verificare "nu trebuie sa apara in cod
// executabil" - fisierele explica DE CE nu folosesc un anumit apel, si acea explicatie
// mentioneaza in text chiar apelul evitat.
function stripLineComments(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

const checkoutSource = await source('../base44/functions/getMyProviderWorkspace/createProviderCheckoutSession.ts');
assert.match(checkoutSource, /base44\.auth\.me\(\)/);
assert.match(checkoutSource, /authorizeProviderBillingOwner/);
assert.match(checkoutSource, /CHECKOUT_SESSION_ID/);
assert.match(checkoutSource, /allow_promotion_codes:\s*true/);
assert.match(checkoutSource, /payment_method_collection:\s*'if_required'/);
assert.match(checkoutSource, /mode:\s*'subscription'/);
assert.match(checkoutSource, /STRIPE_PRICE_ID_PRO_MONTHLY/);
assert.doesNotMatch(checkoutSource, /input\.plan_code|input\.price/, 'Checkout-ul nu trebuie sa accepte planul/pretul din input-ul clientului');

const portalSource = await source('../base44/functions/getMyProviderWorkspace/createProviderBillingPortalSession.ts');
assert.match(portalSource, /base44\.auth\.me\(\)/);
assert.match(portalSource, /authorizeProviderBillingOwner/);
assert.match(portalSource, /portal_return/);
assert.match(portalSource, /billingPortal\.sessions\.create/);

const syncSource = await source('../base44/functions/getMyProviderWorkspace/syncProviderStripeSubscription.ts');
assert.match(syncSource, /base44\.auth\.me\(\)/);
assert.match(syncSource, /authorizeProviderBillingOwner/);
assert.match(syncSource, /checkout\.sessions\.retrieve/);
assert.match(syncSource, /client_reference_id/);
assert.match(syncSource, /upsertProviderSubscriptionFromStripeSubscription/);

const reconcileSource = await source('../base44/functions/getMyProviderWorkspace/reconcileProviderStripeSubscriptions.ts');
assert.match(reconcileSource, /__automation_trigger/);
assert.match(reconcileSource, /billing_mode: 'stripe'/);
assert.match(reconcileSource, /upsertProviderSubscriptionFromStripeSubscription/);
assert.match(reconcileSource, /role !== 'admin'/, 'O rulare manuala (fara __automation_trigger) trebuie sa ramana rezervata adminilor');

const webhookSource = await source('../base44/functions/getMyProviderWorkspace/stripeBillingWebhook.ts');
assert.match(webhookSource, /stripe-signature/);
assert.match(webhookSource, /constructEventAsync/);
assert.match(webhookSource, /upsertProviderSubscriptionFromStripeSubscription/);
assert.doesNotMatch(stripLineComments(webhookSource), /auth\.me\(\)/, 'Webhook-ul Stripe nu are niciodata o sesiune Base44 - nu trebuie sa apeleze auth.me() in cod executabil');

const routerSource = await source('../base44/functions/getMyProviderWorkspace/router.ts');
assert.match(routerSource, /stripe-signature/);
assert.match(routerSource, /stripeBillingWebhookHandle/);
assert.match(routerSource, /createProviderCheckoutSession: createProviderCheckoutSessionHandle/);
assert.match(routerSource, /createProviderBillingPortalSession: createProviderBillingPortalSessionHandle/);
assert.match(routerSource, /syncProviderStripeSubscription: syncProviderStripeSubscriptionHandle/);
assert.match(routerSource, /reconcileProviderStripeSubscriptions: reconcileProviderStripeSubscriptionsHandle/);

const policySource = await source('../base44/shared/providerBillingPolicy.js');
assert.doesNotMatch(policySource, /npm:stripe/, 'providerBillingPolicy.js trebuie sa ramana testabil fara SDK-ul Stripe si fara retea');
assert.doesNotMatch(policySource, /Deno\.env/, 'Logica pura nu trebuie sa citeasca secrete direct');

// --- Frontend: panoul de billing trebuie sa apeleze exact aceste patru functii logice si sa
// gestioneze intoarcerea din Stripe prin query params. -------------------------------------------
const panelSource = await source('../src/components/workspace/provider/leads/ProviderBillingPanel.jsx');
assert.match(panelSource, /createProviderCheckoutSession/);
assert.match(panelSource, /createProviderBillingPortalSession/);
assert.match(panelSource, /syncProviderStripeSubscription/);
assert.match(panelSource, /billing.*success|success.*billing/s);

const inboxSource = await source('../src/components/workspace/provider/ProviderLeadInbox.jsx');
assert.match(inboxSource, /ProviderBillingPanel/);
assert.match(inboxSource, /refreshTick/);

// --- Workflow-ul de resincronizare periodica ------------------------------------------------------
const workflowSource = await source("../base44/workflows/Provider Stripe Subscription Reconciler.jsonc");
const workflow = JSON.parse(workflowSource);
assert.equal(workflow.trigger.config.trigger_type, 'scheduled');
assert.equal(workflow.trigger.config.timezone, 'Europe/Bucharest');
const reconcileStep = workflow.definition.do[0].reconcile_provider_stripe_subscriptions;
assert.equal(reconcileStep.with.function_name, 'getMyProviderWorkspace');
assert.equal(reconcileStep.with.args.__function, 'reconcileProviderStripeSubscriptions');
assert.equal(reconcileStep.with.args.payload.__automation_trigger, true);

console.log('Provider billing checks passed.');
