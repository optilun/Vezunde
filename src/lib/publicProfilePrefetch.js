// Datele profilului public (/furnizor/:id), cerute cat mai devreme.
//
// 2026-09-24. Pe telefon, titlul profilului aparea la 3,6-3,9 s, pentru ca cererile se faceau pe rand:
// codul principal -> codul paginii de profil -> abia apoi `getPublicProviderProfile` (~470 ms) ->
// dupa afisare, `getPublicOrganizationBrand` (~310 ms, doar la profilurile revendicate/verificate).
// Acum:
// - la o intrare directa pe /furnizor/:id (din Google, dintr-un link), cererea profilului porneste
//   odata cu codul principal, in paralel cu descarcarea codului paginii;
// - cererea brandului porneste in clipa in care sosesc datele profilului, nu dupa afisare; tot doar
//   pentru profilurile care nu sunt „directory”, ca pana acum (nicio cerere in plus pentru ele).
// Raspunsurile sunt aceleasi; o cerere pornita devreme se foloseste o singura data si doar daca e
// recenta (FRESH_MS), altfel pagina cere din nou, ca inainte.
//
// Clientul Base44 se incarca la nevoie (import dinamic), ca pe celelalte pagini sa nu fie adus
// in codul principal.

const FRESH_MS = 30 * 1000;
const PROFILE_PATH = /^\/furnizor\/([^/?#]+)\/?$/;

const profiles = new Map();
const brands = new Map();

async function invoke(name, payload) {
  const { base44 } = await import("@/api/base44Client");
  return base44.functions.invoke(name, payload);
}

function remember(cache, key, start) {
  const entry = { promise: start(), at: Date.now() };
  entry.promise.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  cache.set(key, entry);
  return entry.promise;
}

function take(cache, key, start) {
  const entry = cache.get(key);
  cache.delete(key);
  if (entry && Date.now() - entry.at < FRESH_MS) return entry.promise;
  return start();
}

function cleanId(value) {
  return String(value || "").trim();
}

// Brandul se cere cand se stie ca profilul nu este „directory” (aceeasi regula ca in
// ProviderLocationHero), imediat ce sosesc datele profilului.
function startBrandWhenProfileArrives(profilePromise) {
  profilePromise.then((response) => {
    const profile = response?.data?.profile;
    const locationId = cleanId(profile?.id);
    if (!locationId || profile.profile_control_status === "directory" || brands.has(locationId)) return;
    remember(brands, locationId, () => invoke("getPublicOrganizationBrand", { location_id: locationId }));
  }).catch(() => {});
}

export function prefetchPublicProviderProfile(id) {
  const key = cleanId(id);
  if (!key || profiles.has(key)) return;
  startBrandWhenProfileArrives(remember(profiles, key, () => invoke("getPublicProviderProfile", { location_id: key })));
}

/** Apelat o data, la pornirea aplicatiei: daca adresa este un profil, porneste cererea. */
export function prefetchProfileForCurrentUrl() {
  if (typeof window === "undefined") return;
  const match = PROFILE_PATH.exec(window.location.pathname);
  if (!match) return;
  let id = match[1];
  try { id = decodeURIComponent(id); } catch (_error) { return; }
  prefetchPublicProviderProfile(id);
}

/** Acelasi raspuns ca `base44.functions.invoke("getPublicProviderProfile", { location_id })`. */
export function loadPublicProviderProfile(id) {
  const key = cleanId(id);
  const promise = take(profiles, key, () => invoke("getPublicProviderProfile", { location_id: key }));
  startBrandWhenProfileArrives(promise);
  return promise;
}

/** Acelasi raspuns ca `base44.functions.invoke("getPublicOrganizationBrand", { location_id })`. */
export function loadPublicOrganizationBrand(locationId) {
  const key = cleanId(locationId);
  return take(brands, key, () => invoke("getPublicOrganizationBrand", { location_id: key }));
}
