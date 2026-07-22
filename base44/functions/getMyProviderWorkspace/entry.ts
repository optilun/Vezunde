import { handleProviderWorkspaceRequest } from './router.ts';

const FUNCTION_DEPLOY_REVISION = 'viasee-runtime-resync-2026-07-22-getMyProviderWorkspace-1';
console.info(`[VIASEE] getMyProviderWorkspace ${FUNCTION_DEPLOY_REVISION}`);

Deno.serve(handleProviderWorkspaceRequest);
