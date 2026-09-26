# Controlled chat reliability repairs — 2026-09-26

## Scope and saved state

Starting commit: df48afa50b633cf224583dba6a7c410f036125b1.
Pre-change checkpoint: 6ab8111f8235acf1bf6d237d.

This change repairs the existing patient/location chat. It does not add specialist assignment, new commercial rules, appointment booking, or new access permissions. Concurrent search/locality changes were preserved.

## Changes

- Patient and provider panels mount a distinct session for each request/lead and location. Drafts and previous data do not carry across recipients.
- A shared session hook ignores responses from unmounted sessions and superseded operations. A late status response cannot replace a completed send. Historical provider sessions remain read-only.
- The composer retains a pending message ID when delivery acknowledgement fails, allowing the existing backend idempotency check to recognize retries. A successful send or edited message starts a new ID. Submission is locked synchronously against double-clicks; the field is disabled during sending.
- Status returns the latest 50 messages with next_before_message_id. Older pages use a scoped, server-resolved anchor, created_date and id ordering, including equal timestamp boundaries. New arrivals do not shift the cursor. Message sanitization and existing patient/provider authorization still apply.
- Both panels can load older messages. Background refresh preserves loaded history when pages overlap; after a long gap it resets to the latest window with a cursor to retrieve the intervening history.
- Refresh authorization errors clear visible chat data.
- Accessible label/help for the composer, a labelled live message log, preserved reading position, older-history scroll anchoring and a new-messages control.
- Read receipts identify the reader as the location team or client; they do not claim specialist review.
- Added react-test-renderer 18.3.1 as a development dependency matching installed React, and an automatically discovered verify script.

## Validation

Passed:
- node scripts/verify-controlled-chat-reliability.mjs — 17 behavioral scenarios.
- node scripts/verify-controlled-pro-chat.mjs.
- node scripts/verify-provider-lead-inbox-free.mjs.
- node scripts/verify-provider-lead-response.mjs.
- node scripts/verify-patient-request-status.mjs.
- node scripts/verify-request-workspace.mjs.
- node scripts/verify-provider-organization-lead-inbox.mjs.
- npm run lint.
- npm run build (existing stale Browserslist dataset notice only).
- git diff --check.

The behavioral suite executes actual React components with a mocked transport and the actual HTTP handler with a fake SDK. Cases include 210 messages plus a concurrent insert, 125 equal timestamps, invalid/foreign/deleted cursors, token denial, sanitized output, rapid A/B switching, lost acknowledgement and retry, double-submit, late send, late polling, authorization revocation, read-only mode and scrolling.

## Operational limits

No real patient records were read or modified for tests. There was no authenticated patient/provider browser round trip and no screen-reader user test. The SDK database query behavior was simulated; the same scenarios should be verified in the connected preview with synthetic accounts. Pending message IDs are retained within the mounted composer, not persisted across a page reload.

Resource changes auto-sync from the Base44 sandbox. Frontend publication was not performed or verified in this repair task; saving or building is not evidence that viasee.ro runs this frontend version.

## Files

Backend: base44/functions/controlledChatOps/entry.ts and messageHistory.js.
Frontend: src/components/chat/{useControlledChatSession.js,ChatComposer.jsx,ChatThread.jsx}, src/components/intake2/PatientRequestChat.jsx, src/components/workspace/provider/ProviderLeadChat.jsx, src/lib/patientRequestPersistenceClient.js.
Tests: scripts/verify-controlled-chat-reliability.mjs, scripts/verify-controlled-pro-chat.mjs; development dependency in package.json/package-lock.json.
