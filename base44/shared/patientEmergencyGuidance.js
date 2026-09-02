export const PATIENT_EMERGENCY_GUIDANCE_VERSION = "patient-emergency-guidance-v1.2";
export const PATIENT_EMERGENCY_DESTINATION_POLICY = "public_ophthalmology_primary_with_112_transport_fallback";

export const PATIENT_EMERGENCY_GUIDANCE_COPY = Object.freeze({
  chemical_irrigation_instruction:
    "Dacă a ajuns o substanță chimică în ochi, clătește imediat și continuu cu multă apă curată cel puțin 20 de minute. Nu aștepta să ajungi la spital pentru a începe clătirea și nu încerca să neutralizezi substanța cu alt produs.",
  penetrating_injury_instruction:
    "Dacă un obiect a pătruns sau a rămas înfipt în ochi, nu încerca să îl scoți, nu freca și nu apăsa pe ochi.",
  primary_instruction:
    "Mergi imediat la cel mai apropiat spital public care confirmă că preia urgențe oftalmologice, are cameră de gardă oftalmologică sau secție de oftalmologie cu linie de gardă și chirurgie.",
  fallback_instruction:
    "Dacă nu știi care este, mergi la cea mai apropiată UPU a unui spital public și spune clar că este o urgență oculară.",
  transport_instruction:
    "Nu conduce dacă vederea este afectată; roagă pe cineva să te însoțească.",
  emergency_call_instruction:
    "Dacă nu te poți deplasa în siguranță sau starea generală se agravează rapid, apelează 112.",
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
