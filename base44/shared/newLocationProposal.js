// Locatia noua propusa de un furnizor: un singur loc pentru datele create.
//
// 2026-10-02. Folosit de submitProviderClaim (trimiterea unei locatii noi) si de
// adminProviderClaimReview (aprobarea unei cereri marcate duplicat, cand adminul decide ca e o
// locatie distincta). Inainte, o cerere marcata duplicat nu putea fi aprobata deloc: adminul
// trebuia sa recreeze locatia manual, iar furnizorul sa o propuna din nou.
//
// Fara importuri, ca sa poata fi testat direct in Node (scripts/verify-duplicate-distinct-approval.mjs).

export const DISTINCT_APPROVAL_NOTE_MIN_LENGTH = 15;
export const BLOCKING_DUPLICATE_SEVERITIES = Object.freeze(['strong_duplicate', 'possible_duplicate']);

import { locationCoordinates } from './locationMapPosition.js';

const clean = (value) => String(value ?? '').trim();

/**
 * Datele locatiei propuse, asa cum se pastreaza in submitted_payload (proposed_location).
 * Coordonatele si place_id se pastreaza ca locatia sa poata fi creata si mai tarziu, la aprobare.
 */
export function proposedLocationSnapshot(location = {}, geo = {}) {
  const snapshot = {
    name: clean(location.name),
    provider_type: clean(location.provider_type),
    provider_profile_type: clean(location.provider_profile_type),
    locality_siruta_code: clean(geo.siruta_code || location.locality_siruta_code),
    locality_name: clean(geo.name || location.locality_name),
    county_name: clean(geo.county_name || location.county_name),
    address: clean(location.address),
    phone_public: clean(location.phone_public),
    public_email: clean(location.public_email),
  };
  snapshot.map_precision = location.map_precision === 'exact' && locationCoordinates(location) ? 'exact' : 'approximate';
  if (clean(location.place_id)) snapshot.place_id = clean(location.place_id);
  const point = locationCoordinates(location);
  if (point) Object.assign(snapshot, point);
  return snapshot;
}

/** Ce lipseste ca propunerea sa poata deveni locatie (lista goala = completa). */
export function missingProposalFields(proposed = {}) {
  return ['name', 'provider_type', 'provider_profile_type', 'locality_siruta_code', 'address']
    .filter((field) => !clean(proposed[field]))
    .concat(!clean(proposed.phone_public) && !clean(proposed.public_email) ? ['phone_public_or_public_email'] : []);
}

export function newOrganizationRecord({ name, providerProfileType } = {}) {
  return {
    name: clean(name),
    status: 'activa',
    organization_type: clean(providerProfileType),
  };
}

/**
 * Locatia noua, inainte de verificare: nepublicata, nerevendicata, neverificata.
 * Geografia vine din GeographicLocality (SIRUTA), nu din textul trimis.
 */
export function newLocationRecord({ proposed = {}, geo = {}, organizationId = null, nowIso = new Date().toISOString() } = {}) {
  const record = {
    name: clean(proposed.name),
    provider_type: clean(proposed.provider_type),
    provider_profile_type: clean(proposed.provider_profile_type),
    locality_siruta_code: clean(geo.siruta_code),
    locality_name: clean(geo.name),
    county_code: clean(geo.county_code),
    county_name: clean(geo.county_name),
    uat_code: clean(geo.uat_code),
    uat_name: clean(geo.uat_name),
    city: clean(geo.name),
    county: clean(geo.county_name),
    address: clean(proposed.address),
    map_precision: proposed.map_precision === 'exact' && locationCoordinates(proposed) ? 'exact' : 'approximate',
    phone_public: clean(proposed.phone_public),
    public_email: clean(proposed.public_email),
    availability_status: 'necunoscuta',
    status: 'in_verificare',
    public_visibility_status: 'draft',
    profile_control_status: 'directory',
    claim_verification_status: 'pending',
    profile_control_status_updated_at: nowIso,
    profile_control_status_reason: 'Locatie noua trimisa spre verificare',
    verification_state: 'in_verification',
    active_status: 'activa',
    is_verified: false,
    data_source: clean(proposed.place_id) ? 'google_place_reference' : 'manual',
    last_confirmed_at: nowIso,
  };
  if (clean(proposed.place_id)) record.place_id = clean(proposed.place_id);
  const point = locationCoordinates(proposed);
  if (point) Object.assign(record, point);
  if (organizationId) record.organization_id = organizationId;
  return record;
}

/**
 * Duplicatele aparute DUPA ce furnizorul a trimis cererea (nu erau in snapshot-ul vazut de admin).
 * Propunerile retrase (respinse/arhivate) si cele confirmate deja de admin nu mai opresc aprobarea.
 */
export function newDuplicateCandidates({
  snapshotCandidates = [],
  currentCandidates = [],
  retiredLocationIds = [],
  acknowledgedIds = [],
} = {}) {
  const known = new Set(snapshotCandidates.map((candidate) => candidate?.location_id).filter(Boolean));
  const retired = new Set(retiredLocationIds);
  const acknowledged = new Set(acknowledgedIds);
  return currentCandidates.filter((candidate) => (
    candidate?.location_id
    && BLOCKING_DUPLICATE_SEVERITIES.includes(candidate.severity)
    && !known.has(candidate.location_id)
    && !retired.has(candidate.location_id)
    && !acknowledged.has(candidate.location_id)
  ));
}

export default {
  DISTINCT_APPROVAL_NOTE_MIN_LENGTH,
  BLOCKING_DUPLICATE_SEVERITIES,
  proposedLocationSnapshot,
  missingProposalFields,
  newOrganizationRecord,
  newLocationRecord,
  newDuplicateCandidates,
};
