import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { installBase44FunctionRouting } from '@/api/base44FunctionRouting';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const rawBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

export const base44 = installBase44FunctionRouting(rawBase44);
