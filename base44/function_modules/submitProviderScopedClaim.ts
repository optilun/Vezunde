import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { deriveCanonicalDirectoryState } from '../../shared/directoryCanonicalModel.js';
import {
  PROVIDER_CLAIM_SCOPE_CONTRACT_VERSION,
  claimLocationIdsFromPayload,
  normalizeClaimScopeSelection,
} from '../../shared/providerClaimScopePolicy.js';

const ACTIVE_OR_APPROVED_CLAIM_STATUSES = new Set(['in_asteptare', 'needs_more_info', 'aprobata']);
const CONTROLLED_PROFILE_STATUSES = new Set(['claimed', 'verified']);
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

function clean(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (_error) {
    return {};
  }
}

function isClaimCandidate(location) {
  if (!location || !PATIENT_FACING_PROFILE_TYPES.has(clean(location.provider_profile_type))) return false;
  const state = deriveCanonicalDirectoryState(location);
  return state.is_publicly_available === true && state.control_status !== 'suspended';
}

function locationSnapshot(location, linkStatus, controlled) {
  const state = deriveCanonicalDirectoryState(location);
  return {
    id: location.id,
    name: location.public_display_name || location.name || 'Locatie',
    organization_id: location.organization_id || null,
    provider_type: location.provider_type || null,
    provider_profile_type: location.provider_profile_type || null,
    city: location.city || location.locality_name || null,
    county: location.county || location.county_name || null,
    address: location.address || null,
    profile_control_status: state.control_status,
    operational_status: state.operational_status,
    organization_link_status: linkStatus,
    controlled,
    claim_action: controlled ? 'request_access' : 'claim_profile',
  };
}

async function cleanupPartialScope(svc, claimId, scopeId, childIds) {
  for (const childId of childIds) await svc.entities.ProviderClaimLocationSelection.delete(childId).catch(() => null);
  if (scopeId) await svc.entities.ProviderClaimScopeSelection.delete(scopeId).catch(() => null);
  if (claimId) await svc.entities.ProviderClaimRequest.delete(claimId).catch(() => null);
}

