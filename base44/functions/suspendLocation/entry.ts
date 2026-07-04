// DEPRECATED (Module 3D). The single canonical suspension path is
// directoryOps action=suspend_profile (note required, audited).
Deno.serve(async (_req) => {
  try {
    return Response.json(
      { error: 'Endpoint dezactivat. Foloseste directoryOps cu action=suspend_profile.' },
      { status: 410 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});