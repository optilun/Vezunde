// Recomandarea de specialisti, ca transformare pura.
//
// 2026-09-03. Pana acum motorul de recomandare cunostea o singura unitate: locatia. Specialistii
// existau in date (`ProfessionalProfile`, `ProfessionalLocationAssignment`) si pe pagina fiecarei
// locatii, dar pacientul care stie ca vrea "un oftalmolog", nu "o clinica", nu avea unde sa ceara
// asta. Fisierul asta adauga a doua unitate, fara sa atinga prima.
//
// De ce fisier separat si nu o extindere a shared/providerRecommendation.js: scorul locatiilor
// este inghetat prin garzi de stabilitate pe octeti (verify-patient-conversation-marketplace-
// isolation.mjs si cele trei amprente fnv1a peste matchProvidersSemantic/entry.ts). Regula
// proiectului spune ca matching-ul, ranking-ul si Top 3 nu se ating fara cerere explicita.
// Recomandarea de specialisti este un strat nou, paralel, care CONSUMA acelasi context de cerere
// si respecta acelasi contract de bucket-uri, dar nu modifica niciun octet din calea existenta.
//
// Contractul de bucket-uri este identic cu cel al locatiilor, ca frontendul sa poata folosi
// aceleasi sectiuni: `top3` (primii 3 din grupul confirmat), `extended_confirmed`,
// `extended_directory`. Top 3 este intotdeauna derivat din grup si rang, niciodata dintr-o
// taietura pozitionala.
//
// Fara pay-to-rank: niciun camp de abonament, membership sau plata nu intra in scor. Componentele
// sunt declarate explicit in `recommendation_score_components` si sunt aratate pacientului.

import {
  isMedicalProfessionalType,
  normalizeProfessionalType,
  professionalDisplayName,
  professionalSpecializationLabel,
  professionalTypeLabel,
  sanitizeProfessionalSpecializations,
} from './professionalIdentity.js';
import { isPublicProfessionalProfile } from './professionalProfileStatus.js';

export const PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION = 'professional-recommendation-v1';

// Ponderile scorului. Suma maxima 100. Sunt aici, nu imprastiate prin cod, ca sa se poata
// discuta si schimba intr-un singur loc.
export const PROFESSIONAL_SCORE_WEIGHTS = Object.freeze({
  specialization_match: 40,
  service_context: 20,
  profile_trust: 15,
  location_trust: 10,
  proximity: 10,
  reachability: 5,
});

const LOCATION_TRUST_POINTS = Object.freeze({
  verified: 10,
  claimed: 5,
  directory: 0,
});

const LOCATION_TRUST_ORDER = Object.freeze({
  verified: 2,
  claimed: 1,
  directory: 0,
});

// Etichetele de treapta geografica sunt cele produse de motorul de locatii: `oras`, `judet`,
// `tara`. `apropiere` si `national` apar in stratul de prezentare mai vechi si sunt acceptate
// aici ca sinonime, ca sa nu depinda scorul de care dintre cele doua vocabulare ajunge la noi.
const TIER_POINTS = Object.freeze({
  apropiere: 10,
  oras: 10,
  judet: 5,
  tara: 0,
  national: 0,
});

