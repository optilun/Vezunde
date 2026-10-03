const KEY = "viasee.claim.search_selection";
const TTL_MS = 30 * 60 * 1000;

function sessionStorageOrNull() {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

// Only public search metadata is retained. This never submits a claim or grants access.
export function rememberClaimSearchSelection(selection, storage = sessionStorageOrNull(), now = Date.now()) {
  if (!storage) return;
  try {
    const organization = selection.selectedOrganization;
    const entry = {
      ...selection,
      selectedOrganization: organization ? {
        id: organization.id, name: organization.name, location_count: organization.location_count,
        cities: organization.cities || [],
      } : null,
    };
    storage.setItem(KEY, JSON.stringify({ at: now, entry }));
  } catch { /* Navigation still works when session storage is unavailable. */ }
}

export function readClaimSearchSelection(storage = sessionStorageOrNull(), now = Date.now()) {
  if (!storage) return null;
  try {
    const saved = JSON.parse(storage.getItem(KEY) || "null");
    if (!saved?.at || now < saved.at || now - saved.at > TTL_MS) return null;
    const entry = saved.entry;
    return entry?.selectedLocation?.id || entry?.startFlow === "new_location" ? entry : null;
  } catch { return null; }
}

export function clearClaimSearchSelection(storage = sessionStorageOrNull()) {
  try { storage?.removeItem(KEY); } catch { /* Best-effort draft cleanup. */ }
}
