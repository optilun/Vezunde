export function shouldRedirectProviderRoute({
  denied,
  accessMetaLoading,
  accessMetaResolved,
  accessMetaMatchesOrganization,
  accessMetaError,
}) {
  return Boolean(
    denied
    && !accessMetaLoading
    && accessMetaResolved
    && accessMetaMatchesOrganization
    && !accessMetaError,
  );
}

export function providerSectionUrl(searchParams, sectionKey) {
  const next = new URLSearchParams(searchParams);
  next.set("s", sectionKey);
  next.delete("ps");
  return `/contul-meu?${next.toString()}`;
}

// 2026-10-02. Cand URL-ul are deja organizatia sau locatia (ex. venind din /dupa-login),
// alegerea din comutator le actualizeaza, altfel parametrul vechi ar readuce alegerea veche.
// Intoarce "" cand URL-ul nu are niciunul dintre ei (nu e nimic de sincronizat).
export function providerSelectionUrl(searchParams, { organizationId = "", locationId = "" } = {}) {
  const current = new URLSearchParams(searchParams);
  if (!current.has("organization") && !current.has("location")) return "";
  if (organizationId) current.set("organization", organizationId);
  else current.delete("organization");
  if (locationId) current.set("location", locationId);
  else current.delete("location");
  return `/contul-meu?${current.toString()}`;
}

export function providerLocationModuleUrl(locationId, moduleKey) {
  return `/contul-meu/locatii/${encodeURIComponent(locationId)}/${encodeURIComponent(moduleKey)}`;
}
