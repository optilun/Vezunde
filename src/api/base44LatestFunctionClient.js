import { createClient } from '@base44/sdk';
import { appParams } from '../lib/app-params.js';

let latestFunctionClient = null;

export function getBase44LatestFunctionClient() {
  if (latestFunctionClient) return latestFunctionClient;

  const { appId, token, appBaseUrl } = appParams;
  latestFunctionClient = createClient({
    appId,
    token,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl,
  });

  return latestFunctionClient;
}
