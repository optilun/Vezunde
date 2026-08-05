import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  getServiceSearchKeywords,
} from './canonicalServiceRegistryExtended.js';

export const SEMANTIC_INTENT_RULES = [
  {
    key: 'dry_eye_symptoms',
    phrases: ['ma ustura ochii', 'ochi uscati', 'ochi uscat', 'roseata', 'nisip in ochi', 'ma ard ochii', 'lacrimeaza ochii', 'imi lacrimeaza ochiul', 'lacrimeaza de cateva zile'],
    targets: [
      ['dry_eye_management', 1],
      ['dry_eye_screening', 0.9],
      ['pachymeter', 0.55],
    ],
  },
  {
    key: 'blurred_vision_refraction',
    phrases: [
      'vad in ceata', 'vad incetosat', 'control ochelari', 'mi au crescut dioptriile', 'nu mai vad bine', 'schimbat dioptrii',
      'control la ochi', 'control de vedere', 'control ochi', 'nu am mai fost de mult la control',
      'vreau sa fac un control', 'vederea incetosata seara', 'mi se incetoseaza vederea',
    ],
    targets: [
      ['optometry_consultation', 1],
      ['refraction', 0.96],
      ['visual_acuity_test', 0.78],
    ],
  },
  {
    key: 'photochromic_or_prescription_sun',
    phrases: ['ochelari heliomati', 'lentile heliomate', 'lentile de soare cu dioptrii', 'ochelari de soare cu dioptrii'],
    targets: [
      ['photochromic_lenses', 1],
      ['prescription_sunglasses', 0.92],
    ],
  },
  {
    key: 'ophthalmology_emergency',
    phrases: [
      'mi a intrat ceva in ochi', 'durere insuportabila', 'durere oculara brusca', 'pierdere brusca vedere',
      'lovitura in ochi', 'ochi rosu foarte dureros',
      // Variante suplimentare de fraze reale de pacient, ca sa treaca pragul de 0.7
      // fara sa depinda de o formulare exacta identica.
      'nu mai vad deloc', 'nu mai vad cu un ochi', 'mi am pierdut vederea brusc', 'am pierdut vederea',
      'durere foarte tare la ochi', 'durere mare la ochi si greata', 'ma doare ochiul foarte tare',
      'substanta chimica in ochi', 'mi a sarit ceva chimic in ochi', 'inalbitor in ochi', 'detergent in ochi',
      'soda caustica in ochi', 'a sarit ceva in ochi',
      'obiect infipt in ochi', 'obiect patruns in ochi', 'sticla in ochi', 'aschie in ochi',
      'dupa operatie la ochi nu mai vad', 'durere dupa operatie la ochi',
    ],
    targets: [
      ['emergency_ophthalmology', 1],
      ['ocular_trauma', 0.88],
      ['foreign_body_removal', 0.82],
    ],
  },
  {
    key: 'pediatric_eye_care',
    phrases: ['control ochelari copii', 'control ochi copil', 'ochi lenes', 'medici copii', 'oftalmolog copii', 'strabism copil', 'control vedere copil', 'control vedere pentru scoala', 'control vedere scoala', 'copilul meu trebuie sa faca un control'],
    targets: [
      ['children_eye_exam', 1],
      ['pediatric_ophthalmology', 0.98],
      ['pediatric_refraction', 0.9],
      ['vision_therapy', 1],
    ],
  },
  {
    key: 'onsite_employee_testing',
    phrases: ['testare ochelari la birou', 'testare angajati', 'control vedere la sediu', 'control ochelari angajati', 'screening vedere firma', 'testare la domiciliu'],
    targets: [['onsite_eye_testing_b2b', 1]],
  },
  {
    key: 'computer_screen',
    phrases: ['ochelari calculator', 'protectie ecrane', 'ochelari pentru ecran', 'lumina albastra calculator', 'ochelari birou'],
    targets: [
      ['computer_screen_glasses', 1],
      ['blue_light_lenses', 0.92],
      ['office_lenses', 0.76],
      ['occupational_vision', 0.65],
    ],
  },
  {
    key: 'cas_reimbursement',
    phrases: ['servicii decontate cas', 'decontare cas', 'cu bilet de trimitere', 'prin cnas', 'gratuit cu asigurare'],
    targets: [['cas_reimbursed_services', 1]],
  },
  {
    key: 'myopia_control',
    phrases: ['control miopie', 'miopie progresiva', 'lentile de noapte', 'ortokeratologie', 'stellest', 'miyosmart', 'mi yosmart'],
    targets: [
      ['myopia_management', 1],
      ['orthokeratology', 0.98],
      ['myopia_control_spectacle_lenses', 0.96],
      ['myopia_control_contact_lenses', 0.88],
      ['myopia_control_children', 0.82],
    ],
  },
  {
    key: 'orthoptics',
    phrases: ['ortoptica', 'exercitii vizuale', 'terapie ochi lenes', 'exercitii strabism', 'terapie ambliopie'],
    targets: [['vision_therapy', 1]],
  },
  {
    key: 'endothelial_microscopy',
    phrases: ['microscopie endoteliala', 'celule endoteliale', 'endoteliu cornean'],
    targets: [['specular_microscopy', 1]],
  },
];

