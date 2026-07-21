import { PROVIDER_WORKSPACE_FUNCTION_ROUTES } from '../../shared/providerWorkspaceFunctionRouting.js';
import { handle as getMyAccountDeletionEligibilityHandle } from './getMyAccountDeletionEligibility.ts';
import { handle as getMyProviderMembersHandle } from './getMyProviderMembers.ts';
import { handle as getMyProviderOnboardingWorkspaceHandle } from './getMyProviderOnboardingWorkspace.ts';
import { handle as getProviderEntitlementHandle } from './getProviderEntitlement.ts';
import { handle as getProviderLocationComparisonHandle } from './getProviderLocationComparison.ts';
import { handle as getProviderLogoReviewStatusHandle } from './getProviderLogoReviewStatus.ts';
import { handle as getProviderProfileCompletenessHandle } from './getProviderProfileCompleteness.ts';
import { handle as getProviderWorkspaceOverviewHandle } from './getProviderWorkspaceOverview.ts';
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
  const body = await req.clone().json().catch(() => null);
  const logicalName = typeof body?.__function === 'string' ? body.__function : '';
  if (!logicalName) return getMyProviderWorkspaceHandle(req);

  const handler = PROVIDER_WORKSPACE_FUNCTION_HANDLERS[logicalName];
  if (!Object.prototype.hasOwnProperty.call(PROVIDER_WORKSPACE_FUNCTION_ROUTES, logicalName) || !handler) {
    return Response.json({ error: `Functie logica necunoscuta: ${logicalName}` }, { status: 404 });
  }

  return handler(routedRequest(req, body.payload));
}

