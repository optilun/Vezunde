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

export function providerLocationModuleUrl(locationId, moduleKey) {
  return `/contul-meu/locatii/${encodeURIComponent(locationId)}/${encodeURIComponent(moduleKey)}`;
}
