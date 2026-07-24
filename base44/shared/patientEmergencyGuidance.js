export const PATIENT_EMERGENCY_GUIDANCE_VERSION = "patient-emergency-guidance-v1";
export const PATIENT_EMERGENCY_DESTINATION_POLICY = "public_ophthalmology_emergency_or_surgery";

export const PATIENT_EMERGENCY_GUIDANCE_COPY = Object.freeze({
  primary_instruction:
    "Mergi imediat la cel mai apropiat spital public care are urgente oftalmologice, camera de garda oftalmologica sau sectie de oftalmologie cu chirurgie si poate prelua urgente.",
  fallback_instruction:
    "Daca nu stii care este, mergi la cea mai apropiata UPU a unui spital public si spune clar ca este o urgenta oculara.",
  transport_instruction:
    "Nu conduce daca vederea este afectata; roaga pe cineva sa te insoteasca.",
});

export const PATIENT_EMERGENCY_GUIDANCE_MESSAGE = [
  PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction,
  PATIENT_EMERGENCY_GUIDANCE_COPY.fallback_instruction,
  PATIENT_EMERGENCY_GUIDANCE_COPY.transport_instruction,
].join(" ");

export function patientEmergencyGuidanceMentions112(value) {
  return /\b112\b/.test(String(value ?? ""));
}
