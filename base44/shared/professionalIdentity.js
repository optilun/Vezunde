// Identitatea specialistilor VIASEE: o singura sursa de adevar pentru tipuri, etichete si
// specializari.
//
// 2026-09-03. Inainte de fisierul asta, acelasi adevar era scris de patru ori:
//   - `SPECIALIZATIONS_BY_TYPE` copiat in getPublicProfessionalProfile si in editorul din
//     workspace-ul specialistului;
//   - `ROLE_BY_TYPE` copiat in manageMyProfessionalProfile si in professionalInvitationOps,
//     doar ca sa traduca intre `ProfessionalProfile.professional_type` (engleza) si
//     `ProfessionalProfile.role` (romana) - doua enum-uri pentru acelasi concept;
//   - etichetele romanesti, rescrise in fiecare componenta care afiseaza un specialist.
// Consecinta practica: adaugarea unei profesii noi (ortoptist, tehnician optician) cerea
// atingerea a sase fisiere si garanta divergenta. Aici e o singura lista.
//
// Regula de extindere: o profesie noua = o intrare noua in PROFESSIONAL_TYPES. Nimic altceva
// nu trebuie atins - nici backend, nici carduri, nici recomandari.
//
// Ce NU face fisierul asta: nu inventeaza specialisti si nu presupune competente. Lista de
// specializari este vocabularul permis, nu o afirmatie despre cineva; ce nu e declarat si
// aprobat nu apare nicaieri public.

export const PROFESSIONAL_IDENTITY_CONTRACT_VERSION = 'professional-identity-v1';

// Ordinea din lista este si ordinea de afisare in filtre si in selectoare.
export const PROFESSIONAL_TYPES = Object.freeze([
  Object.freeze({
    code: 'ophthalmologist',
    legacy_role: 'medic_oftalmolog',
    label: 'Medic oftalmolog',
    label_plural: 'Medici oftalmologi',
    short_label: 'Oftalmolog',
    // Ce intelege pacientul ca poate rezolva persoana asta. Text descriptiv, nu promisiune.
    patient_hint: 'Consultații medicale, diagnostic și tratament pentru afecțiuni ale ochiului.',
    medical: true,
    icon_key: 'stethoscope',
    specializations: Object.freeze([
      'general_ophthalmology',
      'pediatric_ophthalmology',
      'glaucoma',
      'retina',
      'cornea',
      'cataract',
      'refractive_surgery',
      'dry_eye',
      'myopia_management',
    ]),
  }),
  Object.freeze({
    code: 'optometrist',
    legacy_role: 'optometrist',
    label: 'Optometrist',
    label_plural: 'Optometriști',
    short_label: 'Optometrist',
    patient_hint: 'Măsurarea vederii, prescripție de ochelari și adaptare de lentile de contact.',
    medical: false,
    icon_key: 'eye',
    specializations: Object.freeze([
      'refraction',
      'contact_lenses',
      'pediatric_optometry',
      'binocular_vision',
      'myopia_management',
      'low_vision',
      'occupational_vision',
    ]),
  }),
  Object.freeze({
    code: 'optician',
    legacy_role: 'optician',
    label: 'Optician',
    label_plural: 'Opticieni',
    short_label: 'Optician',
    patient_hint: 'Alegerea ramei și a lentilelor, montaj, ajustări și reparații.',
    medical: false,
    icon_key: 'glasses',
    specializations: Object.freeze([
      'frame_consulting',
      'ophthalmic_lenses',
      'progressive_lenses',
      'lens_fitting',
      'adjustments_repairs',
      'children_eyewear',
      'protective_eyewear',
    ]),
  }),
]);

export const PROFESSIONAL_TYPE_CODES = Object.freeze(PROFESSIONAL_TYPES.map((entry) => entry.code));

const BY_CODE = new Map(PROFESSIONAL_TYPES.map((entry) => [entry.code, entry]));
const BY_LEGACY_ROLE = new Map(PROFESSIONAL_TYPES.map((entry) => [entry.legacy_role, entry]));

