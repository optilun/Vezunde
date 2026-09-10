import { handleDirectoryRequest } from './router.ts';

const FUNCTION_DEPLOY_REVISION = 'viasee-data-integrity-bulk-2026-09-10-1';
console.info(`[VIASEE] directoryOps ${FUNCTION_DEPLOY_REVISION}`);

Deno.serve(handleDirectoryRequest);
