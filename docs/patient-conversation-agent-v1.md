# VIASEE Patient Conversation Architecture v1

Status: administrator-only shadow implementation  
Patient UI: not connected  
Matching, ranking and Top 3 impact: none  
Production publication: none

## 1. Product objective

VIASEE helps a person describe an eye-care, optical, investigation, product or repair need in ordinary Romanian language and reach the existing deterministic marketplace.

The AI component is not a doctor, a provider recommender or the marketplace orchestrator.

> The LLM understands. VIASEE code decides.

## 2. Responsibility boundaries

### The semantic LLM may extract

- a concise need summary;
- primary and alternative intent candidates;
- canonical service candidates;
- bounded user-provided facts;
- semantic ambiguities;
- advisory safety signals;
- explicit correction hints in a bounded state delta;
- evidence phrases copied from user messages.

### The semantic LLM must not decide

- final urgency or safety clearance;
- the next action or next question;
- whether search may start;
- provider types as authority;
- provider eligibility, selection or order;
- ranking or Top 3;
- patient-facing operational wording;
- specialist messaging or contact sharing.

### Deterministic VIASEE code controls

- safety preflight and final safety state;
- schema and canonical-key validation;
- conversational state reduction;
- care-path compatibility;
- provider-profile derivation from canonical services;
- missing critical fields and search readiness;
- final action and controlled wording;
- question selection through the approved planner;
- matching, ranking, buckets, Top 3 and trust placement;
- consent, contact access and request distribution.

## 3. Runtime pipeline

```text
admin shadow request
        ↓
operational wrapper
        ├─ rollout and sampling policy
        ├─ browser prior-state isolation
        ├─ empty-request stop
        ├─ one-call budget
        └─ response deadline
        ↓
deterministic safety preflight
        ↓ when not blocked
semantic-only LLM call
        ↓
strict schema and prohibited-output validation
        ↓
deterministic state reconciliation
        ↓
validated semantic state-delta reducer
        ↓
deterministic decision policy
        ↓
canonical patient/provider boundary
        ↓
shadow envelope only
```

The shadow route exits before service-role access and before provider matching.

## 4. Operational wrapper

The public runtime is `patientConversationAgentShadow.ts`. The semantic implementation is isolated in `patientConversationAgentShadowCore.ts`.

The wrapper currently enforces:

- `admin_evaluation_only` rollout mode;
- patient-visible execution disabled;
- patient-visible sampling set to zero;
- maximum one model call per request;
- 15-second response deadline;
- fail-closed timeout and call-budget outcomes;
- request-scoped operational metadata;
- no raw patient text or text hashes in operational metadata.

The Base44 integration does not expose cancellation. The timeout is therefore a response deadline and does not prove cancellation of the underlying SDK request.

A request without a user message stops in the wrapper before the semantic core and before semantic shadow logging. It reports:

- `model_invoked: false`;
- `model: null`;
- `prompt_version: null`;
- zero operational model calls.

Administrator evaluation correlation is preserved for such responses when a valid `evaluation_case_id` is supplied.

## 5. Deterministic safety preflight

Before any model call, VIASEE checks user turns with the separately versioned safety policy `patient-eye-safety-v1.1`.

The policy distinguishes uncertainty from an explicit acute signal:

- `Nu mai vad cu un ochi` alone does not automatically become a confirmed emergency; it remains available for controlled semantic clarification;
- explicit sudden wording such as `brusc`, `deodata`, loss that is almost complete, or equivalent acute wording blocks before the model;
- strong chemical exposure, a penetrating or embedded object, severe ocular pain, acute postoperative deterioration, and flashes with a curtain-like shadow are deterministic blocking signals;
- mild shampoo exposure or a nonspecific impact followed only by blurred vision does not automatically become confirmed by this text policy alone.

When preflight blocks:

- the model is not invoked;
- search is stopped;
- urgency becomes deterministically `confirmed`;
- the final action becomes `show_emergency_guidance`;
- a fixed VIASEE safety message is used;
- runtime metadata records a truthful no-model identity.

A locality-only reply does not erase an earlier acute signal. Only a later explicit correction recognized by deterministic policy may clear the corresponding flag.

Model safety flags are advisory. They cannot clear deterministic safety or declare a case safe.

## 6. Semantic model input

For a model-invoked attempt, the runtime supplies:

- at most 20 `user` or `assistant` turns;
- at most 8,000 conversation characters;
- at most 1,200 characters per turn;
- known locality when available;
- the patient-facing canonical service catalog;
- approved intent, ambiguity, safety-flag and state-delta values;
- `contact_share_approved: false`.

Email addresses, Romanian phone numbers and 13-digit identifiers are removed before the call.

### Prior-state boundary

Normal shadow requests discard browser-provided `prior_state` before the semantic core.

A bounded and field-selected `prior_state` is accepted only for administrator evaluation fixtures carrying a syntactically valid `evaluation_case_id`. This permits controlled memory and correction replay. It is not durable patient state, a production authority or a patient-visible activation path.