export function normalizeSemanticText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokens(value) {
  return normalizeSemanticText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

function phraseScore(query, keyword) {
  const normalizedQuery = normalizeSemanticText(query);
  const normalizedKeyword = normalizeSemanticText(keyword);
  if (!normalizedQuery || !normalizedKeyword) return 0;
  if (normalizedQuery === normalizedKeyword) return 1;
  if (normalizedQuery.includes(normalizedKeyword) && normalizedKeyword.length >= 4) return 0.88;
  if (normalizedKeyword.includes(normalizedQuery) && normalizedQuery.length >= 5) return 0.74;

  const queryTokens = new Set(tokens(normalizedQuery));
  const keywordTokens = new Set(tokens(normalizedKeyword));
  if (queryTokens.size === 0 || keywordTokens.size === 0) return 0;
  const intersection = [...queryTokens].filter((item) => keywordTokens.has(item)).length;
  if (intersection === 0) return 0;
  const queryCoverage = intersection / queryTokens.size;
  const keywordCoverage = intersection / keywordTokens.size;
  const harmonic = (2 * queryCoverage * keywordCoverage) / (queryCoverage + keywordCoverage);
  return Math.min(0.68, harmonic * 0.72);
}

function addMatch(map, serviceKey, score, reason, keyword) {
  if (!getCanonicalServiceDefinition(serviceKey)) return;
  const current = map.get(serviceKey) || {
    service_key: serviceKey,
    score: 0,
    reasons: [],
    matched_keywords: [],
  };
  current.score = Math.max(current.score, score);
  if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
  if (keyword && !current.matched_keywords.includes(keyword)) current.matched_keywords.push(keyword);
  map.set(serviceKey, current);
}

export function resolveServiceSearchQuery(rawQuery, options = {}) {
  const query = normalizeSemanticText(rawQuery);
  const limit = Math.max(1, Math.min(Number(options.limit) || 12, 30));
  const minScore = Number.isFinite(Number(options.minScore)) ? Number(options.minScore) : 0.34;
  if (!query) return {
    query: String(rawQuery || ''),
    normalized_query: '',
    matches: [],
    service_keys: [],
  };

  const matches = new Map();

  for (const rule of SEMANTIC_INTENT_RULES) {
    const matchedPhrase = rule.phrases
      .map((phrase) => ({ phrase, score: phraseScore(query, phrase) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!matchedPhrase || matchedPhrase.score < 0.7) continue;
    for (const [serviceKey, weight] of rule.targets) {
      addMatch(
        matches,
        serviceKey,
        Math.min(1, matchedPhrase.score * Number(weight) + 0.08),
        `intent:${rule.key}`,
        matchedPhrase.phrase,
      );
    }
  }

  for (const serviceKey of CANONICAL_SERVICE_KEYS) {
    const definition = getCanonicalServiceDefinition(serviceKey);
    if (!definition || definition.patient_facing === false) continue;
    const candidates = [
      definition.label,
      ...(getServiceSearchKeywords(serviceKey) || []),
    ];
    let best = { score: 0, keyword: '' };
    for (const keyword of candidates) {
      const score = phraseScore(query, keyword);
      if (score > best.score) best = { score, keyword };
    }
    if (best.score >= minScore) {
      addMatch(matches, serviceKey, best.score, 'search_keyword', best.keyword);
    }
  }

  const ordered = [...matches.values()]
    .map((item) => ({
      ...item,
      score: Math.round(Math.min(1, item.score) * 1000) / 1000,
      label: getCanonicalServiceDefinition(item.service_key)?.label || item.service_key,
    }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'ro'))
    .slice(0, limit);

  return {
    query: String(rawQuery || ''),
    normalized_query: query,
    matches: ordered,
    service_keys: ordered.map((item) => item.service_key),
  };
}

export function getServiceSearchSuggestions(rawQuery, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 6, 12));
  const resolution = resolveServiceSearchQuery(rawQuery, {
    ...options,
    limit: Math.max(limit * 2, Number(options.limit) || 0),
  });
  return resolution.matches.slice(0, limit).map((match) => {
    const definition = getCanonicalServiceDefinition(match.service_key);
    return {
      label: definition?.label || match.service_key,
      service_key: match.service_key,
      category: definition?.group || "other",
      matched_keyword: match.matched_keywords?.[0] || "",
      score: match.score,
    };
  });
}
export function resolveServiceSearchKeys(rawQuery, options = {}) {
  return resolveServiceSearchQuery(rawQuery, options).service_keys;
}
