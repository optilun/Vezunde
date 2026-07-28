# Directory location-first runtime resync

This marker documents the controlled redeploy of `directoryOps` after the location-first classification contract was merged.

The data import remains disabled until a fresh immutable pilot snapshot proves that runtime normalization returns:

- `classification_contract_version: viasee-directory-location-first-v1`;
- `canonical_type_source: source_explicit` for explicit canonical rows;
- `organization_type_code` independently from `location_type_code`;
- Lensa and Novum as `optical_store` locations.

No data import, publication, matching, ranking, service creation, access grant, or schema change is performed by this resync.
