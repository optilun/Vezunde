# VIASEE Patient Conversation Architecture v1

Status: administrator-only semantic shadow implementation  
Patient LLM: not connected  
Patient intake safety: shared deterministic policy connected  
Matching, ranking and Top 3 impact: none  
Production publication: none

## 1. Product boundary

VIASEE may use a controlled LLM to understand ordinary Romanian descriptions of eye-care and optical needs.

The model is not a doctor, provider recommender, marketplace orchestrator or question selector.

> The LLM understands. VIASEE code decides.

The semantic layer must not:

- diagnose, prescribe or recommend medication;
- determine final urgency or declare a case safe;
- choose the next question;
- start provider search as authority;
- choose, rank or recommend providers;
- create Top 3;
- distribute requests or expose contact details;
- generate provider-facing specialist messaging.

`specialist_summary` remains `null` in this layer.

## 2. Runtime identities

- route: `patient_conversation_shadow`;
- envelope: `viasee-patient-conversation-agent-v1`;
- semantic response: `viasee-patient-conversation-semantic-v1`;
- model: `gpt_5_4` when semantic interpretation is required;
- prompt: `viasee-patient-conversation-prompt-v1.2`;
- decision policy: `viasee-patient-conversation-decision-policy-v1`;
- eye-safety policy: `patient-eye-safety-v1.2`;
- emergency guidance: `patient-emergency-guidance-v1.1`;
- evaluation: `viasee-patient-conversation-evaluation-v1.4`;
- symptom grounding: `viasee-patient-conversation-grounding-v1`;
- state policy: `viasee-patient-conversation-state-policy-v1.1`;
- state-delta reducer: `viasee-patient-conversation-state-delta-reducer-v1`;
- canonical boundary: `viasee-patient-conversation-canonical-boundary-v1`;
- guidance handoff: `viasee-patient-conversation-guidance-handoff-v1`;
- inactive planner bridge: `viasee-patient-conversation-guidance-planner-bridge-v1`;
- operational policy: `viasee-patient-conversation-operational-policy-v1`.

## 3. Runtime pipeline

```text
administrator shadow request
        ↓
request-scoped operational controls
        ↓
deterministic eye-safety preflight
        ├─ blocking → fixed emergency guidance, no model
        └─ clear/advisory → semantic model path
                ↓
strict schema and prohibited-output validation
        ↓
deterministic state reconciliation
        ↓
validated correction-delta reducer
        ↓
deterministic safety and final-decision policy
        ↓
canonical patient/provider boundary
        ↓
field-level symptom grounding
        ├─ valid → attach fact_evidence
        └─ invalid → ungrounded_symptom_facts
        ↓
shadow envelope and candidate-only handoff
```

The shadow route exits before service-role provider access and before matching.

The inactive planner bridge is not imported by the endpoint.

## 4. Patient intake safety

The patient-visible LLM remains disabled.

Frontend and Base44 use byte-identical copies of `patient-eye-safety-v1.2`:

- `clear`: no unresolved deterministic safety signal;
- `advisory`: controlled clarification is required and search remains stopped;
- `blocking`: the normal flow stops and fixed emergency guidance is shown.

Generic monocular wording such as `Nu vad cu ochiul drept` remains advisory when onset and severity are unknown.

Explicit sudden or near-complete loss of vision is blocking before a model call.

Model safety flags are advisory only. They cannot create blocking certainty, clear deterministic safety or declare a case non-urgent.

## 5. Emergency guidance

Confirmed blocking cases use `patient-emergency-guidance-v1.1` in this order:

1. a public hospital that confirms ophthalmology emergency capability;
2. a public-hospital UPU when the exact ophthalmology destination is unknown;
3. accompanied transport and no driving when vision is affected;
4. conditional secondary 112 fallback only when safe transport is impossible or general condition worsens rapidly.

Hospital or UPU remains the primary action. There is no primary `tel:112` action.

Advisory cases expose no hospital, UPU or 112 instruction.

The model cannot generate, reorder or replace the fixed emergency message.

## 6. Semantic model contract

The raw semantic response may contain only:

- need summary;
- primary and alternative intent candidates;
- canonical service candidates;
- bounded user-provided facts;
- understanding confidence;
- ambiguity fields;
- advisory possible-safety flags;
- explicit correction hints;
- evidence phrases copied from user turns.

The raw response excludes:

- care paths and provider types as authority;
- final urgency and search readiness;
- final action or approved next question;
- patient-facing or provider-facing messaging;
- provider identifiers, scores, ranking and Top 3.

