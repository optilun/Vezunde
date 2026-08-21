import { DIRECTORY_FUNCTION_ROUTES } from '../../shared/directoryFunctionRouting.js';
import { handle as adminDataIntegrityOpsHandle } from './adminDataIntegrityOps.ts';
import { handle as adminDirectoryCorrectionReviewHandle } from './adminDirectoryCorrectionReview.ts';
import { handle as adminFragmentedOrganizationsHandle } from './adminFragmentedOrganizations.ts';
import { handle as adminFragmentedOrganizationsHandle } from './adminFragmentedOrganizations.ts';
import { handle as adminOrganizationProfileReviewHandle } from './adminOrganizationProfileReview.ts';
import { handle as adminProfessionalProfileReviewHandle } from './adminProfessionalProfileReview.ts';
import { handle as adminProviderClaimReviewHandle } from './adminProviderClaimReview.ts';
import { handle as adminProviderScopedClaimReviewHandle } from './adminProviderScopedClaimReview.ts';
import { handle as adminServiceConfigurationReviewHandle } from './adminServiceConfigurationReview.ts';
import { handle as adminServicePrerequisiteReviewHandle } from './adminServicePrerequisiteReview.ts';
import { handle as adminSetLocationHoursHandle } from './adminSetLocationHours.ts';
import { handle as adminWorkspaceReviewHandle } from './adminWorkspaceReview.ts';
import { handle as aiResearchOpsHandle } from './aiResearchOps.ts';
import { handle as backfillLocationServiceMatchingHandle } from './backfillLocationServiceMatching.ts';
import { handle as backfillProviderOrganizationProfileHandle } from './backfillProviderOrganizationProfile.ts';
import { handle as directoryImportOpsHandle } from './directoryImportOpsLatest.ts';
import { handle as directoryMappingOpsHandle } from './directoryMappingOps.ts';
import { handle as directoryOpsHandle } from './directoryOps.ts';
import { handle as geoImportOpsHandle } from './geoImportOps.ts';
import { handle as getAdminServiceManagementDataHandle } from './getAdminServiceManagementData.ts';
import { handle as researchOpsHandle } from './researchOps.ts';
import { handle as reviewProfileChangesHandle } from './reviewProfileChanges.ts';

type DirectoryFunctionHandler = (req: Request) => Response | Promise<Response>;

export const DIRECTORY_FUNCTION_HANDLERS: Record<string, DirectoryFunctionHandler> = Object.freeze({
  adminDataIntegrityOps: adminDataIntegrityOpsHandle,
  adminFragmentedOrganizations: adminFragmentedOrganizationsHandle,
  adminDirectoryCorrectionReview: adminDirectoryCorrectionReviewHandle,
  adminOrganizationProfileReview: adminOrganizationProfileReviewHandle,
  adminProfessionalProfileReview: adminProfessionalProfileReviewHandle,
  adminProviderClaimReview: adminProviderClaimReviewHandle,
  adminProviderScopedClaimReview: adminProviderScopedClaimReviewHandle,
  adminServiceConfigurationReview: adminServiceConfigurationReviewHandle,
  adminServicePrerequisiteReview: adminServicePrerequisiteReviewHandle,
  adminSetLocationHours: adminSetLocationHoursHandle,
  adminWorkspaceReview: adminWorkspaceReviewHandle,
  aiResearchOps: aiResearchOpsHandle,
  backfillLocationServiceMatching: backfillLocationServiceMatchingHandle,
  backfillProviderOrganizationProfile: backfillProviderOrganizationProfileHandle,
  directoryImportOps: directoryImportOpsHandle,
  directoryMappingOps: directoryMappingOpsHandle,
  geoImportOps: geoImportOpsHandle,
  getAdminServiceManagementData: getAdminServiceManagementDataHandle,
  researchOps: researchOpsHandle,
  reviewProfileChanges: reviewProfileChangesHandle,
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

export async function handleDirectoryRequest(req: Request) {
  const body = await req.clone().json().catch(() => null);
  const logicalName = typeof body?.__function === 'string' ? body.__function : '';
  if (!logicalName) return directoryOpsHandle(req);

  const handler = DIRECTORY_FUNCTION_HANDLERS[logicalName];
  if (!Object.prototype.hasOwnProperty.call(DIRECTORY_FUNCTION_ROUTES, logicalName) || !handler) {
    return Response.json({ error: `Functie logica necunoscuta: ${logicalName}` }, { status: 404 });
  }

  return handler(routedRequest(req, body.payload));
}
