export const CLAIMANT_RELATIONSHIPS = {
  owner: "Proprietar sau reprezentant legal",
  organization_representative: "Reprezentant autorizat al organizatiei",
  location_manager: "Manager al locatiei",
  authorized_staff: "Angajat cu acordul organizatiei",
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
  organization_owner: "Owner organizatie",
  location_manager: "Manager locatie",
  location_staff: "Membru locatie",
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
