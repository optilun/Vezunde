// Ephemeral, tab-local navigation context. Never put free-text needs in URLs or analytics.
const KEY = "viasee.search.session.v1";
const TTL = 30 * 60 * 1000;
export function readSearchSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return saved && Date.now() - saved.savedAt < TTL ? saved : {};
  } catch { return {}; }
}
export function writeSearchSession(patch) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...readSearchSession(), ...patch, savedAt: Date.now() })); } catch { /* Storage is optional. */ }
}
