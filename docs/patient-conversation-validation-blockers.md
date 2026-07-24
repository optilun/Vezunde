# VIASEE patient conversation — validation blockers

Status: draft shadow implementation only.

This document records controls that must not be presented as passed until executable evidence exists.

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

## 2. Symptom grounding

The `invented_symptoms` evaluator token now has a deterministic fail-closed implementation under:

```text
viasee-patient-conversation-grounding-v1
```

Grounding applies to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

For one of these fields to survive the shadow runtime:

1. the final value must be an exact normalized fragment of a `user` message;
2. the same value must be supported by an accepted raw `evidence_phrases` item;
3. evidence copied only from an `assistant` message is rejected;
4. the wrapper creates the final field-level `fact_evidence` mapping;
5. a symptom value without valid evidence invalidates the whole semantic envelope with `ungrounded_symptom_facts`.

The evaluator independently checks the final `facts`, `fact_evidence` and fixture conversation. A failed `must_not:invented_symptoms` check is a safety failure.

The fixture contract no longer classifies `invented_symptoms` as unimplemented. The validated launcher may therefore proceed to scoring, but this does not mean acceptance has passed.

### Intentional limitation

The v1 grounding rule is stricter than semantic equivalence. It may reject a legitimate paraphrase or normalization because symptom facts must remain exact user fragments.

This is intentional for the first shadow version: false rejection is safer than accepting a symptom that the patient did not state.

The real-model run must measure:

- how often the model copies exact symptom fragments correctly;
- how often valid cases become `ungrounded_symptom_facts`;
- whether prompt clarification is needed before any activation;
- whether Romanian diacritics, punctuation and mixed-language wording create false rejection.

No patient-visible activation is allowed based only on the static grounding implementation.

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

Durable state must preserve reviewed evidence provenance together with carried symptom facts. A symptom carried from prior state without server-owned evidence must not silently become trusted.

## 4. Safety review

`patient-eye-safety-v1.2` is the single deterministic Romanian safety boundary used by the existing intake UI and by the administrator-only shadow agent.

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

A release evaluation is invalid unless it uses `evaluate-patient-conversation-results-validated.mjs` and completes without fixture-contract, runtime-identity, grounding or acceptance failures.
