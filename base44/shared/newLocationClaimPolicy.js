// Locatii noi propuse de furnizori (care nu sunt in director), ca reguli pure.
//
// 2026-10-01. Fluxul `submitProviderClaim` cu `mode: 'new_location'` creeaza organizatia si
// locatia inainte de revizuirea admin (aprobarea are nevoie de ele ca sa dea acces). Pana acum:
//   - nu exista nicio limita: un cont putea trimite oricate locatii noi, fiecare cu organizatia ei;
//   - la respingere locatia ramanea ciorna si organizatia activa, fara membri - orfani care apoi
//     erau gasiti ca "duplicat puternic" cand proprietarul real incerca sa-si adauge locatia;
//   - verificarea de duplicate intorcea si locatii nepublicate ale altor utilizatori, cu nume si
//     adresa.
// Fisierul tine regulile intr-un singur loc, ca trimiterea, respingerea si verificarea de
// duplicate sa spuna acelasi lucru. Nimic de aici nu sterge date: respingerea arhiveaza.

export const NEW_LOCATION_CLAIM_POLICY_VERSION = 'new-location-claim-policy-v1';

export const NEW_LOCATION_CLAIM_MODES = Object.freeze(['new_location', 'new_location_duplicate_review']);
export const ACTIVE_CLAIM_STATUSES = Object.freeze(['in_asteptare', 'needs_more_info']);

// Cate locatii noi poate avea un cont in asteptare in acelasi timp. Un lant cu mai multe puncte
// le poate adauga dupa aprobare din workspace (extindere), fara limita asta.
export const MAX_PENDING_NEW_LOCATION_CLAIMS = 3;

export const NEW_LOCATION_LIMIT_MESSAGE = 'Ai deja '
  + `${MAX_PENDING_NEW_LOCATION_CLAIMS} locatii noi in verificare. Asteapta raspunsul pentru ele `
  + 'sau scrie-ne la contact@viasee.ro daca ai nevoie sa adaugi mai multe.';

const CONTROLLED_CONTROL_STATUSES = Object.freeze(['claimed', 'verified', 'suspended']);

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

export function pendingNewLocationClaimCount(claims) {
  return (Array.isArray(claims) ? claims : []).filter((claim) => (
    NEW_LOCATION_CLAIM_MODES.includes(clean(claim?.mode))
    && ACTIVE_CLAIM_STATUSES.includes(clean(claim?.status))
  )).length;
}

export function newLocationClaimLimitReached(claims, max = MAX_PENDING_NEW_LOCATION_CLAIMS) {
  return pendingNewLocationClaimCount(claims) >= max;
}

export function isLocationPubliclyListed(location) {
  return clean(location?.status) === 'publicata'
    && clean(location?.active_status) !== 'inactiva'
    && clean(location?.profile_control_status) !== 'suspended';
}

/**
 * O locatie propusa ca noua si respinsa (sau arhivata) nu mai reprezinta pe nimeni: nu trebuie
 * sa blocheze o propunere viitoare pentru acelasi loc si nu trebuie aratata altor utilizatori.
 */
export function isRetiredLocationProposal(location) {
  if (!location) return false;
  if (clean(location.status) === 'publicata') return false;
  return clean(location.public_visibility_status) === 'archived'
    || clean(location.claim_verification_status) === 'rejected';
}

/**
 * Ce se scrie pe locatie cand cererea de locatie noua este respinsa. `null` cand locatia nu
 * trebuie atinsa: a ajuns intre timp publica sau controlata (alta cale a preluat-o).
 */
export function rejectedNewLocationPatch(location) {
  if (!location) return null;
  if (clean(location.status) === 'publicata') return null;
  if (CONTROLLED_CONTROL_STATUSES.includes(clean(location.profile_control_status))) return null;
  return {
    claim_verification_status: 'rejected',
    status: 'draft',
    public_visibility_status: 'archived',
    active_status: 'inactiva',
    // 2026-10-02. Propunerea respinsa nu mai ramane 'in_verification' (test E2E). O stare verified sau
    // suspended pusa de admin nu se suprascrie.
    ...(['verified', 'suspended'].includes(clean(location.verification_state)) ? {} : { verification_state: 'unclaimed' }),
  };
}

/**
 * Organizatia creata odata cu cererea se arhiveaza doar daca e a cererii si nu are nimic altceva:
 * nicio alta locatie, niciun membru activ, niciun control castigat pe alta cale.
 */
export function canArchiveClaimCreatedOrganization({ claim, organization, organizationLocations, activeMemberships } = {}) {
  if (!claim || !organization) return false;
  if (clean(claim.mode) !== 'new_location') return false;
  if (!clean(claim.organization_id) || clean(claim.organization_id) !== clean(organization.id)) return false;
  if (clean(organization.status) === 'inactiva' && clean(organization.public_visibility_status) === 'archived') return false;
  if (CONTROLLED_CONTROL_STATUSES.includes(clean(organization.control_status))) return false;
  if (clean(organization.directory_external_key)) return false;
  const locations = Array.isArray(organizationLocations) ? organizationLocations : [];
  if (locations.some((location) => clean(location?.id) !== clean(claim.location_id))) return false;
  if ((Array.isArray(activeMemberships) ? activeMemberships : []).length > 0) return false;
  return true;
}

export const ARCHIVED_ORGANIZATION_PATCH = Object.freeze({
  status: 'inactiva',
  public_visibility_status: 'archived',
});

/**
 * Candidatul de duplicat aratat unui furnizor (nu unui admin). Locatiile nepublice ale altora
 * raman in calcul - doua persoane care propun acelasi loc trebuie sa ajunga la admin - dar fara
 * nume, adresa sau organizatie: furnizorul afla doar ca exista o propunere in verificare.
 *
 * 2026-10-02. O locatie a contului (are acces la ea sau a propus-o el) nu e "a altcuiva": se
 * arata cu nume si adresa si marcata `is_own`, fara buton de revendicare (test E2E 2026-10-02).
 */
export function providerSafeIdentityCandidate(candidate, location, { ownLocation = false } = {}) {
  if (!candidate) return null;
  const isPublic = isLocationPubliclyListed(location);
  if (ownLocation) return { ...candidate, recommended_action: 'review_manually', is_public: isPublic, is_own: true };
  if (isPublic) return { ...candidate, is_public: true };
  return {
    location_id: candidate.location_id,
    name: '',
    organization_name: '',
    provider_profile_type: candidate.provider_profile_type || '',
    locality_name: candidate.locality_name || '',
    county_name: candidate.county_name || '',
    address: '',
    profile_control_status: 'directory',
    severity: candidate.severity,
    score: candidate.score,
    matched_fields: candidate.matched_fields || [],
    recommended_action: 'review_manually',
    is_public: false,
  };
}

export default {
  NEW_LOCATION_CLAIM_POLICY_VERSION,
  NEW_LOCATION_CLAIM_MODES,
  ACTIVE_CLAIM_STATUSES,
  MAX_PENDING_NEW_LOCATION_CLAIMS,
  NEW_LOCATION_LIMIT_MESSAGE,
  ARCHIVED_ORGANIZATION_PATCH,
  pendingNewLocationClaimCount,
  newLocationClaimLimitReached,
  isLocationPubliclyListed,
  isRetiredLocationProposal,
  rejectedNewLocationPatch,
  canArchiveClaimCreatedOrganization,
  providerSafeIdentityCandidate,
};
