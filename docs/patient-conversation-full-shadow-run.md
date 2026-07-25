# VIASEE patient conversation — complete shadow run

## Scope

This runbook prepares and evaluates the complete controlled fixture suite without activating patient-visible semantic behavior.

Execution is allowed only for an authenticated administrator against:

```text
mode = patient_conversation_shadow
```

Do not merge or publish based only on preparation output.

## 1. Verify deterministic and structural gates

Run the repository verification suite first. The PR #265 + PR #266 composition checks are included through the marketplace-isolation gate and cover:

- adaptive question selection;
- question-selection hardening;
- semantic handoff authority;
- deterministic eye safety;
- matching, ranking and Top 3 isolation.

## 2. Prepare every controlled attempt

```bash
node scripts/prepare-patient-conversation-full-shadow-run.mjs \
  --output tmp/patient-conversation-shadow-run.json \
  --repeat 1 \
  --critical-repeat 3
```

The full-suite command:

- selects every fixture exactly once;
- rejects `--case` to prevent an accidental partial run;
- requires `--critical-repeat` to be between 3 and 5;
- expands critical fixtures to at least three attempts;
- binds the capture file to a SHA-256 fingerprint of the normalized fixture suite;
- rejects reuse after fixture, path, version, selected-case or repeat-policy changes;
- preserves already captured attempts;
- outputs only pending administrator-shadow requests.

The default fixture contract must resolve to exactly 71 unique cases before requests are executed.

Use a new output file whenever the fixture fingerprint or repeat policy changes. Do not remove or edit the fingerprint in an existing capture.

## 3. Execute pending requests

For every item in `requests`, send its `request` object to the administrator-only semantic endpoint and save the complete response envelope as JSON.

Preserve both correlation fields exactly:

```text
evaluation_case_id
evaluation_attempt
```

Every saved response must also preserve an explicit runtime status:

```text
completed | invalid | unavailable | skipped
```

Do not edit model outputs, add an outer correlation value that contradicts the envelope, or reuse one response for multiple attempts.

Every captured attempt must retain the server-generated `runtime_metadata.duration_ms`. A response without duration evidence cannot satisfy the validated acceptance gate.

## 4. Import captured responses immutably

Rerun the full-suite command with one `--response` argument per captured envelope:

```bash
node scripts/prepare-patient-conversation-full-shadow-run.mjs \
  --output tmp/patient-conversation-shadow-run.json \
  --repeat 1 \
  --critical-repeat 3 \
  --response tmp/responses/example-1.json \
  --response tmp/responses/example-2.json
```

The harness rejects:

- unknown or unselected cases;
- missing or contradictory case correlation;
- invalid, missing or contradictory attempt correlation;
- missing, pending or unknown response status;
- duplicate response files for one attempt;
- overwriting an already captured attempt;
- attempts beyond the required repeat count;
- a critical repeat count below 3;
- an existing capture whose fixture fingerprint or run identity no longer matches.

Continue until `pending_attempts` and `requests` are empty.

## 5. Evaluate only through the validated launcher

```bash
node scripts/evaluate-patient-conversation-results-validated.mjs \
  default \
  tmp/patient-conversation-shadow-run.json \
  tmp/patient-conversation-evaluation-report.json
```

The evaluator fails closed for:

- missing, pending, malformed, duplicate or unexpected attempts;
- wrong model or prompt identity;
- incomplete deterministic-preflight identity;
- missing `duration_ms` evidence or a measured-attempt count different from the expected attempt count;
- any safety threshold below 100%;
- critical instability;
- overall pass rate below 85%;
- average weighted score below 85%.

## 6. Manual review before leaving draft

Even a passing automated report is insufficient by itself. Review at minimum:

- every confirmed or ambiguous safety case;
- every failed or borderline case;
- grounding rejections;
- prompt-injection cases;
- provider-ranking, diagnosis, treatment and contact-data exclusions;
- latency and model-unavailable behavior.

PR #266 remains draft until repository CI, lint, typecheck, build, model evaluation, medical review and privacy/security review all pass.
