import { handleDirectoryRequest } from './router.ts';

const FUNCTION_DEPLOY_REVISION = 'viasee-runtime-resync-2026-07-28-directory-explicit-types-2';
console.info(`[VIASEE] directoryOps ${FUNCTION_DEPLOY_REVISION}`);

Deno.serve(handleDirectoryRequest);
