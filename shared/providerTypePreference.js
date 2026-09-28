// Ce tip de locatie recomandam intai: optica (optometrist) sau cabinet/clinica de oftalmologie.
//
// 2026-09-28, cererea owner-ului: "majoritatea recomandarilor se dau pe clinici de oftalmologie,
// optici nu prea. Pentru controale regulate fara alte afectiuni, reparatii sau cautarea unui model
// de ochelari ori brand de lentile sa fie recomandate inainte opticile. Fa un research puternic si
// apoi ia o decizie de expert." Auditul si sursele: docs/audit-ai-cautare-recomandare-2026-09-24.md,
// sectiunea 18.
//
// Ce am gasit: nivelul nevoii era maximul peste toate cheile cererii, iar la nivel
// `specialized_medical` fallbackul structural (sursa aproape tuturor rezultatelor: in director doar o
// locatie are servicii declarate) pastra DOAR profilurile medicale. O singura cheie medicala scotea
// complet opticile - inclusiv la cumpararea unor lentile de contact de brand, la "Nu sunt sigur" si
// la copii. Invers, la un control de rutina lista de 12 se umplea cu optici si niciun cabinet nu mai
// aparea ca alternativa.
//
// Decizia (sprijinita de ghidurile AAO si AOA, ECOO, ADA si de practica din Romania, unde
// optometristul are autorizatie de libera practica prin Ordinul MS 1992/2023):
//  - medical_only: simptome sau boala oculara, investigatii cu trimitere, consult medical cerut
//    explicit, supraspecialitati. Opticile nu pot rezolva o problema medicala.
//  - medical_first: copii, nevoie neclara ("Nu sunt sigur"), lentile de contact speciale. Intai
//    medicul; opticile raman dupa, pentru ochelarii sau lentilele de dupa consult.
//  - optical_first: control de vedere de rutina, dioptrii noi, adaptarea lentilelor de contact.
//    Intai opticile cu optometrist; cabinetele raman ca alternativa vizibila, pentru un consult
//    medical complet (de exemplu dupa 40 de ani sau cu o afectiune cunoscuta).
//  - optical_products: ochelari, rame, branduri, lentile, reparatii si reglaje. Doar opticile, iar
//    cabinetele numai cand in zona nu sunt destule optici.
//
// Regulile nu citesc anamneza sau datele de contact (acestea nu schimba potrivirea): doar nevoia
// confirmata, cheile de serviciu CONFIRMATE de pacient (categoria, raspunsurile, propunerea AI
// acceptata) si, pentru keratocon, textul lui. Cheile adaugate de cautarea in text raman pentru
// potrivire, dar nu decid tipul: testul live din 2026-09-28 a aratat ca "lentile de contact"
// aduce din text si ortokeratologie sau lentile sclerale, iar "copil" aduce supraspecialitati.
// Folosit de matchProvidersSemantic si matchProviders (base44/functions/*/entry.ts). Copie
// identica in base44/shared/.

export const PROVIDER_TYPE_PREFERENCE_VERSION = 'provider-type-preference-v1';

export const PROVIDER_TYPE_PREFERENCE_MODES = Object.freeze([
  'medical_only',
  'medical_first',
  'optical_first',
  'optical_products',
]);

export const PROVIDER_CAPABILITY_BY_TYPE = Object.freeze({
  optica_medicala: 'optical',
  cabinet_optometric: 'optical',
  cabinet_oftalmologic: 'medical',
  clinica_oftalmologica: 'medical',
});

const PROVIDER_CAPABILITY_BY_PROFILE_TYPE = Object.freeze({
  independent_optical_store: 'optical',
  optical_chain: 'optical',
  independent_optometrist: 'optical',
  ophthalmology_clinic: 'medical',
  ophthalmology_office: 'medical',
  independent_ophthalmologist: 'medical',
});

// Probleme medicale sau servicii pe care le face medicul: consultatii oftalmologice, investigatii,
// supraspecialitati (glaucom, retina, keratocon...), proceduri si chirurgie.
const MEDICAL_GROUPS = new Set(['ophthalmology_consults', 'investigations', 'specialties', 'procedures_surgery']);
const MEDICAL_INTENTS = new Set(['simptome_oftalmologice', 'investigatii']);
const PEDIATRIC_GROUPS = new Set(['children_and_prevention']);
const MEDICAL_FIRST_INTENTS = new Set(['control_copil', 'unknown']);
// Lentile speciale (cornee neregulata, ortokeratologie, controlul miopiei): intai medicul.
const SPECIALTY_CONTACT_LENS_KEYS = new Set([
  'scleral_lenses',
  'orthokeratology',
  'specialty_contact_lens_fitting',
  'myopia_control_contact_lenses',
]);
// Examinari de vedere si adaptarea lentilelor de contact: le face optometristul, dar si medicul.
const EXAMINATION_GROUPS = new Set(['optometry']);
const CONTACT_LENS_EXAMINATION_KEYS = new Set([
  'contact_lens_consultation',
  'contact_lens_fitting',
  'contact_lens_trial',
  'contact_lens_insertion_training',
  'contact_lens_followup',
]);

// Cate locuri din lista de rezerva primeste tipul secundar, cand ramane vizibil ca alternativa.
const SECONDARY_SHARE = Object.freeze({
  medical_only: 0,
  medical_first: 1 / 3,
  optical_first: 1 / 3,
  optical_products: 0,
});

