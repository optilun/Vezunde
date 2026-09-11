// Resincronizare periodica a abonamentelor Stripe (2026-09-11).
//
// Completeaza syncProviderStripeSubscription.ts: acela acopera intoarcerea din Checkout/Billing
// Portal, cat timp providerul e prezent in aplicatie. Reinnoirile lunare, esecurile de plata sau
// anularile facute direct in Stripe (fara ca providerul sa mai deschida vreodata workspace-ul)
// nu trec prin nicio pagina de-a noastra - de-asta exista acest pas periodic, in aceeasi familie
// cu Directory Auto Import Scheduler: un workflow Base44 programat apeleaza aceasta functie cu
// __automation_trigger: true (in payload), exact ca advance_auto_import_runs in
// directoryAutoImportOps.ts, iar functia re-citeste direct de la Stripe (sursa de adevar)
// fiecare abonament platit prin Stripe si suprascrie starea prin
// upsertProviderSubscriptionFromStripeSubscription (providerBillingPolicy.js).
//
// Nu poate niciodata acorda Pro cuiva care nu are deja un stripe_subscription_id real - doar
// re-confirma ce spune Stripe despre un abonament deja existent. Un admin poate rula acelasi
// pas manual (fara __automation_trigger), autentificat.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { upsertProviderSubscriptionFromStripeSubscription } from '../../shared/providerBillingPolicy.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

async function authorizeAdminOrAutomation(base44, input) {
  if (input?.__automation_trigger === true) return { svc: base44.asServiceRole };
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return { error: 'Autentificare de admin necesara.', status: 403 };
  return { svc: base44.asServiceRole };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const input = await req.json().catch(() => ({}));
    const auth = await authorizeAdminOrAutomation(base44, input);
    if (auth.error) return res({ error: auth.error }, auth.status);
    const svc = auth.svc;

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) return res({ error: 'Facturarea Stripe nu este configurata complet.' }, 500);
    const stripe = new Stripe(secretKey);

    const rows = await svc.entities.ProviderSubscription.filter({
      billing_mode: 'stripe',
    }, '-created_date', 200);
    const withSubscriptionId = rows.filter((row) => row.stripe_subscription_id);

    let synced = 0;
    let failed = 0;
    for (const row of withSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
          expand: ['items.data.price'],
        });
        await upsertProviderSubscriptionFromStripeSubscription(svc, subscription, {
          locationId: row.location_id,
          organizationId: row.organization_id,
        });
        synced += 1;
      } catch (error) {
        failed += 1;
        console.error('[VIASEE] reconcileProviderStripeSubscriptions: rand esuat', row.id, error?.message);
      }
    }

    return res({ success: true, checked: withSubscriptionId.length, synced, failed });
  } catch (_error) {
    return res({ error: 'Resincronizarea abonamentelor Stripe a esuat.' }, 500);
  }
}
