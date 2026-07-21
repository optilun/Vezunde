import { handle as handle_getMyProfessionalWorkspace } from '../../function_modules/getMyProfessionalWorkspace.ts';
import { handle as handle_manageMyProfessionalProfile } from '../../function_modules/manageMyProfessionalProfile.ts';
import { handle as handle_manageProfessionalAssignment } from '../../function_modules/manageProfessionalAssignment.ts';
import { handle as handle_professionalInvitationOps } from '../../function_modules/professionalInvitationOps.ts';

const ROUTER_NAME = "getMyProfessionalWorkspace";
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "getMyProfessionalWorkspace": handle_getMyProfessionalWorkspace,
  "manageMyProfessionalProfile": handle_manageMyProfessionalProfile,
  "manageProfessionalAssignment": handle_manageProfessionalAssignment,
  "professionalInvitationOps": handle_professionalInvitationOps,
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