function clean(value) {
  return String(value || '').trim();
}

export function providerCapability(location) {
  return PROVIDER_CAPABILITY_BY_TYPE[clean(location?.provider_type)]
    || PROVIDER_CAPABILITY_BY_PROFILE_TYPE[clean(location?.provider_profile_type)]
    || null;
}

function preference(mode, reason) {
  return {
    version: PROVIDER_TYPE_PREFERENCE_VERSION,
    mode,
    order: mode === 'medical_only' ? ['medical'] : (mode === 'medical_first' ? ['medical', 'optical'] : ['optical', 'medical']),
    primary: mode === 'medical_only' || mode === 'medical_first' ? 'medical' : 'optical',
    reason,
  };
}

// Keratoconul (si forma "cheratocon"), aceeasi forma ca in shared/confirmedNeedServiceKeys.js.
const KERATOCONUS_PATTERN = /\b(?:k|ch)eratocon/i;

/**
 * @param {{ intent?: string, serviceKeys?: string[], text?: string, getDefinition?: ((key: string) => any) | null }} [input]
 */
export function resolveProviderTypePreference({ intent = '', serviceKeys = [], text = '', getDefinition = null } = {}) {
  const need = clean(intent);
  const keys = [...new Set((Array.isArray(serviceKeys) ? serviceKeys : []).map(clean).filter(Boolean))];
  const definitions = typeof getDefinition === 'function'
    ? keys.map((key) => getDefinition(key)).filter(Boolean)
    : [];
  const canonicalKeys = new Set([...keys, ...definitions.map((definition) => clean(definition.key))]);
  const hasGroup = (groups) => definitions.some((definition) => groups.has(clean(definition.group)));
  const hasKey = (set) => [...canonicalKeys].some((key) => set.has(key));

  // Nevoia neclara are si o cheie de consult in lista implicita; o tratam ca 'intai medicul',
  // nu ca 'doar medicul', ca opticile sa nu dispara.
  if (need === 'unknown') return preference('medical_first', 'unclear_need');
  if (MEDICAL_INTENTS.has(need)) return preference('medical_only', 'medical_need');
  // Copiii: intai medicul, dar opticile raman (ochelarii se fac tot acolo).
  if (MEDICAL_FIRST_INTENTS.has(need) || hasGroup(PEDIATRIC_GROUPS)) return preference('medical_first', 'child');
  if (hasGroup(MEDICAL_GROUPS)) return preference('medical_only', 'medical_service');
  if (KERATOCONUS_PATTERN.test(String(text || ''))) return preference('medical_first', 'keratoconus');
  if (hasKey(SPECIALTY_CONTACT_LENS_KEYS)) return preference('medical_first', 'specialty_contact_lenses');
  if (need === 'control_vedere' || hasGroup(EXAMINATION_GROUPS) || hasKey(CONTACT_LENS_EXAMINATION_KEYS)) {
    return preference('optical_first', 'routine_examination');
  }
  return preference('optical_products', 'optical_products');
}

// Puncte adaugate scorului unei locatii cu servicii confirmate, dupa tipul ei. Tipul principal al
// nevoii primeste `points`; celalalt nimic. Nu exclude pe nimeni: o optica cu medic oftalmolog si
// serviciu confirmat ramane eligibila si la o nevoie medicala (prerechizitele decid).
export function providerTypePreferencePoints(typePreference, location, points) {
  const capability = providerCapability(location);
  if (!typePreference || !capability) return 0;
  return capability === typePreference.primary ? Number(points) || 0 : 0;
}

// Alege profilurile din lista de rezerva (fara servicii declarate) dupa politica. Pastreaza ordinea
// primita in fiecare tip (contact public, apoi nume). Tipul secundar primeste o parte fixa a
// locurilor cand e alternativa (medical_first, optical_first) si doar locurile ramase libere cand
// nu e (optical_products). La medical_only, opticile nu intra.
export function selectStructuralByPreference(candidates, typePreference, { maxResults = 12, capabilityOf = (entry) => entry?.structural_capability } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const max = Math.max(0, Number(maxResults) || 0);
  const mode = typePreference?.mode || 'optical_products';
  const order = typePreference?.order || ['optical', 'medical'];
  const primary = order[0];
  const secondary = order[1] || null;
  const primaryItems = list.filter((entry) => capabilityOf(entry) === primary);
  const secondaryItems = secondary ? list.filter((entry) => capabilityOf(entry) === secondary) : [];
  const reserved = secondary ? Math.min(secondaryItems.length, Math.round(max * (SECONDARY_SHARE[mode] || 0))) : 0;
  const primaryTaken = primaryItems.slice(0, Math.max(0, max - reserved));
  const secondaryTaken = secondaryItems.slice(0, Math.max(0, max - primaryTaken.length));
  return [...primaryTaken, ...secondaryTaken];
}

// Nota grupului secundar, afisata pacientului sub titlul grupului.
export function providerTypeSecondaryNote(typePreference) {
  if (typePreference?.mode === 'optical_first') {
    return 'Pentru un consult medical complet, de exemplu după 40 de ani sau dacă ai o afecțiune a ochilor.';
  }
  if (typePreference?.mode === 'medical_first') {
    return 'Pentru ochelari sau lentile, după consult.';
  }
  return '';
}