Conversation content and evaluation prior state remain untrusted data, never prompt instructions.

## 7. Raw semantic response contract

- semantic contract: `viasee-patient-conversation-semantic-v1`;
- prompt: `viasee-patient-conversation-prompt-v1.2`;
- current controlled model: `gpt_5_4`.

Logical shape:

```json
{
  "contract_version": "viasee-patient-conversation-semantic-v1",
  "language": "ro",
  "need_summary": "faithful semantic summary",
  "primary_intent": "control_vedere",
  "alternative_intents": [],
  "service_keys": ["refraction"],
  "facts": {
    "for_whom": "adult",
    "age_group": "adult",
    "locality": {
      "siruta_code": "",
      "city": "Timisoara",
      "county_code": "TM",
      "county": "Timis",
      "area": ""
    },
    "symptom_onset": "",
    "symptom_duration": "",
    "symptom_pattern": "",
    "desired_timing": "",
    "contact_lens_experience": "unknown",
    "prescription_status": "unknown",
    "investigation_reference_text": "",
    "repair_details": "",
    "user_constraints": []
  },
  "understanding_confidence": "high",
  "ambiguity_fields": [],
  "possible_safety_flags": [],
  "state_delta": {
    "correction_detected": false,
    "clear_fields": []
  },
  "evidence_phrases": []
}
```

The raw schema excludes:

- care paths and provider types;
- urgency and search-readiness authority;
- final action;
- assistant or specialist wording;
- providers, scores, ranking and Top 3.

Unexpected fields fail schema validation. Invalid output is not repaired into a usable interpretation.

## 8. Conversational state

The deterministic state policy may preserve compatible evaluation prior facts for short answers. It must prevent stale intent-specific facts, locality, person, symptom timing, prescription, investigation or repair details from contaminating a corrected request.

A model state delta is only a hint. The deterministic reducer:

- requires `correction_detected: true`;
- requires a matching correction signal in the conversation;
- rejects unsupported clear requests;
- clears only stale values;
- preserves replacement values such as Lugoj replacing Timisoara;
- records field names and aggregate diagnostics without raw conversation text.

Durable server-owned conversation persistence is not implemented.

## 9. Final decision and canonical boundary

After semantic validation and state processing, deterministic code recalculates:

- final urgency;
- missing critical fields;
- search readiness;
- final action;
- patient-facing operational wording;
- provider-profile candidates from canonical services.

Rules:

- explicit deterministic safety signal → emergency interruption;
- model-only safety signal → controlled clarification;
- unknown intent or no canonical services → clarification;
- known need without locality → locality question;
- known need, services and locality with no unresolved safety concern → search-ready.

The final envelope separates:

- `provider_profile_type_candidates`;
- `location_provider_type_candidates`.

The older `provider_type_candidates` field remains only as a temporary compatibility alias.

`specialist_summary` remains `null` in this layer.

## 10. Marketplace integration

The agent does not query or receive concrete providers.

The existing deterministic marketplace remains responsible for:

- canonical SIRUTA locality;
- service matching;
- operational prerequisites;
- specialist, equipment, facility and capability checks;
- profile trust state;
- confirmed versus directory result groups;
- explainable score components;
- Top 3 eligibility and tie-breaking.

The AI cannot alter provider order or create a commercial advantage.

## 11. Evaluation

The controlled suite contains 71 scenarios:

- 53 semantic and safety cases;
- 8 adversarial cases;
- 10 memory, correction, negation, typo, mixed-language and intent-switch cases.

Critical cases run repeatedly. Acceptance requires 100% for safety-critical behavior, prohibited-output protection, deterministic decision/state policies where applicable, memory, corrections and critical stability. Overall pass rate and weighted score must each be at least 85%.

The evaluator distinguishes:

1. model-invoked attempts with exact model and prompt identity;
2. deterministic preflight attempts with truthful no-model metadata and exact `patient-eye-safety-v1.1` identity;
3. terminal or skipped attempts, which cannot satisfy the completed-attempt threshold.

A result that declares deterministic decision-policy diagnostics but omits the safety-policy version or reports an older version fails the case and the safety gate.

## 12. Activation blockers

PR #266 remains draft until:

1. GitHub Actions executes the configured checks;
2. lint, typecheck and build complete;
3. all required real-model attempts are captured;
4. acceptance thresholds pass;
5. critical outputs receive manual review;
6. the emergency boundary receives medical safety review;
7. PR #265 remains the sole approved question orchestrator;
8. durable server-owned session persistence and per-session/per-user budgets are designed and implemented;
9. patient-visible disclosure, fallback and sampling policy are approved;
10. the final diff confirms no normal matching, ranking, Top 3, distribution or contact change.

Existing request-scoped controls are necessary but are not sufficient for patient-visible activation.

## 13. Explicit v1 exclusions

The first active version must not:

- diagnose, prescribe or recommend medication;
- claim medical certainty;
- choose or rank providers;
- generate Top 3;
- share contact details;
- send provider requests;
- own the next-question planner;
- rely on exact evaluation phrases as routing logic;
- publish automatically.
