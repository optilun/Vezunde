# Services prerequisite engine — Stage 2

This stage adds dynamic, fail-closed validation for service prerequisites.

## Implemented scope

- one shared prerequisite engine for specialist, equipment, infrastructure and profile compatibility;
- service-specific equipment requirements plus safe group defaults;
- controlled equipment keys for optometry, investigations, procedures and surgery;
- provider read model exposes prerequisite status, blockers and evidence;
- provider workspace displays missing requirements and review-ready services;
- public profiles dynamically exclude services whose prerequisites are no longer met;
- directory browsing calculates public service coverage using the same prerequisite engine;
- matching excludes services when specialist, equipment or infrastructure requirements are not met;
- prerequisite-aware admin review blocks approval when requirements are missing;
- eligible medical services are promoted to `vezunde_verified` only after pre-approval and post-approval validation;
- admin UI displays a service-by-service checklist and disables approval while blockers exist;
- automated tests cover medical, optometric, technical, surgical, legacy and dynamic revalidation scenarios.

## Safety rules

- unknown and ambiguous services remain blocked;
- medical equipment must be approved and `vezunde_verified`;
- non-medical technical equipment may use `provider_confirmed` or `vezunde_verified`;
- a verified specialist must have an active assignment to the location;
- medical services require a verified location before approval;
- procedures and surgery require explicit infrastructure evidence;
- loss of specialist, equipment or infrastructure makes the service ineligible dynamically;
- approval dependencies are read again after the underlying submission is applied;
- a dependency change during approval prevents medical promotion and creates an audit record;
- no Base44 deploy and no remote data migration are part of this branch.

## Operational approval path

The provider submits through `submitProviderWorkspaceChange`.

Service submissions must be reviewed through `adminServicePrerequisiteReview`, which delegates the existing submission application to `adminWorkspaceReview` only after the prerequisite check passes. The admin interface uses this prerequisite-aware endpoint.

The original `adminWorkspaceReview` remains available for compatibility with non-service sections and trusted internal flows. It must not be used directly as the operational approval path for service submissions.

## Before merge

- CI must pass for registry parity, prerequisite tests, targeted typecheck, targeted lint and production build;
- review the PR diff for accidental scope expansion;
- keep the PR as draft until final verification;
- do not deploy Base44 or execute remote migrations from this branch.