Unexpected properties, invalid types, noncanonical services, prohibited medical claims, provider recommendations and generated contact details fail closed.

## 7. Field-level symptom grounding

Grounding applies to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

A final symptom fact survives only when:

1. its value is an exact normalized fragment of a `user` message;
2. it is supported by an accepted raw `evidence_phrases` item;
3. assistant-only wording is not used as evidence;
4. the wrapper creates the final `fact_evidence` mapping.

Normalization is limited to case, Romanian diacritics and repeated whitespace.

Unsupported symptom facts invalidate the whole semantic envelope:

```text
status = invalid
reason = ungrounded_symptom_facts
interpretation = null
```

The invalid envelope cannot become a usable planner handoff and cannot start matching.

## 8. State and corrections

Normal shadow requests discard browser-provided `prior_state`.

A bounded prior state is accepted only for authenticated administrator evaluation fixtures carrying a valid evaluation ID.

The deterministic state policy and correction reducer must prevent stale intent, locality, person, symptom, prescription, investigation and repair facts from contaminating a corrected request.

Durable server-owned conversation state is not implemented.

A future durable session must store reviewed evidence provenance with every carried symptom fact.

## 9. Final decision and handoff

Deterministic code recalculates:

- final safety state and urgency;
- missing critical fields;
- search readiness;
- final action;
- controlled patient-facing wording;
- provider-profile candidates from canonical services.

The handoff forces:

```json
{
  "next_question_key": null,
  "semantic_fields": "candidate_only",
  "confirmed_facts": "controlled_answers_only"
}
```

PR #265 remains the sole approved adaptive `next_question_key` orchestrator.

## 10. Fixture architecture

The controlled evaluation suite contains exactly 71 cases:

- 53 semantic and safety cases;
- 8 adversarial cases;
- 10 state, memory, correction, negation, typo and mixed-language cases.

An explicit replacement file aligns legacy cases without duplicating IDs or increasing the case count:

```text
tests/fixtures/patient-conversation-agent-evaluation-overrides.json
```

Current replacements:

- `vision-loss-003`: current public-hospital/UPU emergency wording;
- `summary-001`: grounded structured facts instead of provider messaging.

`question_goal` values are preserved as non-scoring `fixture_notes` because PR #265, not PR #266, owns question selection.

The fixture contract rejects:

- unknown expected fields or `must_not` tokens;
- malformed expectation types;
- unknown fact keys;
- contradictory urgency, action and question expectations;
- symptom/timing expectations unsupported by user text;
- unsupported provider-messaging expectations.

Evaluation v1.4 also activates previously ineffective checks:

- `service_keys_all: []` requires an actually empty service list;
- `forget_previous_need` fails when prior intent or service meaning is lost;
- `invented_symptoms` independently validates final facts and `fact_evidence`.

The aligned suite is structurally release-ready. This is not evidence that the 71-case model run passed.

## 11. Operational controls

The current wrapper enforces:

- administrator-only evaluation rollout;
- patient-visible sampling at zero;
- maximum one model invocation per request;
- a 15-second response deadline;
- browser prior-state isolation;
- redaction of email, Romanian phone numbers and 13-digit identifiers;
- aggregate metadata without raw patient text or text hashes.

The Base44 integration exposes no cancellation primitive. The timeout is a fail-closed response deadline, not proof that the underlying request was cancelled.

## 12. Marketplace isolation

The deterministic marketplace remains responsible for:

- canonical locality resolution;
- service matching and prerequisites;
- provider eligibility and trust state;
- result groups, ranking and tie-breaking;
- Top 3;
- contact consent and request distribution.

PR #266 does not modify these behaviors.

## 13. Activation blockers

PR #266 remains draft and unpublished until:

1. GitHub Actions executes the configured checks;
2. lint, typecheck and build complete on the final HEAD;
3. all required model and deterministic attempts are captured;
4. acceptance thresholds pass;
5. grounding rejection rates are measured and reviewed;
6. critical outputs receive manual review;
7. the safety and emergency boundary receives medical review;
8. PR #265 remains the sole approved next-question orchestrator;
9. durable server-owned session state, evidence provenance and per-session/per-user budgets exist;
10. patient-visible disclosure, fallback and rollout policy are approved;
11. the final executable diff confirms no normal matching, ranking, Top 3, distribution or contact change.

Static implementation and static audit are not release evidence.
