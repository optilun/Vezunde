import { handle as handle_directoryOps } from '../../function_modules/directoryOps.ts';
import { handle as handle_adminDataIntegrityOps } from '../../function_modules/adminDataIntegrityOps.ts';
import { handle as handle_adminDirectoryCorrectionReview } from '../../function_modules/adminDirectoryCorrectionReview.ts';
import { handle as handle_adminOrganizationProfileReview } from '../../function_modules/adminOrganizationProfileReview.ts';
import { handle as handle_adminProfessionalProfileReview } from '../../function_modules/adminProfessionalProfileReview.ts';
import { handle as handle_adminProviderClaimReview } from '../../function_modules/adminProviderClaimReview.ts';
import { handle as handle_adminProviderScopedClaimReview } from '../../function_modules/adminProviderScopedClaimReview.ts';
import { handle as handle_adminServiceConfigurationReview } from '../../function_modules/adminServiceConfigurationReview.ts';
import { handle as handle_adminServicePrerequisiteReview } from '../../function_modules/adminServicePrerequisiteReview.ts';
import { handle as handle_adminWorkspaceReview } from '../../function_modules/adminWorkspaceReview.ts';
import { handle as handle_aiResearchOps } from '../../function_modules/aiResearchOps.ts';
import { handle as handle_backfillLocationServiceMatching } from '../../function_modules/backfillLocationServiceMatching.ts';
import { handle as handle_backfillProviderOrganizationProfile } from '../../function_modules/backfillProviderOrganizationProfile.ts';
import { handle as handle_directoryImportOps } from '../../function_modules/directoryImportOps.ts';
import { handle as handle_directoryMappingOps } from '../../function_modules/directoryMappingOps.ts';
import { handle as handle_geoImportOps } from '../../function_modules/geoImportOps.ts';
import { handle as handle_getAdminServiceManagementData } from '../../function_modules/getAdminServiceManagementData.ts';
import { handle as handle_researchOps } from '../../function_modules/researchOps.ts';
import { handle as handle_reviewProfileChanges } from '../../function_modules/reviewProfileChanges.ts';

const ROUTER_NAME = "directoryOps";
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "directoryOps": handle_directoryOps,
  "adminDataIntegrityOps": handle_adminDataIntegrityOps,
  "adminDirectoryCorrectionReview": handle_adminDirectoryCorrectionReview,
  "adminOrganizationProfileReview": handle_adminOrganizationProfileReview,
  "adminProfessionalProfileReview": handle_adminProfessionalProfileReview,
  "adminProviderClaimReview": handle_adminProviderClaimReview,
  "adminProviderScopedClaimReview": handle_adminProviderScopedClaimReview,
  "adminServiceConfigurationReview": handle_adminServiceConfigurationReview,
  "adminServicePrerequisiteReview": handle_adminServicePrerequisiteReview,
  "adminWorkspaceReview": handle_adminWorkspaceReview,
  "aiResearchOps": handle_aiResearchOps,
  "backfillLocationServiceMatching": handle_backfillLocationServiceMatching,
  "backfillProviderOrganizationProfile": handle_backfillProviderOrganizationProfile,
  "directoryImportOps": handle_directoryImportOps,
  "directoryMappingOps": handle_directoryMappingOps,
  "geoImportOps": handle_geoImportOps,
  "getAdminServiceManagementData": handle_getAdminServiceManagementData,
  "researchOps": handle_researchOps,
  "reviewProfileChanges": handle_reviewProfileChanges,
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
