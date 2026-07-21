import { handle as handle_getMyProviderWorkspace } from '../../function_modules/getMyProviderWorkspace.ts';
import { handle as handle_getMyAccountDeletionEligibility } from '../../function_modules/getMyAccountDeletionEligibility.ts';
import { handle as handle_getMyProviderMembers } from '../../function_modules/getMyProviderMembers.ts';
import { handle as handle_getMyProviderOnboardingWorkspace } from '../../function_modules/getMyProviderOnboardingWorkspace.ts';
import { handle as handle_getProviderEntitlement } from '../../function_modules/getProviderEntitlement.ts';
import { handle as handle_getProviderLocationComparison } from '../../function_modules/getProviderLocationComparison.ts';
import { handle as handle_getProviderLogoReviewStatus } from '../../function_modules/getProviderLogoReviewStatus.ts';
import { handle as handle_getProviderProfileCompleteness } from '../../function_modules/getProviderProfileCompleteness.ts';
import { handle as handle_getProviderWorkspaceOverview } from '../../function_modules/getProviderWorkspaceOverview.ts';

const ROUTER_NAME = "getMyProviderWorkspace";
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "getMyProviderWorkspace": handle_getMyProviderWorkspace,
  "getMyAccountDeletionEligibility": handle_getMyAccountDeletionEligibility,
  "getMyProviderMembers": handle_getMyProviderMembers,
  "getMyProviderOnboardingWorkspace": handle_getMyProviderOnboardingWorkspace,
  "getProviderEntitlement": handle_getProviderEntitlement,
  "getProviderLocationComparison": handle_getProviderLocationComparison,
  "getProviderLogoReviewStatus": handle_getProviderLogoReviewStatus,
  "getProviderProfileCompleteness": handle_getProviderProfileCompleteness,
  "getProviderWorkspaceOverview": handle_getProviderWorkspaceOverview,
};

function response(body: unknown, status = 200) {
  return Response.json(body, { status });
}

Deno.serve(async (req) => {
  try {
    const envelope = await req.clone().json().catch(() => ({}));
    const requested = typeof envelope?.__function === 'string' ? envelope.__function : ROUTER_NAME;
    const handler = HANDLERS[requested];
    if (!handler) return response({ error: 'Operatie consolidata necunoscuta.', requested }, 400);
    const payload = requested === ROUTER_NAME ? envelope : (envelope?.payload ?? {});
    const forwarded = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(payload),
    });
    return handler(forwarded);
  } catch (error) {
    return response({ error: error?.message || 'Routerul Base44 nu a putut procesa cererea.' }, 500);
  }
});
