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

- the shared `clear / advisory / blocking` eye-safety state;
- safety preflight and final safety decision;
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
shadow envelope only
```

The shadow route exits before service-role access and before provider matching.

## 4. Patient intake boundary

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

## 5. Operational wrapper

The public runtime is `patientConversationAgentShadow.ts`. The semantic implementation is isolated in `patientConversationAgentShadowCore.ts`.

The wrapper currently enforces:

- `admin_evaluation_only` rollout mode;
- patient-visible semantic execution disabled;
- patient-visible sampling set to zero;
- maximum one model call per request;
- 15-second response deadline;
- fail-closed timeout and call-budget outcomes;
- request-scoped operational metadata;
- no raw patient text or text hashes in operational metadata.

The Base44 integration does not expose cancellation. The timeout is therefore a response deadline and does not prove cancellation of the underlying SDK request.

A request without a user message stops before the semantic core and reports truthful no-model identity.

Administrator evaluation correlation is preserved when a valid `evaluation_case_id` is supplied.

## 6. Unified eye-safety policy

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

### Corrections across turns

A short unrelated reply does not erase an earlier signal.

A later explicit correction may clear the corresponding flag, for example:

```text
User: Nu vad cu ochiul drept.
VIASEE: Problema a aparut brusc?
User: Nu este brusc, vad mai slab de cateva luni si nu ma doare.
```

The final deterministic state may then become `clear`.

Model safety flags remain advisory. They cannot clear deterministic safety or declare a case safe.

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

## 8. Semantic model input

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

A bounded and field-selected `prior_state` is accepted only for administrator evaluation fixtures carrying a valid `evaluation_case_id`. This permits controlled memory and correction replay. It is not durable patient state, production authority or a patient-visible activation path.

Conversation content and evaluation prior state remain untrusted data, never prompt instructions.

## 9. Raw semantic response contract

- semantic contract: `viasee-patient-conversation-semantic-v1`;
- prompt: `viasee-patient-conversation-prompt-v1.2`;
- controlled model: `gpt_5_4`.

The response may contain only:

- need summary;
- intent candidates;
- canonical service candidates;
- bounded user facts;
- understanding confidence;
- ambiguity fields;
- advisory possible-safety flags;
- bounded state-delta hints;
- grounded evidence phrases.

The raw schema excludes:

- care paths and provider types;
- urgency and search-readiness authority;
- final action;
- assistant or specialist wording;
- providers, scores, ranking and Top 3.

Unexpected fields fail schema validation. Invalid output is not repaired into a usable interpretation.

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

## 11. Final decision and canonical boundary

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

## 13. Evaluation

The controlled suite contains 71 scenarios:

- 53 semantic and safety cases;
- 8 adversarial cases;
- 10 memory, correction, negation, typo, mixed-language and intent-switch cases.

Critical cases run repeatedly. Acceptance requires 100% for safety-critical behavior, prohibited-output protection, deterministic decision/state policies where applicable, memory, corrections and critical stability. Overall pass rate and weighted score must each be at least 85%.

The evaluator distinguishes:

1. model-invoked attempts with exact model and prompt identity;
2. deterministic preflight attempts with truthful no-model metadata and exact `patient-eye-safety-v1.2` identity;
3. terminal or skipped attempts, which cannot satisfy the completed-attempt threshold.

A result that declares decision-policy diagnostics but omits the safety-policy version or reports an older version fails the case and the safety gate.

## 14. Activation blockers

PR #266 remains draft until:

1. GitHub Actions executes the configured checks;
2. lint, typecheck and build complete;
3. all required real-model attempts are captured;
4. acceptance thresholds pass;
5. critical outputs receive manual review;
6. the eye-safety and emergency boundary receive medical safety review;
7. PR #265 remains the sole approved adaptive question orchestrator;
8. durable server-owned session persistence and per-session/per-user budgets are implemented;
9. patient-visible AI disclosure, fallback and sampling policy are approved;
10. the final diff confirms no normal matching, ranking, Top 3, distribution or contact change.

Existing request-scoped controls are necessary but are not sufficient for patient-visible LLM activation.

## 15. Explicit v1 exclusions

The first active version must not:

- diagnose, prescribe or recommend medication;
- claim medical certainty;
- choose or rank providers;
- generate Top 3;
- share contact details;
- send provider requests;
- own the adaptive next-question planner;
- rely on fixture phrases as model routing logic;
- publish automatically.
