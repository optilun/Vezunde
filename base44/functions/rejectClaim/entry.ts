// DEPRECATED (Module 3D). The single canonical claim rejection path is
// directoryOps action=reject_claim (note required, audited).
Deno.serve(async (_req) => {
  try {
    return Response.json(
      { error: 'Endpoint dezactivat. Foloseste directoryOps cu action=reject_claim.' },
      { status: 410 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});