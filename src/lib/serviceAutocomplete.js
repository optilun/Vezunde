import { CANONICAL_SERVICE_REGISTRY, SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { SEMANTIC_INTENT_RULES, getServiceSearchSuggestions, normalizeSemanticText } from "@/lib/serviceSemanticSearch";
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
const POPULAR_HINTS = new Map(POPULAR_SERVICES.map((item) => [item.service_key, item.hint]));
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
      // Cheile tehnice (control_vedere_adulti) nu sunt cuvinte pe care le scrie un pacient.
      const keywords = [...new Set((getServiceSearchKeywords(key) || [])
        .filter((raw) => !String(raw).includes("_"))
        .map(normalizeSemanticText)
        .filter((keyword) => keyword && keyword !== labelN))];
      return {
        service_key: key,
        label,
        group: definition.group || "other",
        labelN,
        labelWords: labelN.split(" "),
        keywords: keywords.filter((keyword) => !groupLabels.has(keyword)),
        groupKeywords: keywords.filter((keyword) => groupLabels.has(keyword)),
      };
    });
  // Un cuvant-cheie pus pe 4 sau mai multe servicii descrie grupul, nu serviciul („dioptrii” e pe
  // toate serviciile de optometrie). Ramane gasibil, dar nu mai trage in fata orice serviciu.
  const frequency = new Map();
  for (const entry of indexCache) for (const keyword of entry.keywords) frequency.set(keyword, (frequency.get(keyword) || 0) + 1);
  for (const entry of indexCache) entry.sharedKeywords = new Set(entry.keywords.filter((keyword) => frequency.get(keyword) >= 4));
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

// Aceeasi idee, fara terminatia cuvintelor lungi: in romana ea se schimba
// („cataractă” / „cataractei”, „ochelarii”, „glaucomul”, „lentilele”).
function stem(token) {
  if (token.length < 6) return token;
  const stripped = token.replace(/(ului|ilor|elor|lor|ul|le|ii|ei|a|e|i)$/, "");
  return stripped.length >= 4 ? stripped : token;
}
function everyTokenStartsAWordLoosely(queryTokens, words) {
  return queryTokens.every((token) => words.some((word) => word.startsWith(stem(token))));
}

// Scorul potrivirii si cuvantul-cheie care a potrivit (daca nu a potrivit eticheta).
function lexicalMatch(entry, query, queryTokens) {
  if (entry.labelN === query) return { score: 120, keyword: null };
  if (entry.labelN.startsWith(query)) return { score: 100, keyword: null };
  if (everyTokenStartsAWord(queryTokens, entry.labelWords)) return { score: 85, keyword: null };
  if (everyTokenStartsAWordLoosely(queryTokens, entry.labelWords)) return { score: 80, keyword: null };
  if (query.length < 3) return { score: 0, keyword: null };
  const loose = query.length >= 4;
  let best = { score: loose && entry.labelN.includes(query) ? 70 : 0, keyword: null };
  for (const keyword of entry.keywords) {
    let score = 0;
    if (keyword === query) score = 90;
    else if (keyword.startsWith(query)) score = 75;
    else if (everyTokenStartsAWord(queryTokens, keyword.split(" "))) score = 65;
    else if (loose && keyword.includes(query)) score = 50;
    if (score && entry.sharedKeywords.has(keyword)) { score = Math.min(score, 40); if (score > best.score) best = { score, keyword: null }; continue; }
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
    // Nevoile cele mai cautate urca: „control” trebuie sa aduca sus si „Consult optometric complet”
    // (control de vedere), chiar daca potrivirea vine din cuvantul-cheie, nu din eticheta.
    const popular = POPULAR_RANK.has(entry.service_key);
    const bonus = popular ? (match.keyword ? 26 : 16) : COMMON_SERVICES.has(entry.service_key) ? 8 : 0;
    scored.set(entry.service_key, { entry, score: match.score + bonus });
  }

  // Cuvintele pacientului („urcior”, „conjunctivită”, „keratocon”) din regulile existente de
  // intentie. Aceleasi tinte ca in cautare; aici doar le propunem.
  for (const rule of SEMANTIC_INTENT_RULES) {
    let best = 0;
    for (const phrase of rule.phrases) {
      const normalized = normalizeSemanticText(phrase);
      if (normalized === query) best = Math.max(best, 1);
      else if (query.length >= 4 && query.includes(normalized) && normalized.length >= 4) best = Math.max(best, 0.9);
      else if (query.length >= 4 && normalized.startsWith(query)) best = Math.max(best, 0.85);
    }
    if (best < 0.85) continue;
    for (const [serviceKey, weight] of rule.targets) {
      const entry = serviceIndex().find((item) => item.service_key === serviceKey);
      if (!entry) continue;
      const score = Math.round(90 * best * Number(weight));
      const current = scored.get(serviceKey);
      if (!current || current.score < score) scored.set(serviceKey, { entry, score });
    }
  }

  // Frazele mai lungi („văd în ceață de câteva zile”) trec prin potrivirea existenta pe fraze. Un
  // singur cuvant e acoperit mai sus; acolo ar aduce tot grupul („dioptrii” -> toata optometria).
  if (queryTokens.length >= 2) {
    for (const suggestion of getServiceSearchSuggestions(rawQuery, { limit: 8 })) {
      if (Number(suggestion.score || 0) < 0.6) continue;
      const entry = serviceIndex().find((item) => item.service_key === suggestion.service_key);
      if (!entry) continue;
      const score = Math.round(Number(suggestion.score || 0) * 90);
      const current = scored.get(entry.service_key);
      if (!current || current.score < score) scored.set(entry.service_key, { entry, score });
    }
  }

  // Potrivirile slabe nu stau langa cele clare: sub jumatate din scorul primei sugestii nu apar.
  const top = Math.max(0, ...[...scored.values()].map((item) => item.score));
  const cutoff = Math.max(40, top * 0.5);
  return [...scored.values()]
    .filter((item) => item.score >= cutoff)
    .sort((a, b) =>
      b.score - a.score
      || (POPULAR_RANK.get(a.entry.service_key) ?? 99) - (POPULAR_RANK.get(b.entry.service_key) ?? 99)
      || a.entry.label.length - b.entry.label.length
      || a.entry.label.localeCompare(b.entry.label, "ro"))
    .slice(0, limit)
    .map(({ entry }) => ({
      service_key: entry.service_key,
      label: entry.label,
      group: entry.group,
      hint: POPULAR_HINTS.get(entry.service_key) || "",
    }));
}

// Filtru pentru lista de servicii din panoul de filtre: aceeasi potrivire, fara limita.
export function serviceMatchesNeedle(serviceKey, rawNeedle) {
  const needle = normalizeSemanticText(rawNeedle);
  if (!needle) return true;
  const entry = serviceIndex().find((item) => item.service_key === serviceKey);
  if (!entry) return false;
  // Mai strict decat sugestiile: in lista de bifat, un rezultat in plus e zgomot, nu ajutor.
  return lexicalScore(entry, needle, needle.split(" ").filter(Boolean)) >= 70 || entry.labelN.includes(needle);
}

export function patientServicesByGroup() {
  const groups = new Map(SERVICE_GROUP_ORDER.map((group) => [group, []]));
  for (const entry of serviceIndex()) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push({ service_key: entry.service_key, label: entry.label });
  }
  return [...groups.entries()].filter(([, items]) => items.length > 0);
}
