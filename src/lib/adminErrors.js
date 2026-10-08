// Erori de afișare în panoul de admin (2026-10-08). Parte pură (fără React), verificabilă din scripts/.
//
// Două situații contează:
//  1. Fila a rămas deschisă cât s-a publicat o versiune nouă: fișierele ecranelor au alte nume, iar
//     cele vechi nu mai există. Încărcarea unui ecran eșuează cu „Failed to fetch dynamically imported
//     module”. Nu e un defect de date: o reîncărcare a paginii rezolvă.
//  2. O eroare neașteptată la afișare (de obicei o dată lipsă sau în alt format). Meniul rămâne
//     folosibil, iar detaliile se pot copia și trimite.

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS/i;

export function isChunkLoadError(error) {
  const text = `${error?.name || ""} ${error?.message || ""}`;
  return CHUNK_ERROR.test(text);
}

export const CHUNK_RELOAD_KEY = "admin_chunk_reload_at";
export const CHUNK_RELOAD_GAP_MS = 60_000;

// Reîncărcăm singuri o dată; dacă eroarea persistă după reîncărcare (fișierul chiar lipsește), nu
// intrăm într-un ciclu: a doua oară în același minut doar afișăm mesajul cu butonul.
// `storage` = sessionStorage (sau un obiect cu getItem/setItem); orice eroare de acces înseamnă „nu”.
export function claimAutoReload(storage, now = Date.now()) {
  try {
    const last = Number(storage?.getItem(CHUNK_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < CHUNK_RELOAD_GAP_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

const firstLines = (text, count) => String(text || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, count);

// Ce se trimite la statistici când un ecran cade (2026-10-08): ca să se vadă și fără să copieze cineva
// textul. Doar secțiunea, felul erorii, numele și mesajul ei (tăiate) și primele componente; fără date
// personale. Evenimentul „admin_render_error” se citește din statisticile aplicației.
export const ADMIN_ERROR_EVENT = "admin_render_error";

/** @param {{ error?: any, componentStack?: string, section?: string, reloading?: boolean }} [details] */
export function errorEventProperties({ error, componentStack = "", section = "", reloading = false } = {}) {
  const where = firstLines(componentStack, 3).map((line) => line.replace(/^at\s+/, "").replace(/\s*\(.*\)\s*$/, ""));
  return {
    section: String(section || "").slice(0, 60),
    kind: isChunkLoadError(error) ? "versiune_noua" : "randare",
    error_name: String(error?.name || "Error").slice(0, 40),
    error_message: String(error?.message ?? "").slice(0, 200),
    where: where.join(" > ").slice(0, 160),
    auto_reload: Boolean(reloading),
  };
}

// Textul care se copiază: ce ecran, ce eroare, unde în cod. Fără date personale.
/** @param {{ error?: any, componentStack?: string, section?: string, href?: string, now?: number }} [details] */
export function errorReport({ error, componentStack = "", section = "", href = "", now = Date.now() } = {}) {
  const name = error?.name || "Error";
  const plain = ["string", "number", "boolean"].includes(typeof error) ? String(error) : "";
  const message = error?.message || plain || (error === null || error === undefined ? "eroare necunoscută" : "fără mesaj");
  const lines = [
    `Secțiune: ${section || "necunoscută"}`,
    `Eroare: ${name}: ${message}`,
    `Adresă: ${href || "necunoscută"}`,
    `Moment: ${new Date(now).toISOString()}`,
  ];
  const stack = firstLines(error?.stack, 6).filter((line) => !line.startsWith(`${name}:`));
  if (stack.length) lines.push("", "Urmă:", ...stack);
  const where = firstLines(componentStack, 8);
  if (where.length) lines.push("", "Componente:", ...where);
  return lines.join("\n");
}
