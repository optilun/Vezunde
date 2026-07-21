import { handle as handle_submitProviderClaim } from '../../function_modules/submitProviderClaim.ts';
import { handle as handle_submitProviderScopedClaim } from '../../function_modules/submitProviderScopedClaim.ts';
import { handle as handle_getProviderClaimScopeOptions } from '../../function_modules/getProviderClaimScopeOptions.ts';
import { handle as handle_providerLocationExpansionOps } from '../../function_modules/providerLocationExpansionOps.ts';
import { handle as handle_providerLocationIdentityResolutionOps } from '../../function_modules/providerLocationIdentityResolutionOps.ts';
import { handle as handle_providerLocationLifecycleOps } from '../../function_modules/providerLocationLifecycleOps.ts';
import { handle as handle_updateProviderLocation } from '../../function_modules/updateProviderLocation.ts';

const ROUTER_NAME = "submitProviderClaim";
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "submitProviderClaim": handle_submitProviderClaim,
  "submitProviderScopedClaim": handle_submitProviderScopedClaim,
  "getProviderClaimScopeOptions": handle_getProviderClaimScopeOptions,
  "providerLocationExpansionOps": handle_providerLocationExpansionOps,
  "providerLocationIdentityResolutionOps": handle_providerLocationIdentityResolutionOps,
  "providerLocationLifecycleOps": handle_providerLocationLifecycleOps,
  "updateProviderLocation": handle_updateProviderLocation,
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
