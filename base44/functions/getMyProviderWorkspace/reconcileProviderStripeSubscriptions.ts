import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@22.6.2';
import { syncVerifiedBillingSubscription } from './billingAccountHelpers.ts';

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    // __automation_trigger is only a routing hint, never proof of identity.
    const user = await base44.auth.me().catch(() => null);
    const authorization = req.headers.get('authorization');
    const serviceAuthorization = req.headers.get('Base44-Service-Authorization');
    const serviceCaller = Boolean(authorization?.startsWith('Bearer ') && authorization.length > 20 && authorization === serviceAuthorization);
    if (user?.role !== 'admin' && !serviceCaller) return Response.json({ error: 'Autentificare de admin sau serviciu necesară.' }, { status: 403 });
    const svc = base44.asServiceRole;
    // This server request validates the service credential before Stripe is accessed.
    await svc.entities.ProviderSubscription.filter({ billing_mode: 'stripe' }, '-created_date', 1);
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID_PRO_MONTHLY');
    if (!secret || !priceId) return Response.json({ error: 'Facturarea nu este configurată complet.' }, { status: 503 });
    const stripe = new Stripe(secret);
    let checked = 0, synced = 0, failed = 0;
    // Stripe pagination discovers paid checkouts even when the customer never returned.
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      const locationId = subscription.metadata?.location_id;
      if (!locationId || subscription.metadata?.app !== 'viasee') continue;
      checked++;
      try {
        const location = await svc.entities.ProviderLocation.get(locationId);
        if (!location) { failed++; continue; }
        await syncVerifiedBillingSubscription(svc, subscription, priceId, locationId, location.organization_id);
        synced++;
      } catch (_error) { failed++; }
    }
    const summary = { success: failed === 0, checked, synced, failed };
    console.info(`[VIASEE] provider Stripe reconciliation ${JSON.stringify({ checked, synced, failed })}`);
    return Response.json(summary, { status: failed > 0 ? 502 : 200 });
  } catch (_error) { return Response.json({ error: 'Resincronizarea abonamentelor a eșuat.' }, { status: 502 }); }
}
