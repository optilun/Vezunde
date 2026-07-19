import { normalizeServiceKey } from './canonicalServiceRegistryExtended.js';
import { PATIENT_INTENT_KEYS, PATIENT_SAFETY_FLAG_KEYS } from './patientNeedInterpretation.js';

export const PATIENT_REQUEST_DRAFT_CONTRACT_VERSION = 'patient-request-draft-v1';
export const PATIENT_QUESTIONNAIRE_VERSION = 'patient-questionnaire-v1';
export const PATIENT_REQUEST_PROCESSING_CONSENT_VERSION = 'patient-request-processing-v1';
export const PATIENT_REQUEST_RETENTION_POLICY_KEY = 'patient-request-retention-90d-v1';
export const PATIENT_REQUEST_EXPIRY_DAYS = 30;
export const PATIENT_REQUEST_CONTACT_RETENTION_DAYS = 90;

const INTENT_SET = new Set(PATIENT_INTENT_KEYS);
const SAFETY_SET = new Set(PATIENT_SAFETY_FLAG_KEYS);
const CONTACT_PREFERENCES = new Set(['email', 'phone', 'either']);
const RESULT_BUCKETS = new Set(['top3', 'extended_confirmed', 'extended_directory', 'excluded']);
const NEED_LEVELS = new Set(['general', 'technical', 'specialized_medical']);

export class PatientRequestValidationError extends Error {
  constructor(message, field = '') {
    super(message);
    this.name = 'PatientRequestValidationError';
    this.field = field;
  }
}

function clean(value, maxLength = 800) {
  return String(value || '').trim().slice(0, maxLength);
}

function required(value, field, maxLength = 800) {
  const result = clean(value, maxLength);
  if (!result) throw new PatientRequestValidationError(`${field} este obligatoriu.`, field);
  return result;
}

function unique(values, maxLength = 120, limit = 30) {
  return [...new Set((Array.isArray(values) ? values : [])
    .slice(0, limit)
    .map((value) => clean(value, maxLength))
    .filter(Boolean))];
}

function canonicalServiceKeys(values) {
  const result = [];
  for (const value of unique(values, 120, 30)) {
    const normalized = normalizeServiceKey(value);
    if (!normalized.canonicalKey) {
      throw new PatientRequestValidationError(`Serviciu necunoscut: ${value}`, 'service_keys');
    }
    result.push(normalized.canonicalKey);
  }
  return [...new Set(result)];
}

function normalizeEmail(value) {
  const email = required(value, 'contact.email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PatientRequestValidationError('Adresa de email nu este valida.', 'contact.email');
  }
  return email;
}

function normalizePhone(value) {
  const phone = clean(value, 32).replace(/[^0-9+()\-\s]/g, '');
  if (phone && phone.replace(/\D/g, '').length < 7) {
    throw new PatientRequestValidationError('Numarul de telefon nu este valid.', 'contact.phone');
  }
  return phone;
}

function normalizeAnswers(answers, questionnaireVersion, questionnaireKey) {
  return (Array.isArray(answers) ? answers : [])
    .slice(0, 30)
    .map((answer, index) => {
      const questionKey = clean(answer?.question_key, 80);
      const answerValue = clean(answer?.answer_value, 500);
      if (!questionKey || !answerValue) return null;
      return {
        questionnaire_version: questionnaireVersion,
        questionnaire_key: questionnaireKey,
        position: index + 1,
        question_key: questionKey,
        question_label: clean(answer?.question_label || questionKey, 160),
        answer_value: answerValue,
        answer_label: clean(answer?.answer_label || answerValue, 240),
      };
    })
    .filter(Boolean);
}

function normalizeExplanation(value) {
  if (typeof value === 'string') return clean(value, 240);
  const code = clean(value?.code, 80);
  const label = clean(value?.label, 180);
  return [code, label].filter(Boolean).join(':');
}

function normalizeMatches(results, recommendationContractVersion) {
  const seen = new Set();
  const matches = [];
  for (const [index, result] of (Array.isArray(results) ? results : []).slice(0, 20).entries()) {
    const locationId = clean(result?.id || result?.location_id, 120);
    if (!locationId || seen.has(locationId)) continue;
    seen.add(locationId);
    const resultBucket = RESULT_BUCKETS.has(result?.result_bucket) ? result.result_bucket : 'excluded';
    const needLevel = NEED_LEVELS.has(result?.need_level_snapshot || result?.need_level)
      ? (result.need_level_snapshot || result.need_level)
      : null;
    matches.push({
      location_id: locationId,
      rank: index + 1,
      bucket_rank: Number.isFinite(Number(result?.bucket_rank)) ? Number(result.bucket_rank) : index + 1,
      recommendation_contract_version: clean(result?.recommendation_contract_version || recommendationContractVersion, 100),
      snapshot_source: 'client_confirmed_search',
      recommendation_score: Number.isFinite(Number(result?.recommendation_score)) ? Number(result.recommendation_score) : 0,
      semantic_match_score: Number.isFinite(Number(result?.semantic_match_score)) ? Number(result.semantic_match_score) : 0,
      matched_service_keys: canonicalServiceKeys(result?.matched_service_keys || []),
      match_reasons: unique(result?.match_reasons, 180, 20),
      recommendation_explanations: (Array.isArray(result?.recommendation_explanations) ? result.recommendation_explanations : [])
        .slice(0, 20)
        .map(normalizeExplanation)
        .filter(Boolean),
      expansion_tier: ['oras', 'apropiere', 'judet', 'national'].includes(result?.expansion_tier)
        ? result.expansion_tier
        : 'oras',
      status: 'matched',
      result_bucket: resultBucket,
      need_level_snapshot: needLevel,
      profile_control_status_snapshot: clean(result?.profile_control_status, 80),
      service_confirmation_level_snapshot: clean(result?.service_confirmation_level_snapshot, 80),
      is_top3_eligible: resultBucket === 'top3' && result?.is_top3_eligible !== false,
      exclusion_reasons: unique(result?.exclusion_reasons, 180, 20),
    });
  }
  return matches;
}

