# Patient conversation evaluation security

## Default state

The patient-conversation model route is disabled unless all of these server-side
conditions are present:

- `PATIENT_CONVERSATION_EVALUATION_ENABLED=true`;
- `PATIENT_CONVERSATION_EVALUATION_RUNTIME_CONTEXT=isolated_evaluation`;
- a configured key id;
- a signing secret containing at least 32 characters;
- a positive server-side maximum call count for the approved run.

Production must not define this opt-in configuration.

## Synthetic request authorization

Only requests generated from the repository fixture manifest may be authorized.
The signing tool binds the complete request payload to:

- the fixture fingerprint;
- the evaluation case and attempt;
- a run id;
- a one-use nonce;
- a short expiry;
- the approved upper bound for model calls in the run.

Changing any signed field invalidates the HMAC. The signing secret is read only
from an environment variable and is never written to the output manifest.

## Replay and consumption boundary

The runtime reserves an authorized nonce before any guided or semantic execution
and blocks a duplicate nonce within the same warm function instance. The run
budget is checked and incremented separately, immediately before `InvokeLLM`.
Therefore, a signed request completed by deterministic preflight consumes no
model-call budget. The existing operational controller still permits at most one
model call per HTTP request and no retry.

The replay map and per-run counter are process-scoped. They are not a durable,
cross-instance quota. A global guarantee requires a dedicated persisted usage
entity with atomic uniqueness or another platform-level idempotency primitive.
That schema change is intentionally outside this patch.

Until that persistence is approved:

- keep the route disabled outside the isolated evaluation app;
- authorize only the exact number of calls approved for one run;
- use a new run id and output path for every run;
- do not execute real patient text;
- do not treat the signed manifest as reusable.

## Logging and responses

Operational summaries exclude patient intent, urgency, next action, service
readiness and grounded symptom text. Unexpected route errors return a generic
message with `Cache-Control: no-store`.

The model failure classifier exposes only controlled categories and HTTP status,
not raw provider output or provider error messages.
