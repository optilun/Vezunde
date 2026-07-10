# Vezunde — Services registry foundation (Stage 1)

## Scope

This stage centralizes the 94 canonical service keys and aligns the provider configurator, provider submissions, admin review, directory operations, public profile and matching.

It intentionally does **not**:

- deploy to Base44;
- mutate remote data;
- execute a legacy-key migration;
- add a hospital provider enum;
- implement the complete specialist/equipment/infrastructure validator;
- create the future B2B catalog;
- redesign the complete Services workspace.

## Canonical registry

The source of truth is:

```text
shared/canonicalServiceRegistry.js
```

Frontend code re-exports it through `src/lib/canonicalServiceCatalog.js`. Base44 functions import the same source directly. Consumer-specific arrays must be derived from the registry rather than extended by mutation.

The registry is intentionally not frozen. Helpers return defensive copies, allowing adapters to create local maps without mutating the source object. This prevents the previous failure where a submit adapter attempted to extend an object after `Object.freeze`.

## Legacy handling

Deterministic aliases are normalized for reads and matching. Ambiguous aliases remain fail-closed and require manual review.

Unknown and legacy rows are returned by `getProviderLocationServices` and displayed in the provider workspace under **Servicii existente de migrat**. A provider may request exact-key deactivation through `raw_removal_keys`; this never creates or remaps a service.

No unknown key is automatically published or included in matching.

## Verification

Run:

```bash
npm ci
npm run test:services
npm run typecheck
npm run lint
npm run build
```

Expected registry output:

```text
Canonical keys: 94
directoryOps recognized: 94
admin review recognized: 94
presentation recognized: 94
public profile classified: 94
matching classified: 94
Service registry parity: PASS
```

## Read-only snapshot audit

Export remote records read-only into a JSON file with either of these shapes:

```json
{
  "locationServices": [],
  "submissions": []
}
```

or:

```json
{
  "LocationService": [],
  "ProviderWorkspaceSubmission": []
}
```

Then run:

```bash
npm run audit:services -- ./snapshot.json > ./service-audit-report.json
```

The script:

- performs no network calls;
- performs no writes;
- hashes location and submission identifiers in the report;
- counts canonical, mapped legacy, ambiguous and unknown keys;
- detects duplicate `location + key` pairs;
- identifies active medical services with `provider_confirmed`;
- lists proposed migration actions as a dry-run only.

## Migration rules

A future migration must be:

1. preceded by a remote read-only snapshot;
2. idempotent;
3. executed in a small batch first;
4. non-destructive;
5. audited before and after;
6. prohibited from upgrading medical confirmation levels;
7. prohibited from enabling matching implicitly.

When a deterministic legacy key and its canonical key already coexist at the same location, the migration must report a conflict rather than merge automatically.

## Remaining prerequisites for Stage 2

- executable specialist validation per service;
- equipment and clinical infrastructure validation;
- revalidation when a dependency is removed;
- explicit owner/manager/staff write policy;
- lifecycle for custom service suggestions;
- separate B2B taxonomy and channel;
- decision on professional-only public profiles;
- medical/legal approval of the service-requirement matrix;
- remote snapshot and migration dry-run review.
