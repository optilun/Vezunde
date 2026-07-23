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

The evaluator currently contains an `invented_symptoms` expectation token, but it does not have a reliable deterministic implementation.

It must not be counted as an active protection or successful acceptance metric.

A safe implementation requires evidence binding between each extracted symptom fact and user-provided text. A simple keyword-difference heuristic is insufficient because it would:

- reject legitimate semantic normalization;
- miss paraphrased hallucinations;
- create language and diacritic false positives;
- encourage evaluation overfitting.

Before this token may be accepted, the semantic contract must expose a field-level evidence mapping or another reviewed grounding mechanism. The evaluator must then verify the mapping against sanitized user turns.

Until that exists, fixture contracts used for release approval must not rely on `invented_symptoms` as proof of safety.

## 3. Durable state and cost controls

Implemented request-scoped controls are not durable patient controls.

Still required before patient-visible activation:

- server-owned conversation/session persistence;
- per-session model-call budget;
- per-user model-call budget;
- reviewed expiry and concurrency rules;
- server-owned sampling identity independent of patient text;
- observability and alert thresholds;
- a documented cancellation limitation or real SDK cancellation support.

## 4. Safety review

`patient-eye-safety-v1.1` has a deterministic Romanian text boundary and isolated expression checks, but still requires:

- complete fixture execution;
- repeated critical attempts;
- manual output review;
- medical safety review;
- review for unsupported Romanian variants and mixed-language acute wording.

No medical safety approval is implied by the current code.

## 5. Orchestration boundary

PR #265 must remain the sole approved next-question orchestrator.

PR #266 must not independently:

- choose the next question;
- activate patient-visible wording;
- invoke matching;
- alter provider eligibility;
- alter ranking or Top 3;
- distribute requests;
- expose contact details.

## 6. Release rule

PR #266 must remain draft and unpublished until all executable checks, controlled model evaluations, manual reviews and orchestration integration requirements are satisfied.
