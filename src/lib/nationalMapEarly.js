// 2026-09-28 (audit /cauta, B6). Harta Romaniei, ceruta cat mai devreme.
//
// Cand /cauta se deschide pe harta Romaniei (fara localitate in adresa si fara una aleasa in
// sesiunea din fila), fisierul static al hartii (shared/nationalMapSnapshot.js) si lista actuala se
// cer odata cu codul principal, nu abia dupa ce se descarca si porneste codul paginii.
// Ca la profilul public (publicProfilePrefetch.js): clientul Base44 se incarca la nevoie.

import { NATIONAL_MAP_SNAPSHOT_PATH, parseNationalMapSnapshot } from "../../shared/nationalMapSnapshot.js";

const SESSION_KEY = "viasee.search.session.v1";
const SESSION_TTL_MS = 30 * 60 * 1000;

let snapshotPromise = null;

/** /cauta se deschide pe harta Romaniei? (aceeasi regula ca in Search.jsx, aproximata la pornire) */
export function opensOnNationalMap(pathname, search, session, now = Date.now()) {
  if (pathname !== "/cauta") return false;
  const params = new URLSearchParams(search || "");
  if (params.get("siruta") || params.get("serviciu") || params.get("q")) return false;
  const fresh = session && now - Number(session.savedAt) < SESSION_TTL_MS;
  return !(fresh && session.locality?.siruta_code);
}

function readSession() {
  try { return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

/** Fisierul static (o singura descarcare pe pagina); null cand lipseste sau nu e folosibil. */
export function loadNationalMapSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch(NATIONAL_MAP_SNAPSHOT_PATH, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => parseNationalMapSnapshot(text))
      .catch(() => null);
  }
  return snapshotPromise;
}

export function startNationalMapEarly() {
  if (typeof window === "undefined") return;
  if (!opensOnNationalMap(window.location.pathname, window.location.search, readSession())) return;
  loadNationalMapSnapshot();
  import("./nationalDirectoryMap.js")
    .then((module) => module.loadNationalDirectoryMap())
    .catch(() => {});
}
