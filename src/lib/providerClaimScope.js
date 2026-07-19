export const CLAIM_SCOPE = Object.freeze({
  LOCATION: "location",
  SELECTED_LOCATIONS: "selected_locations",
  ORGANIZATION: "organization",
});

export const CLAIM_SCOPE_LABELS = Object.freeze({
  location: "O singura locatie",
  selected_locations: "Mai multe locatii selectate",
  organization: "Organizatia si locatiile confirmate",
});

export const CLAIM_SCOPE_DESCRIPTIONS = Object.freeze({
  location: "Acces doar la profilul locatiei selectate.",
  selected_locations: "Acces separat la locatiile pe care le confirmi.",
  organization: "Administrarea organizatiei, limitata la locatiile confirmate si aprobate.",
});

export function isOrganizationRelationship(relationship) {
  return ["owner", "organization_representative"].includes(String(relationship || ""));
}

export function requestedRoleForClaimScope(relationship, claimScope) {
  if (claimScope === CLAIM_SCOPE.ORGANIZATION && isOrganizationRelationship(relationship)) return "organization_owner";
  if (relationship === "authorized_staff") return "location_staff";
  return "location_manager";
}

export function normalizeClaimScopeDraft(draft = {}, primaryLocationId = "") {
  const requested = [...new Set((Array.isArray(draft.requested_location_ids) ? draft.requested_location_ids : []).filter(Boolean))];
  if (primaryLocationId && !requested.includes(primaryLocationId)) requested.unshift(primaryLocationId);
  return {
    claim_scope: draft.claim_scope || CLAIM_SCOPE.LOCATION,
    requested_location_ids: requested.length > 0 ? requested : (primaryLocationId ? [primaryLocationId] : []),
    excluded_location_ids: [...new Set((Array.isArray(draft.excluded_location_ids) ? draft.excluded_location_ids : []).filter(Boolean))],
    reported_missing_location: String(draft.reported_missing_location || ""),
  };
}

export function scopeDraftForChoice(choice, options, current = {}) {
  const candidates = options?.candidate_locations || [];
  const primaryLocationId = options?.primary_location_id || candidates[0]?.id || "";
  if (choice === CLAIM_SCOPE.ORGANIZATION) {
    return {
      claim_scope: choice,
      requested_location_ids: candidates.filter((item) => !item.already_has_access).map((item) => item.id),
      excluded_location_ids: candidates.filter((item) => item.already_has_access).map((item) => item.id),
      reported_missing_location: current.reported_missing_location || "",
    };
  }
  if (choice === CLAIM_SCOPE.SELECTED_LOCATIONS) {
    const allowed = new Set(candidates.filter((item) => !item.already_has_access).map((item) => item.id));
    const selected = (current.requested_location_ids || []).filter((id) => allowed.has(id));
    if (primaryLocationId && allowed.has(primaryLocationId) && !selected.includes(primaryLocationId)) selected.unshift(primaryLocationId);
    return {
      claim_scope: choice,
      requested_location_ids: selected,
      excluded_location_ids: candidates.map((item) => item.id).filter((id) => !selected.includes(id)),
      reported_missing_location: current.reported_missing_location || "",
    };
  }
  return {
    claim_scope: CLAIM_SCOPE.LOCATION,
    requested_location_ids: primaryLocationId ? [primaryLocationId] : [],
    excluded_location_ids: candidates.map((item) => item.id).filter((id) => id !== primaryLocationId),
    reported_missing_location: current.reported_missing_location || "",
  };
}

export function validateClaimScopeDraft(draft, options) {
  const normalized = normalizeClaimScopeDraft(draft, options?.primary_location_id || "");
  if (normalized.requested_location_ids.length === 0) return "Selecteaza cel putin o locatie.";
  if (normalized.claim_scope === CLAIM_SCOPE.SELECTED_LOCATIONS && normalized.requested_location_ids.length < 2) {
    return "Selecteaza cel putin doua locatii.";
  }
  if (normalized.claim_scope === CLAIM_SCOPE.ORGANIZATION) {
    const candidateIds = new Set((options?.candidate_locations || []).map((item) => item.id));
    const accounted = new Set([...normalized.requested_location_ids, ...normalized.excluded_location_ids]);
    if ([...candidateIds].some((id) => !accounted.has(id))) return "Confirma fiecare locatie a organizatiei.";
  }
  return "";
}
