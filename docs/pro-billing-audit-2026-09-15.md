# VIASEE Pro billing — implementation and verification

## Implemented
- Settings → Abonament și facturare, with per-location owner scope and a shared compatibility panel in Leads → Cont.
- Server-sourced Pro pricing; the existing live VIASEE price is 49 RON/month. No prices, charges, refunds or cancellations were changed during development.
- Persisted ProviderBillingAccount customer mapping before checkout, with admin-only entity RLS and owner-authorized server handlers.
- Billing identity: individual/company, name, billing email, address and CUI. CUI is stored as a customer metadata/custom invoice field; it is not automatically registered as an EU VAT ID.
- Existing VAT identity conflicts block saving mismatched company details.
- Required billing details, address and payment method collection at Checkout.
- Duplicate subscription rejection includes active, trialing, overdue, unpaid, incomplete and paused subscriptions. Open checkout sessions are reused; session creation has an idempotency key.
- Stripe return confirmation retains session parameters until confirmation and refresh succeed; failures remain retryable.
- Per-customer cards (masked), invoice history with pagination, PDF/hosted invoice links.
- Dedicated portal configuration is provisioned on first use (or uses STRIPE_BILLING_PORTAL_CONFIG_ID). Enables card/billing/tax ID/invoice management and cancellation at period end; disables quantity/plan changes. Existing account-wide portal defaults remain unchanged.
- Admin → Plăți și abonamente: invoices, PaymentIntents with latest charge outcomes/refunds/disputes, and subscriptions. Only VIASEE customers are included. Search/status filters apply to the current page. Consequential management links open Stripe Dashboard.
- Exact subscription history is preserved by Stripe subscription ID. Paused subscriptions do not grant Pro.
- Reconciliation paginates Stripe subscriptions and can recover completed checkouts that never returned to VIASEE.
- Body-only automation authorization removed. Reconciliation requires admin identity or matching caller/service credentials, followed by a server API call that validates the service credential.
- Billing return origins restricted to known VIASEE domains and local development.

## Verified
- npm run build
- npm run lint
- node scripts/verify-provider-billing.mjs
- node scripts/verify-billing-flow.mjs (mock Stripe: authorization, duplicate subscriptions, canceled/unfinished checkout, replay/recovery, invoice identity, portal isolation, unrelated-customer exclusion)
- npm run test:provider-workspace-router
- node scripts/verify-provider-entitlement.mjs
- node scripts/verify-provider-context-url.mjs
- Live unauthenticated providerBillingOps call returns 401.
- Live body-forged reconciliation call returns 403.
- Invalid Stripe signature is rejected by the Base44 gateway with 401.
- ProviderBillingAccount schema and admin-only RLS verified through Base44.

## Still requiring completion / external access
1. Fiscal issuer/provider and VAT status: awaiting owner response (SmartBill/Oblio/FGO/accountant or other). Price tax_behavior is currently unspecified. No automatic_tax or VAT registration was invented or enabled. Stripe PDFs do not establish completion of RO e-Factura delivery.
2. End-to-end authenticated browser verification and frontend Publish: browser automation unavailable due local Windows sandbox ACL error. Backend changes and entity schema are synced; frontend publication is not confirmed.
3. Real scheduled-workflow execution: verify that the Base44 scheduler supplies a valid authenticated admin or service caller. Never restore trust in __automation_trigger alone if its authentication differs.
4. Valid signed webhook delivery must be verified separately; rejection of an invalid signature does not prove successful delivery.
5. No real payments, cancellations, refunds, card removal or invoice voiding were executed. Complete lifecycle testing in a Stripe test environment before treating the entire billing system as production-validated.

## References
- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://docs.stripe.com/customer-management
- https://docs.base44.com/developers/references/sdk/docs/functions/createClientFromRequest
