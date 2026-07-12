const STORAGE_PREFIX = "viasee.account.preferences";
const START_MODES = new Set(["last", "personal", "provider", "professional"]);
const RUNTIME_MODES = new Set(["personal", "provider", "professional", "applicant"]);
const PROVIDER_LOCATION_MODES = new Set(["last", "fixed"]);

const DEFAULT_PREFERENCES = Object.freeze({
  startMode: "last",
  rememberLastLocation: true,
  providerLocationMode: "last",
  fixedProviderLocationId: "",
  lastMode: "",
  lastProviderLocationId: "",
});

function storageKey(userId) {
  return `${STORAGE_PREFIX}.${String(userId || "anonymous")}`;
}

function normalize(value = {}) {
  const legacyRememberLastLocation = value.rememberLastLocation !== false;
  const providerLocationMode = PROVIDER_LOCATION_MODES.has(value.providerLocationMode)
    ? value.providerLocationMode
    : legacyRememberLastLocation
      ? "last"
      : "fixed";

  return {
    startMode: START_MODES.has(value.startMode) ? value.startMode : DEFAULT_PREFERENCES.startMode,
    rememberLastLocation: providerLocationMode === "last",
    providerLocationMode,
    fixedProviderLocationId: String(value.fixedProviderLocationId || (!legacyRememberLastLocation ? value.lastProviderLocationId : "") || "").trim(),
    lastMode: RUNTIME_MODES.has(value.lastMode) ? value.lastMode : "",
    lastProviderLocationId: String(value.lastProviderLocationId || "").trim(),
  };
}

export function readAccountPreferences(userId) {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? normalize(JSON.parse(raw)) : { ...DEFAULT_PREFERENCES };
  } catch (_error) {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveAccountPreferences(userId, updates = {}) {
  const next = normalize({ ...readAccountPreferences(userId), ...updates });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch (_error) {
      // The settings remain usable for the current render even if storage is unavailable.
    }
  }
  return next;
}

export function rememberAccountMode(userId, mode) {
  if (!RUNTIME_MODES.has(mode)) return readAccountPreferences(userId);
  return saveAccountPreferences(userId, { lastMode: mode });
}

export function rememberProviderLocation(userId, locationId) {
  const current = readAccountPreferences(userId);
  if (current.providerLocationMode !== "last") return current;
  return saveAccountPreferences(userId, { lastProviderLocationId: String(locationId || "").trim() });
}
