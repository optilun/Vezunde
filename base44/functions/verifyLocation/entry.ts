// DEPRECATED (Module 3D). The single canonical profile verification path is
// directoryOps action=verify_profile (note required, audited, services are
// NEVER auto-verified).
Deno.serve(async (_req) => {
  try {
    return Response.json(
      { error: 'Endpoint dezactivat. Foloseste directoryOps cu action=verify_profile.' },
      { status: 410 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});