// Puntea intre nevoia pacientului (chei canonice de serviciu) si competenta declarata de
// specialist (chei de specializare). O profesie noua isi aduce propriile specializari in
// shared/professionalIdentity.js si propriile linii aici; restul lantului nu se atinge.
//
// Maparea este deliberat conservatoare: leaga o specializare de serviciile pe care acea
// specializare le acopera fara dubiu. Nu presupune competente si nu extinde prin sinonime.
export const SPECIALIZATION_SERVICE_KEYS = Object.freeze({
  general_ophthalmology: Object.freeze([
    'ophthalmology_consultation', 'complete_eye_exam', 'prescription_check', 'eye_pressure_check',
    'fundus_exam', 'anterior_segment_exam', 'followup_consultation', 'second_opinion', 'tonometry',
  ]),
  pediatric_ophthalmology: Object.freeze([
    'pediatric_ophthalmology', 'children_eye_exam', 'pediatric_refraction', 'amblyopia_screening',
    'strabismus_screening', 'strabismus', 'school_screening', 'myopia_control_children',
  ]),
  glaucoma: Object.freeze([
    'glaucoma_consultation', 'eye_pressure_check', 'tonometry', 'gonioscopy', 'visual_field_analyzer',
    'pachymeter', 'yag_laser',
  ]),
  retina: Object.freeze([
    'retina_consultation', 'vitreoretinal_consultation', 'fundus_exam', 'fundus_camera', 'oct',
    'angiography', 'diabetic_retinopathy', 'macular_degeneration', 'retinal_laser',
    'intravitreal_injections', 'electroretinography',
  ]),
  cornea: Object.freeze([
    'cornea_consultation', 'corneal_topography', 'keratometry', 'specular_microscopy',
    'corneal_crosslinking', 'pachymeter',
  ]),
  cataract: Object.freeze(['cataract_consultation', 'cataract_surgery', 'biometer', 'yag_laser']),
  refractive_surgery: Object.freeze(['refractive_surgery', 'laser_procedures', 'corneal_topography']),
  dry_eye: Object.freeze(['dry_eye_management', 'dry_eye_screening', 'lacrimal_system_consultation']),
  myopia_management: Object.freeze([
    'myopia_management', 'myopia_control_children', 'orthokeratology',
    'myopia_control_contact_lenses', 'myopia_control_spectacle_lenses',
  ]),
  refraction: Object.freeze([
    'refraction', 'optometry_consultation', 'visual_acuity_test', 'autorefractometry',
    'prescription_check', 'pd_measurement', 'digital_centering',
  ]),
  contact_lenses: Object.freeze([
    'contact_lenses', 'contact_lens_consultation', 'contact_lens_fitting', 'contact_lens_trial',
    'contact_lens_followup', 'contact_lens_insertion_training', 'toric_contact_lenses',
    'multifocal_contact_lenses', 'rgp_lenses', 'scleral_lenses', 'specialty_contact_lens_fitting',
  ]),
  pediatric_optometry: Object.freeze([
    'children_eye_exam', 'pediatric_refraction', 'amblyopia_screening', 'school_screening',
    'children_frames', 'school_vision_screening',
  ]),
  binocular_vision: Object.freeze(['binocular_vision', 'vision_therapy', 'prism_lenses', 'strabismus_screening']),
  low_vision: Object.freeze(['low_vision_rehabilitation']),
  occupational_vision: Object.freeze([
    'occupational_vision', 'workplace_vision_screening', 'computer_screen_glasses',
    'office_lenses', 'blue_light_lenses', 'employer_glasses_reimbursement',
  ]),
  frame_consulting: Object.freeze(['frames', 'eyeglasses', 'sunglasses', 'prescription_sunglasses', 'accessories']),
  ophthalmic_lenses: Object.freeze([
    'prescription_lenses', 'single_vision_lenses', 'thin_lenses', 'photochromic_lenses',
    'polarized_lenses', 'blue_light_lenses', 'reading_lenses',
  ]),
  progressive_lenses: Object.freeze(['progressive_lenses', 'office_lenses']),
  lens_fitting: Object.freeze([
    'lens_fitting', 'lens_replacement', 'client_frame_lens_mounting', 'rimless_drilling',
    'semi_rimless_grooving', 'optical_quality_check', 'pd_measurement', 'digital_centering',
  ]),
  adjustments_repairs: Object.freeze([
    'eyeglasses_adjustment', 'frame_straightening', 'temple_adjustment', 'bridge_adjustment',
    'hinge_adjustment', 'screw_replacement', 'nose_pad_replacement', 'temple_tip_replacement',
    'eyeglasses_repair', 'frame_repair', 'temple_replacement', 'hinge_repair',
    'acetate_frame_repair', 'metal_frame_soldering', 'frame_polishing', 'frame_cleaning',
    'ultrasonic_cleaning',
  ]),
  children_eyewear: Object.freeze(['children_frames', 'sports_glasses']),
  protective_eyewear: Object.freeze(['safety_glasses', 'sports_glasses']),
});