export async function handle(req: Request) {
  let createdClaimId = null;
  let createdScopeId = null;
  const createdChildIds = [];
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara.' }, { status: 401 });

    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const contact = input.contact || {};
    const relationship = clean(input.claimant_relationship, 80);
    const primaryLocationId = clean(input.location_id, 160);

    if (input.representation_confirmed !== true) {
      return Response.json({ error: 'Confirmarea reprezentarii este obligatorie.' }, { status: 400 });
    }
    if (!clean(contact.contact_name, 160) || !clean(contact.email, 240)) {
      return Response.json({ error: 'Numele complet si emailul sunt obligatorii.' }, { status: 400 });
    }
    if (!primaryLocationId) return Response.json({ error: 'Locatia este obligatorie.' }, { status: 400 });

    const primaryLocation = await svc.entities.ProviderLocation.get(primaryLocationId).catch(() => null);
    if (!isClaimCandidate(primaryLocation)) {
      return Response.json({ error: 'Locatia selectata nu poate fi revendicata momentan.' }, { status: 400 });
    }

    const organizationId = clean(primaryLocation.organization_id, 160);
    const organization = organizationId
      ? await svc.entities.ProviderOrganization.get(organizationId).catch(() => null)
      : null;
    const rawCandidates = organizationId
      ? await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, 'name', 1000).catch(() => [])
      : [primaryLocation];
    const candidates = rawCandidates.filter(isClaimCandidate);
    if (!candidates.some((location) => location.id === primaryLocationId)) candidates.unshift(primaryLocation);

    const links = organizationId
      ? await svc.entities.DirectoryOrganizationLocationLink.filter({
          organization_id: organizationId,
          link_record_status: 'active',
        }, '-reviewed_at', 1000).catch(() => [])
      : [];
    const linkByLocationId = new Map();
    for (const link of links) if (!linkByLocationId.has(link.location_id)) linkByLocationId.set(link.location_id, link);

    const eligibleCandidates = candidates.filter((location) => {
      const linkStatus = linkByLocationId.get(location.id)?.link_status || (location.organization_id ? 'probable' : 'unassigned');
      return location.id === primaryLocationId || !['conflict', 'rejected'].includes(linkStatus);
    });
    const candidateIds = eligibleCandidates.map((location) => location.id);

    const normalized = normalizeClaimScopeSelection({
      primaryLocationId,
      organizationId,
      relationship,
      claimScope: input.claim_scope,
      candidateLocationIds: candidateIds,
      requestedLocationIds: input.requested_location_ids,
      excludedLocationIds: input.excluded_location_ids,
      reportedMissingLocation: input.reported_missing_location,
    });
    if (!normalized.ok) return Response.json({ error: normalized.error }, { status: 400 });

    const requestedSet = new Set(normalized.requested_location_ids);
    const requestedCandidates = eligibleCandidates.filter((location) => requestedSet.has(location.id));
    if (requestedCandidates.length !== normalized.requested_location_ids.length) {
      return Response.json({ error: 'Una dintre locatiile selectate nu mai este disponibila.' }, { status: 409 });
    }

    const ownMembershipRows = await Promise.all(requestedCandidates.map((location) => svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: location.id,
      status: 'active',
    }, '-created_date', 1).catch(() => [])));
    const alreadyAccessible = requestedCandidates.filter((_location, index) => ownMembershipRows[index]?.length > 0);
    if (alreadyAccessible.length > 0) {
      return Response.json({
        error: `Ai deja acces la ${alreadyAccessible.length === 1 ? 'locatia selectata' : 'unele locatii selectate'}. Elimina-le din solicitare.`,
      }, { status: 400 });
    }

    const previousClaims = await svc.entities.ProviderClaimRequest.filter({ user_id: user.id }, '-created_date', 200).catch(() => []);
    for (const previousClaim of previousClaims) {
      if (!ACTIVE_OR_APPROVED_CLAIM_STATUSES.has(previousClaim.status)) continue;
      const payload = parseJSON(previousClaim.submitted_payload);
      const previousIds = new Set(claimLocationIdsFromPayload(previousClaim, payload));
      if (normalized.requested_location_ids.some((locationId) => previousIds.has(locationId))) {
        return Response.json({ error: 'Ai deja o solicitare activa sau aprobata pentru cel putin una dintre locatiile selectate.' }, { status: 400 });
      }
    }

    const membershipRows = await Promise.all(eligibleCandidates.map((location) => svc.entities.ProviderMembership.filter({
      location_id: location.id,
      status: 'active',
    }, '-created_date', 1).catch(() => [])));
    const snapshots = eligibleCandidates.map((location, index) => {
      const linkStatus = linkByLocationId.get(location.id)?.link_status || (location.organization_id ? 'probable' : 'unassigned');
      const controlled = membershipRows[index]?.length > 0
        || CONTROLLED_PROFILE_STATUSES.has(clean(location.profile_control_status))
        || clean(location.claim_verification_status) === 'approved';
      return locationSnapshot(location, linkStatus, controlled);
    });
    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const requestedSnapshots = normalized.requested_location_ids.map((locationId) => snapshotById.get(locationId)).filter(Boolean);
    const controlledCount = requestedSnapshots.filter((snapshot) => snapshot.controlled).length;
    const requestType = controlledCount === requestedSnapshots.length
      ? 'access_request_existing_claimed_profiles'
      : controlledCount === 0
        ? 'claim_existing_directory_profiles'
        : 'mixed_claim_and_access_request';
    const businessName = normalized.claim_scope === 'organization'
      ? (organization?.public_display_name || organization?.name || primaryLocation.name)
      : primaryLocation.name;
    const claimSubjectType = organizationId || !clean(primaryLocation.provider_profile_type).includes('independent_')
      ? 'organization'
      : 'independent_professional';
    const submittedPayload = {
      mode: 'claim',
      scope_contract_version: PROVIDER_CLAIM_SCOPE_CONTRACT_VERSION,
      claim_scope: normalized.claim_scope,
      request_type: requestType,
      location_id: primaryLocationId,
      organization_id: organizationId || null,
      requested_location_ids: normalized.requested_location_ids,
      excluded_location_ids: normalized.excluded_location_ids,
      requested_membership_role: normalized.requested_membership_role,
      claimant_relationship: relationship,
      reported_missing_location: normalized.reported_missing_location || '',
      candidate_location_count: candidateIds.length,
      contact: {
        contact_name: clean(contact.contact_name, 160),
        email: clean(contact.email, 240),
        phone: clean(contact.phone, 80),
      },
    };

    const claim = await svc.entities.ProviderClaimRequest.create({
      organization_id: organizationId || null,
      location_id: primaryLocationId,
      user_id: user.id,
      mode: 'claim',
      claim_subject_type: claimSubjectType,
      claimant_relationship: relationship,
      business_name: businessName,
      contact_name: clean(contact.contact_name, 160),
      role: clean(contact.role, 160),
      email: clean(contact.email, 240),
      phone: clean(contact.phone, 80),
      representation_confirmed: true,
      submitted_payload: JSON.stringify(submittedPayload),
      status: 'in_asteptare',
    });
    createdClaimId = claim.id;

    const scope = await svc.entities.ProviderClaimScopeSelection.create({
      claim_request_id: claim.id,
      organization_id: organizationId || null,
      primary_location_id: primaryLocationId,
      scope_contract_version: PROVIDER_CLAIM_SCOPE_CONTRACT_VERSION,
      claim_scope: normalized.claim_scope,
      candidate_location_count: candidateIds.length,
      requested_location_count: normalized.requested_location_ids.length,
      excluded_location_count: normalized.excluded_location_ids.length,
      reported_missing_locations_json: normalized.reported_missing_location
        ? JSON.stringify([{ description: normalized.reported_missing_location }])
        : JSON.stringify([]),
      scope_snapshot_json: JSON.stringify({
        organization: organization ? { id: organization.id, name: organization.public_display_name || organization.name } : null,
        candidates: snapshots,
      }),
      requested_membership_role: normalized.requested_membership_role,
      approval_status: 'pending',
      approved_location_count: 0,
      selection_status: 'active',
    });
    createdScopeId = scope.id;

    for (const snapshot of snapshots) {
      const included = requestedSet.has(snapshot.id);
      const child = await svc.entities.ProviderClaimLocationSelection.create({
        claim_request_id: claim.id,
        organization_id: organizationId || null,
        location_id: snapshot.id,
        decision: included ? 'included' : 'excluded',
        request_status: included ? 'pending' : 'not_requested',
        claim_action: snapshot.claim_action,
        was_controlled: snapshot.controlled,
        organization_link_status: snapshot.organization_link_status,
        requested_role: normalized.requested_membership_role,
        location_snapshot_json: JSON.stringify(snapshot),
        selection_status: 'active',
      });
      createdChildIds.push(child.id);
    }

    for (const snapshot of requestedSnapshots) {
      if (snapshot.controlled) continue;
      await svc.entities.ProviderLocation.update(snapshot.id, {
        claim_verification_status: 'pending',
      });
    }

    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderClaimRequest',
      entity_id: claim.id,
      action_type: 'submit_provider_scoped_claim',
      changed_fields: ['claim_scope', 'requested_location_ids', 'excluded_location_ids'],
      previous_values: JSON.stringify({}),
      new_values: JSON.stringify({
        claim_scope: normalized.claim_scope,
        requested_location_count: normalized.requested_location_ids.length,
        excluded_location_count: normalized.excluded_location_ids.length,
        request_type: requestType,
      }),
      admin_user_id: user.id,
      admin_email: user.email || '',
      note: '',
      performed_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({
      claim_request_id: claim.id,
      location_id: primaryLocationId,
      organization_id: organizationId || null,
      claim_scope: normalized.claim_scope,
      requested_location_ids: normalized.requested_location_ids,
      requested_membership_role: normalized.requested_membership_role,
    });
  } catch (error) {
    if (createdClaimId) {
      try {
        const base44 = createClientFromRequest(req);
        await cleanupPartialScope(base44.asServiceRole, createdClaimId, createdScopeId, createdChildIds);
      } catch (_cleanupError) {
        // Cererea partiala ramane vizibila adminului daca platforma nu permite curatarea completa.
      }
    }
    return Response.json({ error: error?.message || 'Solicitarea nu a putut fi trimisa.' }, { status: 500 });
  }
}
