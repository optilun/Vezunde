# Module 3A — Directory Trust Foundation: Migration Notes (internal)

Date: 2026-07-04

## Canonical models in active use
All active pages and backend functions read/write canonical models only:
ProviderOrganization, ProviderLocation, ProfessionalProfile, ProfessionalLocationAssignment,
LocationService, LocationSpecialization, LocationFacility, PatientRequest, PatientRequestAnswer,
RequestMatch, ProviderClaimRequest (+ ProviderMembership, VerificationRecord, SafetyFlag).

## Remaining legacy dependencies (audit result)
Legacy entities kept, NOT deleted, NOT used by active code paths:
- `Location` — no active reads/writes found. Superseded by ProviderLocation.
- `Request` — no active reads/writes found. Superseded by PatientRequest.
- `Professional` — no active reads/writes found. Superseded by ProfessionalProfile + ProfessionalLocationAssignment.
- `IntakeAnswer` — no active reads/writes found. Superseded by PatientRequestAnswer.
- `ClaimRequest` — no active reads/writes found. Superseded by ProviderClaimRequest.

Legacy FIELDS still written (kept in sync temporarily, for backward compatibility only —
must NOT be used by matching after Module 3A):
- `ProviderLocation.verification_state`, `is_verified`, `last_verified_at` — still written by
  approveClaim / verifyLocation / suspendLocation / submitProviderClaim alongside the new
  profile_control_status fields. `is_verified` still displayed as a badge in ProviderProfile,
  ProviderCard, MatchResultCard, ProviderSearch (display only; UI switch to
  profile_control_status is the next UI task).
- `src/lib/intake.js` — legacy intake config; only LEGACY_CATEGORY_MAP is used by RequestFlow
  for old URL redirects. No entity access.

## Trust model source of truth
- Profile: `ProviderLocation.profile_control_status` (directory | claimed | verified | suspended)
  + `claim_verification_status` (none | pending | approved | rejected).
- Services: `LocationService.confirmation_level`, `service_need_level`, `matching_allowed`.
- Central eligibility function: `evaluateEligibility()` in `base44/functions/matchProviders/entry.ts`
  (backend functions cannot import local modules; submitProviderClaim inlines the same
  service-need-level catalog — keep both in sync when the catalog changes).

## Conservative migration applied (see completion report for counts)
- verification_state=verified → profile_control_status=verified, claim_verification_status=approved.
- verification_state=in_verification → directory + pending.
- verification_state=unclaimed → directory + none.
- Legacy conflicts (e.g. unclaimed+is_verified) → directory + migration_review_required=true
  (unless a clearly approved ProviderClaimRequest is linked); never Top-3 eligible until reviewed.
- LocationService: all rows re-leveled from the catalog; NO service was granted
  provider_confirmed/vezunde_verified or matching_allowed=true by migration (no source evidence
  exists in current data). Unknown service keys → general + not_confirmed + matching_allowed=false
  + migration_review_required=true.