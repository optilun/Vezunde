// DEPRECATED (Module 3D). The single canonical claim approval path is
// directoryOps action=approve_claim (strict rules: no auto-verify, no auto
// service confirmation, no matching_allowed changes, audited).
// This endpoint is intentionally disabled to prevent the unsafe legacy behavior.
Deno.serve(async (_req) => {
  try {
    return Response.json(
      { error: 'Endpoint dezactivat. Foloseste directoryOps cu action=approve_claim.' },
      { status: 410 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});