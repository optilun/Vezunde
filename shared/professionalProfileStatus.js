// Ciclul de viata al profilului profesional, ca transformare pura.
//
// 2026-09-03. `ProfessionalProfile` poarta trei enum-uri pentru doua intrebari:
//   - `profile_review_status`  - unde e draftul (draft / pending_review / approved / rejected /
//     needs_more_info);
//   - `verification_status`    - increderea in identitatea persoanei (unverified / pending_review /
//     verified / rejected);
//   - `public_visibility_status` + `is_public` - daca profilul e vizibil public.
// Toate trei erau tinute in sincron cu mana, in trei fisiere backend diferite
// (manageMyProfessionalProfile, adminProfessionalProfileReview, manageProfessionalAssignment).
// Orice tranzitie noua scrisa intr-un singur loc rupea tacit invariantul in celelalte doua.
//
// Fisierul asta nu inventeaza un al patrulea enum si nu migreaza date. Pastreaza exact valorile
// existente, dar muta *tranzitiile* si *eligibilitatea* intr-un singur loc, ca sa nu mai fie
// nevoie ca trei fisiere sa fie de acord din intamplare.
//
// Invariantul central, pastrat din codul existent si acum verificabil:
//   1. Un profil devine public doar prin decizie de admin (`approve`).
//   2. O respingere sau o cerere de completari NU scoate offline un profil deja aprobat -
//      pacientii nu raman cu o pagina disparuta pentru ca specialistul a trimis un draft slab.
//   3. Aprobarea profilului NU publica automat asocierile la locatii: pentru fiecare locatie e
//      nevoie de consimtamantul explicit al specialistului.

export const PROFESSIONAL_PROFILE_STATUS_CONTRACT_VERSION = 'professional-profile-status-v1';

export const PROFESSIONAL_REVIEW_STATUSES = Object.freeze([
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'needs_more_info',
]);

export const PROFESSIONAL_VERIFICATION_STATUSES = Object.freeze([
  'unverified',
  'pending_review',
  'verified',
  'rejected',
]);

export const PROFESSIONAL_VISIBILITY_STATUSES = Object.freeze([
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'needs_more_info',
  'archived',
]);

export const ASSIGNMENT_CONSENT_STATUSES = Object.freeze([
  'not_requested',
  'pending',
  'accepted',
  'declined',
  'revoked',
]);

// Cate puncte da fiecare piesa de profil. Suma maxima este 100.
export const PROFESSIONAL_COMPLETENESS_WEIGHTS = Object.freeze({
  display_name: 15,
  bio: 25,
  specializations: 20,
  photo: 15,
  contact: 10,
  links: 5,
  type: 10,
});

export const PROFESSIONAL_BIO_MIN_LENGTH = 80;
export const PROFESSIONAL_NAME_MIN_LENGTH = 3;

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

/**
 * Starea de referinta a unui profil, normalizata. Toate celelalte functii pleaca de aici, ca sa
 * nu repete `|| 'draft'` prin cod.
 */
export function professionalProfileState(profile) {
  const reviewStatus = clean(profile?.profile_review_status) || 'draft';
  const verificationStatus = clean(profile?.verification_status) || 'unverified';
  const visibilityStatus = clean(profile?.public_visibility_status) || 'draft';
  const isPublic = profile?.is_public === true;
  return {
    profile_review_status: PROFESSIONAL_REVIEW_STATUSES.includes(reviewStatus) ? reviewStatus : 'draft',
    verification_status: PROFESSIONAL_VERIFICATION_STATUSES.includes(verificationStatus) ? verificationStatus : 'unverified',
    public_visibility_status: PROFESSIONAL_VISIBILITY_STATUSES.includes(visibilityStatus) ? visibilityStatus : 'draft',
    is_public: isPublic,
  };
}

/**
 * Poarta publica pentru profil. Identica cu `isPublicProfile` din getPublicProfessionalProfile,
 * dar acum una singura pentru tot proiectul.
 */
export function isPublicProfessionalProfile(profile) {
  const state = professionalProfileState(profile);
  return state.is_public === true
    && state.verification_status === 'verified'
    && state.public_visibility_status === 'approved';
}

export function isProfessionalProfileLocked(profile) {
  return professionalProfileState(profile).profile_review_status === 'pending_review';
}

/**
 * Tranzitiile de stare, intr-un singur loc.
 *
 * @param {'submit'|'approve'|'request_more_info'|'reject'|'archive'|'restore'} action
 * @param {object} profile starea curenta
 * @returns {{profile_review_status:string, verification_status:string, public_visibility_status:string, is_public:boolean}|null}
 */
