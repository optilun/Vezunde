# VIASEE patient conversation — durable state contract

Status: contract only; no persistence adapter; not connected to runtime.

## Identity

```text
viasee-patient-conversation-durable-state-policy-v1
viasee-patient-conversation-durable-state-record-v1
```

Shared copies:

```text
shared/patientConversationDurableStatePolicy.js
base44/shared/patientConversationDurableStatePolicy.js
```

They must remain byte-identical.

## Activation state

The policy is deliberately inactive:

- `mode = inactive_contract_only`;
- `persistence_adapter = none`;
- patient-visible persistence disabled;
- administrator shadow persistence disabled;
- release readiness false;
- per-session budget unapproved;
- per-subject 24-hour budget unapproved.

This module is not imported by the shadow endpoint and does not create a Base44 entity.

## Record boundary

A valid record contains only:

- record and policy versions;
- server-issued opaque `session_id`;
- server-issued pseudonymous `subject_key`;
- status and optimistic `revision`;
- creation, update and expiry timestamps;
- aggregate model-call count;
- grounded symptom facts;
- field-level provenance.

Unknown top-level, fact or provenance fields fail validation.

The record must not contain:

- the raw conversation or message list;
- contact details;
- names;
- access tokens;
- provider data;
- diagnosis or treatment fields.

The exact short evidence phrase is retained only where required to prove one grounded symptom fact. It is not a conversation transcript.

## Lifetime

The absolute TTL is two hours, matching the existing browser intake snapshot policy.

A record created more than five minutes in the future is invalid.

Expired records fail validation and cannot be updated.

## Concurrency

Updates use optimistic revision control:

```text
expected_revision == stored revision
```

A stale write returns:

```text
durable_state_revision_mismatch
```

No automatic merge is permitted.

Allowed transitions:

- `active -> active`;
- `active -> completed`;
- `active -> revoked`;
- `completed -> completed` only.

Completed sessions cannot be reopened as active. Expired or revoked sessions cannot be updated.

## Evidence provenance

Durable provenance applies to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

For each non-empty value, the record requires:

- the exact grounded value;
- the exact evidence phrase;
- a server-issued opaque `source_message_id`;
- the revision at which the evidence was verified.

The source must be a user message. Assistant-only text is rejected.

A fact without provenance, mismatched evidence or an invalid message ID fails the record.

## Budgets

The contract can evaluate proposed numeric limits, but production values are intentionally unset.

When either limit is missing, the result is:

```text
durable_budget_policy_unconfigured
```

When configured later, both limits must pass:

- calls in the current session;
- calls for the pseudonymous subject during the rolling 24-hour window.

No values are invented in this PR.

## Persistence adapter requirements

A future adapter must provide:

- server-generated session and subject identifiers;
- atomic create/read/update with revision compare-and-swap;
- TTL cleanup;
- rolling 24-hour subject counters;
- revocation;
- encryption and access policy review;
- no creation of `PatientRequest`, matching, ranking or distribution records;
- no reuse of browser `prior_state` as authority;
- no patient-visible activation without approved disclosure and consent policy.

The adapter must remain separate from PR #265 question selection.

## Remaining blockers

The durable-state activation readiness function must continue returning false until:

1. a reviewed persistence adapter exists;
2. per-session call limits are approved;
3. per-subject 24-hour limits are approved;
4. patient-visible persistence policy is approved;
5. executable tests, security review and privacy review pass;
6. the complete semantic and safety evaluation passes.

The current contract reduces ambiguity. It does not remove the durable-state activation blocker.
