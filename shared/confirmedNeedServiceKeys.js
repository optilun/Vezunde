// Cheile de serviciu gasite in textul liber, cand pacientul are o nevoie confirmata.
//
// 2026-09-25, decizia owner-ului (docs/audit-ai-cautare-recomandare-2026-09-24.md, 11.2).
// Cautarea semantica pe textul pacientului adauga chei peste nevoia confirmata, iar un cuvant
// comun le aduce pe toate: "ochelari" e cuvant cheie pentru 10 servicii, "lentile de contact"
// pentru 15. La o reparatie intrau ochelari de soare, rame si accesorii (in simulare, o optica
// fara reparatii iesea prima in Top 3, desi la distribuire nu putea primi cererea), iar o
// cumparare de lentile devenea nevoie medicala specializata (Top 3 doar cu profiluri
// verificate, fallback fara optici, distribuire blocata pentru opticile revendicate).
//
// Regula: cand nevoia e confirmata (intentie cunoscuta si chei explicite), o cheie gasita in
// text ramane doar daca e din familia nevoii, iar la nevoile comerciale (reparatii, ochelari,
// lentile de contact) nu poate ridica cererea la `specialized_medical`. Cheile explicite
// (categoria, raspunsurile, propunerea AI confirmata) raman toate. Fara nevoie confirmata
// (cautarea libera din /cauta) rezultatul e reuniunea de pana acum.
//
// Folosit de potrivirea din browser (src/lib/providerSemanticSearch.js) si de server
// (base44/functions/matchProvidersSemantic/entry.ts). Copie identica in base44/shared/.
// Formulele de scor, bucket-urile si selectia Top 3 nu se schimba: se schimba doar cheile
// care intra in potrivire.

const MEDICAL_NEED_GROUPS = Object.freeze([
  'ophthalmology_consults',
  'investigations',
  'specialties',
  'procedures_surgery',
  'children_and_prevention',
  'optometry',
  // Atributele de serviciu (ex. consult la domiciliu) apartin consultului, nu vanzarii.
  'business_attributes',
]);

export const CONFIRMED_NEED_SERVICE_GROUPS = Object.freeze({
  reparatii_ochelari: Object.freeze(['technical_activities']),
  ochelari_lentile: Object.freeze([
    'optical_retail',
    'lenses_and_measurements',
    'technical_activities',
    'optometry',
    'business_attributes',
  ]),
  lentile_contact: Object.freeze(['contact_lenses', 'optometry']),
  control_vedere: MEDICAL_NEED_GROUPS,
  control_copil: MEDICAL_NEED_GROUPS,
  simptome_oftalmologice: MEDICAL_NEED_GROUPS,
  investigatii: MEDICAL_NEED_GROUPS,
});

const COMMERCIAL_NEEDS = new Set(['reparatii_ochelari', 'ochelari_lentile', 'lentile_contact']);

// 2026-09-26, decizia owner-ului: un pacient cu keratocon care cere lentile de contact are
// nevoie de adaptare speciala (lentile rigide sau sclerale) la un specialist, nu de o cumparare
// obisnuita. Cand textul pomeneste keratoconul, nevoia de lentile si nevoile medicale pastreaza
// din text atat serviciile medicale, cat si pe cele de lentile de contact, iar lentilele nu mai
// sunt tratate ca nevoie comerciala. Ochelarii si reparatiile raman neschimbate.
const KERATOCONUS_PATTERN = /\b(?:k|ch)eratocon/i;
const KERATOCONUS_NEEDS = new Set(['lentile_contact', 'simptome_oftalmologice', 'control_vedere', 'investigatii']);
const KERATOCONUS_GROUPS = Object.freeze([...MEDICAL_NEED_GROUPS, 'contact_lenses']);

const NEED_ORDER = Object.freeze({ general: 0, technical: 1, specialized_medical: 2 });

function uniqueKeys(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

function highestNeedLevel(definitions) {
  return definitions.reduce((level, definition) => (
    (NEED_ORDER[definition.service_need_level] ?? -1) > (NEED_ORDER[level] ?? -1)
      ? definition.service_need_level
      : level
  ), 'general');
}

/**
 * @param {{
 *   intent?: string,
 *   explicitKeys?: string[],
 *   textKeys?: string[],
 *   text?: string,
 *   getDefinition?: ((key: string) => any) | null,
 * }} input
 */
export function filterTextServiceKeysForConfirmedNeed({
  intent = '',
  explicitKeys = [],
  textKeys = [],
  text: patientText = '',
  getDefinition = null,
} = {}) {
  const need = String(intent || '').trim();
  const explicit = uniqueKeys(explicitKeys);
  const text = uniqueKeys(textKeys);
  const keratoconus = KERATOCONUS_NEEDS.has(need) && KERATOCONUS_PATTERN.test(String(patientText || ''));
  const allowedGroups = keratoconus ? KERATOCONUS_GROUPS : CONFIRMED_NEED_SERVICE_GROUPS[need];
  if (!allowedGroups || explicit.length === 0 || typeof getDefinition !== 'function') {
    return { serviceKeys: uniqueKeys([...explicit, ...text]), droppedTextKeys: [], applied: false };
  }

  const explicitDefinitions = explicit.map((key) => getDefinition(key)).filter(Boolean);
  const explicitCanonicalKeys = new Set(explicitDefinitions.map((definition) => definition.key));
  const explicitLevel = highestNeedLevel(explicitDefinitions);

  const keptTextKeys = [];
  const droppedTextKeys = [];
  for (const key of text) {
    const definition = getDefinition(key);
    const sameAsExplicit = explicit.includes(key) || Boolean(definition && explicitCanonicalKeys.has(definition.key));
    const inNeedFamily = Boolean(definition && allowedGroups.includes(definition.group));
    const raisesCommercialNeed = !keratoconus
      && COMMERCIAL_NEEDS.has(need)
      && definition?.service_need_level === 'specialized_medical'
      && explicitLevel !== 'specialized_medical';
    if (sameAsExplicit || (inNeedFamily && !raisesCommercialNeed)) keptTextKeys.push(key);
    else droppedTextKeys.push(key);
  }

  return {
    serviceKeys: uniqueKeys([...explicit, ...keptTextKeys]),
    droppedTextKeys,
    applied: true,
  };
}
