import { handle as handle_providerServiceConfigurationOps } from '../../function_modules/providerServiceConfigurationOps.ts';
import { handle as handle_getProviderServiceConfiguration } from '../../function_modules/getProviderServiceConfiguration.ts';
import { handle as handle_getProviderLocationServices } from '../../function_modules/getProviderLocationServices.ts';
import { handle as handle_copyProviderServiceConfiguration } from '../../function_modules/copyProviderServiceConfiguration.ts';
import { handle as handle_copyProviderOpeningHours } from '../../function_modules/copyProviderOpeningHours.ts';
import { handle as handle_saveProviderOperatingHours } from '../../function_modules/saveProviderOperatingHours.ts';
import { handle as handle_saveProviderRoutineProfile } from '../../function_modules/saveProviderRoutineProfile.ts';
import { handle as handle_submitProviderWorkspaceChange } from '../../function_modules/submitProviderWorkspaceChange.ts';
import { handle as handle_manageProviderOrganizationProfile } from '../../function_modules/manageProviderOrganizationProfile.ts';
import { handle as handle_profileFoundationOps } from '../../function_modules/profileFoundationOps.ts';
import { handle as handle_locationPhotoOps } from '../../function_modules/locationPhotoOps.ts';
import { handle as handle_providerPhotoUploadLifecycleOps } from '../../function_modules/providerPhotoUploadLifecycleOps.ts';
import { handle as handle_preserveLegacyLocationLogo } from '../../function_modules/preserveLegacyLocationLogo.ts';
import { handle as handle_submitProviderLogoForReview } from '../../function_modules/submitProviderLogoForReview.ts';

const ROUTER_NAME = "providerServiceConfigurationOps";
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "providerServiceConfigurationOps": handle_providerServiceConfigurationOps,
  "getProviderServiceConfiguration": handle_getProviderServiceConfiguration,
  "getProviderLocationServices": handle_getProviderLocationServices,
  "copyProviderServiceConfiguration": handle_copyProviderServiceConfiguration,
  "copyProviderOpeningHours": handle_copyProviderOpeningHours,
  "saveProviderOperatingHours": handle_saveProviderOperatingHours,
  "saveProviderRoutineProfile": handle_saveProviderRoutineProfile,
  "submitProviderWorkspaceChange": handle_submitProviderWorkspaceChange,
  "manageProviderOrganizationProfile": handle_manageProviderOrganizationProfile,
  "profileFoundationOps": handle_profileFoundationOps,
  "locationPhotoOps": handle_locationPhotoOps,
  "providerPhotoUploadLifecycleOps": handle_providerPhotoUploadLifecycleOps,
  "preserveLegacyLocationLogo": handle_preserveLegacyLocationLogo,
  "submitProviderLogoForReview": handle_submitProviderLogoForReview,
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
