# Services prerequisite engine — Stage 2

This stage adds dynamic, fail-closed validation for service prerequisites.

## Scope implemented so far

- one shared prerequisite engine for specialist, equipment, infrastructure and profile compatibility;
- service-specific equipment requirements and group defaults;
- provider read model exposes prerequisite status, blockers and evidence;
- public profile dynamically excludes services whose prerequisites are no longer met;
- automated tests cover medical, technical, surgical and legacy scenarios.

## Safety rules

- unknown services remain blocked;
- medical equipment must be approved and `vezunde_verified`;
- a verified specialist must have an active assignment to the location;
- procedures and surgery require explicit infrastructure evidence;
- loss of specialist, equipment or infrastructure makes the service ineligible dynamically;
- no Base44 deploy and no remote data migration are part of this branch.

## Remaining Stage 2 work

- enforce the same prerequisite engine in admin submission approval;
- set medical verification only after prerequisite validation;
- enforce dynamic prerequisites in matching and directory browsing;
- expose prerequisite checklist in the admin review interface;
- add controlled equipment keys needed by advanced procedures;
- complete CI and manual review before merge.
