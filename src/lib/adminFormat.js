// Formatări scurte pentru panoul de admin (2026-10-07). Fără React.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// „acum 5 min”, „acum 2 ore”, „ieri”, „acum 3 zile”; după o lună, data.
export function relativeTime(value, now = Date.now()) {
  if (!value) return "";
  const time = new Date(value).getTime();
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
  const date = new Date(value);
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

// „1 revendicare” / „3 revendicări”.
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
