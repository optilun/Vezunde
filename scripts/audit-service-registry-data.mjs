import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  AMBIGUOUS_LEGACY_SERVICE_KEYS,
  LEGACY_SERVICE_ALIASES,
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from "../shared/canonicalServiceRegistry.js";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Utilizare: node scripts/audit-service-registry-data.mjs <snapshot.json>");
  process.exit(2);
}

const raw = JSON.parse(await readFile(inputPath, "utf8"));
const locationServices = Array.isArray(raw.locationServices)
  ? raw.locationServices
  : Array.isArray(raw.LocationService)
    ? raw.LocationService
    : [];
const submissions = Array.isArray(raw.submissions)
  ? raw.submissions
  : Array.isArray(raw.ProviderWorkspaceSubmission)
    ? raw.ProviderWorkspaceSubmission
    : [];

function ref(value) {
  return createHash("sha256").update(String(value || "missing")).digest("hex").slice(0, 12);
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

const byStatus = { canonical: 0, legacy_mapped: 0, legacy_ambiguous: 0, unknown: 0 };
const byConfirmation = {};
const byKey = {};
const duplicates = [];
const proposedActions = [];
const medicalProviderConfirmed = [];
const seenPairs = new Map();

for (const row of locationServices) {
  const rawKey = String(row.service_key || row.key || "").trim();
  const locationId = row.location_id || row.locationId || "";
  const normalized = normalizeServiceKey(rawKey);
  increment(byStatus, normalized.status);
  increment(byConfirmation, row.confirmation_level || "not_confirmed");
  increment(byKey, rawKey || "<empty>");

  const pair = `${locationId}:${rawKey}`;
  if (seenPairs.has(pair)) {
    duplicates.push({ location_ref: ref(locationId), raw_key: rawKey, count: seenPairs.get(pair) + 1 });
  }
  seenPairs.set(pair, (seenPairs.get(pair) || 0) + 1);

  if (normalized.status === "legacy_mapped") {
    proposedActions.push({
      location_ref: ref(locationId),
      legacy_key: rawKey,
      canonical_key: normalized.canonicalKey,
      action: "review_then_remap_without_changing_confirmation",
      conflict: locationServices.some((candidate) => (
        String(candidate.location_id || candidate.locationId || "") === String(locationId)
        && String(candidate.service_key || candidate.key || "").trim() === normalized.canonicalKey
      )),
    });
  } else if (normalized.status === "legacy_ambiguous") {
    proposedActions.push({
      location_ref: ref(locationId),
      legacy_key: rawKey,
      canonical_key: null,
      action: "manual_review_required",
      reason: "ambiguous_alias",
    });
  } else if (normalized.status === "unknown") {
    proposedActions.push({
      location_ref: ref(locationId),
      legacy_key: rawKey,
      canonical_key: null,
      action: "manual_review_required",
      reason: "unknown_key",
    });
  }

  const definition = getCanonicalServiceDefinition(rawKey);
  if (
    definition?.requires_review
    && row.is_active !== false
    && row.confirmation_level === "provider_confirmed"
  ) {
    medicalProviderConfirmed.push({ location_ref: ref(locationId), service_key: definition.key });
  }
}

const activeServiceSubmissions = [];
const submissionPayloadIssues = [];
for (const submission of submissions) {
  if (submission.section !== "services") continue;
  if (["draft", "pending_review", "needs_more_info"].includes(submission.status)) {
    activeServiceSubmissions.push({
      submission_ref: ref(submission.id),
      location_ref: ref(submission.location_id),
      status: submission.status,
    });
  }
  let payload = {};
  try { payload = JSON.parse(submission.payload_json || "{}"); } catch {
    submissionPayloadIssues.push({ submission_ref: ref(submission.id), issue: "invalid_json" });
    continue;
  }
  for (const [field, groups] of Object.entries({
    selected_ids: payload.selected_ids || {},
    removal_ids: payload.removal_ids || {},
  })) {
    for (const [group, keys] of Object.entries(groups || {})) {
      for (const rawKey of Array.isArray(keys) ? keys : []) {
        const normalized = normalizeServiceKey(rawKey);
        if (normalized.status !== "canonical") {
          submissionPayloadIssues.push({
            submission_ref: ref(submission.id),
            field,
            group,
            raw_key: rawKey,
            status: normalized.status,
          });
        }
      }
    }
  }
  for (const rawKey of Array.isArray(payload.raw_removal_keys) ? payload.raw_removal_keys : []) {
    const normalized = normalizeServiceKey(rawKey);
    if (normalized.status === "canonical") {
      submissionPayloadIssues.push({
        submission_ref: ref(submission.id),
        field: "raw_removal_keys",
        raw_key: rawKey,
        issue: "canonical_key_in_raw_removal_field",
      });
    }
  }
}

const report = {
  mode: "read_only_dry_run",
  writes_performed: 0,
  totals: {
    location_services: locationServices.length,
    submissions: submissions.length,
    active_service_submissions: activeServiceSubmissions.length,
  },
  classification: byStatus,
  confirmation_levels: byConfirmation,
  key_counts: byKey,
  duplicate_pairs: duplicates,
  medical_provider_confirmed: medicalProviderConfirmed,
  active_service_submissions: activeServiceSubmissions,
  submission_payload_issues: submissionPayloadIssues,
  proposed_migration_actions: proposedActions,
  registry: {
    deterministic_legacy_aliases: Object.keys(LEGACY_SERVICE_ALIASES).length,
    ambiguous_legacy_aliases: AMBIGUOUS_LEGACY_SERVICE_KEYS,
  },
};

console.log(JSON.stringify(report, null, 2));
