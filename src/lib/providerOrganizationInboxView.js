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
