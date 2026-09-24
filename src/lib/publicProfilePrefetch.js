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
// recenta (PROFILE_PREFETCH_FRESH_MS), altfel pagina cere din nou, ca inainte.
//
// Clientul Base44 se incarca la nevoie (import dinamic), ca pe celelalte pagini sa nu fie adus
// in codul principal.

export const PROFILE_PREFETCH_FRESH_MS = 30 * 1000;
const PROFILE_PATH = /^\/furnizor\/([^/?#]+)\/?$/;

function cleanId(value) {
  return String(value || "").trim();
}

/** Id-ul profilului din adresa paginii, sau "" daca adresa nu este un profil. */
export function profileIdFromPath(pathname) {
  const match = PROFILE_PATH.exec(String(pathname || ""));
  if (!match) return "";
  try { return cleanId(decodeURIComponent(match[1])); } catch (_error) { return ""; }
}

export function createPublicProfileLoader({ invoke, now = () => Date.now(), freshMs = PROFILE_PREFETCH_FRESH_MS }) {
  const profiles = new Map();
  const brands = new Map();

  function remember(cache, key, start) {
    const entry = { promise: Promise.resolve().then(start), at: now() };
    entry.promise.catch(() => {
      if (cache.get(key) === entry) cache.delete(key);
    });
    cache.set(key, entry);
    return entry.promise;
  }

  function take(cache, key, start) {
    const entry = cache.get(key);
    cache.delete(key);
    if (entry && now() - entry.at < freshMs) return entry.promise;
    return start();
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

  function prefetchPublicProviderProfile(id) {
    const key = cleanId(id);
    if (!key || profiles.has(key)) return;
    startBrandWhenProfileArrives(remember(profiles, key, () => invoke("getPublicProviderProfile", { location_id: key })));
  }

  return {
    prefetchPublicProviderProfile,
    prefetchProfileForPath(pathname) {
      const id = profileIdFromPath(pathname);
      if (id) prefetchPublicProviderProfile(id);
    },
    /** Acelasi raspuns ca `base44.functions.invoke("getPublicProviderProfile", { location_id })`. */
    loadPublicProviderProfile(id) {
      const key = cleanId(id);
      const promise = take(profiles, key, () => invoke("getPublicProviderProfile", { location_id: key }));
      startBrandWhenProfileArrives(promise);
      return promise;
    },
    /** Acelasi raspuns ca `base44.functions.invoke("getPublicOrganizationBrand", { location_id })`. */
    loadPublicOrganizationBrand(locationId) {
      const key = cleanId(locationId);
      return take(brands, key, () => invoke("getPublicOrganizationBrand", { location_id: key }));
    },
  };
}

async function invokeBase44(name, payload) {
  const { base44 } = await import("@/api/base44Client");
  return base44.functions.invoke(name, payload);
}

const loader = createPublicProfileLoader({ invoke: invokeBase44 });

export const loadPublicProviderProfile = loader.loadPublicProviderProfile;
export const loadPublicOrganizationBrand = loader.loadPublicOrganizationBrand;

/** Apelat o data, la pornirea aplicatiei: daca adresa este un profil, porneste cererea. */
export function prefetchProfileForCurrentUrl() {
  if (typeof window === "undefined") return;
  loader.prefetchProfileForPath(window.location.pathname);
}
