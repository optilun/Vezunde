# VIASEE patient conversation — remaining validation blockers

Status: draft administrator-only shadow implementation.

This document records the gates that remain after successful repository validation.

## 1. Repository validation is complete

Validated implementation:

```text
branch: feat/patient-conversation-agent-contract
HEAD validated before documentation refresh: 460ae7934131c426406477b246a9275dd187fa1e
```

The dedicated self-hosted validation passed:

- service and patient-conversation suites;
- post-evaluation stabilization;
- service typecheck;
- full typecheck comparison against `main`;
- build;
- lint.

Evidence:

```text
Patient Conversation Self-Hosted Validation
run 30213042388 — success
```

The full shadow harness also passed:

```text
Patient Conversation Full Shadow Harness
run 30213042389 — success
```

These runs are static. They do not establish real-model quality or medical approval.

Some unrelated GitHub-hosted workflows still fail before checkout because of the repository-wide hosted-runner startup restriction. They are not executed-test failures for this implementation.

## 2. Automatic model pilot has not run

The current model boundary is:

```text
model = null
model_policy = base44_automatic
model_override = null
maximum_model_calls_per_request = 1
automatic_retry_enabled = false
```

No live request has been executed after the switch from `gpt_5_4` to Base44 Automatic.

The Base44 cloud sandbox currently accessible to the project contains an older app state and does not include the PR #266 runtime files or route. It must not be used as pilot evidence.

Still required:

- confirm an isolated runtime on the exact PR branch and HEAD;
- run the separately approved three-attempt pilot;
- preserve complete server envelopes;
- inspect actual Base44 credit consumption;
- review latency, invalid output and unavailable-model behavior;
- decide whether a larger evaluation is justified.

No large 71-case or 151-attempt run may start automatically.

## 3. Symptom grounding still requires real-model evidence

`invented_symptoms` has deterministic fail-closed grounding under:

```text
viasee-patient-conversation-grounding-v1
```

Grounding applies to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

Unsupported fields are stripped and the deterministic decision is recomputed. Assistant-only evidence is rejected.

The Automatic pilot and any later approved evaluation must measure:

- exact user-fragment retention;
- unsupported-field rejection frequency;
- Romanian punctuation and diacritic behavior;
- mixed Romanian/English behavior;
- false rejection of legitimate descriptions.

## 4. Evaluation contract

The loaded fixture suite contains exactly 71 unique cases.

Current evaluation identity:

```text
viasee-patient-conversation-evaluation-v1.5
viasee-patient-conversation-prompt-v1.3
base44_automatic
```

`question_goal` remains non-scoring metadata because PR #265 owns adaptive question selection.

`specialist_summary` remains `null`.

A release-scale evaluation is invalid unless it:

- uses complete server envelopes;
- preserves runtime identity and measured duration;
- contains no missing or duplicate attempts;
- is processed through `evaluate-patient-conversation-results-validated.mjs`;
- completes without fixture-contract, runtime-identity, grounding or acceptance failures.

## 5. Cost and credit exhaustion boundary

No arbitrary monthly model-call limit is hardcoded in PR #266.

The runtime enforces only:

```text
maximum 1 model call per request
0 automatic retries
0 expensive fallback-model calls
```

When Base44 cannot execute `InvokeLLM`, including credit exhaustion or model unavailability:

- the request fails closed;
- search remains blocked;
- the user is routed to deterministic clarification;
- no second model call is attempted.

Actual Automatic cost remains an empirical pilot item.

## 6. Durable state remains inactive

The inactive contracts remain under:

```text
viasee-patient-conversation-durable-state-policy-v1
viasee-patient-conversation-durable-state-record-v1
```

They are not connected to a Base44 entity or production endpoint.

Before any durable use, VIASEE still requires:

- reviewed atomic persistence;
- server-generated identifiers;
- TTL cleanup and revocation;
- privacy, encryption and access-policy review;
- observability;
- consent and disclosure policy;
- separate activation approval.

No durable counter or arbitrary monthly cutoff is part of the current implementation.

## 7. Medical safety review remains mandatory

`patient-eye-safety-v1.2` is deterministic and shared by the existing intake and shadow agent.

The code does not constitute medical approval.

Still required:

- qualified medical review of emergency wording;
- review of false positives and false negatives;
- review of Romanian and mixed-language variants;
- review of advisory-to-clear and advisory-to-blocking transitions;
- manual review of every safety failure in any future live evaluation.

## 8. Patient and marketplace boundaries

The semantic LLM remains disabled for patients.

PR #265 remains the sole approved `next_question_key` authority.

PR #266 must not:

- own adaptive question selection;
- activate patient-visible LLM wording;
- invoke matching from the shadow route;
- alter provider eligibility;
- alter ranking or Top 3;
- distribute requests;
- expose contact details;
- generate provider-facing specialist summaries.

## 9. Release rule

PR #266 remains draft and unpublished until:

1. the exact PR runtime is available in isolation;
2. the small Automatic pilot is explicitly approved and reviewed;
3. medical and privacy/security review are complete;
4. a final human release decision is made.

Static green checks alone do not authorize merge or publication.