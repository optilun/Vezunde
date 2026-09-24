// Incarcarea hartii nationale in browser (pagina /cauta si harta din pagina de rezultate).
// Fara importuri, ca sa poata fi testata direct in Node (scripts/verify-national-map-cache.mjs).
//
// 2026-09-23. Cand serverul refuza temporar (limita de trafic Base44, 5xx, retea), pagina arata
// „Request failed with status code 500”. Acum:
// - reincearca singura de doua ori, dupa 1,5 s si 4 s, doar pentru erori trecatoare;
// - tine harta 5 minute in pagina, ca o intoarcere pe /cauta sau trecerea spre rezultate sa nu mai
//   ceara serverului aceleasi ~1.300 de puncte;
// - cererile simultane din aceeasi pagina asteapta acelasi raspuns;
// - vizitatorul vede un mesaj clar, nu textul tehnic al erorii.
// Nu schimba ce contine harta si nici ordinea punctelor.

export const NATIONAL_MAP_ERROR_MESSAGE = "Harta directorului nu s-a putut încărca acum. Încearcă din nou peste câteva secunde.";
export const NATIONAL_MAP_CLIENT_FRESH_MS = 5 * 60 * 1000;
export const NATIONAL_MAP_RETRY_DELAYS_MS = Object.freeze([1500, 4000]);

function statusOf(error) {
  const status = Number(error?.response?.status ?? error?.status);
  return Number.isFinite(status) && status > 0 ? status : null;
}

/** Erorile care merita o noua incercare: limita de trafic, erori de server, lipsa raspunsului. */
export function isRetryableMapError(error) {
  if (error?.retryable === false) return false;
  const status = statusOf(error);
  if (status === null) return true;
  return status === 408 || status === 429 || status >= 500;
}

export function createNationalMapLoader({
  invoke,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  freshMs = NATIONAL_MAP_CLIENT_FRESH_MS,
  retryDelaysMs = NATIONAL_MAP_RETRY_DELAYS_MS,
} = {}) {
  let cached = null;
  let inflight = null;

  async function fetchWithRetry() {
    let lastError = null;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const response = await invoke({ map_scope: "national" });
        const data = response?.data;
        if (!data || data.error || !Array.isArray(data.results)) {
          const error = new Error(data?.error || "directory unavailable");
          error.status = 503;
          throw error;
        }
        cached = { data, at: now() };
        return data;
      } catch (error) {
        lastError = error;
        if (!isRetryableMapError(error) || attempt === retryDelaysMs.length) break;
        await wait(retryDelaysMs[attempt]);
      }
    }
    throw lastError;
  }

  return function loadNationalMap({ force = false } = {}) {
    if (!force && cached && now() - cached.at < freshMs) return Promise.resolve(cached.data);
    if (!inflight) inflight = fetchWithRetry().finally(() => { inflight = null; });
    return inflight;
  };
}
