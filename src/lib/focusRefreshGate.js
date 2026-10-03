// Reincarcarea la revenirea in fereastra (evenimentul `focus`), cu pauza minima intre reincarcari.
//
// 2026-10-03. Contul de furnizor reincarca prezentarea si tot spatiul de lucru la FIECARE `focus`
// (si statusul logo-ului, separat). Cine trecea de cateva ori intre ferestre pornea o rafala de
// cereri catre server, iar Base44 raspundea „Rate limit exceeded”. Acum o reincarcare din `focus`
// pleaca doar daca ultima incarcare e mai veche de 30 de secunde. Butoanele si navigarea
// reincarca la fel ca inainte.
//
// Fara importuri, ca sa poata fi testat direct in Node.

export const FOCUS_REFRESH_MIN_INTERVAL_MS = 30000;

export function focusRefreshGate(minIntervalMs = FOCUS_REFRESH_MIN_INTERVAL_MS, now = () => Date.now()) {
  // Montarea componentei tocmai a incarcat datele, deci conteaza ca o incarcare.
  let lastLoadedAt = now();
  return {
    markLoaded() {
      lastLoadedAt = now();
    },
    shouldRefresh() {
      const current = now();
      if (current - lastLoadedAt < minIntervalMs) return false;
      lastLoadedAt = current;
      return true;
    },
  };
}
