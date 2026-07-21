export const PROVIDER_WORKSPACE_FUNCTION_ENDPOINT = 'getMyProviderWorkspace';

export const PROVIDER_WORKSPACE_FUNCTION_ROUTES = Object.freeze({
  getMyAccountDeletionEligibility: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getMyProviderMembers: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getMyProviderOnboardingWorkspace: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getProviderEntitlement: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getProviderLocationComparison: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getProviderLogoReviewStatus: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getProviderProfileCompleteness: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  getProviderWorkspaceOverview: PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
});

export function providerWorkspaceFunctionEnvelope(logicalName, payload = {}) {
  if (!PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName]) {
    throw new Error(`Ruta Base44 lipseste pentru functia logica ${logicalName}`);
  }
  return { __function: logicalName, payload };
}

export function invokeProviderWorkspaceFunction(client, logicalName, payload = {}) {
  const endpoint = PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName];
  if (!endpoint) {
    throw new Error(`Ruta Base44 lipseste pentru functia logica ${logicalName}`);
  }
  return client.functions.invoke(endpoint, providerWorkspaceFunctionEnvelope(logicalName, payload));
}

