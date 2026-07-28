# VIASEE patient conversation operational policy

## Status

- Runtime: administrator-only shadow route.
- Patient-visible rollout: disabled.
- Production publication: not performed.
- Matching, ranking, Top 3, distribution and contact sharing: unchanged.

This policy controls only the isolated `patient_conversation_shadow` route. It does not activate the conversation agent in the patient UI.

## Versioned identities

- operational policy: `viasee-patient-conversation-operational-policy-v1`;
- request-scoped server state: `viasee-patient-conversation-server-state-v1`;
- semantic runner wrapper: `patientConversationAgentShadow.ts`;
- unchanged semantic core: `patientConversationAgentShadowCore.ts`.

## Rollout controls

The policy is defined in server code and cannot be overridden by request payload fields.

Current values:

| Control | Value |
|---|---:|
| Rollout mode | `admin_evaluation_only` |
| Admin shadow enabled | `true` |
| Admin shadow sampling | `10000` basis points |
| Patient-visible enabled | `false` |
| Patient-visible sampling | `0` basis points |

The explicit admin route is therefore available for controlled evaluation, while patient-visible execution remains disabled.

Client payload fields that attempt to change rollout, sampling, timeout, call counts, state authority or persistence are ignored and recorded only by field name in operational diagnostics.

## Model-call budget

The wrapper permits at most one model invocation per request.

A second attempted invocation:

- is rejected by server policy;
- returns `conversation_model_call_budget_exceeded`;
- clears any interpretation from the returned envelope;
- records the attempted budget violation.

This is a **per-request** budget only. A durable per-session or per-user budget is not implemented and remains required before patient-visible activation.

## Timeout behavior

The response deadline is 15 seconds.

When the deadline is exceeded:

- the returned envelope becomes `unavailable`;
- the reason becomes `conversation_model_timeout`;
- no interpretation is exposed;
- operational metadata records the timeout.

The current Base44 integration does not expose a cancellation primitive. Therefore the timeout is `response_deadline_only`: VIASEE stops waiting and fails closed, but cannot prove that the underlying SDK request was cancelled. Operational metadata records `timeout_cancels_underlying_call: false`.

True cancellation remains a future requirement if Base44 exposes an abort or cancellation contract.

## Server-recomputed request state

The browser-side intake session is not treated as trusted state.

For the shadow route, the server recomputes a bounded request state containing only:

- state version and authority;
- request-scoped identifier;
- turn counts;
- total bounded character count;
- whether approved evaluation prior state was supplied;
- whether an evaluation case ID was supplied;
- names of ignored client control fields.

The request identifier is derived from structural metadata such as turn roles and lengths, not from patient text or text hashes. Raw patient content, emails, phone numbers and personal identifiers are not included in operational metadata.

Normal shadow requests discard browser-provided `prior_state` before the semantic core runs. A sanitized `prior_state` is accepted only for administrator evaluation fixtures carrying a syntactically valid `evaluation_case_id`, so controlled memory and correction cases can be replayed. This fixture exception is not patient state authority, durable persistence or an activation path.

Current persistence is explicitly `request_scoped_shadow`. There is no claim of durable server-owned conversation storage.

## Truthful model identity

Every envelope must report whether the model was actually invoked.

- deterministic safety preflight records `model_invoked: false`, `model: null` and `prompt_version: null`;
- a request without a user message records the same non-invoked identity;
- operational rollout exclusions expose no interpretation;
- completed semantic interpretation records the configured model and prompt identity.

The operational model-call counter is the authority used to correct a pre-model skipped response at the public wrapper boundary.

## Safety preflight interaction

Deterministic safety preflight remains before the model.

When preflight resolves an explicit blocking signal:

- the model call count remains zero;
- operational metadata is still attached;
- the deterministic emergency interpretation is preserved;
- normal provider search remains stopped.

## Fail-closed outcomes

The wrapper clears the interpretation when any of these controls fail:

- rollout disabled;
- sampling exclusion;
- model timeout;
- model-call budget exceeded.

The semantic core continues to own schema validation, prohibited-output checks, state reconciliation, deterministic decision policy and canonical output boundaries.

## Activation blockers

Before any patient-visible rollout, VIASEE still requires:

1. durable server-owned conversation/session persistence;
2. per-session and per-user call budgets;
3. an approved server-side sampling key not derived from patient text;
4. operational observability and alert thresholds;
5. cancellation support or a documented platform limitation;
6. the single approved question planner from PR #265 as the only orchestrator;
7. a successful CI run and controlled 71-case evaluation;
8. manual review of safety-critical attempts;
9. explicit publication approval.
