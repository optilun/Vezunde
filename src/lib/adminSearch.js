// Căutare în listele din panoul de admin (2026-10-07): fără diacritice, fără majuscule, cu toate
// cuvintele scrise obligatorii. „brasov” găsește „Brașov”, „optica ia” găsește „Optica Demo — Iași”,
// iar un număr de telefon se găsește oricum e scris („0722111222” găsește „0722 111 222”).
// Fără React, ca să poată fi verificat din scripts/.

export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Un număr de telefon scris cu spații, puncte sau cratime („0722 111 222”, „0722.111.222”, „+40 722 111 222”)
// e un singur cuvânt de căutat, nu trei; altfel „0722 000 007” ar găsi și „0722 000 070”.
function phoneToken(normalized) {
  if (!/^[\d\s().+-]+$/.test(normalized)) return null;
  const digits = normalized.replace(/\D+/g, "");
  if (digits.length < 5) return null;
  if (digits.startsWith("0040")) return `0${digits.slice(4)}`;
  if (digits.startsWith("40") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

export function searchTokens(query) {
  const normalized = normalizeSearch(query);
  const phone = phoneToken(normalized);
  return phone ? [phone] : normalized.split(/\s+/).filter(Boolean);
}

export function matchesAllTokens(haystack, tokens) {
  return tokens.every((token) => haystack.includes(token));
}

const digitsOnly = (value) => String(value ?? "").replace(/\D+/g, "");
const joinText = (parts) => normalizeSearch(parts.filter(Boolean).join(" "));

// Indexul se construiește o dată per listă (nu la fiecare tastă): 1.600 de locații × 5 câmpuri.
//   name   = textul principal (după el se clasează);
//   parts  = toate câmpurile în care se caută;
//   phones = câmpurile cu telefon (se caută și fără spații, puncte sau paranteze).
export function buildSearchIndex(items, { name, parts, phones = () => [] }) {
  return (items || []).map((item) => {
    const digits = phones(item).map(digitsOnly).filter((value) => value.length >= 5).join(" ");
    const text = `${joinText(parts(item))} ${digits}`.trim();
    return {
      item,
      name: normalizeSearch(name(item)),
      text,
      words: text.split(/[^a-z0-9]+/).filter(Boolean),
    };
  });
}

// Elementele potrivite. Ordinea: întâi cele în care cât mai multe cuvinte scrise încep un cuvânt întreg
// („demo 6” → „Demo 6” înaintea lui „Demo 46”), apoi cele al căror nume începe cu primul cuvânt, apoi
// alfabetic. `total` = câte se potrivesc în tot; `items` = primele `limit`.
export function searchIndex(index, query, { limit = 50, filter = null } = {}) {
  const tokens = searchTokens(query);
  const matched = [];
  for (const entry of index) {
    if (filter && !filter(entry.item)) continue;
    if (tokens.length > 0 && !matchesAllTokens(entry.text, tokens)) continue;
    matched.push(entry);
  }
  const first = tokens[0] || "";
  const wordStarts = (entry) => tokens.filter((token) => entry.words.some((word) => word.startsWith(token))).length;
  const scored = matched.map((entry) => ({ entry, starts: wordStarts(entry) }));
  scored.sort((a, b) => {
    if (a.starts !== b.starts) return b.starts - a.starts;
    const aName = first && a.entry.name.startsWith(first) ? 0 : 1;
    const bName = first && b.entry.name.startsWith(first) ? 0 : 1;
    if (aName !== bName) return aName - bName;
    return a.entry.name.localeCompare(b.entry.name, "ro");
  });
  return { items: scored.slice(0, limit).map(({ entry }) => entry.item), total: scored.length };
}

// Locațiile: nume, oraș, județ, adresă, organizație, telefon.
export function buildLocationIndex(locations) {
  return buildSearchIndex(locations, {
    name: (location) => location.public_display_name || location.name,
    parts: (location) => [location.public_display_name, location.name, location.city, location.locality_name, location.county, location.county_name, location.address, location.organization_name, location.public_email],
    phones: (location) => [location.phone_public, location.public_phone],
  });
}
export const searchLocationIndex = searchIndex;
