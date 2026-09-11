import { PROVIDER_WORKSPACE_FUNCTION_ROUTES } from '../../shared/providerWorkspaceFunctionRouting.js';
import { handle as getMyAccountDeletionEligibilityHandle } from './getMyAccountDeletionEligibility.ts';
import { handle as getMyProviderMembersHandle } from './getMyProviderMembers.ts';
import { handle as getMyProviderOnboardingWorkspaceHandle } from './getMyProviderOnboardingWorkspace.ts';
import { handle as getProviderEntitlementHandle } from './getProviderEntitlement.ts';
import { handle as getProviderLocationComparisonHandle } from './getProviderLocationComparison.ts';
import { handle as getProviderLogoReviewStatusHandle } from './getProviderLogoReviewStatus.ts';
import { handle as getProviderProfileCompletenessHandle } from './getProviderProfileCompleteness.ts';
import { handle as getProviderWorkspaceOverviewHandle } from './getProviderWorkspaceOverview.ts';
import { handle as createProviderCheckoutSessionHandle } from './createProviderCheckoutSession.ts';
import { handle as createProviderBillingPortalSessionHandle } from './createProviderBillingPortalSession.ts';
import { handle as syncProviderStripeSubscriptionHandle } from './syncProviderStripeSubscription.ts';
import { handle as reconcileProviderStripeSubscriptionsHandle } from './reconcileProviderStripeSubscriptions.ts';
import { handle as stripeBillingWebhookHandle } from './stripeBillingWebhook.ts';
import { handle as getMyProviderWorkspaceHandle } from './getMyProviderWorkspace.ts';

type ProviderWorkspaceHandler = (req: Request) => Response | Promise<Response>;

export const PROVIDER_WORKSPACE_FUNCTION_HANDLERS: Record<string, ProviderWorkspaceHandler> = Object.freeze({
  getMyAccountDeletionEligibility: getMyAccountDeletionEligibilityHandle,
  getMyProviderMembers: getMyProviderMembersHandle,
  getMyProviderOnboardingWorkspace: getMyProviderOnboardingWorkspaceHandle,
  getProviderEntitlement: getProviderEntitlementHandle,
  getProviderLocationComparison: getProviderLocationComparisonHandle,
  getProviderLogoReviewStatus: getProviderLogoReviewStatusHandle,
  getProviderProfileCompleteness: getProviderProfileCompletenessHandle,
  getProviderWorkspaceOverview: getProviderWorkspaceOverviewHandle,
  createProviderCheckoutSession: createProviderCheckoutSessionHandle,
  createProviderBillingPortalSession: createProviderBillingPortalSessionHandle,
  syncProviderStripeSubscription: syncProviderStripeSubscriptionHandle,
  reconcileProviderStripeSubscriptions: reconcileProviderStripeSubscriptionsHandle,
});

function routedRequest(req: Request, payload: unknown) {
  const headers = new Headers(req.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(payload ?? {}),
  });
}

export async function handleProviderWorkspaceRequest(req: Request) {
  // Vezi stripeBillingWebhook.ts: pastrat ca sincronizare best-effort/secundara - platforma
  // Base44 poate intercepta la nivel de gateway un request cu acest header inainte sa ajunga
  // aici. Sincronizarea garantata e syncProviderStripeSubscription (__function normal, mai jos)
  // si reconcileProviderStripeSubscriptions (rulat periodic de un workflow).
  if (req.headers.get('stripe-signature')) return stripeBillingWebhookHandle(req);
  const body = await req.clone().json().catch(() => null);
  const logicalName = typeof body?.__function === 'string' ? body.__function : '';
  if (!logicalName) return getMyProviderWorkspaceHandle(req);

  const handler = PROVIDER_WORKSPACE_FUNCTION_HANDLERS[logicalName];
  if (!Object.prototype.hasOwnProperty.call(PROVIDER_WORKSPACE_FUNCTION_ROUTES, logicalName) || !handler) {
    return Response.json({ error: `Functie logica necunoscuta: ${logicalName}` }, { status: 404 });
  }

  return handler(routedRequest(req, body.payload));
}

