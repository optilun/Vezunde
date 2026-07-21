const ROLE_PRIORITY = ["organization_owner", "organization_admin", "location_manager", "location_staff"];

function highestRole(memberships = []) {
  const roles = memberships.map((membership) => membership?.role).filter(Boolean);
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || "";
}

export function resolveProviderLocationAccess(context, locationId) {
  if (!context || !locationId) return { role: "", capabilities: [] };

  const location = (context.locations || []).find((item) => item?.id === locationId) || null;
  const memberships = (context.memberships || []).filter((membership) => membership?.location_id === locationId);
  const capabilities = new Set();

  for (const capability of location?.capabilities || []) capabilities.add(capability);
  for (const membership of memberships) {
    for (const capability of membership?.capabilities || []) capabilities.add(capability);
  }

  return {
    role: location?.current_user_role || highestRole(memberships),
    capabilities: [...capabilities],
  };
}
