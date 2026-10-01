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

// 2026-09-30. Camera hartii de pe /cauta tine de LOCALITATE, nu de filtre: schimbarea unui filtru sau
// a serviciului nu muta harta (ca pe Airbnb), iar revenirea de pe un profil o gaseste unde era.
export function localityCameraKey(sirutaCode) {
  return `local:${sirutaCode}`;
}

// Alegerea explicita a unei localitati incadreaza harta pe ea: pozitia salvata pentru aceeasi
// localitate (de unde a mutat-o vizitatorul intre timp) se uita.
export function forgetLocalityCamera(sirutaCode) {
  const maps = readSearchSession().maps || {};
  const key = localityCameraKey(sirutaCode);
  if (!(key in maps)) return;
  writeSearchSession({ maps: Object.fromEntries(Object.entries(maps).filter(([name]) => name !== key)) });
}

// „Caută în această zonă”: harta Romaniei se deschide exact unde e harta localitatii (aceeasi camera),
// cu selectia si ordinea de dinainte uitate. `view` este ce raporteaza harta: { bounds, camera }.
export function handOverCameraToNationalMap(view) {
  if (!view || !Array.isArray(view.bounds)) return false;
  const maps = readSearchSession().maps || {};
  writeSearchSession({
    maps: { ...maps, national: { signature: "", bounds: view.bounds, camera: view.camera } },
    national: {},
    nationalScroll: 0,
  });
  return true;
}

// 2026-09-29 (audit /cauta, E2). Pe telefon, harta Romaniei porneste pe harta (1.300 de locatii,
// lista alfabetica spune putin), iar o localitate porneste pe lista (cateva zeci de locatii, de
// comparat). Cand vizitatorul alege singur lista sau harta, alegerea lui se pastreaza pentru
// ambele vederi, in aceasta fila.
export function readMobileViewChoice(fallback) {
  const session = readSearchSession();
  const choice = session.mobileViewVersion === 2 ? session.mobileViewChoice : null;
  return choice === "map" || choice === "list" ? choice : fallback;
}
export function rememberMobileViewChoice(view) {
  if (view === "map" || view === "list") writeSearchSession({ mobileViewChoice: view, mobileViewVersion: 2 });
}
