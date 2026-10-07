// Căutare în listele din panoul de admin (2026-10-07): fără diacritice, fără majuscule, cu toate
// cuvintele scrise obligatorii. „brasov” găsește „Brașov”, „optica ia” găsește „Optica Demo — Iași”.
// Fără React, ca să poată fi verificat din scripts/.

export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function searchTokens(query) {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

export function matchesAllTokens(haystack, tokens) {
  return tokens.every((token) => haystack.includes(token));
}

const joinText = (parts) => normalizeSearch(parts.filter(Boolean).join(" "));

// Indexul se construiește o dată per listă (nu la fiecare tastă): 1.600 de locații × 5 câmpuri.
export function buildLocationIndex(locations) {
  return (locations || []).map((location) => {
    const text = joinText([location.public_display_name, location.name, location.city, location.locality_name, location.county, location.address, location.organization_name]);
    return {
      location,
      name: normalizeSearch(location.public_display_name || location.name),
      text,
      words: text.split(/[^a-z0-9]+/).filter(Boolean),
    };
  });
}

// Locațiile potrivite. Ordinea: întâi cele în care cât mai multe cuvinte scrise încep un cuvânt întreg
// („demo 6” → „Demo 6” înaintea lui „Demo 46”), apoi cele al căror nume începe cu primul cuvânt, apoi
// alfabetic. `total` = câte se potrivesc în tot; `items` = primele `limit`.
export function searchLocationIndex(index, query, { limit = 50, filter = null } = {}) {
  const tokens = searchTokens(query);
  const matched = [];
  for (const entry of index) {
    if (filter && !filter(entry.location)) continue;
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
  matched.length = 0;
  matched.push(...scored.map((item) => item.entry));
  return { items: matched.slice(0, limit).map((entry) => entry.location), total: matched.length };
}
