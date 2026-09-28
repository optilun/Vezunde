// 2026-09-28 (audit /cauta, C2). Focusul pentru fereastra locatiei de pe harta.
//
// Cand vizitatorul cere explicit o locatie pe harta (pinul apasat, „Arată pe hartă” din card, o
// locatie din lista unui grup), focusul trece pe fereastra care se deschide. Pe telefon, butonul
// apasat era in lista care tocmai se ascunsese, iar focusul cadea pe <body>. La inchidere, focusul
// revine pe butonul de unde a pornit (sau, daca acela nu se mai vede, pe comutatorul lista/harta).
//
// O selectie restaurata din sesiune (revenirea pe pagina) nu muta focusul: nu este ceruta acum.

const REQUEST_WINDOW_MS = 4000;
let requestedAt = 0;
let opener = null;

export function requestMapCardFocus() {
  requestedAt = Date.now();
  const active = typeof document !== "undefined" ? document.activeElement : null;
  opener = active && active !== document.body ? active : null;
}

export function wantsMapCardFocus() {
  return requestedAt > 0 && Date.now() - requestedAt < REQUEST_WINDOW_MS;
}

export function mapCardFocused() {
  requestedAt = 0;
}

function visible(element) {
  return Boolean(element?.isConnected && element.getClientRects().length > 0);
}

export function restoreMapCardOpener() {
  const target = visible(opener) ? opener : document.querySelector("[data-map-toggle]");
  opener = null;
  if (visible(target)) target.focus({ preventScroll: true });
}
