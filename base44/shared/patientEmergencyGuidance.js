export const PATIENT_EMERGENCY_GUIDANCE_VERSION = "patient-emergency-guidance-v1.1";
export const PATIENT_EMERGENCY_DESTINATION_POLICY = "public_ophthalmology_primary_with_112_transport_fallback";

export const PATIENT_EMERGENCY_GUIDANCE_COPY = Object.freeze({
  primary_instruction:
    "Mergi imediat la cel mai apropiat spital public care confirma ca preia urgente oftalmologice, are camera de garda oftalmologica sau sectie de oftalmologie cu linie de garda si chirurgie.",
  fallback_instruction:
    "Daca nu stii care este, mergi la cea mai apropiata UPU a unui spital public si spune clar ca este o urgenta oculara.",
  transport_instruction:
    "Nu conduce daca vederea este afectata; roaga pe cineva sa te insoteasca.",
  emergency_call_instruction:
    "Daca nu te poti deplasa in siguranta sau starea generala se agraveaza rapid, apeleaza 112.",
});

export const PATIENT_EMERGENCY_GUIDANCE_MESSAGE = [
  PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction,
  PATIENT_EMERGENCY_GUIDANCE_COPY.fallback_instruction,
  PATIENT_EMERGENCY_GUIDANCE_COPY.transport_instruction,
  PATIENT_EMERGENCY_GUIDANCE_COPY.emergency_call_instruction,
].join(" ");

export function patientEmergencyGuidanceMentions112(value) {
  return /\b112\b/.test(String(value ?? ""));
}

export function patientEmergencyGuidanceUses112AsPrimaryAction(value) {
  const text = String(value ?? "").toLocaleLowerCase("ro-RO");
  const emergencyNumberIndex = text.search(/\b112\b/);
  if (emergencyNumberIndex < 0) return false;
  const hospitalIndex = text.search(/\b(?:spital|upu|camera de garda|urgente oftalmologice)\b/);
  return hospitalIndex < 0 || emergencyNumberIndex < hospitalIndex;
}
