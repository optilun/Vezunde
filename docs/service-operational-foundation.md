# Vezunde Services — operational foundation

## Model

The provider configuration follows this order:

1. provider/location profile;
2. physical functional units;
3. operational capabilities attached to a unit;
4. professionals, equipment and facilities attached to a unit;
5. products, services, investigations, specialties and procedures performed in that unit;
6. patient-facing need filters or the separate B2B channel.

A capability is not a room. Contact-lens fitting, pediatric care, medical expertise and B2B logistics are capabilities. Cabinets, workshops, laboratories, diagnostic areas, procedure rooms and surgical units are physical units.

## Required Base44 schema

### `LocationFunctionalUnit`

- `location_id`: string, required
- `unit_key`: enum from `FUNCTIONAL_UNIT_KEYS`, required
- `care_setting`: enum from `CARE_SETTING_KEYS`
- `note`: string
- `status`: `declared | pending_review | verified | needs_more_info | rejected | inactive`
- `confirmation_level`: `declared | provider_confirmed | vezunde_verified`
- `source`: string
- `is_active`: boolean
- `reviewed_by`: string
- `reviewed_at`: datetime

Unique logical key: `location_id + unit_key`.

### `LocationCapability`

- `location_id`: string, required
- `capability_key`: enum from `CAPABILITY_KEYS`, required
- `parent_unit_key`: enum from `FUNCTIONAL_UNIT_KEYS`, required
- `note`: string
- `status`: same lifecycle as a functional unit
- `confirmation_level`: same levels
- `source`: string
- `is_active`: boolean
- `reviewed_by`: string
- `reviewed_at`: datetime

Unique logical key: `location_id + capability_key + parent_unit_key`.

### `ServiceCatalogSuggestion`

- `location_id`
- `submission_id`
- `proposed_label`
- `proposed_group`
- `proposed_unit_key`
- `proposed_capability_key`
- `provider_note`
- `status`: `pending_catalog_review | mapped_to_canonical | rejected | needs_more_info | archived`
- `canonical_service_key`
- `admin_note`
- `submitted_by_user_id`
- `reviewed_by_user_id`
- `reviewed_at`

### Existing entities

`ProviderLocation`
- add optional `care_setting`.

`LocationService`
- add optional `functional_unit_key`;
- add optional `capability_key`.

`LocationEquipment`
- add optional `functional_unit_key`;
- expand `equipment_category_key` with every key used by the canonical prerequisite registry.

`LocationFacility`
- add optional `functional_unit_key`;
- expand `facility_key` with optical workshop/laboratory, procedure-room and surgical infrastructure keys.

`ProfessionalLocationAssignment`
- add optional `functional_unit_keys: string[]`.

All new fields are optional during migration. Existing rows remain valid and use the legacy location-wide prerequisite fallback until units are persisted.

## Safe rollout

1. Deploy schemas and functions without migrating existing services.
2. Deploy provider/admin UI.
3. Existing locations load inferred units from profile and selected services.
4. The first approved full configuration persists units, capabilities and resource links.
5. From that point, prerequisite checks use strict unit scope.
6. No unknown or legacy service is deleted automatically.
7. B2B keys are never exposed in patient public profiles or patient matching.

## Manual test profiles

- independent optical store;
- optical chain location;
- independent optometrist;
- independent optician;
- ophthalmology office;
- independent ophthalmologist;
- ophthalmology clinic;
- optical laboratory B2C;
- optical laboratory B2B;
- B2B distributor.

For every profile test selection, draft reload, resource assignment, submit, admin review, public output, matching exclusion/inclusion and mobile layout.
