import { handleProviderServiceConfigurationRequest } from './router.ts';

const FUNCTION_DEPLOY_REVISION = 'viasee-runtime-resync-2026-07-22-providerServiceConfigurationOps-3';
console.info(`[VIASEE] providerServiceConfigurationOps ${FUNCTION_DEPLOY_REVISION}`);

Deno.serve(handleProviderServiceConfigurationRequest);