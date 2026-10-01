// Locatia cat mai exacta a vizitatorului, de pe telefon, tableta sau laptop.
//
// 2026-10-01. Inainte cerem `getCurrentPosition` cu `enableHighAccuracy: false` si
// `maximumAge: 300000`: browserul putea raspunde cu o pozitie veche de 5 minute si, pe telefon,
// cu cea estimata din antene / Wi-Fi (sute de metri pana la kilometri), nu din GPS.
//
// Acum:
//  - cerem pozitia de inalta precizie (GPS pe telefon / tableta; Wi-Fi sau Windows / macOS
//    Location Services pe laptop) si nu acceptam una din cache (`maximumAge: 0`);
//  - urmarim pozitia cu `watchPosition`: prima pozitie vine repede dar e grosiera, iar GPS-ul se
//    rafineaza in cateva secunde. Ne oprim cand precizia e suficienta (`targetAccuracy`) sau cand
//    se termina timpul (`maxWaitMs`), cu cea mai buna pozitie primita;
//  - daca inalta precizie nu merge (unele laptopuri nu au GPS si dau eroare / timeout), cerem o
//    singura data pozitia obisnuita, ca sa nu ramana vizitatorul fara nimic;
//  - spunem cat de buna e pozitia (`quality`), ca interfata sa nu o prezinte drept exacta cand nu e.
//
// Nu citim tipul dispozitivului din user-agent: precizia raportata de browser (`coords.accuracy`,
// in metri) arata direct ce a obtinut dispozitivul, fie GPS, Wi-Fi sau IP.

export const TARGET_ACCURACY_M = 75;
export const MAX_WAIT_MS = 15000;
export const MAX_USABLE_ACCURACY_M = 5000;

// gps: ~pana la 100 m | wifi: pana la ~1 km | coarse: peste, doar zona orasului.
export function locationQuality(accuracyM) {
  if (!Number.isFinite(accuracyM)) return "coarse";
  if (accuracyM <= 100) return "gps";
  if (accuracyM <= 1000) return "wifi";
  return "coarse";
}

// „~30 m” / „~2,4 km”: precizia pentru afisare. Sub 100 m se rotunjeste la 5 m, pana la 1 km la 10 m.
export function formatAccuracy(accuracyM) {
  if (!Number.isFinite(accuracyM)) return "";
  if (accuracyM >= 1000) return `~${(accuracyM / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} km`;
  const step = accuracyM < 100 ? 5 : 10;
  return `~${Math.max(step, Math.round(accuracyM / step) * step)} m`;
}

// Mesajul pentru client, dupa ce pozitia e gata.
export function accuracyNote(accuracyM) {
  const value = formatAccuracy(accuracyM);
  if (!value) return "";
  const quality = locationQuality(accuracyM);
  if (quality === "gps") return `Poziție precisă (${value}).`;
  if (quality === "wifi") return `Poziție aproximativă (${value}). Pe laptop sau fără GPS, precizia e mai mică.`;
  return `Poziție vagă (${value}). Alege localitatea pentru rezultate mai exacte.`;
}

// Mesajul cand vizitatorul a refuzat (sau browserul blocheaza) accesul la locatie. Spune ce poate
// face, nu doar ca nu merge: pictograma din bara de adresa (lacat / locatie) deschide permisiunile.
export const LOCATION_DENIED_MESSAGE = "Accesul la locație este blocat. Permite-l din setările browserului (pictograma de lângă adresă) și apasă din nou, sau alege localitatea.";

const PERMISSION_DENIED = 1;

/**
 * Porneste cautarea pozitiei. Intoarce `{ promise, cancel }`.
 * `promise` se rezolva cu `{ lat, lng, accuracy, quality }` sau se respinge cu `{ code }`
 * (`code === 1` inseamna acces refuzat; orice alt cod, pozitie indisponibila).
 * `onProgress` primeste fiecare pozitie mai buna decat cele anterioare.
 */
export function locatePrecisely({
  targetAccuracy = TARGET_ACCURACY_M,
  maxWaitMs = MAX_WAIT_MS,
  onProgress,
} = {}) {
  let cancel = () => {};
  const promise = new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: 0 });
      return;
    }
    let best = null;
    let finished = false;
    let watchId = null;
    let timer = null;
    let triedFallback = false;

    const cleanup = () => {
      finished = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer) window.clearTimeout(timer);
    };
    const finish = () => {
      if (finished) return;
      cleanup();
      if (best) resolve(best);
      else reject({ code: 2 });
    };
    const fail = (code) => {
      if (finished) return;
      cleanup();
      reject({ code });
    };
    const accept = (position) => {
      if (finished) return;
      const accuracy = Number(position.coords.accuracy);
      if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) return;
      if (best && Number.isFinite(accuracy) && accuracy >= best.accuracy) return;
      best = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : Infinity,
        quality: locationQuality(accuracy),
      };
      if (onProgress) onProgress(best);
      if (best.accuracy <= targetAccuracy) finish();
    };
    const fallbackOnce = () => {
      if (triedFallback || finished) return;
      triedFallback = true;
      navigator.geolocation.getCurrentPosition(
        accept,
        (error) => { if (!best) fail(error.code === PERMISSION_DENIED ? PERMISSION_DENIED : 2); },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
      );
    };

    cancel = () => { if (!finished) { cleanup(); reject({ code: -1, cancelled: true }); } };
    timer = window.setTimeout(finish, maxWaitMs);
    watchId = navigator.geolocation.watchPosition(
      accept,
      (error) => {
        if (error.code === PERMISSION_DENIED) { fail(PERMISSION_DENIED); return; }
        // Pozitie indisponibila / timeout la inalta precizie: incercam o data pozitia obisnuita.
        if (!best) fallbackOnce();
      },
      { enableHighAccuracy: true, timeout: Math.min(maxWaitMs, 10000), maximumAge: 0 },
    );
  });
  return { promise, cancel: () => cancel() };
}
