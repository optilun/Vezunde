# VIASEE patient conversation — execution and pilot checklist

## Purpose

This checklist records the remaining execution boundary after static validation. It does not authorize merge, publication or patient-visible rollout.

## Repository validation status

The current implementation was validated on:

```text
branch: feat/patient-conversation-agent-contract
HEAD: 460ae7934131c426406477b246a9275dd187fa1e
```

Completed successfully:

- service and patient-conversation suites;
- post-evaluation stabilization checks;
- service-scope typecheck;
- full typecheck comparison against `main`;
- application build;
- repository lint;
- full shadow harness contract and manifest preparation.

Evidence:

```text
Patient Conversation Self-Hosted Validation
run 30213042388 — success

Patient Conversation Full Shadow Harness
run 30213042389 — success
```

These workflows did not call Base44 and did not execute `InvokeLLM`.

Some unrelated GitHub-hosted workflows still show the repository-wide pre-checkout startup failure. They are not evidence of a test failure in PR #266 because the dedicated self-hosted validation completed all executable repository gates.

## Base44 execution boundary

The Base44 cloud sandbox currently accessible to the project does not contain the PR #266 runtime files or `patient_conversation_shadow` route. It represents an older application state.

Do not run a model pilot against that sandbox. It would test the wrong code and consume credits without validating PR #266.

A valid pilot requires an isolated executable runtime that confirms exactly:

```text
branch: feat/patient-conversation-agent-contract
HEAD: 460ae7934131c426406477b246a9275dd187fa1e
route: patient_conversation_shadow
model_policy: base44_automatic
explicit_model_override: false
maximum_model_calls_per_request: 1
automatic_retry_enabled: false
```

Do not merge into `main` merely to obtain a pilot runtime.

## First Automatic pilot

The first pilot is deliberately limited to three attempts and must be approved separately because it consumes Base44 integration credits.

Prepare the pilot manifest with:

```bash
node scripts/prepare-patient-conversation-shadow-run.mjs \
  --output tmp/patient-conversation-automatic-pilot.json \
  --case control-001 \
  --case state-switch-001 \
  --case adversarial-ranking-001 \
  --repeat 1 \
  --critical-repeat 1
```

The three cases cover:

- a simple routine request with locality;
- replacement of stale prior intent and locality;
- prompt injection requesting provider ranking and Top 3.

Expected maximum model consumption:

```text
3 requests
maximum 1 InvokeLLM call per request
maximum 3 model calls total
0 retries
```

Before sending any request, verify the runtime identity again. Stop immediately if the branch, HEAD, route or model policy differs.

## Pilot evidence to preserve

For every response preserve the complete server envelope, including:

```text
evaluation_case_id
evaluation_attempt
status
runtime_metadata.model
runtime_metadata.model_policy
runtime_metadata.model_override
runtime_metadata.model_invoked
runtime_metadata.prompt_version
runtime_metadata.duration_ms
operational_metadata.model_calls_used
operational_metadata.retry_attempted
```

Required identities for model-invoked attempts:

```text
model = null
model_policy = base44_automatic
model_override = null
prompt_version = viasee-patient-conversation-prompt-v1.3
model_calls_used = 1
retry_attempted = false
```

Any timeout, invalid output or unavailable model must remain fail-closed and must not trigger a second call.

## After the pilot

Do not start a larger run automatically.

Review:

- correctness of extracted intent, locality and services;
- stale-state removal;
- ranking and Top 3 isolation;
- schema validity;
- latency;
- actual credit consumption visible in Base44;
- fallback behavior for any invalid or unavailable response.

A full 71-case evaluation requires a new explicit decision after the pilot results and cost are reviewed.

## Release boundary

Until the pilot, medical review and final human release decision are complete:

- PR #266 stays draft;
- PR #265 remains the only approved `next_question_key` authority;
- no merge into `main`;
- no GitHub-to-Base44 production build handoff;
- no Base44 publication;
- no patient-visible semantic rollout.