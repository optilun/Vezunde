# VIASEE patient conversation to guidance planner handoff

Status: contract implemented in PR #266; planner consumption not activated.

## Governing boundary

The semantic conversation agent and the adaptive question planner have different authorities:

- the conversation agent interprets patient language and returns candidate semantic data;
- deterministic VIASEE policy owns the final safety state;
- `patient-guidance-planner-v1` remains the only component allowed to select `next_question_key`;
- approved question text and options continue to come only from `PATIENT_GUIDANCE_QUESTION_CATALOG`;
- matching, ranking, Top 3, distribution and contact sharing remain outside both layers.

The handoff contract is:

```text
viasee-patient-conversation-guidance-handoff-v1
```

The declared target is:

```text
patient-guidance-planner-v1
```

## Envelope location

Administrator-only shadow responses expose:

```text
patient_guidance_handoff
```

The handoff is attached after the operational envelope is finalized. It does not invoke the planner and does not start provider matching.

## Authority fields

Every handoff declares:

```json
{
  "authority": {
    "semantic_fields": "candidate_only",
    "confirmed_facts": "controlled_answers_only",
    "safety": "viasee_deterministic_policy",
    "next_question": "patient-guidance-planner-v1"
  }
}
```

The semantic proposal always contains:

```json
{
  "primary_intent": "unknown",
  "alternative_intents": [],
  "candidate_service_keys": [],
  "extracted_facts": [],
  "candidate_care_paths": [],
  "next_question_key": null,
  "confidence_band": "low",
  "possible_safety_flags": [],
  "evidence_phrases": []
}
```

`next_question_key` is deliberately forced to `null`. PR #266 cannot choose a question.

## Confirmed versus candidate data

The handoff does not expose `confirmed_facts` or confirmed services.

Semantic facts are converted only to planner-compatible candidate facts. Controlled wizard answers and other server-approved deterministic sources remain the only sources that may confirm facts in the planner.

Candidate values are restricted to the planner contract:

- patient-facing canonical services only;
- approved patient intents only;
- approved care paths excluding `unresolved` and `emergency_interruption`;
- planner-compatible age-group aliases;
- controlled timing and acuity values only;
- at most 12 candidate facts;
- at most 5 evidence phrases, each at most 120 characters.

## Safety states

### `clear`

- planner handoff status: `ready`;
- planner allowed: `true`;
- stale model-only safety flags are removed;
- the planner still recalculates its own routing and search prerequisites.

### `advisory`

- planner handoff status: `ready`;
- planner allowed: `true`;
- unresolved safety information and candidate safety flags may be supplied;
- only the approved planner may select a clarification question.

### `blocking`

- planner handoff status: `safety_blocked`;
- planner allowed: `false`;
- candidate services, facts and care paths are emptied;
- `next_question_key` remains `null`;
- the emergency interruption remains owned by deterministic VIASEE safety policy.

### unavailable or skipped

- planner handoff status: `unavailable`;
- safety state: `unchecked`;
- planner allowed: `false`;
- an empty semantic proposal is returned.

## Integration sequence

The current PR only defines and emits the handoff. It does not modify PR #265.

Future integration must occur only after both contracts are available on the same code base:

1. receive the finalized conversation envelope server-side;
2. read `patient_guidance_handoff`;
3. reject it unless the handoff and target-planner versions match;
4. stop immediately when `planner_allowed` is false;
5. pass only `semantic_proposal` as the planner's candidate AI envelope;
6. rebuild confirmed facts from controlled question history and server-owned data;
7. let `patient-guidance-planner-v1` calculate routing and select the approved question;
8. retain legacy fallback for unavailable, invalid, timeout or loop-prevention outcomes.

A browser-provided copy of this handoff must never become server authority.

## Activation status

This contract does not activate the semantic LLM for patients. It remains administrator-only shadow output. Patient-visible activation still requires executable CI, the complete evaluation suite, manual and medical safety review, durable server-owned session state, budgets, fallback and controlled rollout.