// Etichetele romanesti ale specializarilor. Cheile sunt globale, nu per tip: `myopia_management`
// inseamna acelasi lucru si la oftalmolog, si la optometrist, iar duplicarea etichetei per tip ar
// fi produs exact divergenta pe care fisierul asta o elimina.
// Etichetele sunt text vizibil pentru pacient, deci se scriu cu diacritice. Comentariile si
// identificatorii raman fara, ca in restul proiectului.
export const PROFESSIONAL_SPECIALIZATION_LABELS = Object.freeze({
  general_ophthalmology: 'Oftalmologie generală',
  pediatric_ophthalmology: 'Oftalmologie pediatrică',
  glaucoma: 'Glaucom',
  retina: 'Retină',
  cornea: 'Cornee',
  cataract: 'Cataractă',
  refractive_surgery: 'Chirurgie refractivă',
  dry_eye: 'Ochi uscat',
  myopia_management: 'Managementul miopiei',
  refraction: 'Refracție și determinarea dioptriilor',
  contact_lenses: 'Lentile de contact',
  pediatric_optometry: 'Optometrie pediatrică',
  binocular_vision: 'Vedere binoculară',
  low_vision: 'Low vision',
  occupational_vision: 'Vedere ocupațională',
  frame_consulting: 'Consiliere rame',
  ophthalmic_lenses: 'Lentile oftalmice',
  progressive_lenses: 'Lentile progresive',
  lens_fitting: 'Montaj lentile',
  adjustments_repairs: 'Reglaje și reparații',
  children_eyewear: 'Ochelari pentru copii',
  protective_eyewear: 'Ochelari de protecție',
});

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

/**
 * Intrarea canonica pentru un tip de specialist. Accepta si codul canonic (engleza), si rolul
 * legacy (romana), pentru ca ambele exista in date.
 */
export function professionalTypeEntry(value) {
  const raw = clean(value);
  if (!raw) return null;
  return BY_CODE.get(raw) || BY_LEGACY_ROLE.get(raw) || null;
}

export function isProfessionalType(value) {
  return BY_CODE.has(clean(value));
}

export function normalizeProfessionalType(value) {
  const entry = professionalTypeEntry(value);
  return entry ? entry.code : '';
}

export function professionalLegacyRole(value) {
  const entry = professionalTypeEntry(value);
  return entry ? entry.legacy_role : '';
}

export function professionalTypeLabel(value) {
  const entry = professionalTypeEntry(value);
  return entry ? entry.label : 'Specialist';}

export function professionalTypeShortLabel(value) {
  const entry = professionalTypeEntry(value);
  return entry ? entry.short_label : 'Specialist';
}

export function professionalTypePluralLabel(value) {
  const entry = professionalTypeEntry(value);
  return entry ? entry.label_plural : 'Specialisti';
}

export function professionalTypeIconKey(value) {
  const entry = professionalTypeEntry(value);
  return entry ? entry.icon_key : 'user';
}

export function isMedicalProfessionalType(value) {
  const entry = professionalTypeEntry(value);
  return Boolean(entry && entry.medical);
}

export function professionalSpecializationsFor(value) {
  const entry = professionalTypeEntry(value);
  return entry ? [...entry.specializations] : [];
}

export function professionalSpecializationLabel(key) {
  const raw = clean(key);
  return PROFESSIONAL_SPECIALIZATION_LABELS[raw] || raw;
}

/**
 * Filtreaza specializarile declarate la vocabularul permis pentru tipul respectiv. Ce nu e in
 * vocabular nu ajunge public - nici din greseala, nici prin payload manipulat.
 */
export function sanitizeProfessionalSpecializations(type, specializations, limit = 12) {
  const allowed = new Set(professionalSpecializationsFor(type));
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(specializations) ? specializations : []) {
    const key = clean(item);
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Numele afisat public. Nu inventeaza nimic: daca nu exista nici nume public, nici nume complet,
 * intoarce sir gol si apelantul decide ca profilul nu e afisabil.
 */
export function professionalDisplayName(profile) {
  return clean(profile?.public_display_name) || clean(profile?.full_name) || clean(profile?.name);
}

/**
 * Initialele pentru avatarul fara fotografie. Aceleasi reguli ca la LocationThumb, ca sa arate
 * ca acelasi produs.
 */
export function professionalInitials(profile) {
  const name = professionalDisplayName(profile);
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('ro-RO');
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase('ro-RO');
}

export default {
  PROFESSIONAL_IDENTITY_CONTRACT_VERSION,
  PROFESSIONAL_TYPES,
  PROFESSIONAL_TYPE_CODES,
  PROFESSIONAL_SPECIALIZATION_LABELS,
  professionalTypeEntry,
  isProfessionalType,
  normalizeProfessionalType,
  professionalLegacyRole,
  professionalTypeLabel,
  professionalTypeShortLabel,
  professionalTypePluralLabel,
  professionalTypeIconKey,
  isMedicalProfessionalType,
  professionalSpecializationsFor,
  professionalSpecializationLabel,
  sanitizeProfessionalSpecializations,
  professionalDisplayName,
  professionalInitials,
};
