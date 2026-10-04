// Randurile ProviderSubscription care dau planul unei locatii (structura conturilor, pasul 4).
//
// Din 2026-10-04 abonamentul se plateste pe organizatie: o locatie are Pro daca are ea insasi un
// rand (abonament vechi pe locatie sau Pro acordat manual) SAU daca organizatia ei are un abonament
// de organizatie activ. resolveProviderEntitlement (providerEntitlementPolicy.js) alege apoi randul
// activ, exact ca inainte.
function clean(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function loadProviderEntitlementRows(svc, { locationId = '', organizationId = '', location = null } = {}) {
  const resolvedLocationId = clean(locationId || location?.id);
  const rows = resolvedLocationId
    ? await svc.entities.ProviderSubscription.filter({ location_id: resolvedLocationId }, '-created_date', 100)
    : [];
  let resolvedOrganizationId = clean(organizationId || location?.organization_id);
  if (!resolvedOrganizationId && resolvedLocationId) {
    const loaded = await svc.entities.ProviderLocation.get(resolvedLocationId).catch(() => null);
    resolvedOrganizationId = clean(loaded?.organization_id);
  }
  if (resolvedOrganizationId) {
    const organizationRows = await svc.entities.ProviderSubscription.filter({
      organization_id: resolvedOrganizationId,
      subscription_scope: 'organization',
    }, '-created_date', 100).catch(() => []);
    for (const row of organizationRows) if (!rows.some((item) => item.id === row.id)) rows.push(row);
  }
  return rows;
}
