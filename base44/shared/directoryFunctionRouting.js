export const DIRECTORY_FUNCTION_ENDPOINT = 'directoryOps';

export const DIRECTORY_FUNCTION_ROUTES = Object.freeze({
  adminDataIntegrityOps: DIRECTORY_FUNCTION_ENDPOINT,
  adminDirectoryCorrectionReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminOrganizationProfileReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminProfessionalProfileReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminProviderClaimReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminProviderScopedClaimReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminServiceConfigurationReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminServicePrerequisiteReview: DIRECTORY_FUNCTION_ENDPOINT,
  adminWorkspaceReview: DIRECTORY_FUNCTION_ENDPOINT,
  aiResearchOps: DIRECTORY_FUNCTION_ENDPOINT,
  backfillLocationServiceMatching: DIRECTORY_FUNCTION_ENDPOINT,
  backfillProviderOrganizationProfile: DIRECTORY_FUNCTION_ENDPOINT,
  directoryImportOps: DIRECTORY_FUNCTION_ENDPOINT,
  directoryMappingOps: DIRECTORY_FUNCTION_ENDPOINT,
  geoImportOps: DIRECTORY_FUNCTION_ENDPOINT,
  getAdminServiceManagementData: DIRECTORY_FUNCTION_ENDPOINT,
  researchOps: DIRECTORY_FUNCTION_ENDPOINT,
  reviewProfileChanges: DIRECTORY_FUNCTION_ENDPOINT,
});

export function directoryFunctionEnvelope(logicalName, payload = {}) {
  if (!DIRECTORY_FUNCTION_ROUTES[logicalName]) {
    throw new Error(`Ruta Base44 lipseste pentru functia logica ${logicalName}`);
  }
  return { __function: logicalName, payload };
}

export function invokeDirectoryFunction(client, logicalName, payload = {}) {
  const endpoint = DIRECTORY_FUNCTION_ROUTES[logicalName];
  if (!endpoint) {
    throw new Error(`Ruta Base44 lipseste pentru functia logica ${logicalName}`);
  }
  return client.functions.invoke(endpoint, directoryFunctionEnvelope(logicalName, payload));
}
