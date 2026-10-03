export const CLAIMANT_RELATIONSHIPS = {
  owner: "Proprietar sau reprezentant legal",
  organization_representative: "Reprezentant autorizat al organizației",
  location_manager: "Manager al locației",
  authorized_staff: "Angajat cu acordul organizației",
};

export const REQUESTED_ROLE_BY_RELATIONSHIP = {
  owner: "organization_owner",
  organization_representative: "organization_owner",
  location_manager: "location_manager",
  authorized_staff: "location_staff",
};

export const LOCATION_REQUESTED_ROLE_BY_RELATIONSHIP = {
  owner: "location_manager",
  organization_representative: "location_manager",
  location_manager: "location_manager",
  authorized_staff: "location_staff",
};

export const REQUESTED_ROLE_LABELS = {
  organization_owner: "Owner organizație",
  location_manager: "Manager locație",
  location_staff: "Membru locație",
};

export function requestedRoleForRelationship(relationship) {
  return REQUESTED_ROLE_BY_RELATIONSHIP[relationship] || "location_staff";
}

export function requestedLocationRoleForRelationship(relationship) {
  return LOCATION_REQUESTED_ROLE_BY_RELATIONSHIP[relationship] || "location_staff";
}

export function requestedRoleForClaimScope(relationship, claimScope) {
  if (claimScope === "organization" && ["owner", "organization_representative"].includes(relationship)) {
    return "organization_owner";
  }
  return requestedLocationRoleForRelationship(relationship);
}
