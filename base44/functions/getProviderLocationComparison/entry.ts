import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const MAX_LOCATIONS = 6;

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'manager') return 'location_manager';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function reject(error, status = 400, details = {}) {
  return Response.json({ error, ...details }, { status });
}

function locationName(location) {
  return location.public_display_name || location.name || 'Locatie';
}

function locationPlace(location) {
  return location.locality_name || location.city || location.county_name || location.county || '';
}

function primaryPhoto(location) {
  return clean(
    location.photo_url
    || location.cover_photo_url
    || location.primary_photo_url
    || location.image_url,
  );
}

function activeServiceRow(row) {
  return row
    && row.is_active !== false
    && row.active !== false
    && !['removal_pending', 'provider_suspended'].includes(clean(row.provider_visibility_status));
}

function canonicalServiceEntries(rows) {
  const entries = new Map();
  for (const row of rows.filter(activeServiceRow)) {
    const normalized = normalizeServiceKey(row.service_key);
    if (normalized.status !== 'canonical' && normalized.status !== 'legacy_mapped') continue;
    if (!normalized.canonicalKey) continue;
    const definition = getCanonicalServiceDefinition(normalized.canonicalKey);
    if (!definition) continue;
    entries.set(normalized.canonicalKey, {
      key: normalized.canonicalKey,
      label: definition.label || normalized.canonicalKey,
      group: definition.group || 'other',
      confirmation_level: row.confirmation_level || 'not_confirmed',
      matching_allowed: row.matching_allowed === true,
    });
  }
  return [...entries.values()].sort((a, b) => (
    `${a.group}:${a.label}`.localeCompare(`${b.group}:${b.label}`, 'ro')
  ));
}

function activeSubmissionRows(rows) {
  return rows
    .filter((row) => !row.claim_request_id)
    .filter((row) => ACTIVE_SUBMISSION_STATUSES.includes(row.status))
    .sort((a, b) => new Date(b.updated_date || b.created_date || 0).getTime() - new Date(a.updated_date || a.created_date || 0).getTime());
}

function checklist(location, content) {
  const checks = [
    { key: 'identity', label: 'Identitate', done: Boolean(clean(location.public_display_name || location.name)) },
    { key: 'address', label: 'Adresa', done: Boolean(clean(location.address)) },
    { key: 'contact', label: 'Contact public', done: Boolean(clean(location.public_phone || location.phone_public || location.public_email)) },
    { key: 'hours', label: 'Program', done: Boolean(clean(location.opening_hours || location.opening_hours_json)) },
    { key: 'services', label: 'Servicii', done: content.service_entries.length > 0 },
    { key: 'photo', label: 'Fotografie', done: Boolean(primaryPhoto(location) || content.approved_media_count > 0) },
  ];
  const completed = checks.filter((item) => item.done).length;
  return {
    percentage: Math.round((completed / checks.length) * 100),
    completed_count: completed,
    total_items: checks.length,
    missing: checks.filter((item) => !item.done).map((item) => item.key),
    checks,
  };
}

