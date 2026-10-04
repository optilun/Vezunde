// 2026-10-04 (audit cont organizație, #1-#2). Erorile din „Cereri”, spuse pe înțeles.
//
// Înainte, o eroare scurtă a serverului (limită de trafic, HTTP 500) ajungea în pagină ca
// „Request failed with status code 500”, iar planul rămânea pe valoarea implicită „Free”: un client
// Pro vedea „Plan Free” și limitări care nu existau. Acum:
// - erorile trecătoare (5xx, 408, 429, fără răspuns) primesc un mesaj în română și se reîncearcă;
// - erorile reale ale backendului (acces refuzat, cerere negăsită) își păstrează mesajul;
// - planul necunoscut rămâne necunoscut, nu devine „Free”.
// Fără importuri din aplicație, ca să poată fi testat direct în Node.
import { errorStatus, readableErrorMessage } from "./transientRetry.js";

export const INBOX_UNAVAILABLE_MESSAGE = "Cererile nu au putut fi încărcate acum. Încearcă din nou în câteva secunde.";
export const INBOX_PLAN_UNKNOWN_MESSAGE = "Nu am putut verifica acum planul și accesul locației. Datele contului nu s-au schimbat.";

// Reîncercări pentru citirile din „Cereri”: aceleași pauze ca restul contului, cu o mică
// împrăștiere, ca cererile căzute deodată să nu lovească din nou limita împreună.
export const INBOX_RETRY_OPTIONS = Object.freeze({ delaysMs: [1500, 4000], jitterMs: 1000 });

export function isTransientInboxError(error) {
  const status = errorStatus(error);
  return status === null || status === 408 || status === 429 || status >= 500;
}

export function inboxErrorMessage(error, fallback = INBOX_UNAVAILABLE_MESSAGE) {
  if (isTransientInboxError(error)) return fallback;
  return readableErrorMessage(error?.response?.data?.error || error?.message, fallback);
}
