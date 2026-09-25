export function organizationInboxDataFor(data, organizationId) {
  return data?.organization_id === organizationId ? data : null;
}

export function canShowOrganizationInbox({ isOrganizationOwner, organizationId, locations }) {
  return Boolean(isOrganizationOwner && organizationId && Array.isArray(locations) && locations.length > 1);
}

export function locationPlanLabel(entitlementsByLocation, locationId) {
  return entitlementsByLocation?.[locationId]?.plan_code === "pro" ? "Pro" : "Free";
}

export function mergeFocusedLead(leads, targetLead) {
  const listed = Array.isArray(leads) ? leads : [];
  return targetLead && !listed.some((lead) => lead.id === targetLead.id)
    ? [targetLead, ...listed]
    : listed;
}

export function groupOrganizationLeads(leads) {
  const groups = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const key = lead.group_key || lead.id;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, leads: [] });
    groups.get(key).leads.push(lead);
  }
  return [...groups.values()];
}

export function organizationLeadTarget(lead) {
  if (!lead?.id || !lead?.location_id) return null;
  return {
    leadId: lead.id,
    locationId: lead.location_id,
    history: lead.is_historical === true,
  };
}