export function nextProfessionalProfileState(action, profile) {
  const current = professionalProfileState(profile);
  // Un profil deja public nu e scos offline de o decizie despre draftul nou. Draftul e o
  // propunere de modificare, nu o repunere in discutie a paginii vizibile azi.
  const wasPublic = current.is_public === true && current.public_visibility_status === 'approved';

  switch (clean(action)) {
    case 'submit':
      return {
        profile_review_status: 'pending_review',
        // Identitatea deja verificata nu se re-pune in discutie pentru ca s-a schimbat o
        // descriere. Daca ar deveni `pending_review`, `isPublicProfessionalProfile` ar fi fals
        // si pagina publica a specialistului ar disparea din cautare pana la urmatoarea decizie
        // de admin - exact ce se intampla inainte de 2026-09-03.
        verification_status: wasPublic ? 'verified' : 'pending_review',
        public_visibility_status: wasPublic ? 'approved' : 'pending_review',
        is_public: wasPublic,
      };
    case 'approve':
      return {
        profile_review_status: 'approved',
        verification_status: 'verified',
        public_visibility_status: 'approved',
        is_public: true,
      };
    case 'request_more_info':
      return {
        profile_review_status: 'needs_more_info',
        verification_status: wasPublic ? 'verified' : 'unverified',
        public_visibility_status: wasPublic ? 'approved' : 'draft',
        is_public: wasPublic,
      };
    case 'reject':
      return {
        profile_review_status: 'rejected',
        verification_status: wasPublic ? 'verified' : 'rejected',
        public_visibility_status: wasPublic ? 'approved' : 'rejected',
        is_public: wasPublic,
      };
    // Arhivarea este singura actiune care scoate deliberat un profil public offline. Se face
    // explicit, de admin, si nu e reversibila automat.
    case 'archive':
      return {
        profile_review_status: current.profile_review_status,
        verification_status: current.verification_status,
        public_visibility_status: 'archived',
        is_public: false,
      };
    case 'restore':
      return {
        profile_review_status: 'draft',
        verification_status: current.verification_status === 'verified' ? 'verified' : 'unverified',
        public_visibility_status: 'draft',
        is_public: false,
      };
    default:
      return null;
  }
}

/**
 * Eligibilitatea unei asocieri specialist - locatie pentru afisare publica.
 * Cere simultan: profil public, consimtamant explicit, asociere activa marcata public si locatie
 * publicata. Daca una singura cade, asocierea nu se vede.
 */
export function assignmentPublicEligibility({ profile, assignment, location } = {}) {
  const reasons = [];
  if (!isPublicProfessionalProfile(profile)) reasons.push('profile_not_public');
  if (!assignment || assignment.active_status !== 'activ') reasons.push('assignment_inactive');
  if (!assignment || assignment.visibility_consent_status !== 'accepted') reasons.push('consent_missing');
  if (!location) {
    reasons.push('location_missing');
  } else {
    if (location.status !== 'publicata') reasons.push('location_not_published');
    if (location.active_status === 'inactiva') reasons.push('location_inactive');
    if (location.profile_control_status === 'suspended') reasons.push('location_suspended');
  }
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Ce valoare trebuie sa aiba `public_status` al asocierii, date fiind starile curente. Folosita
 * si la reconciliere dupa aprobare, si oriunde altundeva starea se poate schimba sub asociere
 * (suspendarea unei locatii, arhivarea unui profil).
 */
export function reconciledAssignmentPublicStatus({ profile, assignment, location } = {}) {
  return assignmentPublicEligibility({ profile, assignment, location }).eligible ? 'public' : 'privat';
}

/**
 * Completitudinea profilului. Aceleasi ponderi ca in codul existent, dar acum verificabile.
 */
export function professionalProfileCompleteness(draft, professionalType, isKnownType) {
  const w = PROFESSIONAL_COMPLETENESS_WEIGHTS;
  let score = 0;
  if (clean(draft?.public_display_name).length >= PROFESSIONAL_NAME_MIN_LENGTH) score += w.display_name;
  if (clean(draft?.professional_bio).length >= PROFESSIONAL_BIO_MIN_LENGTH) score += w.bio;
  if (Array.isArray(draft?.specializations) && draft.specializations.length > 0) score += w.specializations;
  if (clean(draft?.profile_photo_url)) score += w.photo;
  if (clean(draft?.public_email) || clean(draft?.public_phone)) score += w.contact;
  if (clean(draft?.public_website_url) || clean(draft?.linkedin_url) || clean(draft?.facebook_url) || clean(draft?.instagram_url)) score += w.links;
  if (isKnownType === true || (isKnownType === undefined && clean(professionalType))) score += w.type;
  return score;
}

/**
 * Ce ii lipseste specialistului ca sa poata trimite profilul spre verificare. Aceeasi lista e
 * folosita si de checklist-ul din workspace, si de validarea de pe server, ca sa nu spuna doua
 * lucruri diferite.
 */
export function professionalSubmissionBlockers(draft) {
  const blockers = [];
  if (clean(draft?.public_display_name).length < PROFESSIONAL_NAME_MIN_LENGTH) blockers.push('display_name');
  if (clean(draft?.professional_bio).length < PROFESSIONAL_BIO_MIN_LENGTH) blockers.push('bio');
  if (!Array.isArray(draft?.specializations) || draft.specializations.length === 0) blockers.push('specializations');
  return blockers;
}

export const PROFESSIONAL_SUBMISSION_BLOCKER_LABELS = Object.freeze({
  display_name: 'Numele afisat public trebuie sa aiba cel putin 3 caractere.',
  bio: 'Descrierea profesionala trebuie sa aiba cel putin 80 de caractere.',
  specializations: 'Alege cel putin o specializare.',
});

export default {
  PROFESSIONAL_PROFILE_STATUS_CONTRACT_VERSION,
  PROFESSIONAL_REVIEW_STATUSES,
  PROFESSIONAL_VERIFICATION_STATUSES,
  PROFESSIONAL_VISIBILITY_STATUSES,
  ASSIGNMENT_CONSENT_STATUSES,
  PROFESSIONAL_COMPLETENESS_WEIGHTS,
  PROFESSIONAL_BIO_MIN_LENGTH,
  PROFESSIONAL_NAME_MIN_LENGTH,
  PROFESSIONAL_SUBMISSION_BLOCKER_LABELS,
  professionalProfileState,
  isPublicProfessionalProfile,
  isProfessionalProfileLocked,
  nextProfessionalProfileState,
  assignmentPublicEligibility,
  reconciledAssignmentPublicStatus,
  professionalProfileCompleteness,
  professionalSubmissionBlockers,
};