export function sanitizePatientRequestSubmission(input = {}) {
  const idempotencyKey = required(input.idempotency_key, 'idempotency_key', 120);
  if (!/^[A-Za-z0-9:_-]{16,120}$/.test(idempotencyKey)) {
    throw new PatientRequestValidationError('Cheia de idempotenta nu este valida.', 'idempotency_key');
  }

  const draft = input.request_draft || {};
  if (draft.contract_version !== PATIENT_REQUEST_DRAFT_CONTRACT_VERSION) {
    throw new PatientRequestValidationError('Versiunea contractului cererii nu este acceptata.', 'request_draft.contract_version');
  }
  if (draft.questionnaire_version !== PATIENT_QUESTIONNAIRE_VERSION) {
    throw new PatientRequestValidationError('Versiunea chestionarului nu este acceptata.', 'request_draft.questionnaire_version');
  }

  const intent = required(draft.intent, 'request_draft.intent', 80);
  if (!INTENT_SET.has(intent)) {
    throw new PatientRequestValidationError('Intentia cererii nu este acceptata.', 'request_draft.intent');
  }
  const questionnaireKey = required(draft.questionnaire_key, 'request_draft.questionnaire_key', 120);
  const sirutaCode = required(draft.locality_siruta_code, 'request_draft.locality_siruta_code', 40);
  if (!/^\d{1,10}$/.test(sirutaCode)) {
    throw new PatientRequestValidationError('Codul SIRUTA nu este valid.', 'request_draft.locality_siruta_code');
  }

  const contact = input.contact || {};
  const contactName = required(contact.name || contact.contact_name, 'contact.name', 120);
  if (contactName.length < 2) throw new PatientRequestValidationError('Numele este prea scurt.', 'contact.name');
  const contactEmail = normalizeEmail(contact.email || contact.contact_email);
  const contactPhone = normalizePhone(contact.phone || contact.contact_phone);
  const contactPreference = CONTACT_PREFERENCES.has(contact.preference || contact.contact_preference)
    ? (contact.preference || contact.contact_preference)
    : 'email';
  if (['phone', 'either'].includes(contactPreference) && !contactPhone) {
    throw new PatientRequestValidationError('Telefonul este necesar pentru preferinta aleasa.', 'contact.phone');
  }

  const consent = input.consent || {};
  if (consent.processing !== true) {
    throw new PatientRequestValidationError('Consimtamantul pentru crearea cererii este obligatoriu.', 'consent.processing');
  }
  if (consent.version !== PATIENT_REQUEST_PROCESSING_CONSENT_VERSION) {
    throw new PatientRequestValidationError('Versiunea consimtamantului nu este acceptata.', 'consent.version');
  }

  const interpretation = draft.interpretation || {};
  const safetyFlags = unique(interpretation.possible_safety_flags, 100, 10).filter((flag) => SAFETY_SET.has(flag));
  const recommendation = input.recommendation || {};
  const recommendationContractVersion = clean(recommendation.contract_version, 100);
  const matches = normalizeMatches(recommendation.results, recommendationContractVersion);

  return {
    idempotency_key: idempotencyKey,
    request: {
      contract_version: draft.contract_version,
      questionnaire_version: draft.questionnaire_version,
      questionnaire_key: questionnaireKey,
      intent,
      original_message: clean(draft.original_message, 800),
      service_keys: canonicalServiceKeys(draft.service_keys),
      location_scope: ['locality', 'geo', 'city', 'national'].includes(draft.location_scope) ? draft.location_scope : 'locality',
      city: required(draft.city, 'request_draft.city', 120),
      county: clean(draft.county, 120),
      locality_siruta_code: sirutaCode,
      client_address_text: clean(draft.client_address_text, 240),
      for_whom: ['adult', 'copil'].includes(draft.for_whom) ? draft.for_whom : null,
      age_group: clean(draft.age_group, 40),
      urgency: 'normala',
      timing_key: clean(draft.timing_key, 60),
      preferences: unique(draft.preferences, 120, 20),
      request_source: 'patient_search',
      interpretation_version: clean(interpretation.version, 80),
      interpretation_confidence_band: clean(interpretation.confidence_band, 20),
      interpretation_agreement_status: clean(interpretation.agreement_status, 30),
      possible_safety_flags: safetyFlags,
      recommendation_contract_version: recommendationContractVersion,
      matching_coverage_status: clean(recommendation.coverage_status, 80),
      matching_need_level: NEED_LEVELS.has(recommendation.need_level) ? recommendation.need_level : '',
      match_count: matches.length,
      top3_count: matches.filter((match) => match.result_bucket === 'top3').length,
    },
    contact: {
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      contact_preference: contactPreference,
      processing_consent: true,
      processing_consent_version: consent.version,
      provider_contact_sharing_consent: consent.provider_contact_sharing === true,
    },
    answers: normalizeAnswers(draft.answers, draft.questionnaire_version, questionnaireKey),
    matches,
  };
}
