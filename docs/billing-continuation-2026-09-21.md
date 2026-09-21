# VIASEE billing continuation — 2026-09-21

## Baseline and preservation
The first inspection matched checkpoint commit 694d74242c44ea8b91cc7884742da82a4cf95ac2 with a clean worktree. On resumption, HEAD was e871ab53 (Base44 package update), with both earlier fixes preserved and a clean worktree. The package update was not reverted.

## Corrections saved
- ProviderBillingPanel: reopening billing details uses the latest server customer snapshot. Repeated activation while editing preserves unsaved input.
- ProviderWorkspaceRoot: sidebar entitlement is passed only when its location matches the selected location. This prevents the previous location's Pro link appearing during the next location's request.
- ProviderBillingPanel: after unmount/location change, a completed billing save cannot initiate Checkout, and late Checkout/portal responses cannot redirect the user. A request already received by the server is not canceled.

## Verification actually executed
- node scripts/verify-billing-flow.mjs: passed; mocked Stripe only.
- node scripts/verify-provider-billing.mjs: passed.
- node scripts/verify-provider-context-url.mjs: passed.
- node scripts/verify-billing-ui-lifecycle.mjs: six behavioral cases passed, using actual component handlers in an isolated hook host. Covers late portal response, departure during billing save, late Checkout response, normal portal redirect, fresh edit data, and preserving an open draft. This is not a browser rendering or Stripe integration test.
- npm run lint: passed.
- npm run build: passed (existing Browserslist data-age warning).
- Cloud browser starts successfully; no Windows ACL failure in this environment.
- Public site and login page inspected. Settings, owner/admin sessions, mobile rendering, and real portal return remain unverified because no authenticated session has been established.

## Stripe observations
Account available through the connector: Lunera Optic SRL, LIVE only.
Earlier in this continuation the API returned the active VIASEE recurring price price_1UEVM3HNiHqLBWRJmxcAjd6e: RON 4900 minor units, one month, metadata app=viasee.
The dedicated active VIASEE portal configuration bpc_1UGMhBHNiHqLBWRJ3ipt2lCv exists: card updates, billing details, invoice history and cancellation at period end enabled; subscription changes disabled.
On 2026-09-21, GetWebhookEndpoints still returned only the Optilun endpoint, with has_more=false. Earlier GetV2CoreEventDestinations also returned only the same destination. No dedicated VIASEE destination or valid delivery was confirmed. Do not treat invalid-signature rejection as delivery evidence.
No real payments, cancellation, refunds, card changes, roles or Stripe configuration were changed.

## Scheduler
base44/workflows/Provider Stripe Subscription Reconciler.jsonc contains cron */30 * * * * and routes to getMyProviderWorkspace / reconcileProviderStripeSubscriptions.
The handler requires admin or validated service credentials; __automation_trigger remains only a routing hint.
Configuration in source does not establish deployment, execution success, or scheduler-provided authentication. These still need execution logs and a real scheduled run.

## Manual KEEZ invoice gap
Reviewed billing backend, owner panel, admin billing center, and entity schema references. The current flow displays Stripe collection documents and explains manual KEEZ issuance. No complete association/upload/archive flow for manually issued KEEZ invoices was found.
Required next implementation:
- An admin-maintained fiscal-document record linked to the billing account/location and verified Stripe invoice/payment reference.
- Issuer series and number copied from the invoice already issued in KEEZ, issue date, amount/currency, document status and an audit trail. VIASEE must not issue its own KEEZ number.
- Private PDF storage; authorize the active location owner/admin before issuing a short-lived download URL. Avoid permanent public PDF URLs.
- Admin upload/association/replacement workflow and a separate owner fiscal-invoices section, with an explicit pending/not-yet-attached state.
- Preserve original issued documents and distinguish correction/credit documents from Stripe refunds.
This module is evaluated, not implemented. No KEEZ API, series or automatic fiscal issuance is configured.

## Delivery status
Code: saved remotely through Base44 auto-commit.
Backend: not changed in this continuation; actual deployed version not revalidated.
Preview: authenticated billing UI not inspected.
Published frontend: publication of the saved corrections is not confirmed and was not performed.
Outstanding: authenticated desktop/mobile owner and admin checks, manager/staff negative live tests using agreed test accounts, real Stripe test-mode lifecycle, valid webhook delivery, scheduler execution, and publication verification.
