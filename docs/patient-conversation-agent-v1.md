# VIASEE Patient Conversation Architecture v1

Status: administrator-only semantic shadow implementation  
Patient LLM: not connected  
Patient intake safety: shared deterministic policy connected  
Matching, ranking and Top 3 impact: none  
Production publication: none

## 1. Product objective

VIASEE helps a person describe an eye-care, optical, investigation, product or repair need in ordinary Romanian language and reach the existing deterministic marketplace.

The AI component is not a doctor, a provider recommender or the marketplace orchestrator.

> The LLM understands. VIASEE code decides.

## 2. Runtime identities

- route: `patient_conversation_shadow`;
- envelope: `viasee-patient-conversation-agent-v1`;
- semantic response: `viasee-patient-conversation-semantic-v1`;
- model: `gpt_5_4` when semantic interpretation is required;
- prompt: `viasee-patient-conversation-prompt-v1.2`;
- decision policy: `viasee-patient-conversation-decision-policy-v1`;
- deterministic eye safety: `patient-eye-safety-v1.2`;
- emergency guidance: `patient-emergency-guidance-v1.1`;
- evaluation: `viasee-patient-conversation-evaluation-v1.3`;
- symptom grounding: `viasee-patient-conversation-grounding-v1`;
- state policy: `viasee-patient-conversation-state-policy-v1.1`;
- state-delta reducer: `viasee-patient-conversation-state-delta-reducer-v1`;
- canonical boundary: `viasee-patient-conversation-canonical-boundary-v1`;
- guidance handoff: `viasee-patient-conversation-guidance-handoff-v1`;
- inactive planner bridge: `viasee-patient-conversation-guidance-planner-bridge-v1`;
- operational policy: `viasee-patient-conversation-operational-policy-v1`.

## 3. Responsibility boundaries

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

- the shared `clear / advisory / blocking` eye-safety state;
- safety preflight and final safety decision;
- schema and canonical-key validation;
- conversational state reduction;
- field-level symptom grounding;
- care-path compatibility;
- provider-profile derivation from canonical services;
- missing critical fields and search readiness;
- final action and controlled wording;
- question selection through the approved planner;
- matching, ranking, buckets, Top 3 and trust placement;
- consent, contact access and request distribution.

## 4. Runtime pipeline

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
unified deterministic eye-safety preflight
        ├─ blocking → fixed emergency guidance, no model
        └─ clear/advisory → semantic path
                ↓
semantic-only LLM call
        ↓
strict schema and prohibited-output validation
        ↓
deterministic state reconciliation
        ↓
validated semantic state-delta reducer
        ↓
unified deterministic safety and decision policy
        ↓
canonical patient/provider boundary
        ↓
field-level symptom grounding
        ├─ valid → attach fact_evidence
        └─ invalid → ungrounded_symptom_facts
        ↓
operational shadow envelope
        ↓
