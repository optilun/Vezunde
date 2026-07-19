export function buildProviderContextSearch(currentSearch, { organizationId = "", locationId = "" } = {}) {
  const next = new URLSearchParams(currentSearch || "");
  next.set("mode", "provider");

  if (organizationId) next.set("organization", organizationId);
  else next.delete("organization");

  if (locationId) next.set("location", locationId);
  else next.delete("location");

  return next.toString();
}
