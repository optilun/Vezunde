import { DIRECTORY_FUNCTION_ROUTES } from '../../shared/directoryFunctionRouting.js';
import { handle as adminDataIntegrityOpsHandle } from './adminDataIntegrityOps.ts';
import { handle as adminDirectoryCorrectionReviewHandle } from './adminDirectoryCorrectionReview.ts';
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
import { handle as directoryGeocodeOpsHandle } from './directoryGeocodeOps.ts';
import { handle as directoryImportOpsHandle } from './directoryImportOpsLatest.ts';
import { handle as directoryMappingOpsHandle } from './directoryMappingOps.ts';
import { handle as directoryOpsHandle } from './directoryOps.ts';
import { handle as geoImportOpsHandle } from './geoImportOps.ts';
import { handle as getAdminServiceManagementDataHandle } from './getAdminServiceManagementData.ts';
import { handle as outreachCampaignOpsHandle } from './outreachCampaignOps.ts';
import { handle as outreachSendOpsHandle } from './outreachSendOps.ts';
import { handle as outreachUnsubscribeOpsHandle } from './outreachUnsubscribeOps.ts';
import { handle as outreachWebhookOpsHandle } from './outreachWebhookOps.ts';
import { handle as researchOpsHandle } from './researchOps.ts';
import { handle as researchServiceBatchOpsHandle } from './researchServiceBatchOps.ts';
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
  directoryGeocodeOps: directoryGeocodeOpsHandle,
  directoryImportOps: directoryImportOpsHandle,
  directoryMappingOps: directoryMappingOpsHandle,
  geoImportOps: geoImportOpsHandle,
  getAdminServiceManagementData: getAdminServiceManagementDataHandle,
  outreachCampaignOps: outreachCampaignOpsHandle,
  outreachSendOps: outreachSendOpsHandle,
  researchOps: researchOpsHandle,
  researchServiceBatchOps: researchServiceBatchOpsHandle,
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
  // Doua rute publice, fara autentificare Base44, verificate ATAT de devreme incat corpul
  // cererii nu e nici macar parsat ca JSON __function/payload: Resend (webhook, semnat Svix) si
  // linkul de dezabonare cu un click (query string, poate fi si un simplu GET din browser).
  // Niciuna nu apare in DIRECTORY_FUNCTION_ROUTES / DIRECTORY_FUNCTION_HANDLERS — nu pot fi
  // atinse prin __function, doar prin aceste doua verificari explicite.
  if (req.headers.get('svix-signature')) return outreachWebhookOpsHandle(req);
  const requestUrl = new URL(req.url);
  if (requestUrl.searchParams.get('outreach_action') === 'unsubscribe') return outreachUnsubscribeOpsHandle(req);

  const body = await req.clone().json().catch(() => null);
  const logicalName = typeof body?.__function === 'string' ? body.__function : '';
  if (!logicalName) return directoryOpsHandle(req);

  const handler = DIRECTORY_FUNCTION_HANDLERS[logicalName];
  if (!Object.prototype.hasOwnProperty.call(DIRECTORY_FUNCTION_ROUTES, logicalName) || !handler) {
    return Response.json({ error: `Functie logica necunoscuta: ${logicalName}` }, { status: 404 });
  }

  return handler(routedRequest(req, body.payload));
}
