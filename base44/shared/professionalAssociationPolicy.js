// Asocierea specialist <-> locatie, pornita de la specialist sau de la ownerul care e si specialist.
//
// 2026-10-03 (structura conturilor, pasul 2, decizia lui Alex). Pana acum o asociere pornea doar
// dintr-o invitatie trimisa de organizatie. Acum:
// - specialistul poate cere singur „Lucrez aici”; organizatia aproba sau refuza;
// - ownerul/managerul care are si profil profesional se poate afisa singur ca specialist la o
//   locatie pe care o administreaza, fara sa-si trimita invitatie pe email.
//
// Regulile de consimtamant raman cele de pana acum: profilul apare public doar daca e verificat si
// public, locatia e publicata si activa, iar specialistul a acceptat afisarea
// (assignmentPublicEligibility). Cine cere singur asocierea isi da acordul de afisare in aceeasi
// cerere (bifa „vreau sa apar public”), deci nu mai primeste o a doua intrebare.
//
// Functii pure: fara acces la baza de date, testate direct in Node.
import { reconciledAssignmentPublicStatus } from './professionalProfileStatus.js';
import { deriveCanonicalDirectoryState } from './directoryCanonicalModel.js';

export const ASSOCIATION_PENDING_REQUEST_LIMIT = 10;

function clean(value) {
  return String(value ?? '').trim();
}

/** De ce nu se poate cere asocierea la aceasta locatie ('' = se poate). */
export function associationRequestBlockReason(location) {
  if (!location) return 'Locația nu a fost găsită.';
  if (location.active_status === 'inactiva' || clean(location.profile_control_status) === 'suspended' || location.status === 'suspendata') {
    return 'Locația nu mai este activă în VIASEE.';
  }
  if (deriveCanonicalDirectoryState(location).is_publicly_available !== true) {
    return 'Locația nu este publicată în VIASEE.';
  }
  const managed = location.claim_verification_status === 'approved'
    || ['claimed', 'verified'].includes(clean(location.profile_control_status));
  if (!managed) {
    return 'Locația nu este încă administrată în VIASEE, deci nimeni nu poate aproba cererea. O poți ruga să își revendice profilul.';
  }
  return '';
}

/** Randul nou (sau actualizarea unui rand vechi) pentru cererea „Lucrez aici”. */
export function associationRequestRecord({ profile, locationId, showPublicly, userId, now }) {
  return {
    professional_id: profile.id,
    location_id: locationId,
    professional_type: profile.professional_type,
    active_status: 'inactiv',
    public_status: 'privat',
    association_origin: 'professional_request',
    association_request_status: 'pending',
    association_requested_at: now,
    association_decided_at: '',
    association_decided_by_user_id: '',
    visibility_consent_status: showPublicly ? 'accepted' : 'not_requested',
    visibility_decided_at: showPublicly ? now : '',
    visibility_decided_by_user_id: showPublicly ? userId : '',
  };
}

/** Ce se schimba cand organizatia aproba cererea. */
export function approvedAssociationPatch({ assignment, profile, location, actorUserId, now }) {
  const next = {
    active_status: 'activ',
    association_request_status: 'approved',
    association_decided_at: now,
    association_decided_by_user_id: actorUserId,
    confirmed_by_professional_at: assignment.association_requested_at || now,
  };
  next.public_status = reconciledAssignmentPublicStatus({ profile, assignment: { ...assignment, ...next }, location });
  return next;
}

/** Ce se schimba cand organizatia refuza cererea. Asocierea ramane inactiva si privata. */
export function declinedAssociationPatch({ actorUserId, now }) {
  return {
    active_status: 'inactiv',
    public_status: 'privat',
    association_request_status: 'declined',
    association_decided_at: now,
    association_decided_by_user_id: actorUserId,
  };
}

/**
 * Ownerul/managerul care e si specialist se afiseaza singur la o locatie pe care o administreaza.
 * E aceeasi persoana, deci asocierea si acordul de afisare se confirma deodata. Devine publica
 * doar daca profilul e verificat si locatia e publicata; altfel ramane privata pana atunci
 * (aprobarea profilului reconciliaza asocierile cu acord dat).
 */
export function selfAssociationRecord({ profile, location, userId, now }) {
  const record = {
    professional_id: profile.id,
    location_id: location.id,
    professional_type: profile.professional_type,
    active_status: 'activ',
    association_origin: 'owner_self',
    confirmed_by_professional_at: now,
    visibility_consent_status: 'accepted',
    visibility_decided_at: now,
    visibility_decided_by_user_id: userId,
  };
  record.public_status = reconciledAssignmentPublicStatus({ profile, assignment: record, location });
  return record;
}

export function isPendingAssociationRequest(assignment) {
  return assignment?.association_request_status === 'pending' && assignment?.active_status !== 'activ';
}
