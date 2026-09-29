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

// 2026-09-29 (audit /cauta, E2). Pe telefon, harta Romaniei porneste pe harta (1.300 de locatii,
// lista alfabetica spune putin), iar o localitate porneste pe lista (cateva zeci de locatii, de
// comparat). Cand vizitatorul alege singur lista sau harta, alegerea lui se pastreaza pentru
// ambele vederi, in aceasta fila.
export function readMobileViewChoice(fallback) {
  const choice = readSearchSession().mobileViewChoice;
  return choice === "map" || choice === "list" ? choice : fallback;
}
export function rememberMobileViewChoice(view) {
  if (view === "map" || view === "list") writeSearchSession({ mobileViewChoice: view });
}
