// Shared claimant relationship catalog used by onboarding, review and admin.
export const CLAIMANT_RELATIONSHIPS = {
  owner: "Sunt proprietar sau reprezentant legal",
  organization_representative: "Sunt reprezentant autorizat al organizatiei",
  location_manager: "Sunt managerul acestei locatii",
  authorized_staff: "Lucrez aici cu acordul organizatiei",
};

export const REQUESTED_ROLE_BY_RELATIONSHIP = {
  owner: "organization_owner",
  organization_representative: "organization_owner",
  location_manager: "location_manager",
  authorized_staff: "location_staff",
};

export const MEMBERSHIP_ROLE_LABELS = {
  organization_owner: "Owner organizatie",
  location_manager: "Manager locatie",
  location_staff: "Membru locatie",
};

export function requestedRoleForRelationship(relationship) {
  return REQUESTED_ROLE_BY_RELATIONSHIP[relationship] || "location_staff";
}
