import { createClient } from '@base44/sdk';

let latestFunctionClient = null;
let latestFunctionClientPromise = null;

export async function getBase44LatestFunctionClient() {
  if (latestFunctionClient) return latestFunctionClient;
  if (latestFunctionClientPromise) return latestFunctionClientPromise;

  latestFunctionClientPromise = import('../lib/app-params.js').then(({ appParams }) => {
    const { appId, token, appBaseUrl } = appParams;
    latestFunctionClient = createClient({
      appId,
      token,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    });
    return latestFunctionClient;
  }).catch((error) => {
    latestFunctionClientPromise = null;
    throw error;
  });

  return latestFunctionClientPromise;
}
