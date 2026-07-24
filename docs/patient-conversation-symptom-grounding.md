# VIASEE patient conversation symptom grounding

Status: implemented in administrator-only shadow mode; executable validation still blocked externally.

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

Grounding applies only to structured symptom facts that may influence later deterministic decisions:

- `symptom_onset`;
- `symptom_duration`;
- `symptom_pattern`.

It does not turn the model into a medical authority. Safety, search readiness, question selection and provider matching remain deterministic.

Free-text fields such as `need_summary` are not treated as confirmed medical facts. `specialist_summary` remains unavailable in this layer.

## Evidence rule

A symptom fact is accepted only when all conditions are true:

1. the value is present as an exact normalized fragment in a `user` message;
2. the value is also contained in one of the raw model `evidence_phrases` items already validated against user turns;
3. the value is not supported only by an `assistant` question or suggestion;
4. the wrapper creates the final `fact_evidence` mapping itself.

Normalization is limited to:

- case;
- Romanian diacritics;
- repeated whitespace.

The runtime does not use a medical keyword list to infer whether two different phrases mean the same symptom.

## Fail-closed runtime behavior

Grounding runs after deterministic state reconciliation, state-delta reduction, final decision policy and the canonical boundary, but before the guidance handoff is generated.

When all symptom facts are grounded, the final interpretation receives:

```json
{
  "fact_evidence": {
    "symptom_onset": [],
    "symptom_duration": ["De cateva luni"],
    "symptom_pattern": ["Vad mai prost cand citesc si ma doare capul"]
  }
}
```

When a symptom fact is not grounded, the complete semantic envelope becomes:

```json
{
  "status": "invalid",
  "reason": "ungrounded_symptom_facts",
  "interpretation": null
}
```

The invalid result cannot reach the planner handoff as usable semantic data and cannot start matching.

## Deterministic emergency preflight

Explicit blocking emergencies skip the model. Their deterministic interpretation does not populate semantic symptom facts and therefore receives an empty evidence map without being rejected.

Grounding must never downgrade, delay or invalidate a correctly detected deterministic blocking emergency.

## Evaluator behavior

Evaluation identity:

```text
viasee-patient-conversation-evaluation-v1.3
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
- the fixture's user messages.

A symptom fact without valid evidence, a mismatched evidence value, an assistant-only quote or an invalid runtime envelope fails `must_not:invented_symptoms` and fails the safety gate.

The fixture token is no longer classified as unimplemented.

## Intentional strictness

The first version may reject legitimate paraphrases. For example, the user phrase:

```text
Vad mai prost cand citesc.
```

must not silently become the structured fact:

```text
vedere redusa la aproape
```

unless a later reviewed contract explicitly permits that normalization while preserving evidence provenance.

This strictness protects against hallucinated symptom details at the cost of more invalid shadow attempts.

The current prompt remains `viasee-patient-conversation-prompt-v1.2`. It already requires `evidence_phrases` to be copied from user turns, but it does not explicitly require every symptom fact value to be copied literally. The fail-closed grounding layer will measure how often this causes `ungrounded_symptom_facts` before any prompt revision is approved.

## Fixture-scope distinction

The default fixture `summary-001` contains a separate provider-summary expectation. The runtime intentionally keeps `specialist_summary = null`, so the validated launcher blocks that fixture with `fixture_unsupported_runtime_expectation`.

This blocker is independent from symptom grounding. Grounding itself is implemented; the fixture must be aligned with the actual PR scope before the complete release evaluation can start.

## State limitation

Current persistence is request-scoped shadow state.

A future durable session must store reviewed evidence provenance together with every carried symptom fact. A carried prior symptom without server-owned evidence must not become trusted merely because it exists in prior state.

Until durable provenance is implemented, cross-request symptom memory remains an activation blocker.

## Remaining evidence required

Before patient-visible activation:

- align the incompatible `summary-001` fixture;
- execute the grounding verification script;
- execute lint and typecheck;
- run all 71 fixtures with critical repeats;
- measure `ungrounded_symptom_facts` frequency;
- inspect Romanian diacritic and punctuation variants;
- inspect mixed Romanian/English symptom wording;
- manually review every grounding failure in safety-critical cases;
- obtain medical safety review of the complete safety boundary.

Static implementation is not release evidence.
