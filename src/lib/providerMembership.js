export const PROVIDER_MEMBERSHIP_ROLE_LABELS = {
  organization_owner: "Proprietar organizatie",
  location_manager: "Manager locatie",
  location_staff: "Membru echipa",
};

const LEGACY_ROLE_MAP = {
  owner: "organization_owner",
  staff: "location_staff",
};

const LEGACY_STATUS_MAP = {
  revoked: "inactive",
};

export const normalizeProviderMembershipRole = (role) => {
  const value = String(role || "").trim();
  const normalized = LEGACY_ROLE_MAP[value] || value;
  return PROVIDER_MEMBERSHIP_ROLE_LABELS[normalized] ? normalized : "";
};

export const normalizeProviderMembershipStatus = (status) => {
  const value = String(status || "").trim();
  const normalized = LEGACY_STATUS_MAP[value] || value;
  return normalized === "active" || normalized === "inactive" ? normalized : "inactive";
};

export const normalizeProviderMembership = (membership) => {
  if (!membership) return null;
  return {
    ...membership,
    role: normalizeProviderMembershipRole(membership.role),
    status: normalizeProviderMembershipStatus(membership.status),
  };
};

export const isActiveProviderMembership = (membership) => {
  const normalized = normalizeProviderMembership(membership);
  return !!normalized && normalized.status === "active" && !!normalized.role;
};

export const getProviderMembershipRoleLabel = (role) =>
  PROVIDER_MEMBERSHIP_ROLE_LABELS[normalizeProviderMembershipRole(role)] || "Rol furnizor";
