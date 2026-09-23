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

## Follow-up verified 2026-09-22
Supersedes the earlier missing-webhook observation. Dedicated LIVE webhook we_1UIBPbHNiHqLBWRJQQwe1AD0 was created on September 21 and reconfirmed enabled today. URL: https://viasee.ro/api/functions/getMyProviderWorkspace. Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted. Its STRIPE_WEBHOOK_SECRET was saved in Base44 Secrets and confirmed as a masked entry. Optilun endpoint preserved.
A synthetic signed transport probe received Cloudflare 403 from the local execution environment; genuine Stripe delivery and access updates remain unverified. GetEvents is unavailable through the connector; Dashboard requires authentication. Browser session reset; Base44 currently shows login. Scheduler logs and authenticated UI checks remain pending.
Baseline 5f6db486 includes subsequent outreach changes, all preserved. Billing source unchanged since eb121b04. Re-running verify-billing-flow exposed a stale assertion expecting only lock.current; updated it to the current lock.current || !mounted.current guard. Earlier blanket pass claims do not establish that this assertion passed after the lifecycle fix. verify-billing-flow, verify-provider-billing and verify-billing-ui-lifecycle now all pass (mock Stripe / isolated UI). No live financial transactions, backend source edits or frontend publication performed. Runtime acceptance of the saved secret remains unverified.

### Authenticated browser evidence (same continuation)
Base44 sign-in succeeded. Workflow is Active, Every 30 minutes (Europe/Bucharest), with 520 history entries and visible Completed runs. Opened scheduled run displayed Started 23.09.2026 00:02:41 and Completed 00:03:31 (browser local timezone); step duration 50497ms. No function response or scheduler headers exposed in this view, so workflow completion alone is not proof of financial reconciliation success.
Admin preview successfully loaded Stripe document and subscription lists: existing invoice K8CCWEPK-0009 total RON 0; subscription sub_1UEb3fHNiHqLBWRJNvxowkz0 canceled, RON49. Manually invoked the existing admin synchronization action: UI returned 1 synced and 0 errors; this did not create or cancel a Stripe subscription.
Changed ambiguous admin hosted-invoice link label from Factura to Document Stripe (Romanian source uses diacritics). npm run lint passed. This new label is saved in code, not yet confirmed in preview or public build.
Logs Explorer includes app.published at 23.09.2026 00:20:41 attributed to the existing administrator. This agent did not publish; exact deployed source revision is not shown and remains unverified. Subsequent edits must not be described as published based on that event.

### Test subscription webhook probe — 2026-09-23
User explicitly identified voicu.f96@gmail.com as the test customer. Read Stripe subscription sub_1UEb3fHNiHqLBWRJNvxowkz0 expanded customer: email matched, customer and subscription metadata app=viasee, location 6a4e6165343614d24bdcad96, configured price price_1UEVM3HNiHqLBWRJmxcAjd6e, quantity1, canceled.
Performed a metadata-only subscription update through the Stripe connector: viasee_webhook_check=viasee-delivery-check-20260923. Stripe accepted the update; subscription remains canceled and latest invoice remains in_1UEb3fHNiHqLBWRJoB5orK85. No financial fields, price, quantity, card, or status were changed. The purpose is to provoke a fresh customer.subscription.updated notification for delivery inspection. Event creation and webhook HTTP response are NOT established by the successful update response.
The existing Optilun endpoint also subscribes to customer.subscription.updated; this probe does not selectively deliver only to VIASEE and no endpoint configuration was changed. The connector has no available snapshot-event listing/delivery operation. User's separately connected Chrome session must inspect VIASEE Event deliveries for the new event and HTTP response. Do not substitute an Optilun 200 for VIASEE evidence.
