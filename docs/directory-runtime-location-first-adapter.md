# Directory runtime location-first adapter

The directory import runtime currently bundles an older copy of the shared normalizer in Base44 even when the repository sandbox contains the newer location-first contract.

The runtime adapter reconciles finalized snapshot rows directly from the immutable raw payload:

- preserves explicit `provider_type`, `provider_profile_type`, `location_type_code`, and `care_setting_code`;
- preserves explicit `organization_type_code` separately;
- marks the normalized payload with `viasee-directory-location-first-v1`;
- blocks invalid explicit types fail-closed;
- leaves imports, publishing, matching, ranking, services, and controlled profiles unchanged.

The adapter runs only after `finalize_snapshot`. It does not generate a batch or execute an import.
