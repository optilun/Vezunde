export const SERVICE_CONFIGURATION_FUNCTION_ENDPOINT = 'providerServiceConfigurationOps';

export const SERVICE_CONFIGURATION_FUNCTION_ROUTES = Object.freeze({
  getProviderServiceConfiguration: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  getProviderLocationServices: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  copyProviderServiceConfiguration: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  copyProviderOpeningHours: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  saveProviderOperatingHours: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  saveProviderRoutineProfile: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  submitProviderWorkspaceChange: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  manageProviderOrganizationProfile: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  profileFoundationOps: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  locationPhotoOps: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  providerPhotoUploadLifecycleOps: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  preserveLegacyLocationLogo: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  submitProviderLogoForReview: SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
});

export function serviceConfigurationFunctionEnvelope(logicalName, payload = {}) {
  if (!SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName]) {
    throw new Error(`Ruta Base44 lipseste pentru functia logica ${logicalName}`);
  }
  return { __function: logicalName, payload };
}

export function invokeServiceConfigurationFunction(client, logicalName, payload = {}) {
  const endpoint = SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName];
  if (!endpoint) {
    throw new Error(`Ruta Base44 lipseste pentru functia logica ${logicalName}`);
  }
  return client.functions.invoke(endpoint, serviceConfigurationFunctionEnvelope(logicalName, payload));
}
