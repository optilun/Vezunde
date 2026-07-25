import {
  PATIENT_EYE_SAFETY_POLICY_VERSION,
  PATIENT_SAFETY_FLAG_PRESENTATION,
  advisorySafetyFlagsFromText,
  assessPatientEyeSafety,
  deterministicSafetyFlagsFromText,
  guidedSafetyClearRequestedFromAnswers,
  guidedSafetyFlagsFromAnswers,
  sanitizeGuidedSafetyAnswers,
} from '../../shared/patientEyeSafetyPolicy.js';

export const PATIENT_SAFETY_ASSESSMENT_VERSION = PATIENT_EYE_SAFETY_POLICY_VERSION;
export { PATIENT_SAFETY_FLAG_PRESENTATION };
export {
  advisorySafetyFlagsFromText,
  deterministicSafetyFlagsFromText,
  guidedSafetyClearRequestedFromAnswers,
  guidedSafetyFlagsFromAnswers,
  sanitizeGuidedSafetyAnswers,
};

export function buildPatientSafetyAssessment(options = {}) {
  return assessPatientEyeSafety(options);
}
