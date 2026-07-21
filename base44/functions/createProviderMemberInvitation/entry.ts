import { handle as handle_createProviderMemberInvitation } from '../../function_modules/createProviderMemberInvitation.ts';
import { handle as handle_acceptProviderMemberInvitation } from '../../function_modules/acceptProviderMemberInvitation.ts';
import { handle as handle_deactivateProviderMember } from '../../function_modules/deactivateProviderMember.ts';
import { handle as handle_reactivateProviderMember } from '../../function_modules/reactivateProviderMember.ts';
import { handle as handle_revokeProviderMemberInvitation } from '../../function_modules/revokeProviderMemberInvitation.ts';
import { handle as handle_listProviderMemberInvitations } from '../../function_modules/listProviderMemberInvitations.ts';
import { handle as handle_setProviderMemberAccess } from '../../function_modules/setProviderMemberAccess.ts';
import { handle as handle_updateProviderMemberRole } from '../../function_modules/updateProviderMemberRole.ts';
import { handle as handle_syncProviderOrganizationOwnerAccess } from '../../function_modules/syncProviderOrganizationOwnerAccess.ts';

const ROUTER_NAME = "createProviderMemberInvitation";
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "createProviderMemberInvitation": handle_createProviderMemberInvitation,
  "acceptProviderMemberInvitation": handle_acceptProviderMemberInvitation,
  "deactivateProviderMember": handle_deactivateProviderMember,
  "reactivateProviderMember": handle_reactivateProviderMember,
  "revokeProviderMemberInvitation": handle_revokeProviderMemberInvitation,
  "listProviderMemberInvitations": handle_listProviderMemberInvitations,
  "setProviderMemberAccess": handle_setProviderMemberAccess,
  "updateProviderMemberRole": handle_updateProviderMemberRole,
  "syncProviderOrganizationOwnerAccess": handle_syncProviderOrganizationOwnerAccess,
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