semantic candidate handoff
```

The shadow route exits before service-role access and before provider matching.

The inactive planner bridge is not imported by the request endpoint.

## 5. Patient intake boundary

The semantic LLM remains disabled for patients.

The existing patient-description UI uses the same deterministic eye-safety policy as Base44:

- `shared/patientEyeSafetyPolicy.js` for frontend/shared consumers;
- `base44/shared/patientEyeSafetyPolicy.js` for Base44 runtime;
- the two files must remain byte-identical.

The UI behavior is:

- `clear` → the ordinary intake may continue;
- `advisory` → show clarification-only copy and controlled safety questions;
- `blocking` → stop the ordinary flow and show fixed emergency guidance.

For example:

- `Nu vad cu ochiul drept` is advisory because onset and severity are unknown;
- `Nu mai vad cu ochiul drept deodata` is blocking;
- `Vad mai slab de cateva luni si nu este brusc` may clear the advisory signal.

Choosing `Niciuna dintre acestea` allows the unchanged advisory description to continue. Editing the description invalidates that review and requires a new safety assessment.

This deterministic UI behavior is not an LLM rollout and does not diagnose the user.

## 6. Unified eye-safety authority

The policy identity is:

```text
patient-eye-safety-v1.2
```

It is used before and after semantic interpretation.

### `clear`

No unresolved deterministic safety signal is present. Search may continue only when intent, canonical services and locality are also sufficient.

### `advisory`

The description is ambiguous or the model proposes a possible safety signal.

Examples include generic monocular wording such as:

- `Nu mai vad cu un ochi`;
- `Nu vad cu ochiul drept`;
- `Vad mai slab cu ochiul stang`;
- `Vad incetosat cu un ochi`.

Advisory state:

- does not confirm an emergency;
- does not show hospital or 112 guidance;
- stops search temporarily;
- requires controlled clarification;
- cannot be promoted to blocking by an AI flag alone.

### `blocking`

An explicit acute phrase or guided emergency answer is present.

The deterministic blocking catalog covers:

- explicit sudden or near-complete vision loss;
- strong chemical exposure;
- penetrating or embedded eye trauma;
- severe ocular pain;
- acute postoperative deterioration;
- flashes with a curtain-like shadow or equivalent acute wording.

Blocking state:

- stops search;
- skips the model when detected in preflight;
- sets urgency to `confirmed`;
- returns fixed emergency guidance;
- never performs commercial matching or Top 3.

A short unrelated reply does not erase an earlier signal. A later explicit correction may clear the corresponding signal. Model safety flags remain advisory and cannot clear deterministic safety or declare a case safe.

## 7. Emergency guidance

The emergency-guidance identity is:

```text
patient-emergency-guidance-v1.1
```

For confirmed blocking cases only, the controlled order is:

1. public hospital that confirms ophthalmology emergency capability;
2. public-hospital UPU fallback when the exact destination is unknown;
3. no driving and accompanied transport when vision is affected;
4. conditional 112 fallback only when safe transport is impossible or general condition worsens rapidly.

Hospital/UPU remains the primary action. There is no primary `tel:112` button.

The model cannot generate, reorder or replace this guidance.

## 8. Semantic model input and raw response

For a model-invoked attempt, the runtime supplies:

- at most 20 `user` or `assistant` turns;
- at most 8,000 conversation characters;
- at most 1,200 characters per turn;
- known locality when available;
- the patient-facing canonical service catalog;
- approved intent, ambiguity, safety-flag and state-delta values;
- `contact_share_approved: false`.

Email addresses, Romanian phone numbers and 13-digit identifiers are removed before the call.

The raw response may contain only:

- need summary;
- intent candidates;
- canonical service candidates;
- bounded user facts;
- understanding confidence;
- ambiguity fields;
- advisory possible-safety flags;
- bounded state-delta hints;
- evidence phrases copied from user turns.

The raw schema excludes:

- care paths and provider types;
- urgency and search-readiness authority;
- final action;
- assistant or specialist wording;
- providers, scores, ranking and Top 3.

Unexpected fields fail schema validation. Invalid output is not repaired into a usable interpretation.

Normal shadow requests discard browser-provided `prior_state`. A bounded and field-selected prior state is accepted only for administrator evaluation fixtures carrying a valid `evaluation_case_id`. This is not durable patient state or production authority.

## 9. Field-level symptom grounding

The grounding identity is:

```text
viasee-patient-conversation-grounding-v1
```

It applies to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

A final symptom fact survives only when:

1. its value is an exact normalized fragment of a `user` message;
2. the same value is supported by an accepted raw `evidence_phrases` item;
3. the evidence does not come only from an assistant question;
4. the wrapper creates the final field-level `fact_evidence` mapping.

Normalization is restricted to case, Romanian diacritics and repeated whitespace. There is no medical keyword or semantic-equivalence heuristic.

An unsupported symptom fact invalidates the complete semantic envelope:

```text
status = invalid
reason = ungrounded_symptom_facts
interpretation = null
```

The invalid envelope cannot become a usable planner handoff and cannot start matching.

The evaluator independently checks final facts, final `fact_evidence` and fixture user turns. `must_not:invented_symptoms` is an active safety check in evaluation v1.3.

This first version intentionally rejects paraphrases rather than accepting a symptom the patient did not state.

## 10. Conversational state

The deterministic state policy may preserve compatible evaluation prior facts for short answers. It must prevent stale intent-specific facts, locality, person, symptom timing, prescription, investigation or repair details from contaminating a corrected request.

A model state delta is only a hint. The deterministic reducer:

- requires `correction_detected: true`;
- requires a matching correction signal in the conversation;
- rejects unsupported clear requests;
- clears only stale values;
- preserves replacement values;
- records field names and aggregate diagnostics without raw conversation text.

Durable server-owned conversation persistence is not implemented.

A future durable session must preserve reviewed evidence provenance with every carried symptom fact. Prior symptom text without server-owned evidence cannot become trusted automatically.

## 11. Final decision, handoff and planner boundary

After semantic validation and state processing, deterministic code recalculates:

- final safety state and urgency;
- missing critical fields;
- search readiness;
- final action;
- patient-facing operational wording;
- provider-profile candidates from canonical services.

Rules:

- `blocking` → emergency interruption;
- `advisory` → controlled clarification;
- unknown intent or no canonical services → clarification;
- known need without locality → locality question;
- known need, services, locality and `clear` safety → search-ready.

The final envelope separates:

- `provider_profile_type_candidates`;
- `location_provider_type_candidates`.

The older `provider_type_candidates` field remains only as a temporary compatibility alias.

`specialist_summary` remains `null` in this layer.

The handoff forces:

```json
{
  "next_question_key": null,
  "semantic_fields": "candidate_only",
  "confirmed_facts": "controlled_answers_only"
}
```

PR #265 remains the sole approved adaptive question orchestrator.

## 12. Marketplace integration

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

## 13. Operational controls

The wrapper currently enforces:

- `admin_evaluation_only` rollout mode;
- patient-visible semantic execution disabled;
- patient-visible sampling set to zero;
- maximum one model call per request;
- 15-second response deadline;
- fail-closed timeout and call-budget outcomes;
- request-scoped operational metadata;
- no raw patient text or text hashes in operational metadata.

The Base44 integration does not expose cancellation. The timeout is a response deadline and does not prove cancellation of the underlying SDK request.

## 14. Evaluation and current suite blocker

Evaluation identity:

```text
viasee-patient-conversation-evaluation-v1.3
```

The controlled suite contains 71 scenarios:

- 53 semantic and safety cases;
- 8 adversarial cases;
- 10 memory, correction, negation, typo, mixed-language and intent-switch cases.

Critical cases run repeatedly. Safety-critical behavior requires 100% acceptance. Overall pass rate and weighted score must each be at least 85%.

The default fixture `summary-001` currently requires values in `specialist_summary_must_include`, while this architecture intentionally forces `specialist_summary = null`.

The validated release launcher therefore reports:

```text
fixture_unsupported_runtime_expectation
PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED
```

This is a fixture-scope mismatch, not a grounding failure. The fixture must be rewritten to test grounded structured facts, or moved to a future separately approved provider-messaging contract. PR #266 must not expand into provider messaging merely to satisfy the fixture.

## 15. Activation blockers

PR #266 remains draft until:

1. GitHub Actions executes the configured checks;
2. lint, typecheck and build complete;
3. the `summary-001` fixture-scope mismatch is resolved;
4. all required real-model attempts are captured;
5. grounding rejection rates are measured and reviewed;
6. acceptance thresholds pass;
7. critical outputs receive manual review;
8. the eye-safety and emergency boundary receive medical safety review;
9. PR #265 remains the sole approved adaptive question orchestrator;
10. durable server-owned session persistence and per-session/per-user budgets are implemented;
11. patient-visible AI disclosure, fallback and sampling policy are approved;
12. the final diff confirms no normal matching, ranking, Top 3, distribution or contact change.

Existing request-scoped controls are necessary but are not sufficient for patient-visible LLM activation.

## 16. Explicit v1 exclusions

The first active version must not:

- diagnose, prescribe or recommend medication;
- claim medical certainty;
- choose or rank providers;
- generate Top 3;
- share contact details;
- send provider requests;
- own the adaptive next-question planner;
- generate specialist messaging in this layer;
- rely on fixture phrases as model routing logic;
- publish automatically.
