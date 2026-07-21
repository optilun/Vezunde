import { SERVICE_CONFIGURATION_FUNCTION_ROUTES } from '../../shared/serviceConfigurationFunctionRouting.js';
import { handle as getProviderServiceConfigurationHandle } from './getProviderServiceConfiguration.ts';
import { handle as getProviderLocationServicesHandle } from './getProviderLocationServices.ts';
import { handle as copyProviderServiceConfigurationHandle } from './copyProviderServiceConfiguration.ts';
import { handle as copyProviderOpeningHoursHandle } from './copyProviderOpeningHours.ts';
import { handle as saveProviderOperatingHoursHandle } from './saveProviderOperatingHours.ts';
import { handle as saveProviderRoutineProfileHandle } from './saveProviderRoutineProfile.ts';
import { handle as submitProviderWorkspaceChangeHandle } from './submitProviderWorkspaceChange.ts';
import { handle as manageProviderOrganizationProfileHandle } from './manageProviderOrganizationProfile.ts';
import { handle as profileFoundationOpsHandle } from './profileFoundationOps.ts';
import { handle as locationPhotoOpsHandle } from './locationPhotoOps.ts';
import { handle as providerPhotoUploadLifecycleOpsHandle } from './providerPhotoUploadLifecycleOps.ts';
import { handle as preserveLegacyLocationLogoHandle } from './preserveLegacyLocationLogo.ts';
import { handle as submitProviderLogoForReviewHandle } from './submitProviderLogoForReview.ts';
import { handle as providerServiceConfigurationOpsHandle } from './providerServiceConfigurationOps.ts';

type ProviderServiceConfigurationHandler = (req: Request) => Response | Promise<Response>;

export const SERVICE_CONFIGURATION_FUNCTION_HANDLERS: Record<string, ProviderServiceConfigurationHandler> = Object.freeze({
  getProviderServiceConfiguration: getProviderServiceConfigurationHandle,
  getProviderLocationServices: getProviderLocationServicesHandle,
  copyProviderServiceConfiguration: copyProviderServiceConfigurationHandle,
  copyProviderOpeningHours: copyProviderOpeningHoursHandle,
  saveProviderOperatingHours: saveProviderOperatingHoursHandle,
  saveProviderRoutineProfile: saveProviderRoutineProfileHandle,
  submitProviderWorkspaceChange: submitProviderWorkspaceChangeHandle,
  manageProviderOrganizationProfile: manageProviderOrganizationProfileHandle,
  profileFoundationOps: profileFoundationOpsHandle,
  locationPhotoOps: locationPhotoOpsHandle,
  providerPhotoUploadLifecycleOps: providerPhotoUploadLifecycleOpsHandle,
  preserveLegacyLocationLogo: preserveLegacyLocationLogoHandle,
  submitProviderLogoForReview: submitProviderLogoForReviewHandle,
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

export async function handleProviderServiceConfigurationRequest(req: Request) {
  const body = await req.clone().json().catch(() => null);
  const logicalName = typeof body?.__function === 'string' ? body.__function : '';
  if (!logicalName) return providerServiceConfigurationOpsHandle(req);

  const handler = SERVICE_CONFIGURATION_FUNCTION_HANDLERS[logicalName];
  if (!Object.prototype.hasOwnProperty.call(SERVICE_CONFIGURATION_FUNCTION_ROUTES, logicalName) || !handler) {
    return Response.json({ error: `Functie logica necunoscuta: ${logicalName}` }, { status: 404 });
  }

  return handler(routedRequest(req, body.payload));
}
