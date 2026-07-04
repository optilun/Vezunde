# Geography Contract (Modules 3F.2 – 3F.2.3)

Canonical geography source: **GeographicLocality** (SIRUTA, 16.978 records, admin-only RLS).
`GeographicImportRun` records import provenance. Both are read publicly ONLY through
the whitelisted `searchGeographicLocalities` function — never via direct entity reads.

## Invariants (must never be reintroduced/broken)

1. **No automatic geographic fallback in `matchProviders`** — no county, national or
   "nearby" expansion. Zero local results return `coverage_status: "no_local_results"`;
   any expansion requires a future explicit patient action.
2. **No coordinates in public matching/ranking** — no haversine, lat/lng or place_id
   logic in `matchProviders` or any public results. lat/lng/place_id exist on
   ProviderLocation only as protected onboarding compatibility fields.
3. **city/county are never canonical geography** — every ProviderLocation creation or
   geographic edit requires a validated `locality_siruta_code` (active GeographicLocality);
   `locality_name`, `county_code`, `county_name`, `uat_code`, `uat_name` and the
   `city`/`county` compatibility mirrors are derived server-side ONLY from that record.
   Client-submitted city/county/county_name values never override canonical geography.
4. **Google-derived values are never canonical geography** — place_id/lat/lng/city text
   from Google can prefill drafts but cannot bypass canonical locality selection.
5. **No public direct reads of GeographicLocality / GeographicImportRun** — RLS keeps
   both admin-only; public access exists only through `searchGeographicLocalities`.
6. **No new `?oras=` links** — reading `?oras=` in `src/pages/Search.jsx` is a
   deprecated legacy fallback for old links only. New navigation/state must use
   `locality_siruta_code`. Never infer or save a SIRUTA code from arbitrary URL text.

## Regression checks

In-app, admin-only: **Operatiuni director → tab "Contract geografic"** runs the
regression suite (`src/components/admin/directory/GeoContractChecks.jsx`) against
the live backend functions. It exercises only rejection/empty paths — it creates
NO records — and shows pass/fail for each runtime-verifiable invariant above.
All checks must pass before shipping changes to `matchProviders`,
`submitProviderClaim`, `directoryOps` or `updateProviderLocation`.
Invariants 5 and 6 (RLS on geographic entities; no new `?oras=` links) are
enforced by schema RLS and code review against this document.