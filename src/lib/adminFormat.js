// Formatări scurte pentru panoul de admin (2026-10-07). Fără React.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// 2026-10-10: datele care trec prin funcțiile de backend (SDK 0.8.31) vin ca „2026-10-10T17:55:29.046000”:
// în UTC, dar fără „Z”. `new Date()` le citea ca oră locală, deci în România apăreau cu 2-3 ore mai vechi
// (clopoțelul arăta „acum 3 ore” pentru un anunț de acum 3 minute). Le citește ca UTC.
const NAIVE_ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

export function parseServerDate(value) {
  if (value instanceof Date) return value;
  const text = String(value ?? "").trim();
  return new Date(NAIVE_ISO_DATE_TIME.test(text) ? `${text}Z` : text);
}

// „acum 5 min”, „acum 2 ore”, „ieri”, „acum 3 zile”; după o lună, data.
export function relativeTime(value, now = Date.now()) {
  if (!value) return "";
  const time = parseServerDate(value).getTime();
  if (!Number.isFinite(time)) return "";
  const diff = now - time;
  if (diff < -MINUTE) return new Date(time).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
  if (diff < MINUTE) return "chiar acum";
  if (diff < HOUR) return `acum ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return hours === 1 ? "acum o oră" : `acum ${hours} ore`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "ieri";
  if (days < 30) return `acum ${days} zile`;
  return new Date(time).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

export function fullDateTime(value) {
  if (!value) return "—";
  const date = parseServerDate(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("ro-RO") : "—";
}

// Termen de răspuns (ex. 30 de zile pentru eliminarea datelor personale). `daysLeft` negativ = depășit.
//   tone: "danger" (depășit), "warning" (7 zile sau mai puțin), "neutral" (restul)
export function deadlineInfo(startValue, days, now = Date.now()) {
  const start = new Date(startValue).getTime();
  if (!startValue || !Number.isFinite(start)) return null;
  const due = start + days * DAY;
  const daysLeft = Math.ceil((due - now) / DAY);
  const late = daysLeft < 0;
  const soon = !late && daysLeft <= 7;
  const label = late
    ? `termen depășit cu ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "zi" : "zile"}`
    : daysLeft === 0
      ? "termen astăzi"
      : `${daysLeft} ${daysLeft === 1 ? "zi" : "zile"} rămase`;
  return { due: new Date(due), daysLeft, late, soon, label, tone: late ? "danger" : soon ? "warning" : "neutral" };
}

// Cât așteaptă un element în coadă (pentru „Trimisă acum 2 zile”). Ton: neutru, apoi avertisment de la
// 3 zile și alertă de la 7 zile; e doar un indiciu vizual, nu un termen legal (cum e cel GDPR).
export function waitingInfo(startValue, now = Date.now()) {
  const start = new Date(startValue).getTime();
  if (!startValue || !Number.isFinite(start)) return null;
  const days = Math.max(0, Math.floor((now - start) / DAY));
  return { days, label: relativeTime(startValue, now), tone: days >= 7 ? "danger" : days >= 3 ? "warning" : "neutral" };
}

// Cele mai vechi primele: ordinea în care ar trebui rezolvată o coadă. Elementele fără dată merg la final.
export function oldestFirst(items, getDate) {
  const time = (item) => {
    const value = new Date(getDate(item)).getTime();
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  };
  return [...items].sort((a, b) => time(a) - time(b));
}

// „1 revendicare” / „3 revendicări”.
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

// „1 zi”, „7 zile”, „30 de zile”, „90 de zile”, „101 zile”: de la 20 în sus (și la sute pline) se pune „de”.
export function daysLabel(count) {
  const n = Math.abs(Number(count) || 0);
  const mod = n % 100;
  return `${count} ${n === 1 ? "zi" : mod === 0 || mod >= 20 ? "de zile" : "zile"}`;
}
