# VIASEE patient conversation — validation blockers

Status: draft shadow implementation only.

This document records controls that must not be presented as passed or implemented until executable evidence exists.

## 1. External execution blockers

- GitHub Actions currently fails before checkout across unrelated workflows.
- The affected jobs expose no executable steps and no logs.
- The connected Base44 sandbox does not grant the required write/command execution scope.
- A direct repository checkout is not available in the current execution environment.

Consequences:

- full verification scripts have not executed on the final HEAD;
- lint has not executed on the final HEAD;
- service typecheck has not executed on the final HEAD;
- build has not executed on the final HEAD;
- the controlled 71-case model run has not executed.

Static review and isolated expression checks are not substitutes for these gates.

## 2. `invented_symptoms` evaluator token

The evaluator contains an `invented_symptoms` expectation token, but it does not have a reliable deterministic implementation.

It must not be counted as an active protection or successful acceptance metric.

A safe implementation requires evidence binding between each extracted symptom fact and user-provided text. A simple keyword-difference heuristic is insufficient because it would:

- reject legitimate semantic normalization;
- miss paraphrased hallucinations;
- create language and diacritic false positives;
- encourage evaluation overfitting.

Before this token may be accepted, the semantic contract must expose a field-level evidence mapping or another reviewed grounding mechanism. The evaluator must then verify the mapping against sanitized user turns.

### Current fail-closed release behavior

The fixture contract now classifies `invented_symptoms` as an explicitly unimplemented expectation.

This distinction preserves the research fixture while preventing a false release claim:

- structural fixture validation still recognizes the token;
- `collectPatientConversationUnimplementedExpectations()` reports every fixture that depends on it;
- `summary-001` is currently reported as blocked;
- `assertPatientConversationFixtureReleaseReady()` throws `PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED`;
- `evaluate-patient-conversation-results-validated.mjs` invokes that release assertion before the scorer;
- the validated release evaluator therefore cannot report acceptance while the grounding check is missing.

The lower-level scorer remains useful for development diagnostics, but it is not a release-approval entry point. Release evidence must use the validated launcher.

Until field-level grounding exists, fixture contracts used for release approval must not rely on `invented_symptoms` as proof of safety.

## 3. Durable state and cost controls

Implemented request-scoped controls are not durable patient controls.

Still required before patient-visible LLM activation:

- server-owned conversation/session persistence;
- per-session model-call budget;
- per-user model-call budget;
- reviewed expiry and concurrency rules;
- server-owned sampling identity independent of patient text;
- observability and alert thresholds;
- a documented cancellation limitation or real SDK cancellation support.

## 4. Safety review

`patient-eye-safety-v1.2` is now the single deterministic Romanian safety boundary used by the existing intake UI and by the administrator-only shadow agent.

It defines:

- `clear` for no unresolved deterministic safety signal;
- `advisory` for ambiguous monocular wording or model-proposed possible safety signals;
- `blocking` for explicit acute wording or guided emergency answers.

This unification removes the previous frontend/Base44 contradiction, but it still requires:

- complete fixture execution;
- repeated critical attempts;
- manual review of false-positive and false-negative cases;
- medical safety review;
- review for unsupported Romanian variants and mixed-language acute wording;
- review of the transition from `advisory` to `clear` after user clarification;
- review of the transition from `advisory` to `blocking` after an acute guided answer.

No medical safety approval is implied by the current code.

## 5. Patient UI boundary

The existing patient intake uses the shared deterministic safety policy only.

This does not activate the semantic LLM for patients.

The current UI behavior must still be verified through executable tests and manual interaction:

- ambiguous wording must show clarification, not emergency guidance;
- `Niciuna dintre acestea` must allow the unchanged description to continue without a loop;
- editing the description must invalidate the previous safety review;
- blocking cases must remain stopped;
- advisory cases must not expose hospital or 112 guidance.

## 6. Orchestration boundary

PR #265 must remain the sole approved next-question orchestrator for the future LLM-assisted conversation.

PR #266 must not independently:

- own adaptive next-question selection;
- activate patient-visible LLM wording;
- invoke matching from the shadow route;
- alter provider eligibility;
- alter ranking or Top 3;
- distribute requests;
- expose contact details.

## 7. Release rule

PR #266 must remain draft and unpublished until all executable checks, controlled model evaluations, manual reviews and orchestration integration requirements are satisfied.

A release evaluation is invalid unless it uses `evaluate-patient-conversation-results-validated.mjs` and completes without fixture-contract or release-readiness blockers.
