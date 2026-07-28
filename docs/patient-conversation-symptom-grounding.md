# VIASEE patient conversation symptom grounding

Status: implemented in administrator-only shadow mode; executable validation remains externally blocked.

## Contract identity

```text
viasee-patient-conversation-grounding-v1
```

The shared and Base44 modules must remain byte-identical:

```text
shared/patientConversationGrounding.js
base44/shared/patientConversationGrounding.js
```

## Scope

Grounding applies only to:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

It does not give the model medical, safety, question-selection, search or matching authority.

`need_summary` is not treated as a confirmed medical fact. `specialist_summary` remains `null`.

## Evidence rule

A symptom fact is accepted only when:

1. the final value is an exact normalized fragment of a `user` message;
2. the value is supported by an accepted raw `evidence_phrases` item;
3. assistant-only wording is rejected as evidence;
4. the wrapper creates the final `fact_evidence` map.

Normalization is limited to:

- case;
- Romanian diacritics;
- repeated whitespace.

The runtime does not infer semantic equivalence between different medical phrases.

## Fail-closed runtime behavior

Grounding runs after state reconciliation, correction reduction, final deterministic decision policy and the canonical boundary, but before the guidance handoff.

A grounded interpretation may contain:

```json
{
  "fact_evidence": {
    "symptom_onset": [],
    "symptom_duration": ["De cateva luni"],
    "symptom_pattern": ["Vad mai prost cand citesc si ma doare capul"]
  }
}
```

An unsupported symptom fact invalidates the complete semantic envelope:

```json
{
  "status": "invalid",
  "reason": "ungrounded_symptom_facts",
  "interpretation": null
}
```

The invalid result cannot become a usable planner handoff and cannot start matching.

## Deterministic emergency preflight

Explicit blocking emergencies skip the model.

Their deterministic interpretation does not populate semantic symptom facts, so grounding cannot downgrade, delay or invalidate a correctly detected emergency.

## Evaluator behavior

Evaluation identity:

```text
viasee-patient-conversation-evaluation-v1.4
```

For fixtures containing:

```json
{
  "must_not": ["invented_symptoms"]
}
```

the evaluator independently compares:

- final structured symptom facts;
- final field-level `fact_evidence`;
- fixture user messages.

Missing evidence, mismatched evidence, assistant-only evidence or an invalid runtime envelope fails `must_not:invented_symptoms` and fails the safety gate.

## Fixture alignment

`summary-001` is now replaced at load time by a case that tests:

- `locality_city = Timisoara`;
- `duration = de cateva luni`;
- the exact grounded `symptom_pattern`;
- `timing_preference = dupa ora 17`;
- no invented symptoms, diagnosis or contact details.

The replacement keeps `specialist_summary = null` and does not activate provider messaging.

The total suite remains exactly 71 unique cases.

## Intentional strictness

The first version may reject legitimate paraphrases.

For example, the user phrase:

```text
Vad mai prost cand citesc.
```

must not silently become:

```text
vedere redusa la aproape
```

This strictness prefers false rejection over accepting a symptom the patient did not state.

The current prompt remains `viasee-patient-conversation-prompt-v1.2`. It requires evidence phrases to be copied from user turns, but the real-model run must still measure how often exact symptom grounding produces `ungrounded_symptom_facts`.

## State limitation

Persistence remains request-scoped shadow state.

A future durable session must store reviewed evidence provenance with every carried symptom fact. Prior symptom text without server-owned evidence must not become trusted automatically.

## Remaining evidence required

Before patient-visible activation:

- execute the grounding and fixture-audit scripts;
- execute lint, typecheck and build;
- run all 71 cases with critical repeats;
- measure `ungrounded_symptom_facts` frequency;
- inspect Romanian punctuation, diacritics and mixed-language wording;
- manually review safety-critical grounding failures;
- obtain medical review of the complete safety boundary.

Static implementation and static audit are not release evidence.