const SERVICE_TO_SPECIALIZATIONS = (() => {
  const map = new Map();
  for (const [specialization, serviceKeys] of Object.entries(SPECIALIZATION_SERVICE_KEYS)) {
    for (const key of serviceKeys) {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(specialization);
    }
  }
  return map;
})();

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function round(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/**
 * Specializarile care raspund cheilor de serviciu cerute. Folosita si invers, la explicatii.
 */
export function specializationsForServiceKeys(serviceKeys) {
  const out = new Set();
  for (const key of unique(serviceKeys)) {
    const matches = SERVICE_TO_SPECIALIZATIONS.get(key);
    if (matches) for (const specialization of matches) out.add(specialization);
  }
  return [...out];
}

export function serviceKeysForSpecializations(specializations) {
  const out = new Set();
  for (const specialization of unique(specializations)) {
    for (const key of SPECIALIZATION_SERVICE_KEYS[specialization] || []) out.add(key);
  }
  return [...out];
}

/**
 * Grupul de recomandare pentru un specialist.
 *
 * Regula de siguranta, aceeasi ca la locatii: pentru o nevoie medicala specializata doar
 * profesiile medicale intra in grupul confirmat. Un optician competent ramane vizibil, dar sub
 * cei care pot da raspunsul medical - nu e ascuns, doar nu e propus ca prima optiune pentru o
 * decizie care nu e a lui.
 */
export function professionalRecommendationGroup({
  professionalType,
  matchedSpecializations = [],
  needLevel = 'general',
} = {}) {
  if (needLevel === 'specialized_medical' && !isMedicalProfessionalType(professionalType)) {
    return 'directory';
  }
  return unique(matchedSpecializations).length > 0 ? 'confirmed' : 'directory';
}

export function buildProfessionalScore({
  matchedSpecializations = [],
  requestedSpecializations = [],
  matchedServiceKeys = [],
  requestedServiceKeys = [],
  bestLocationTrust = 'directory',
  expansionTier = 'oras',
  publicLocationCount = 0,
} = {}) {
  const w = PROFESSIONAL_SCORE_WEIGHTS;

  const requestedSpecializationCount = unique(requestedSpecializations).length;
  const matchedSpecializationCount = unique(matchedSpecializations).length;
  const specializationRatio = requestedSpecializationCount > 0
    ? Math.min(1, matchedSpecializationCount / requestedSpecializationCount)
    : (matchedSpecializationCount > 0 ? 1 : 0);
  const specializationMatch = round(specializationRatio * w.specialization_match);

  const requestedServiceCount = unique(requestedServiceKeys).length;
  const matchedServiceCount = unique(matchedServiceKeys).length;
  const serviceRatio = requestedServiceCount > 0
    ? Math.min(1, matchedServiceCount / requestedServiceCount)
    : (matchedServiceCount > 0 ? 1 : 0);
  const serviceContext = round(serviceRatio * w.service_context);

  // Profilul specialistului ajunge in motor doar daca e verificat, deci punctajul de incredere
  // proprie este constant. Il pastram explicit, nu implicit, ca sa fie vizibil in explicatii si
  // ca sa nu dispara tacit daca poarta publica se schimba vreodata.
  const profileTrust = w.profile_trust;
  const locationTrust = LOCATION_TRUST_POINTS[clean(bestLocationTrust)] ?? 0;
  const proximity = TIER_POINTS[clean(expansionTier)] ?? 0;
  const reachability = Math.min(w.reachability, Math.max(0, Number(publicLocationCount) || 0) * 2.5);

  const components = {
    specialization_match: specializationMatch,
    service_context: serviceContext,
    profile_trust: profileTrust,
    location_trust: locationTrust,
    proximity,
    reachability: round(reachability),
  };

  const total = round(Object.values(components).reduce((sum, value) => sum + value, 0));
  return { score: total, components };
}

export function buildProfessionalExplanations({
  professionalType,
  matchedSpecializations = [],
  matchedServiceKeys = [],
  bestLocationTrust = 'directory',
  publicLocationCount = 0,
} = {}) {
  const explanations = [];

  for (const specialization of unique(matchedSpecializations).slice(0, 2)) {
    explanations.push({
      code: 'specialization_match',
      label: `Specializare declarata: ${professionalSpecializationLabel(specialization)}`,
      specialization,
    });
  }

  if (unique(matchedServiceKeys).length > 0) {
    explanations.push({
      code: 'service_available_at_location',
      label: 'Serviciul cautat este confirmat la o locatie unde lucreaza',
    });
  }

  explanations.push({
    code: 'verified_professional_profile',
    label: `${professionalTypeLabel(professionalType)} cu profil verificat de VIASEE`,
  });

  if (clean(bestLocationTrust) === 'verified') {
    explanations.push({ code: 'verified_location_profile', label: 'Lucreaza intr-o locatie cu profil verificat' });
  } else if (publicLocationCount > 1) {
    explanations.push({ code: 'multiple_locations', label: `Poate fi gasit in ${publicLocationCount} locatii publice` });
  }

  return explanations.slice(0, 4);
}

export function getProfessionalConfidence({
  matchedSpecializations = [],
  bestLocationTrust = 'directory',
  matchedServiceKeys = [],
} = {}) {
  const specializationCount = unique(matchedSpecializations).length;
  if (specializationCount > 1 && clean(bestLocationTrust) === 'verified') return 'high';
  if (specializationCount > 0 && unique(matchedServiceKeys).length > 0) return 'high';
  if (specializationCount > 0) return 'medium';
  return 'limited';
}

/**
 * Panoul de incredere pentru un specialist, in exact acelasi format ca
 * `buildProviderDecisionConfidence` pentru locatii, ca sa fie randat de aceeasi componenta
 * (`DecisionConfidencePanel`) si sa arate identic. Ce difera este continutul dovezilor, pentru ca
 * intrebarea e alta: nu "ce ofera locul", ci "ce declara persoana".
 */
export function buildProfessionalDecisionConfidence({
  professionalType,
  matchedSpecializations = [],
  matchedServiceKeys = [],
  bestLocationTrust = 'directory',
  publicLocationCount = 0,
  needLevel = 'general',
} = {}) {
  const specializationCount = unique(matchedSpecializations).length;
  const serviceCount = unique(matchedServiceKeys).length;
  const evidence = [];
  const limitations = [];

  evidence.push({
    code: 'verified_professional',
    label: `${professionalTypeLabel(professionalType)} cu profil verificat de VIASEE`,
  });

  if (specializationCount > 0) {
    evidence.push({
      code: 'declared_specialization',
      label: specializationCount > 1
        ? `${specializationCount} specializari declarate acopera aceasta cerere`
        : 'O specializare declarata acopera aceasta cerere',
    });
  } else {
    limitations.push('Specializarile declarate nu acopera explicit ce ai cerut.');
  }

  if (serviceCount > 0) {
    evidence.push({
      code: 'service_confirmed_at_location',
      label: 'Serviciul cautat este confirmat la o locatie unde lucreaza',
    });
  } else {
    limitations.push('Serviciul cautat nu este confirmat la locatiile unde lucreaza.');
  }

  if (clean(bestLocationTrust) === 'verified') {
    evidence.push({ code: 'verified_location', label: 'Lucreaza intr-o locatie cu profil verificat' });
  } else if (clean(bestLocationTrust) === 'claimed') {
    limitations.push('Locatia unde lucreaza nu are inca nivelul complet de verificare VIASEE.');
  }

  if (publicLocationCount > 0) {
    evidence.push({
      code: 'reachable_locations',
      label: publicLocationCount === 1
        ? 'Poate fi gasit intr-o locatie publica'
        : `Poate fi gasit in ${publicLocationCount} locatii publice`,
    });
  }

  // Programul si disponibilitatea persoanei nu sunt date pe care VIASEE le detine. Spunem asta,
  // nu il lasam pe pacient sa presupuna.
  limitations.push('Programul personal si disponibilitatea nu sunt confirmate in VIASEE.');

  if (needLevel === 'specialized_medical' && !isMedicalProfessionalType(professionalType)) {
    limitations.push('Aceasta profesie nu acopera diagnosticul medical.');
  }

  const evidenceCount = evidence.length;
  let level = 'limited';
  if (specializationCount > 0 && serviceCount > 0 && evidenceCount >= 4) level = 'high';
  else if (specializationCount > 0 && evidenceCount >= 3) level = 'good';

  const labels = {
    high: 'Potrivire foarte bine sustinuta',
    good: 'Potrivire bine sustinuta',
    limited: 'Potrivire cu informatii limitate',
  };
  const summaries = {
    high: 'Mai multe informatii confirmate sustin acest specialist.',
    good: 'Exista suficiente informatii confirmate pentru a lua in calcul acest specialist.',
    limited: 'Specialistul este relevant, dar unele informatii importante nu sunt confirmate.',
  };

  return {
    contract_version: PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
    level,
    label: labels[level],
    summary: summaries[level],
    filled_segments: level === 'high' ? 3 : level === 'good' ? 2 : 1,
    total_segments: 3,
    evidence: evidence.slice(0, 5),
    limitations: [...new Set(limitations)].slice(0, 3),
    commercial_influence: false,
  };
}

export function compareProfessionalEntries(a, b) {
  const scoreDifference = (Number(b?.recommendation_score) || 0) - (Number(a?.recommendation_score) || 0);
  if (scoreDifference !== 0) return scoreDifference;
  const specializationDifference = (b?.matched_specializations?.length || 0) - (a?.matched_specializations?.length || 0);
  if (specializationDifference !== 0) return specializationDifference;
  const serviceDifference = (b?.matched_service_keys?.length || 0) - (a?.matched_service_keys?.length || 0);
  if (serviceDifference !== 0) return serviceDifference;
  const trustDifference = (LOCATION_TRUST_ORDER[b?.best_location_trust] || 0) - (LOCATION_TRUST_ORDER[a?.best_location_trust] || 0);
  if (trustDifference !== 0) return trustDifference;
  const nameDifference = clean(a?.display_name).localeCompare(clean(b?.display_name), 'ro');
  if (nameDifference !== 0) return nameDifference;
  return clean(a?.id).localeCompare(clean(b?.id), 'ro');
}

/**
 * Acelasi contract de bucket-uri ca la locatii. Top 3 = primii trei din grupul confirmat, marcati
 * explicit; niciodata o taietura pozitionala peste lista completa.
 */
export function assignProfessionalBuckets(entries = [], limit = 20) {
  const sorted = [...entries].sort(compareProfessionalEntries);
  const confirmed = sorted.filter((entry) => entry.recommendation_group === 'confirmed');
  const directory = sorted.filter((entry) => entry.recommendation_group === 'directory');
  const visible = [...confirmed, ...directory].slice(0, Math.max(1, Number(limit) || 20));
  let confirmedRank = 0;
  let directoryRank = 0;
  return visible.map((entry) => {
    if (entry.recommendation_group === 'confirmed') {
      confirmedRank += 1;
      return {
        ...entry,
        result_bucket: confirmedRank <= 3 ? 'top3' : 'extended_confirmed',
        bucket_rank: confirmedRank,
        is_top3_eligible: true,
      };
    }
    directoryRank += 1;
    return {
      ...entry,
      result_bucket: 'extended_directory',
      bucket_rank: directoryRank,
      is_top3_eligible: false,
    };
  });
}

/**
 * Construieste o intrare de recomandare pentru un specialist, din profilul lui si din locatiile
 * publice unde este asociat.
 *
 * @param {object} input
 * @param {object} input.profile ProfessionalProfile
 * @param {Array<object>} input.locations locatii publice deja filtrate (id, name, city, county,
 *   profile_control_status, expansion_tier, organization_id, organization_name, service_keys)
 * @param {Array<string>} input.requestedServiceKeys cheile de serviciu rezolvate din cererea pacientului
 * @param {string} input.needLevel general | technical | specialized_medical
 */
export function buildProfessionalRecommendationEntry({
  profile,
  locations = [],
  requestedServiceKeys = [],
  needLevel = 'general',
} = {}) {
  if (!isPublicProfessionalProfile(profile)) return null;

  const professionalType = normalizeProfessionalType(profile?.professional_type || profile?.role);
  if (!professionalType) return null;

  const displayName = professionalDisplayName(profile);
  if (!displayName) return null;

  const publicLocations = (Array.isArray(locations) ? locations : []).filter(Boolean);
  if (publicLocations.length === 0) return null;

  const specializations = sanitizeProfessionalSpecializations(professionalType, profile?.specializations);
  const requestedSpecializations = specializationsForServiceKeys(requestedServiceKeys)
    .filter((item) => SPECIALIZATION_SERVICE_KEYS[item]);
  const requestedSpecializationSet = new Set(requestedSpecializations);
  const matchedSpecializations = specializations.filter((item) => requestedSpecializationSet.has(item));

  const requestedServiceSet = new Set(unique(requestedServiceKeys));
  const matchedServiceKeys = unique(
    publicLocations.flatMap((location) => (Array.isArray(location.service_keys) ? location.service_keys : [])),
  ).filter((key) => requestedServiceSet.has(key));

  const bestLocationTrust = publicLocations.reduce((best, location) => {
    const current = clean(location.profile_control_status) || 'directory';
    return (LOCATION_TRUST_ORDER[current] || 0) > (LOCATION_TRUST_ORDER[best] || 0) ? current : best;
  }, 'directory');

  const expansionTier = publicLocations.reduce((best, location) => {
    const current = clean(location.expansion_tier) || 'tara';
    return (TIER_POINTS[current] ?? 0) > (TIER_POINTS[best] ?? 0) ? current : best;
  }, 'tara');

  const { score, components } = buildProfessionalScore({
    matchedSpecializations,
    requestedSpecializations,
    matchedServiceKeys,
    requestedServiceKeys,
    bestLocationTrust,
    expansionTier,
    publicLocationCount: publicLocations.length,
  });

  return {
    id: clean(profile.id),
    entity_kind: 'professional',
    display_name: displayName,
    professional_type: professionalType,
    professional_type_label: professionalTypeLabel(professionalType),
    profile_photo_url: clean(profile.profile_photo_url) || null,
    bio: clean(profile.professional_bio || profile.bio),
    specializations,
    specialization_labels: specializations.map(professionalSpecializationLabel),
    matched_specializations: matchedSpecializations,
    matched_specialization_labels: matchedSpecializations.map(professionalSpecializationLabel),
    matched_service_keys: matchedServiceKeys,
    accepts_independent_requests: profile.accepts_independent_requests === true,
    verified: true,
    locations: publicLocations.map((location) => ({
      id: clean(location.id),
      name: clean(location.name),
      city: clean(location.city),
      county: clean(location.county),
      organization_id: clean(location.organization_id) || null,
      organization_name: clean(location.organization_name) || null,
      profile_control_status: clean(location.profile_control_status) || 'directory',
      expansion_tier: clean(location.expansion_tier) || 'tara',
    })),
    public_location_count: publicLocations.length,
    best_location_trust: bestLocationTrust,
    expansion_tier: expansionTier,
    recommendation_contract_version: PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
    recommendation_group: professionalRecommendationGroup({
      professionalType,
      matchedSpecializations,
      needLevel,
    }),
    recommendation_score: score,
    recommendation_score_components: components,
    recommendation_confidence: getProfessionalConfidence({
      matchedSpecializations,
      bestLocationTrust,
      matchedServiceKeys,
    }),
    recommendation_explanations: buildProfessionalExplanations({
      professionalType,
      matchedSpecializations,
      matchedServiceKeys,
      bestLocationTrust,
      publicLocationCount: publicLocations.length,
    }),
    score,
  };
}

export default {
  PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
  PROFESSIONAL_SCORE_WEIGHTS,
  SPECIALIZATION_SERVICE_KEYS,
  specializationsForServiceKeys,
  serviceKeysForSpecializations,
  professionalRecommendationGroup,
  buildProfessionalScore,
  buildProfessionalExplanations,
  buildProfessionalDecisionConfidence,
  getProfessionalConfidence,
  compareProfessionalEntries,
  assignProfessionalBuckets,
  buildProfessionalRecommendationEntry,
};
