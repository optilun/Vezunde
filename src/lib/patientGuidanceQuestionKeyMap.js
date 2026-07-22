// Mapare controlata intre cheile chestionarului legacy (intentRegistry.js) si
// cheile aprobate din patient-guidance-question-selection-v1. Folosita doar pentru
// selectia adaptiva a urmatoarei intrebari — nu influenteaza matchingul sau rezultatele.

export const LEGACY_QUESTION_KEY_TO_GUIDANCE_KEY = Object.freeze({
  pentru_cine: "for_whom",
  varsta_copil: "child_age_group",
  investigatie: "investigation_type",
  ce_cauti: "optical_product_type",
  prima_data: "contact_lens_experience",
  ce_deteriorat: "repair_type",
  descriere: "symptom_description",
  timing: "timing",
  routine_vs_symptom: "routine_vs_symptom",
});

export const GUIDANCE_KEY_TO_LEGACY_QUESTION_KEY = Object.freeze(
  Object.fromEntries(
    Object.entries(LEGACY_QUESTION_KEY_TO_GUIDANCE_KEY).map(([legacyKey, guidanceKey]) => [guidanceKey, legacyKey]),
  ),
);

const LEGACY_ANSWER_VALUE_MAP = Object.freeze({
  pentru_cine: { adult: "adult", copil: "child" },
  varsta_copil: { sub_3_ani: "under_3", "3_6_ani": "3_6", "7_12_ani": "7_12", "13_18_ani": "13_18" },
  investigatie: {
    oct: "oct",
    camp_vizual: "visual_field_analyzer",
    tonometrie: "tonometry",
    fund_de_ochi: "fundus_exam",
    topografie_corneana: "corneal_topography",
    nu_sunt_sigur: "not_sure",
  },
  ce_cauti: {
    ochelari_noi: "new_eyeglasses",
    lentile_progresive: "progressive_lenses",
    schimbare_lentile: "lens_replacement",
    lentile_contact: "contact_lenses",
    nu_sunt_sigur: "not_sure",
  },
  prima_data: { da: "first_time", nu: "experienced" },
  ce_deteriorat: {
    rama_rupta: "broken_frame",
    balama_surub: "hinge_or_screw",
    lentila_zgariata: "damaged_lens",
    reglaj_rama: "frame_adjustment",
    nu_stiu: "not_sure",
  },
});

function cleanLocalityForGuidance(locality, city) {
  const source = locality && typeof locality === "object" ? locality : {};
  const value = {
    siruta_code: String(source.siruta_code || "").trim(),
    city: String(source.city_name || source.name || city || "").trim(),
    county_code: String(source.county_code || "").trim(),
    county: String(source.county_name || "").trim(),
  };
  return (value.siruta_code || value.city) ? value : null;
}

export function toGuidanceAnswers({ answers = [], locality = null, city = "" } = {}) {
  const result = [];
  for (const answer of Array.isArray(answers) ? answers : []) {
    const legacyKey = answer?.question_key;
    const guidanceKey = LEGACY_QUESTION_KEY_TO_GUIDANCE_KEY[legacyKey];
    if (!guidanceKey || guidanceKey === "locality") continue;
    const valueMap = LEGACY_ANSWER_VALUE_MAP[legacyKey];
    const mappedValue = valueMap ? valueMap[answer.answer_value] : answer.answer_value;
    if (!mappedValue) continue;
    result.push({ question_key: guidanceKey, answer_value: mappedValue });
  }
  const guidanceLocality = cleanLocalityForGuidance(locality, city);
  if (guidanceLocality) {
    result.push({ question_key: "locality", answer_value: guidanceLocality });
  }
  return result.slice(0, 30);
}