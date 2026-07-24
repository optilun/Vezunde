# VIASEE patient conversation — validation blockers

Status: draft shadow implementation only.

This document records what must not be presented as passed until executable evidence exists.

## 1. External execution blockers

- GitHub Actions fails before checkout across unrelated workflows.
- Affected jobs expose `steps: null` and no usable logs.
- The connected Base44 sandbox does not grant command execution scope.
- Direct repository checkout is unavailable in the current environment.

Consequences:

- final verification scripts have not executed;
- scoped or complete lint has not executed;
- service typecheck and baseline comparison have not executed;
- build has not executed;
- the controlled 71-case model run has not executed.

Static review is not a substitute for these gates.

## 2. Symptom grounding status

`invented_symptoms` has a deterministic fail-closed implementation under:

```text
viasee-patient-conversation-grounding-v1
```

Grounding applies to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

A value survives only when it is an exact normalized user fragment supported by accepted model evidence.

Assistant-only evidence is rejected.

Unsupported symptom facts invalidate the whole semantic envelope with:

```text
ungrounded_symptom_facts
```

Evaluation v1.4 independently checks final facts, final `fact_evidence` and fixture user turns. Failure of `must_not:invented_symptoms` is a safety failure.

### Remaining grounding evidence

The real-model run must still measure:

- exact-fragment success rate;
- `ungrounded_symptom_facts` frequency;
- Romanian punctuation and diacritic effects;
- mixed Romanian/English behavior;
- false rejection of legitimate wording.

No patient-visible activation is permitted based only on static grounding code.

## 3. Fixture alignment status

The previous `summary-001` scope mismatch is resolved without enabling provider messaging.

An explicit replacement now tests:

- locality;
- duration;
- exact symptom pattern;
- timing preference;
- no invented symptoms, diagnosis or contact leakage.

`specialist_summary` remains `null`.

`vision-loss-003` is also replaced with current public-hospital/UPU-first emergency guidance expectations.

The replacement file does not add cases. The loaded suite remains exactly 71 unique cases.

`question_goal` is preserved as non-scoring metadata because PR #265 owns adaptive question selection.

Evaluation v1.4 now activates checks that were previously incomplete:

- `service_keys_all: []` requires an actually empty service list;
- `forget_previous_need` detects lost intent/service memory;
- unknown expectation fields and tokens fail contract validation;
- contradictory urgency, action and question expectations fail validation;
- user-grounded symptom and timing expectations are checked before scoring.

The suite is structurally release-ready. This does not mean it passed execution.

## 4. Durable state and cost controls

The inactive foundation now exists under:

```text
viasee-patient-conversation-durable-state-policy-v1
viasee-patient-conversation-durable-state-record-v1
```

It defines and statically verifies:

- server-format opaque session and pseudonymous subject identifiers;
- a two-hour absolute TTL;
- optimistic revision conflicts;
- strict allowlisted record fields;
- no raw conversation, contact, diagnosis or provider fields;
- exact symptom-fact provenance tied to a user `message_id`;
- no assistant-only evidence;
- no reopening of completed sessions;
- fail-closed session and rolling 24-hour subject budget evaluation.

The foundation remains deliberately inactive:

- no persistence adapter;
- no Base44 entity;
- no endpoint import;
- administrator persistence disabled;
- patient-visible persistence disabled;
- per-session limit unapproved;
- per-subject 24-hour limit unapproved;
- activation readiness false.

Still required before durable use:

- a reviewed atomic persistence adapter with compare-and-swap revision updates;
- server-generated identifiers;
- TTL cleanup and revocation;
- rolling subject counters;
- approved numeric budgets;
- privacy, encryption and access-policy review;
- observability and alert thresholds;
- consent/disclosure policy for patient-visible persistence;
- executable contract tests.

A symptom carried from prior state without server-owned evidence must not become trusted.

The contract reduces ambiguity but does not remove the durable-state activation blocker.

## 5. Safety review

`patient-eye-safety-v1.2` is the shared deterministic Romanian safety boundary for the existing intake UI and the administrator-only shadow agent.

It still requires:

- complete fixture execution;
- repeated critical attempts;
- manual review of false positives and false negatives;
- medical safety review;
- review of unsupported Romanian and mixed-language variants;
- review of advisory-to-clear transitions;
- review of advisory-to-blocking transitions.

No medical approval is implied by the code.

## 6. Patient UI boundary

The existing intake uses deterministic safety only.

The semantic LLM remains disabled for patients.

Executable and manual verification still must confirm:

- ambiguous wording shows clarification, not emergency guidance;
- `Niciuna dintre acestea` avoids a loop for unchanged text;
- editing the description invalidates the prior safety review;
- blocking cases remain stopped;
- advisory cases expose no hospital, UPU or 112 guidance.

## 7. Orchestration boundary

PR #265 must remain the sole approved next-question orchestrator.

PR #266 must not:

- own adaptive question selection;
- activate patient-visible LLM wording;
- invoke matching from the shadow route;
- alter provider eligibility;
- alter ranking or Top 3;
- distribute requests;
- expose contact details;
- generate provider-facing specialist summaries.

## 8. Release rule

PR #266 must remain draft and unpublished until executable checks, controlled model evaluation, manual review, medical review and orchestration requirements are satisfied.

A release evaluation is invalid unless it uses `evaluate-patient-conversation-results-validated.mjs` and completes without fixture-contract, runtime-identity, grounding or acceptance failures.
