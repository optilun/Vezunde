import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  getServiceSearchKeywords,
} from './canonicalServiceRegistryExtended.js';

export const SEMANTIC_INTENT_RULES = [
  {
    key: 'dry_eye_symptoms',
    phrases: [
      'ma ustura ochii', 'ochi uscati', 'ochi uscat', 'roseata', 'nisip in ochi', 'ma ard ochii',
      'lacrimeaza ochii', 'imi lacrimeaza ochiul', 'lacrimeaza de cateva zile',
      // 2026-09-03: formularea cea mai frecventa lipsea complet.
      'ma usuca ochii', 'usuca ochii', 'uscaciune la ochi', 'senzatie de uscaciune',
      'ochii obositi seara', 'ma inteapa ochii',
    ],
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
      // Cele mai comune formulari de miopie / presbiopie - lipseau complet si trimiteau
      // pacientul pe fluxul de simptome, unde risca sa bifeze gresit un semnal de urgenta.
      'nu vad bine la distanta', 'nu vad bine la aproape', 'nu mai vad bine la distanta',
      'nu mai vad bine la aproape', 'nu vad bine de departe', 'nu vad de aproape',
      'vad greu la distanta', 'vad greu de aproape', 'nu disting literele', 'nu vad la tabla',
      // 2026-09-03, audit flow intrebari/recomandari. Masurat pe un corpus de 61 de
      // formulari reale, "vad cam incetosat de cateva saptamani", "vreau sa imi verific
      // vederea" sau "nu am mai fost la un control de ochi de 5 ani" nu produceau nicio
      // cheie de serviciu. Potrivirea se compara prin subsir, deci fiecare varianta
      // trebuie scrisa, nu dedusa.
      'incetosat', 'incetosata', 'vedere incetosata',
      'verific vederea', 'verifica vederea', 'verificare a vederii', 'verific ochii',
      'control de ochi', 'control de rutina la ochi',
      'nu am mai fost la control', 'nu am mai fost la un control', 'nu am mai fost la oftalmolog',
      'mi a scazut vederea', 'a scazut vederea', 'a scazut treptat', 'scade vederea',
      'nu mai vede bine', 'nu vede bine', 'nevoie de un control', 'are nevoie de control',
      'masor dioptriile', 'sa imi masor dioptriile',
      'am miopie', 'miopie mare', 'sunt miop', 'sunt miopa',
      'am astigmatism', 'am hipermetropie', 'am prezbiopie', 'am presbiopie',
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
      // 2026-09-03: perdeaua peste camp vizual lipsea, desi e una dintre cele mai
      // frecvente descrieri de dezlipire de retina.
      'ca o perdea', 'ca o cortina', 'perdea peste vedere', 'perdea in fata ochiului',
      'umbra peste vedere',
      // Traumatismul si durerea severa trebuie sa ramana aici, nu pe ruta de refractie:
      // "m-am lovit la ochi si nu mai vad bine" cadea pe control de dioptrii.
      'm am lovit la ochi', 'lovit la ochi', 'lovitura in ochi', 'am luat o lovitura in ochi',
      'durere severa la ochi', 'durere oculara severa', 'durere severa',
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
    phrases: ['testare ochelari la birou', 'testare angajati', 'control vedere la sediu', 'control ochelari angajati', 'screening vedere firma', 'medicina muncii vedere'],
    targets: [['workplace_vision_screening', 1]],
  },
  {
    key: 'home_visit_eye_care',
    phrases: [
      'testare la domiciliu', 'consultatie acasa', 'control vedere la domiciliu',
      'oftalmolog la domiciliu', 'nu ma pot deplasa',
      // 2026-09-03: cererea vine des la persoana a treia, pentru un parinte sau bunic.
      'nu se poate deplasa', 'nu poate sa se deplaseze', 'nu poate iesi din casa',
      'este imobilizat', 'este imobilizata la pat',
    ],
    targets: [['home_visit_eye_care', 1]],
  },
  {
    key: 'employer_reimbursement',
    phrases: ['decontare ochelari angajator', 'ochelari decontati de firma', 'hg 1028', 'adeverinta pentru ochelari', 'ochelari pe firma'],
    targets: [['employer_glasses_reimbursement', 1]],
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

  // 2026-09-03, audit flow intrebari/recomandari. Regulile de mai jos acopera formulari
  // uzuale care nu se legau de nicio cheie din catalog. Fiecare tinta este un serviciu
  // canonic existent - nu s-a inventat niciun serviciu si nu s-a schimbat niciun scor.
  {
    key: 'red_or_irritated_eye',
    phrases: [
      'ochi rosu', 'ochiul rosu', 'ochi rosii', 'ochii rosii', 'ochi iritat', 'iritatie la ochi',
      'ma mananca ochii', 'ma mananca ochiul', 'secretii la ochi', 'ochi lipit dimineata',
      'alergie la ochi', 'conjunctivita',
    ],
    targets: [
      ['ophthalmology_consultation', 1],
      ['anterior_segment_exam', 0.86],
      ['dry_eye_screening', 0.62],
    ],
  },
  {
    key: 'eyelid_lump',
    phrases: [
      'umflatura la pleoapa', 'pleoapa umflata', 'nodul la pleoapa', 'bubita pe pleoapa',
      'ulcior la ochi', 'salazion', 'orjelet',
    ],
    targets: [
      ['oculoplastics_consultation', 1],
      ['chalazion_treatment', 0.9],
      ['ophthalmology_consultation', 0.84],
    ],
  },
  {
    key: 'floaters_in_vision',
    phrases: [
      'puncte negre care plutesc', 'puncte negre in fata ochilor', 'pete care plutesc',
      'muste zburatoare', 'corpi flotanti', 'firicele in fata ochilor',
    ],
    targets: [
      ['retina_consultation', 1],
      ['vitreoretinal_consultation', 0.9],
      ['fundus_exam', 0.86],
      ['ophthalmology_consultation', 0.8],
    ],
  },
  {
    key: 'keratoconus_care',
    phrases: ['keratoconus', 'keratocon', 'cornee subtiata'],
    targets: [
      ['cornea_consultation', 1],
      ['corneal_topography', 0.92],
      ['corneal_crosslinking', 0.86],
      ['specialty_contact_lens_fitting', 0.72],
    ],
  },
  {
    key: 'oct_referral',
    phrases: [
      'nevoie de oct', 'trimitere pentru oct', 'sa fac oct', 'fac un oct', 'oct la ochi',
      'oct retina', 'oct macula', 'tomografie in coerenta optica',
    ],
    targets: [
      ['oct', 1],
      ['retina_consultation', 0.62],
    ],
  },
  {
    key: 'retinal_angiography_referral',
    phrases: ['angiofluorografie', 'angiografie cu fluoresceina', 'angiografie retiniana', 'fluoresceina'],
    targets: [['angiography', 1]],
  },
  {
    key: 'squinting_or_school_vision',
    phrases: [
      'mijeste ochii', 'mijeste ochiul', 'strange din ochi ca sa vada',
      'nu vede la tabla', 'nu vede bine la tabla', 'sta prea aproape de televizor',
      'sta aproape de ecran', 'se apropie prea mult de carte',
    ],
    targets: [
      ['optometry_consultation', 1],
      ['refraction', 0.92],
      ['children_eye_exam', 0.88],
      ['pediatric_refraction', 0.8],
      ['visual_acuity_test', 0.78],
    ],
  },
  {
    key: 'eye_deviation',
    phrases: [
      'un ochi care fuge', 'ochiul fuge in lateral', 'ii fuge un ochi', 'ochii fug',
      'se uita cruce', 'ochi cruce', 'ochiul deviaza',
    ],
    targets: [
      ['strabismus', 1],
      ['strabismus_screening', 0.92],
      ['pediatric_ophthalmology', 0.86],
      ['children_eye_exam', 0.8],
      ['binocular_vision', 0.72],
    ],
  },
  {
    key: 'eyestrain_reading_or_screen',
    phrases: [
      'dureri de cap cand citesc', 'dureri de cap cand citeste', 'ma doare capul cand citesc',
      'ma doare capul cand stau la calculator', 'ma doare capul de la calculator',
      'obosesc ochii la calculator', 'oboseala oculara', 'ochii obosesc repede',
      'stau mult la calculator', 'stau la calculator', 'stau mult in fata ecranului',
    ],
    targets: [
      ['optometry_consultation', 1],
      ['binocular_vision', 0.9],
      ['refraction', 0.86],
      ['computer_screen_glasses', 0.76],
      ['office_lenses', 0.7],
    ],
  },
  {
    key: 'driving_or_work_vision_certificate',
    phrases: [
      'permis auto', 'permisul auto', 'adeverinta pentru permis', 'fisa pentru permis',
      'adeverinta pentru angajare', 'adeverinta medicala pentru vedere', 'fisa de aptitudini',
    ],
    targets: [
      ['occupational_vision', 1],
      ['visual_acuity_test', 0.9],
      ['color_vision_test', 0.82],
      ['optometry_consultation', 0.76],
    ],
  },
  {
    key: 'undefined_eye_problem',
    phrases: [
      'o problema cu ochii', 'probleme cu ochii', 'probleme la ochi', 'am ceva la ochi',
      'ceva in neregula cu ochii', 'ceva legat de vedere', 'legat de vedere',
    ],
    targets: [
      ['ophthalmology_consultation', 1],
      ['optometry_consultation', 0.9],
      ['complete_eye_exam', 0.8],
    ],
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
