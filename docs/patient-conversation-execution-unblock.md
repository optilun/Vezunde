# VIASEE patient conversation — execution unblock checklist

## Purpose

This checklist separates external execution access from conversational code changes. Completing it does not authorize merge or publication.

## GitHub Actions

Observed repository-wide behavior:

```text
job.status = completed
job.conclusion = failure
job.steps = null
job.logs_url = null
```

The same failure occurs across unrelated workflows and newly added minimal verification workflows. This means the jobs are failing before repository checkout and before any test command executes.

Administrator checks required in GitHub:

1. Open the account billing and usage page for the repository owner.
2. Check GitHub Actions included-minute usage for the current billing cycle.
3. Check whether an Actions budget or spending limit is exhausted or set to zero.
4. Check payment-method or billing-status warnings.
5. In the repository, open `Settings → Actions → General` and confirm Actions and GitHub-hosted runners are enabled.
6. After resolving the account or policy issue, rerun only the failed jobs on PR #266.

Do not interpret the current red checks as test failures. There are no executed steps or logs supporting that conclusion.

## Base44 sandbox

The connected Base44 tool currently returns:

```text
NOT_AUTHORIZED
Missing required OAuth scope 'sandbox:write'. Reconnect granting sandbox access.
```

Required action:

1. Reconnect the Base44 integration and grant sandbox access including `sandbox:write`.
2. Do not publish or edit the application during reconnection.
3. After reconnection, use the sandbox only to check out the PR #266 branch in a temporary working directory and run verification commands.
4. Confirm the sandbox Git HEAD before every command.

## First executable commands after either environment is restored

Run in this order:

```bash
node scripts/verify-patient-conversation-pr265-composition.mjs
node scripts/verify-patient-conversation-shadow-route.mjs
node scripts/verify-patient-conversation-shadow-harness.mjs
node scripts/verify-patient-conversation-evaluation.mjs
npm run test:services
npm run typecheck:services
npm run typecheck -- --pretty false
npm run lint
npm run build
```

Any failure must be investigated from its actual output. Do not bypass or downgrade a failing safety, authority, fixture, capture-identity or marketplace-isolation gate.

## Controlled model run

Only after the repository commands pass:

```bash
node scripts/prepare-patient-conversation-full-shadow-run.mjs \
  --output tmp/patient-conversation-shadow-run.json \
  --repeat 1 \
  --critical-repeat 3
```

Use only administrator-only `patient_conversation_shadow` requests. Import complete server envelopes and evaluate only with:

```bash
node scripts/evaluate-patient-conversation-results-validated.mjs \
  default \
  tmp/patient-conversation-shadow-run.json \
  tmp/patient-conversation-evaluation-report.json
```

## Release boundary

Until all executable checks and the controlled model run pass:

- PR #266 stays draft;
- PR #265 stays the only approved `next_question_key` authority;
- no merge into `main`;
- no GitHub-to-Base44 production build handoff;
- no Base44 publication;
- no patient-visible semantic rollout.