async function loadLocationComparison(svc, location) {
  const [serviceRows, specializationRows, teamRows, mediaRows, submissionRows] = await Promise.all([
    svc.entities.LocationService.filter({ location_id: location.id }, 'service_key', 700).catch(() => []),
    svc.entities.LocationSpecialization.filter({ location_id: location.id, is_active: true }, null, 300).catch(() => []),
    svc.entities.ProfessionalLocationAssignment.filter({ location_id: location.id, active_status: 'activ' }, null, 300).catch(() => []),
    svc.entities.ProviderMediaAsset.filter({ location_id: location.id }, '-created_date', 500).catch(() => []),
    svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: location.id,
      access_origin: 'provider_workspace',
      status: { $in: ACTIVE_SUBMISSION_STATUSES },
    }, '-updated_date', 100).catch(() => []),
  ]);

  const serviceEntries = canonicalServiceEntries(serviceRows);
  const activeSubmissions = activeSubmissionRows(submissionRows);
  const approvedMedia = mediaRows.filter((row) => row.status === 'approved');
  const pendingBySection = {};
  for (const row of activeSubmissions) {
    const section = clean(row.section || 'other');
    pendingBySection[section] = (pendingBySection[section] || 0) + 1;
  }
  const content = {
    service_entries: serviceEntries,
    specialization_count: specializationRows.length,
    active_team_count: teamRows.length,
    public_team_count: teamRows.filter((row) => row.public_status === 'public').length,
    approved_media_count: approvedMedia.length,
    pending_changes_count: activeSubmissions.length,
    pending_by_section: pendingBySection,
    pending_sections: Object.keys(pendingBySection).sort(),
    service_draft_status: activeSubmissions.find((row) => row.section === 'services')?.status || '',
  };

  return {
    id: location.id,
    organization_id: location.organization_id || null,
    name: locationName(location),
    locality: locationPlace(location),
    address: location.address || '',
    provider_type: location.provider_type || '',
    provider_profile_type: location.provider_profile_type || '',
    active_status: location.active_status || 'activa',
    status: location.status || 'draft',
    profile_control_status: location.profile_control_status || 'directory',
    claim_verification_status: location.claim_verification_status || 'pending',
    profile_completeness: Number.isFinite(Number(location.profile_completeness)) ? Number(location.profile_completeness) : null,
    opening_hours: location.opening_hours || '',
    has_opening_hours: Boolean(clean(location.opening_hours || location.opening_hours_json)),
    has_public_contact: Boolean(clean(location.public_phone || location.phone_public || location.public_email)),
    has_primary_photo: Boolean(primaryPhoto(location)),
    ...content,
    comparison_coverage: checklist(location, content),
  };
}

function buildServiceSummary(locations) {
  const sets = locations.map((location) => new Set(location.service_entries.map((entry) => entry.key)));
  const union = new Set(sets.flatMap((set) => [...set]));
  const common = [...union].filter((key) => sets.every((set) => set.has(key)));
  const differing = [...union].filter((key) => !sets.every((set) => set.has(key)));
  return {
    union_count: union.size,
    common_count: common.length,
    differing_count: differing.length,
    common_service_keys: common.sort(),
    differing_service_keys: differing.sort(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return reject('Autentificare necesara.', 401);

    const payload = await req.json().catch(() => ({}));
    const locationIds = unique(payload.location_ids);
    if (locationIds.length < 2) return reject('Selecteaza cel putin doua locatii.');
    if (locationIds.length > MAX_LOCATIONS) return reject(`Poti compara maximum ${MAX_LOCATIONS} locatii.`);

    const svc = base44.asServiceRole;
    if (user.role !== 'admin') {
      const memberships = await svc.entities.ProviderMembership.filter({
        user_id: user.id,
        status: 'active',
      }, '-created_date', 1000).catch(() => []);
      const permitted = new Set(
        memberships
          .filter((membership) => normalizeRole(membership.role))
          .map((membership) => membership.location_id)
          .filter(Boolean),
      );
      const inaccessible = locationIds.filter((locationId) => !permitted.has(locationId));
      if (inaccessible.length > 0) {
        return reject('Nu ai acces la toate locatiile selectate.', 403, { location_ids: inaccessible });
      }
    }

    const locations = [];
    for (const locationId of locationIds) {
      const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
      if (!location) return reject('Una dintre locatii nu a fost gasita.', 404, { location_id: locationId });
      locations.push(location);
    }

    const organizationId = clean(locations[0].organization_id);
    if (!organizationId || locations.some((location) => clean(location.organization_id) !== organizationId)) {
      return reject('Pot fi comparate numai locatii din aceeasi organizatie.', 403);
    }

    const comparisonLocations = await Promise.all(
      locations.map((location) => loadLocationComparison(svc, location)),
    );
    const serviceSummary = buildServiceSummary(comparisonLocations);

    return Response.json({
      success: true,
      read_only: true,
      permission_scope: 'active_memberships_only',
      generated_at: new Date().toISOString(),
      organization_id: organizationId,
      selected_location_count: comparisonLocations.length,
      service_summary: serviceSummary,
      locations: comparisonLocations,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata.' }, { status: 500 });
  }
});
