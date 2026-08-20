import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { deriveCanonicalDirectoryState } from '../../shared/directoryCanonicalModel.js';

const PATIENT_FACING_PROFILE_TYPES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
  'optical_laboratory_b2c',
]);
const CONTROLLED_PROFILE_STATUSES = new Set(['claimed', 'verified']);

function clean(value) {
  return String(value || '').trim();
}

// Detectie retea dupa nume, cand locatia NU are organizatie legata (2026-08-19).
// Aceeasi normalizare ca in findProviderIdentityCandidates: fara diacritice,
// fara punctuatie, cuvinte de minim 3 litere. Reteaua se recunoaste dupa nucleul
// comun al numelui ("Optica Dr. Demian" din "Optica Dr. Demian - Vlaicu"), asa ca
// pragul e pe cuvintele care se repeta, nu pe numele intreg.
function normalizeName(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(value) {
  return normalizeName(value).split(' ').filter((token) => token.length >= 3);
}

// Cuvinte de categorie, comune multor afaceri diferite. Un "nucleu comun" format
// DOAR din ele nu inseamna retea: "Spitalul Judetean Pitesti" si "Spitalul Judetean
// Resita" impart 2 cuvinte, dar sunt institutii complet distincte.
const GENERIC_NAME_TOKENS = new Set([
  'optica', 'optic', 'optik', 'clinica', 'clinic', 'cabinet', 'spitalul', 'spital',
  'centrul', 'centru', 'medical', 'medicala', 'policlinica', 'judetean', 'judeteana',
  'urgenta', 'oftalmologie', 'oftalmologic', 'municipal', 'municipala', 'ambulatoriu',
  'ambulator', 'sectia', 'vedere', 'lentile',
]);

// Scor de retea, pe NUCLEUL COMUN de la inceputul numelui - nu pe cuvinte totale.
// Retelele isi pun brandul primul si distinctivul la final ("Optic Plus Bacau -
// Aprodu Purice" / "- Stefan cel Mare"), deci prefixul comun e semnalul real.
// Verificat pe date reale din director: 8/8 corect, inclusiv cazurile-capcana.
function networkScore(sourceName, targetName) {
  const source = nameTokens(sourceName);
  const target = nameTokens(targetName);
  let prefixLength = 0;
  while (prefixLength < source.length && prefixLength < target.length
    && source[prefixLength] === target[prefixLength]) prefixLength += 1;
  if (prefixLength === 0) return 0;
  const sharedCore = source.slice(0, prefixLength);
  // Fara macar un cuvant propriu (brand) in nucleu, nu e retea.
  if (!sharedCore.some((token) => !GENERIC_NAME_TOKENS.has(token))) return 0;
  return prefixLength / Math.max(source.length, target.length) + 0.2;
}

function isClaimCandidate(location) {
  if (!location || !PATIENT_FACING_PROFILE_TYPES.has(clean(location.provider_profile_type))) return false;
  const state = deriveCanonicalDirectoryState(location);
  return state.is_publicly_available === true && state.control_status !== 'suspended';
}

function safeLocation(location, organizationLinkStatus, controlled, alreadyHasAccess) {
  const state = deriveCanonicalDirectoryState(location);
  return {
    id: location.id,
    name: location.public_display_name || location.name || 'Locatie',
    provider_type: location.provider_type || null,
    provider_profile_type: location.provider_profile_type || null,
    city: location.city || location.locality_name || null,
    county: location.county || location.county_name || null,
    address: location.address || null,
    profile_control_status: state.control_status,
    operational_status: state.operational_status,
    organization_link_status: organizationLinkStatus,
    controlled,
    already_has_access: alreadyHasAccess,
    claim_action: controlled ? 'request_access' : 'claim_profile',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara.' }, { status: 401 });

    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const primaryLocationId = clean(input.location_id);
    if (!primaryLocationId) return Response.json({ error: 'location_id este obligatoriu.' }, { status: 400 });

    const primaryLocation = await svc.entities.ProviderLocation.get(primaryLocationId).catch(() => null);
    if (!isClaimCandidate(primaryLocation)) {
      return Response.json({ error: 'Locatia selectata nu poate fi revendicata momentan.' }, { status: 400 });
    }

    const organizationId = clean(primaryLocation.organization_id);
    const organization = organizationId
      ? await svc.entities.ProviderOrganization.get(organizationId).catch(() => null)
      : null;
    const rawCandidates = organizationId
      ? await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, 'name', 1000).catch(() => [])
      : [primaryLocation];

    // Fara organizatie legata, sistemul arata doar locatia curenta - chiar daca in
    // director exista alte locatii evident din aceeasi retea (2026-08-19). Cautam
    // dupa nucleul comun al numelui si le propunem ca SUGESTIE; decizia ramane a
    // furnizorului, iar aprobarea a adminului. Nu modificam nimic automat.
    let networkSuggestions = [];
    if (!organizationId) {
      const primaryTokens = nameTokens(primaryLocation.name);
      // Sub 2 cuvinte utile, orice potrivire ar fi zgomot ("Optica", "Clinica").
      if (primaryTokens.length >= 2) {
        const pool = await svc.entities.ProviderLocation.list(null, 1000).catch(() => []);
        networkSuggestions = pool
          .filter((location) => location.id !== primaryLocationId)
          .filter((location) => !clean(location.organization_id))
          .filter((location) => isClaimCandidate(location))
          .map((location) => ({ location, ratio: networkScore(primaryLocation.name, location.name) }))
          // 0.5: prag verificat pe date reale din director (8/8 corect).
          .filter((entry) => entry.ratio >= 0.5)
          .sort((a, b) => b.ratio - a.ratio)
          .slice(0, 12)
          .map((entry) => ({
            ...safeLocation(entry.location, 'unassigned', false, false),
            match_confidence: Math.round(entry.ratio * 100),
          }));
      }
    }

    const links = organizationId
      ? await svc.entities.DirectoryOrganizationLocationLink.filter({
          organization_id: organizationId,
          link_record_status: 'active',
        }, '-reviewed_at', 1000).catch(() => [])
      : [];
    const linkByLocationId = new Map();
    for (const link of links) {
      if (!linkByLocationId.has(link.location_id)) linkByLocationId.set(link.location_id, link);
    }

    const candidates = rawCandidates.filter(isClaimCandidate);
    if (!candidates.some((location) => location.id === primaryLocationId)) candidates.unshift(primaryLocation);

    const membershipRows = await Promise.all(candidates.map((location) => svc.entities.ProviderMembership.filter({
      location_id: location.id,
      status: 'active',
    }, '-created_date', 100).catch(() => [])));

    const candidateLocations = candidates.map((location, index) => {
      const link = linkByLocationId.get(location.id);
      const linkStatus = link?.link_status || (location.organization_id ? 'probable' : 'unassigned');
      const controlled = membershipRows[index]?.length > 0
        || CONTROLLED_PROFILE_STATUSES.has(clean(location.profile_control_status))
        || clean(location.claim_verification_status) === 'approved';
      const alreadyHasAccess = membershipRows[index]?.some((membership) => membership.user_id === user.id) || false;
      return safeLocation(location, linkStatus, controlled, alreadyHasAccess);
    }).filter((location) => !['conflict', 'rejected'].includes(location.organization_link_status) || location.id === primaryLocationId);

    candidateLocations.sort((left, right) => {
      if (left.id === primaryLocationId) return -1;
      if (right.id === primaryLocationId) return 1;
      return `${left.city || ''} ${left.name || ''}`.localeCompare(`${right.city || ''} ${right.name || ''}`, 'ro');
    });

    return Response.json({
      scope_contract_version: 'provider-claim-scope-v1',
      primary_location_id: primaryLocationId,
      organization: organization ? {
        id: organization.id,
        name: organization.public_display_name || organization.name || 'Organizatie',
        organization_type: organization.organization_type_code || organization.organization_type || null,
      } : null,
      candidate_locations: candidateLocations,
      supports_selected_locations: candidateLocations.filter((location) => !location.already_has_access).length > 1,
      supports_organization_claim: Boolean(organization),
      // Sugestii de retea, doar cand nu exista organizatie (2026-08-19). Interfata le
      // propune explicit; nu intra automat in revendicare.
      network_suggestions: networkSuggestions,
      supports_organization_creation: !organization && networkSuggestions.length > 0,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Optiunile de revendicare nu au putut fi incarcate.' }, { status: 500 });
  }
});
