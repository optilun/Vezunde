export const PATIENT_EMERGENCY_GUIDANCE_VERSION = "patient-emergency-guidance-v1.2";
export const PATIENT_EMERGENCY_DESTINATION_POLICY = "public_ophthalmology_primary_with_112_transport_fallback";

export const PATIENT_EMERGENCY_GUIDANCE_COPY = Object.freeze({
  chemical_irrigation_instruction:
    "Daca a ajuns o substanta chimica in ochi, clateste imediat si continuu cu multa apa curata cel putin 20 de minute. Nu astepta sa ajungi la spital pentru a incepe clatirea si nu incerca sa neutralizezi substanta cu alt produs.",
  penetrating_injury_instruction:
    "Daca un obiect a patruns sau a ramas infipt in ochi, nu incerca sa il scoti, nu freca si nu apasa pe ochi.",
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

export function buildPatientEmergencyGuidanceMessage(flags = []) {
  const controlledFlags = new Set(Array.isArray(flags) ? flags : []);
  const instructions = [];
  const penetrating = controlledFlags.has("penetrating_or_high_speed_trauma");
  if (penetrating) {
    instructions.push(PATIENT_EMERGENCY_GUIDANCE_COPY.penetrating_injury_instruction);
  } else if (controlledFlags.has("chemical_injury")) {
    instructions.push(PATIENT_EMERGENCY_GUIDANCE_COPY.chemical_irrigation_instruction);
  }
  instructions.push(PATIENT_EMERGENCY_GUIDANCE_MESSAGE);
  return instructions.join(" ");
}

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
