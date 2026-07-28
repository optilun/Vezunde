# Patient conversation evaluation security

## Default state

The patient-conversation model route is disabled unless all of these server-side
conditions are present:

- `PATIENT_CONVERSATION_EVALUATION_ENABLED=true`;
- `PATIENT_CONVERSATION_EVALUATION_RUNTIME_CONTEXT=isolated_evaluation`;
- a configured key id;
- a signing secret containing at least 32 characters;
- a positive server-side maximum call count for the approved run;
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the
  dedicated distributed usage store.

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

`--max-calls` may be any positive ceiling up to the number of pending requests.
Use the smallest explicitly approved ceiling when deterministic preflight requests
are expected to consume zero model calls. Omitting the flag authorizes the
conservative maximum of one model call for every pending request.

## Replay and consumption boundary

The runtime reserves an authorized nonce through Redis `SET NX EX` before any
guided or semantic execution. This blocks the same nonce across concurrent
backend instances. The run budget is checked and incremented separately,
immediately before `InvokeLLM`, by one Redis `EVAL` script. The script fixes the
approved ceiling on first use, rejects a different ceiling for the same run and
performs the compare-and-increment atomically.

Therefore, a signed request completed by deterministic preflight consumes no
model-call budget. Reaching the run ceiling does not reject a newly authorized
request before preflight; it rejects the next attempted `InvokeLLM`. The request
nonce remains reserved even when the model-call ceiling is already exhausted.
The existing operational controller still permits at most one model call per
HTTP request and no retry.

Redis keys contain only SHA-256 digests derived from unambiguous JSON tuples
of key id, run id and nonce, plus the approved maximum, used-call counter and
expiry. Tuple serialization prevents separator characters inside identifiers from
aliasing distinct runs or nonces. The keys never contain conversation text,
symptoms, semantic output, patient identifiers or provider results. Nonce and run state expire with the signed authorization, with a hard
upper TTL of 16 minutes.

If Redis is missing, unavailable, times out, returns an invalid response or
reports a run-ceiling mismatch, evaluation fails closed before `InvokeLLM`.
A response can be lost after Redis reserved a slot; in that case the slot remains
consumed and the model is not called. This deliberately prefers under-use over a
quota overrun.

Operational rules:

- keep the route disabled outside the isolated evaluation app;
- authorize only the smallest explicit model-call ceiling approved for one run;
- use a new run id and output path for every run;
- do not execute real patient text;
- do not treat the signed manifest as reusable.

## Logging and responses

Operational summaries exclude patient intent, urgency, next action, service
readiness and grounded symptom text. Unexpected route errors return a generic
message with `Cache-Control: no-store`.

The model failure classifier exposes only controlled categories and HTTP status,
not raw provider output or provider error messages.
