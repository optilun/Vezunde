# VIASEE Patient Conversation Architecture v1

Status: administrator-only shadow implementation  
Patient UI: not connected  
Matching, ranking and Top 3 impact: none  
Production publication: none

## 1. Product objective

VIASEE helps a person describe an eye-care, optical, investigation, product, or repair need in ordinary Romanian language and reach relevant locations from the existing deterministic marketplace.

The AI component is not a doctor, a provider recommender, or the orchestrator of the marketplace. Its role is limited to semantic interpretation.

The governing rule is:

> The LLM understands. VIASEE code decides.

The user may write short answers, spelling mistakes, informal language, corrections, negations, indirect descriptions, or several details across multiple turns.

## 2. Responsibility boundaries

### The semantic LLM may extract

- a concise statement of the need;
- primary and alternative intent candidates;
- canonical service candidates;
- user-provided facts;
- semantic ambiguities;
- advisory safety signals;
- explicit correction hints in a bounded state delta;
- evidence phrases copied from user messages.

### The semantic LLM must not decide

- final urgency;
- whether a case is safe;
- the next action;
- which question is shown;
- whether search may start;
- care-path authority;
- provider types as authority;
- provider eligibility;
- a concrete provider;
- ranking or Top 3;
- patient-facing operational wording;
- a specialist message;
- contact sharing.

### Deterministic VIASEE code controls

- safety preflight and final safety state;
- schema and canonical-key validation;
- conversational state reduction;
- final care-path compatibility;
- provider-profile derivation from canonical services;
- missing critical fields;
- search readiness;
- the final action;
- question selection through the approved planner;
- provider and service eligibility;
- locality and geographic scope;
- ranking, buckets and Top 3;
- directory versus confirmed placement;
- consent, contact access and delivery.

## 3. Runtime pipeline

```text
sanitized patient conversation
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
shadow envelope only
```

The shadow route exits before service-role access and before provider matching.

## 4. Deterministic safety preflight

Before any model call, VIASEE checks user turns for separately versioned explicit acute eye-safety signals.

When the preflight blocks:

- the model is not invoked;
- search is stopped;
- urgency is deterministically `confirmed`;
- the action is deterministically `show_emergency_guidance`;
- a fixed VIASEE safety message is used;
- runtime metadata records `model_invoked: false`, `model: null`, and `prompt_version: null`.

Safety state is reduced turn by turn. A locality-only reply does not clear an earlier acute signal. Only a later explicit correction recognized by deterministic policy may clear the corresponding flag.

The LLM may report possible safety flags, but those flags are advisory. The model cannot clear a deterministic signal or declare a case safe.

## 5. Semantic model input

The model receives:

- at most 20 `user` or `assistant` turns;
- at most 8,000 conversation characters;
- at most 1,200 characters per turn;
- a bounded and field-selected prior state;
- known locality when available;
- the patient-facing canonical service catalog;
- approved intent, ambiguity, safety-flag, and state-delta values;
- `contact_share_approved: false`.

Before the call, email addresses, Romanian phone numbers, and 13-digit identifiers are removed.

Conversation text and prior state are untrusted data, not instructions.

## 6. Raw semantic response contract

The model response uses:

- semantic contract: `viasee-patient-conversation-semantic-v1`;
- prompt: `viasee-patient-conversation-prompt-v1.2`;
- model: `gpt_5_4` in the current controlled evaluation.

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

The raw model schema deliberately excludes:

- `care_path_candidates`;
- `provider_type_candidates`;
- `urgency`;
- `information_status`;
- `next_action`;
- `assistant_message`;
- `specialist_summary`.

Unexpected fields fail schema validation. Invalid output is not repaired into a usable interpretation.

## 7. Final VIASEE shadow envelope

After semantic validation, VIASEE builds a compatibility envelope for the existing evaluation and future planner integration.

Server code derives or recalculates:

- care-path candidates;
- provider-profile candidates;
- urgency;
- missing critical fields;
- search readiness;
- final action;
- patient-facing operational text.

`specialist_summary` remains `null` in this layer because contact sharing is outside semantic interpretation.

## 8. Conversational state

### Existing state reconciliation

The deterministic state policy may preserve compatible prior facts for short replies. It must prevent old intent-specific facts, locality, person, symptom timing, prescription, investigation, or repair details from contaminating a corrected request.

### Semantic state delta

The model may suggest that explicitly corrected fields from prior state should be cleared.

The suggestion is never applied directly. The deterministic reducer:

- requires `correction_detected: true`;
- requires a matching deterministic correction signal in the conversation;
- rejects unsupported clear requests;
- clears a stale value only when the current value is absent or still equals the prior value;
- preserves a new replacement value, such as Lugoj replacing Timisoara;
- records requested, applied, rejected, and replacement-preserved fields without logging raw conversation text.

## 9. Final decision policy

After state processing, deterministic code owns the final decision.

- Explicit deterministic safety signal → emergency interruption.
- Model-only possible or confirmed safety signal → controlled clarification, never automatic emergency certainty.
- Unknown intent or no canonical services → clarification.
- Known intent and services but no locality → locality question.
- Known intent, canonical services, locality, and no unresolved safety concern → search-ready.

Provider-profile candidates are derived from canonical service definitions. Model-proposed provider types do not exist in the raw schema.

## 10. Marketplace integration

The agent does not query or receive concrete providers.

The existing deterministic marketplace remains responsible for:

- canonical locality through SIRUTA;
- service matching;
- operational prerequisites;
- specialist, equipment, facility and capability checks;
- profile trust state;
- confirmed versus directory result groups;
- explainable score components;
- Top 3 eligibility;
- ranking and tie-breaking.

The AI cannot alter provider order or create a commercial advantage.

## 11. Evaluation

The controlled suite contains 71 scenarios:

- 53 semantic and safety cases;
- 8 adversarial cases;
- 10 memory, correction, negation, typo, mixed-language, and intent-switch cases.

Critical cases run repeatedly. Acceptance requires 100% for safety-critical behavior, prohibited-output protection, decision-policy application, state-policy application where relevant, memory, corrections, and critical stability. Overall pass rate and weighted score must each be at least 85%.

The evaluator distinguishes:

1. model-invoked attempts with exact model and prompt identity;
2. deterministic preflight attempts with truthful no-model metadata.

## 12. Activation sequence

The implementation remains draft until:

1. GitHub Actions executes all checks;
2. lint, typecheck and build complete;
3. all required real-model attempts are captured;
4. acceptance thresholds pass;
5. critical outputs are manually reviewed;
6. a medical safety reviewer examines the emergency boundary;
7. the single approved question planner is selected as orchestrator;
8. kill switch, timeout, call budget, sampling and server-owned state exist;
9. the final diff confirms no matching, ranking, Top 3 or distribution change.

Activation must progress from administrator evaluation to invisible shadow sampling and only later to controlled patient-visible wording.

## 13. Explicit v1 exclusions

The first active version must not:

- diagnose or prescribe;
- recommend medication;
- claim medical certainty;
- choose or rank providers;
- generate Top 3;
- share contact details;
- send provider requests;
- own the next-question planner;
- rely on exact evaluation phrases as semantic routing logic;
- publish automatically.
