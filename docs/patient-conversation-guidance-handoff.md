# VIASEE patient conversation to guidance planner handoff

Status: handoff and inactive server-side bridge implemented in PR #266; runtime consumption not activated.

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

The inactive consumer bridge is:

```text
viasee-patient-conversation-guidance-planner-bridge-v1
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

## Inactive server-side bridge

PR #266 now contains byte-identical bridge modules:

```text
shared/patientConversationGuidancePlannerBridge.js
base44/shared/patientConversationGuidancePlannerBridge.js
```

The bridge performs the future integration logic without being connected to an endpoint:

1. validates the handoff contract version;
2. validates the exact target planner version;
3. validates the authority declaration;
4. rejects any non-null `semantic_proposal.next_question_key`;
5. validates the semantic proposal with the planner's own sanitizer;
6. stops before planner execution for `blocking`;
7. supplies semantic fields only as the planner AI candidate envelope;
8. supplies confirmed facts only from a separately constructed controlled context;
9. lets `patient-guidance-planner-v1` calculate routing and select the question;
10. converts invalid or unavailable outcomes to controlled fallback.

The bridge is intentionally not imported by:

```text
base44/functions/matchProvidersSemantic/entry.ts
base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts
```

It contains no `Deno.serve`, no request parsing, no `Core.InvokeLLM`, no provider loading and no matching or ranking code.

### Controlled-context rule

The bridge argument named `controlledContext` is an internal integration boundary, not a browser contract.

A future endpoint must construct it server-side from:

- validated controlled question history;
- validated controlled answers;
- server-resolved locality;
- server-approved intent;
- services confirmed by approved catalog answers.

A future endpoint must never pass through similarly named browser fields as authority. The string `server_internal_only` documents this requirement but is not a cryptographic trust mechanism.

### Authority diagnostics

The bridge reports only structural diagnostics:

- semantic candidate counts;
- confirmed fact keys;
- confirmed fact source labels;
- planner status and search-readiness boolean.

It does not expose confirmed fact values or raw patient text in diagnostics.

The verification contract demonstrates directly that:

- a locality extracted by the semantic model does not appear among planner-confirmed facts;
- the same locality becomes confirmed only when supplied through controlled context;
- its planner source is then `explicit_user`;
- advisory semantic facts remain unconfirmed;
- blocking produces `safety_blocked` without planner diagnostics.

## Integration sequence

The current PR defines the handoff and an inactive consumer bridge. It does not modify PR #265 and does not connect the bridge to the request path.

Runtime integration must occur only after both contracts are available on the same code base:

1. receive the finalized conversation envelope server-side;
2. read the in-memory `patient_guidance_handoff` generated by the same request;
3. rebuild controlled context from server-validated question history and answers;
4. call the bridge directly without serializing or accepting a handoff from the browser;
5. stop immediately when `planner_allowed` is false;
6. let `patient-guidance-planner-v1` calculate routing and select the approved question;
7. return only the approved question-selection envelope;
8. retain legacy fallback for unavailable, invalid, timeout or loop-prevention outcomes.

A browser-provided copy of the handoff or controlled context must never become server authority.

## Activation status

This contract and bridge do not activate the semantic LLM for patients. They remain administrator-only shadow infrastructure. Patient-visible activation still requires executable CI, the complete evaluation suite, manual and medical safety review, durable server-owned session state, budgets, fallback and controlled rollout.
