import { canAccessProviderLeadInbox, normalizeProviderMemberRole } from './providerLeadInboxPolicy.js';
import { findProviderLeadLocationMembership } from './providerLeadLocationAccess.js';
import { providerMembershipAccessRole } from './providerOrganizationOwnerScope.js';

// 2026-10-09 (audit Top 3, T1 + T7; Alex: „1 + 2 + 3 întâi”). Până acum, cele două câmpuri care
// decid dacă o locație primește cereri (`request_intake_status`, `accepts_patients_directly`)
// porneau oprite și niciun ecran nu le putea porni, deci nicio cerere nu ajungea la nimeni.
// Furnizorul le pornește acum dintr-un singur comutator („Primesc cereri de la clienți”).
// Regulile de eligibilitate din providerLeadEligibility.js rămân neschimbate.

export const PROVIDER_REQUEST_INTAKE_CONTRACT_VERSION = 'provider-request-intake-v1';

const MANAGER_ROLES = new Set(['organization_owner', 'location_manager']);
const REQUEST_READY_CONFIRMATION_LEVELS = new Set(['provider_confirmed', 'vezunde_verified']);
const OWNER_LOOKUP_LIMIT = 10;

function clean(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function activeRow(row) {
  const status = clean(row?.active_status).toLowerCase();
  return Boolean(row)
    && row.is_active !== false
    && !['inactiv', 'inactiva', 'inactive'].includes(status);
}

export function isRequestIntakeEnabled(location) {
  return location?.request_intake_status === 'active' && location?.accepts_patients_directly === true;
}

// Oprirea folosește „paused” (oprită de furnizor), nu „inactive” (niciodată pornită).
export function requestIntakeUpdate(enabled) {
  return enabled === true
    ? { request_intake_status: 'active', accepts_patients_directly: true }
    : { request_intake_status: 'paused', accepts_patients_directly: false };
}

export function canManageRequestIntake(role) {
  return MANAGER_ROLES.has(normalizeProviderMemberRole(role));
}

// Aceleași condiții pe serviciu ca evaluateProviderLeadEligibility (fără potrivirea pe cerere).
export function countRequestReadyServices(services) {
  return (Array.isArray(services) ? services : []).filter((row) => (
    activeRow(row)
    && row.accepts_requests !== false
    && row.matching_allowed === true
    && row.migration_review_required !== true
    && REQUEST_READY_CONFIRMATION_LEVELS.has(clean(row.confirmation_level))
  )).length;
}

export function buildRequestIntakeReadiness({ location = {}, services = [], hasActiveMember = false } = {}) {
  const readyServiceCount = countRequestReadyServices(services);
  const controlled = ['claimed', 'verified'].includes(clean(location.profile_control_status));
  const published = location.status === 'publicata'
    && activeRow(location)
    && location.profile_control_status !== 'suspended';
  const items = [
    {
      key: 'controlled',
      ok: controlled,
      label: controlled ? 'Profil revendicat sau verificat' : 'Profilul trebuie revendicat',
    },
    {
      key: 'published',
      ok: published,
      label: published ? 'Profil publicat și activ' : 'Profilul nu este publicat sau activ',
    },
    {
      key: 'services',
      ok: readyServiceCount > 0,
      label: readyServiceCount > 0
        ? (readyServiceCount === 1 ? '1 serviciu confirmat poate primi cereri' : `${readyServiceCount} servicii confirmate pot primi cereri`)
        : 'Niciun serviciu confirmat încă (Servicii)',
    },
    {
      key: 'member',
      ok: hasActiveMember === true,
      label: hasActiveMember === true ? 'Echipa are acces la Cereri' : 'Nimeni din echipă nu are acces la Cereri',
    },
    {
      key: 'intake',
      ok: isRequestIntakeEnabled(location),
      label: isRequestIntakeEnabled(location) ? 'Primirea cererilor este pornită' : 'Primirea cererilor este oprită',
    },
  ];
  return {
    ready: items.every((item) => item.ok),
    ready_service_count: readyServiceCount,
    items,
  };
}

// T7: o cerere ajunge doar unde o poate citi cineva. Membru direct al locației cu acces la Cereri,
// sau proprietar al organizației care acoperă locația (aceeași regulă ca inboxul).
export async function locationHasActiveLeadMember(svc, location) {
  if (!location?.id) return false;
  const direct = await svc.entities.ProviderMembership.filter({
    location_id: location.id,
    status: 'active',
  }, '-created_date', 50);
  if ((direct || []).some((row) => clean(row?.user_id) && canAccessProviderLeadInbox(row?.role))) return true;

  const organizationId = clean(location.organization_id, 120);
  if (!organizationId) return false;
  const organizationRows = await svc.entities.ProviderMembership.filter({
    organization_id: organizationId,
    status: 'active',
  }, '-created_date', 200);
  const ownerUserIds = [...new Set((organizationRows || [])
    .filter((row) => providerMembershipAccessRole(row) === 'organization_owner')
    .map((row) => clean(row?.user_id, 120))
    .filter(Boolean))].slice(0, OWNER_LOOKUP_LIMIT);
  for (const userId of ownerUserIds) {
    const membership = await findProviderLeadLocationMembership(svc, { id: userId }, location).catch(() => null);
    if (membership) return true;
  }
  return false;
}
