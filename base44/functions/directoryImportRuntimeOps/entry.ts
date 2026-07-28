import { handle as directoryImportOpsHandle } from '../directoryOps/directoryImportOpsLatest.ts';

const FUNCTION_DEPLOY_REVISION = 'viasee-directory-import-runtime-dedicated-1';
console.info(`[VIASEE] directoryImportRuntimeOps ${FUNCTION_DEPLOY_REVISION}`);

function routedRequest(req: Request, payload: unknown) {
  const headers = new Headers(req.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(payload ?? {}),
  });
}

Deno.serve(async (req: Request) => {
  const body = await req.clone().json().catch(() => null);
  const logicalName = typeof body?.__function === 'string' ? body.__function : '';
  if (logicalName && logicalName !== 'directoryImportOps') {
    return Response.json({ error: `Functie logica necunoscuta: ${logicalName}` }, { status: 404 });
  }
  const payload = logicalName ? body?.payload : body;
  return directoryImportOpsHandle(routedRequest(req, payload));
});
