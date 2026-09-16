# Settings and billing review — 2026-09-16

## Access
Billing authorization checks the authenticated user ID and an active organization_owner membership for the requested location. VIASEE administrators are also allowed. It is not an email allowlist and is not limited to the first registered email if another owner has been granted access.
Added 20 negative mocked handler cases covering manager/staff, inactive owner, different user and different location. Added an active-owner email-change case.

## Implementation
- Settings and billing share visual constants matching ProviderOverview: sage, blue, lavender and amber, warm paper surfaces, rounded buttons and restrained texture.
- Reuses the existing technical grain and investigations SVG; no external artwork or new image generation.
- Compact Settings header and wrapping navigation, toned section headings, clearer plan action, styled saved-card rows and empty history state.
- Invoice table retains horizontal scrolling on small screens. Forms retain responsive columns and visible keyboard focus.
- Billing form can discard edits; VAT identity management appears only for company profiles.
- Configuration-review subscriptions show the correct message rather than instructions to pay again.
- Selected organization is matched to the selected location; stale overview role fallback is rejected for a different location.
- Lifecycle requests are not fetched when billing is open or the selected user role is not owner.
- Financial backend rules unchanged by this UI pass.

## Verification
Passed: billing-flow regression suite, provider billing policy, entitlement, location URL persistence, workspace routing, lint and Vite build.
Final dependency-only adjustment to the Settings memo is included in the saved version.
Browser initialization still fails with trusted Node process exited unexpectedly. No visual rendering or frontend Publish confirmation is claimed. Real signed webhook, scheduler identity and Stripe test-mode lifecycle verification remain outstanding.
