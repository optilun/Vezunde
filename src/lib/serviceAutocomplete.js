import { CANONICAL_SERVICE_REGISTRY, SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { getServiceSearchSuggestions, normalizeSemanticText } from "@/lib/serviceSemanticSearch";
import { getServiceSearchKeywords } from "../../shared/canonicalServiceRegistryExtended.js";

// Sugestiile din caseta „Ce serviciu cauți?” de pe /cauta.
//
// Doar ordinea si textul sugestiilor se decid aici. Cand pacientul alege o sugestie, cautarea
// primeste aceeasi cheie de serviciu ca inainte; potrivirea si ordinea rezultatelor nu trec prin
// acest fisier. Textul liber (fara sugestie aleasa) merge tot prin resolveServiceSearchQuery.
//
// De ce exista: getServiceSearchSuggestions compara fraze intregi, deci raspundea abia de la 5
// litere, iar la scor egal ordona alfabetic („ochel” aducea intai „Consult ... pediatric”).

// Ordinea grupurilor pentru pacient si denumirile scurte folosite in sugestii si in filtre.
export const SERVICE_GROUP_UI = {
  ophthalmology_consults: { title: "Consultații oftalmologice", short: "Consultații" },
  optometry: { title: "Control de vedere și optometrie", short: "Optometrie" },
  optical_retail: { title: "Ochelari", short: "Ochelari" },
  contact_lenses: { title: "Lentile de contact", short: "Lentile de contact" },
  investigations: { title: "Investigații", short: "Investigații" },
  children_and_prevention: { title: "Copii", short: "Copii" },
  specialties: { title: "Afecțiuni și specialități", short: "Specialități" },
  procedures_surgery: { title: "Operații și proceduri", short: "Proceduri" },
  lenses_and_measurements: { title: "Lentile pentru ochelari", short: "Lentile" },
  technical_activities: { title: "Reparații și reglaje", short: "Reparații" },
  business_attributes: { title: "Alte servicii", short: "Altele" },
};
export const SERVICE_GROUP_ORDER = Object.keys(SERVICE_GROUP_UI);

// Cele mai cautate nevoi, afisate cand caseta e goala. Eticheta ramane cea oficiala; `hint`
// spune in cuvinte obisnuite despre ce e vorba.
export const POPULAR_SERVICES = [
  { service_key: "optometry_consultation", hint: "control de vedere, dioptrii" },
  { service_key: "ophthalmology_consultation", hint: "medic de ochi" },
  { service_key: "eyeglasses", hint: "rame și lentile" },
  { service_key: "contact_lenses", hint: "lentile, probă, adaptare" },
  { service_key: "eyeglasses_repair", hint: "rame rupte, șuruburi, reglaj" },
  { service_key: "children_eye_exam", hint: "pentru copii" },
  { service_key: "oct", hint: "investigație pentru retină" },
  { service_key: "visual_field_analyzer", hint: "investigație" },
];
const POPULAR_RANK = new Map(POPULAR_SERVICES.map((item, index) => [item.service_key, index]));
// Nevoi frecvente care nu intra in lista de mai sus, dar trebuie sa urce la egalitate.
const COMMON_SERVICES = new Set([
  "prescription_lenses", "progressive_lenses", "frames", "sunglasses", "eyeglasses_adjustment",
  "refraction", "complete_eye_exam", "followup_consultation", "contact_lens_fitting",
  "cataract_consultation", "glaucoma_consultation", "pediatric_ophthalmology",
]);

function isPatientService(definition) {
  return definition && definition.patient_facing !== false && definition.b2b_only !== true;
}

// Litera cu litera, fara diacritice, fara sa comprima spatiile: pozitiile raman aceleasi ca in
// eticheta originala, ca sa putem evidentia partea potrivita.
function foldChars(value) {
  return [...String(value || "")]
    .map((char) => char.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || char)
    .join("");
}

let indexCache = null;
function serviceIndex() {
  if (indexCache) return indexCache;
  const groupLabels = new Set(
    Object.values(SERVICE_GROUPS || {}).map((group) => normalizeSemanticText(group?.label)).filter(Boolean),
  );
  indexCache = Object.entries(CANONICAL_SERVICE_REGISTRY)
    .filter(([, definition]) => isPatientService(definition))
    .map(([key, definition]) => {
      const label = definition.label || key;
      const labelN = normalizeSemanticText(label);
      // Cuvintele-cheie pastreaza si forma lor scrisa (cu diacritice), ca sa le putem arata.
      const keywordText = new Map();
      for (const raw of getServiceSearchKeywords(key) || []) {
        const normalized = normalizeSemanticText(raw);
        if (!normalized || normalized === labelN || raw.includes("_")) continue;
        if (!keywordText.has(normalized) || /[ăâîșțşţ]/i.test(raw)) keywordText.set(normalized, String(raw).toLocaleLowerCase("ro"));
      }
      const keywords = [...keywordText.keys()];
      return {
        service_key: key,
        label,
        group: definition.group || "other",
        labelN,
        labelWords: labelN.split(" "),
        keywords: keywords.filter((keyword) => !groupLabels.has(keyword)),
        keywordText,
        groupKeywords: keywords.filter((keyword) => groupLabels.has(keyword)),
      };
    });
  return indexCache;
}

export function serviceGroupShort(group) {
  return SERVICE_GROUP_UI[group]?.short || "";
}

export function getServiceLabel(serviceKey) {
  return CANONICAL_SERVICE_REGISTRY[serviceKey]?.label || serviceKey;
}

// Toate cuvintele cautarii incep cate un cuvant din text („cons oft” -> „Consult oftalmologic”).
function everyTokenStartsAWord(queryTokens, words) {
  return queryTokens.every((token) => words.some((word) => word.startsWith(token)));
}

// Scorul potrivirii si, cand potrivirea vine dintr-un cuvant-cheie, acel cuvant (ca pacientul sa
// inteleaga de ce apare „Consult optometric complet” cand a scris „control”).
function lexicalMatch(entry, query, queryTokens) {
  if (entry.labelN === query) return { score: 120, keyword: null };
  if (entry.labelN.startsWith(query)) return { score: 100, keyword: null };
  if (everyTokenStartsAWord(queryTokens, entry.labelWords)) return { score: 85, keyword: null };
  if (query.length < 3) return { score: 0, keyword: null };
  const loose = query.length >= 4;
  let best = { score: loose && entry.labelN.includes(query) ? 70 : 0, keyword: null };
  for (const keyword of entry.keywords) {
    let score = 0;
    if (keyword === query) score = 90;
    else if (keyword.startsWith(query)) score = 75;
    else if (everyTokenStartsAWord(queryTokens, keyword.split(" "))) score = 65;
    else if (loose && keyword.includes(query)) score = 50;
    if (score > best.score) best = { score, keyword };
  }
  if (!best.score && loose && entry.groupKeywords.some((keyword) => keyword.includes(query))) best = { score: 20, keyword: null };
  return best;
}

function lexicalScore(entry, query, queryTokens) {
  return lexicalMatch(entry, query, queryTokens).score;
}

// Portiunea din eticheta care se potriveste cu ce a scris pacientul, pentru evidentiere.
export function highlightParts(label, rawQuery) {
  const query = foldChars(String(rawQuery || "").trim());
  if (!query) return [{ text: label, match: false }];
  const folded = foldChars(label);
  let start = -1;
  const wordStart = new RegExp(`(^|[^a-z0-9])${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const hit = wordStart.exec(folded);
  if (hit) start = hit.index + hit[1].length;
  else start = folded.indexOf(query);
  if (start < 0) return [{ text: label, match: false }];
  const end = start + query.length;
  return [
    { text: label.slice(0, start), match: false },
    { text: label.slice(start, end), match: true },
    { text: label.slice(end), match: false },
  ].filter((part) => part.text);
}

export function popularServiceSuggestions() {
  return POPULAR_SERVICES
    .filter((item) => isPatientService(CANONICAL_SERVICE_REGISTRY[item.service_key]))
    .map((item) => ({
      service_key: item.service_key,
      label: getServiceLabel(item.service_key),
      hint: item.hint,
      group: CANONICAL_SERVICE_REGISTRY[item.service_key]?.group || "other",
    }));
}

export function rankServiceSuggestions(rawQuery, { limit = 8 } = {}) {
  const query = normalizeSemanticText(rawQuery);
  if (!query) return [];
  const queryTokens = query.split(" ").filter(Boolean);
  const scored = new Map();

  for (const entry of serviceIndex()) {
    const match = lexicalMatch(entry, query, queryTokens);
    if (!match.score) continue;
    const bonus = POPULAR_RANK.has(entry.service_key) ? 16 : COMMON_SERVICES.has(entry.service_key) ? 8 : 0;
    scored.set(entry.service_key, {
      entry,
      score: match.score + bonus,
      hint: match.keyword ? entry.keywordText.get(match.keyword) : "",
    });
  }

  // Frazele descriptive („văd în ceață”, „mă ustură ochii”) vin din regulile existente.
  if (query.length >= 4) {
    for (const suggestion of getServiceSearchSuggestions(rawQuery, { limit: 8 })) {
      const entry = serviceIndex().find((item) => item.service_key === suggestion.service_key);
      if (!entry) continue;
      const score = Math.round(Number(suggestion.score || 0) * 90);
      const current = scored.get(entry.service_key);
      if (!current || current.score < score) scored.set(entry.service_key, { entry, score, hint: "" });
    }
  }

  return [...scored.values()]
    .sort((a, b) =>
      b.score - a.score
      || (POPULAR_RANK.get(a.entry.service_key) ?? 99) - (POPULAR_RANK.get(b.entry.service_key) ?? 99)
      || a.entry.label.length - b.entry.label.length
      || a.entry.label.localeCompare(b.entry.label, "ro"))
    .slice(0, limit)
    .map(({ entry, hint }) => ({ service_key: entry.service_key, label: entry.label, group: entry.group, hint: hint || "" }));
}

// Filtru pentru lista de servicii din panoul de filtre: aceeasi potrivire, fara limita.
export function serviceMatchesNeedle(serviceKey, rawNeedle) {
  const needle = normalizeSemanticText(rawNeedle);
  if (!needle) return true;
  const entry = serviceIndex().find((item) => item.service_key === serviceKey);
  if (!entry) return false;
  return lexicalScore(entry, needle, needle.split(" ").filter(Boolean)) >= 50 || entry.labelN.includes(needle);
}

export function patientServicesByGroup() {
  const groups = new Map(SERVICE_GROUP_ORDER.map((group) => [group, []]));
  for (const entry of serviceIndex()) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push({ service_key: entry.service_key, label: entry.label });
  }
  return [...groups.entries()].filter(([, items]) => items.length > 0);
}
