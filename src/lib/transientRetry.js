// Reincercare pentru cererile paginilor publice de profil (locatie, organizatie, specialist).
// Fara importuri, ca sa poata fi testat direct in Node (scripts/verify-seo-profiles.mjs).
//
// 2026-09-27. Dupa trimiterea sitemap-urilor, crawlerele au deschis sute de profiluri pe minut, iar
// Base44 a raspuns „Rate limit exceeded” (HTTP 500). Paginile tratau orice eroare ca „profil
// negasit” si puneau `noindex` - deci Google primea `noindex` pe profiluri publice perfect valide.
// Acum:
// - o eroare trecatoare (limita de trafic, 5xx, lipsa raspunsului) se reincearca de doua ori, dupa
//   1,5 s si 4 s;
// - doar un 404 real inseamna „profil negasit” (si `noindex`); o eroare trecatoare care persista
//   arata un mesaj de indisponibilitate temporara, fara `noindex`.

export const PROFILE_RETRY_DELAYS_MS = Object.freeze([1500, 4000]);

export function errorStatus(error) {
  const status = Number(error?.response?.status ?? error?.status);
  return Number.isFinite(status) && status > 0 ? status : null;
}

/** Profilul chiar nu exista sau nu este public: backendul raspunde 404. */
export function isNotFoundError(error) {
  return errorStatus(error) === 404;
}

/** Erorile care merita o noua incercare: limita de trafic, erori de server, lipsa raspunsului. */
export function isTransientError(error) {
  const status = errorStatus(error);
  if (status === null) return true;
  return status === 408 || status === 429 || status >= 500;
}

// 2026-10-02. Mesajul brut al platformei („Rate limit exceeded”) ajungea direct in contul de
// furnizor. Il inlocuim cu o explicatie in romana; celelalte mesaje raman neschimbate.
export const RATE_LIMIT_MESSAGE = 'Serverul a primit prea multe cereri deodată. Reîncearcă în câteva secunde.';

export function readableErrorMessage(message, fallback = '') {
  const text = String(message || '').trim();
  if (!text) return fallback;
  return /rate limit/i.test(text) ? RATE_LIMIT_MESSAGE : text;
}

export async function withTransientRetry(run, {
  delaysMs = PROFILE_RETRY_DELAYS_MS,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === delaysMs.length) break;
      await wait(delaysMs[attempt]);
    }
  }
  throw lastError;
}
