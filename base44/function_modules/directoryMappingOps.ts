import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  CANONICAL_LOCATION_TYPE_OPTIONS,
  DIRECTORY_IDENTITY_RELATIONSHIPS,
  DIRECTORY_LINK_CONFIDENCE,
  DIRECTORY_LINK_STATUSES,
  canonicalLocationTypeKey,
  extractUnitDiscriminator,
  isCanonicalLocationTypePair,
  mappingConfirmationToken,
  normalizeAddressBase,
  normalizeIdentityText,
  stableLocationPairKey,
  validateIdentityRelationship,
} from '../../shared/directoryMappingPolicy.js';

const MAX_PAGE_SIZE = 250;
const DEFAULT_PAGE_SIZE = 100;

function clean(value, maxLength = 1200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function numberInRange(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function response(body, status = 200) {
  return Response.json(body, { status });
}

function locationName(location) {
  return location?.public_display_name || location?.name || 'Locatie';
}

function organizationName(organization) {
  return organization?.public_display_name || organization?.name || 'Organizatie';
}

function localityName(location) {
  return location?.locality_name || location?.city || '';
}

function safeLocation(location) {
  return {
    id: location.id,
    organization_id: location.organization_id || null,
    name: locationName(location),
    provider_type: location.provider_type || '',
    provider_profile_type: location.provider_profile_type || '',
    locality_name: localityName(location),
    county_name: location.county_name || location.county || '',
    locality_siruta_code: location.locality_siruta_code || '',
    address: location.address || '',
    profile_control_status: location.profile_control_status || 'directory',
    publication_status: location.status || 'draft',
    migration_review_required: location.migration_review_required === true,
    source_name: location.source_name || '',
    source_url: location.source_url || '',
    source_checked_at: location.source_checked_at || null,
  };
}

function safeOrganization(organization, locationCount = 0) {
  return {
    id: organization.id,
    name: organizationName(organization),
    legal_name: organization.legal_name || '',
    organization_type_code: organization.organization_type_code || organization.organization_type || '',
    control_status: organization.control_status || 'directory',
    publication_status: organization.publication_status || 'draft',
    data_quality_status: organization.data_quality_status || 'low',
    location_count: locationCount,
  };
}

function textTokens(value) {
  return [...new Set(normalizeIdentityText(value).split(' ').filter((token) => token.length > 1))];
}

function tokenSimilarity(left, right) {
  const leftTokens = textTokens(left);
  const rightTokens = textTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const common = leftTokens.filter((token) => rightTokens.includes(token)).length;
  return common / Math.max(leftTokens.length, rightTokens.length);
}

function addressClusterKey(location) {
  const locality = normalizeIdentityText(localityName(location));
  const address = normalizeAddressBase(location.address);
  if (!locality || address.length < 4) return '';
  return `${locality}::${address}`;
}

function latestActiveByLocation(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.link_record_status !== 'active' || !row.location_id || map.has(row.location_id)) continue;
    map.set(row.location_id, row);
  }
  return map;
}

function activeIdentityByPair(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.record_status !== 'active' || !row.pair_key || map.has(row.pair_key)) continue;
    map.set(row.pair_key, row);
  }
  return map;
}

function buildDirectoryState(locations, organizations, links, identityLinks) {
  const organizationCounts = new Map();
  for (const location of locations) {
    if (!location.organization_id) continue;
    organizationCounts.set(location.organization_id, (organizationCounts.get(location.organization_id) || 0) + 1);
  }
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const activeLinkByLocation = latestActiveByLocation(links);
  const identityByPair = activeIdentityByPair(identityLinks);
  const clusters = new Map();
  for (const location of locations) {
    const key = addressClusterKey(location);
    if (!key) continue;
    const rows = clusters.get(key) || [];
    rows.push(location);
    clusters.set(key, rows);
  }

  const rows = locations.map((location) => {
    const activeLink = activeLinkByLocation.get(location.id) || null;
    const clusterKey = addressClusterKey(location);
    const cluster = clusterKey ? clusters.get(clusterKey) || [] : [];
    const identityRecords = cluster
      .filter((candidate) => candidate.id !== location.id)
      .map((candidate) => identityByPair.get(stableLocationPairKey(location.id, candidate.id)))
      .filter(Boolean);
    const linkStatus = activeLink?.link_status || (location.organization_id ? 'confirmed' : 'unassigned');
    const typeCanonical = isCanonicalLocationTypePair(location.provider_type, location.provider_profile_type);
    const flags = [];
    if (!location.organization_id || linkStatus === 'unassigned') flags.push('organization_unassigned');
    if (linkStatus === 'probable') flags.push('organization_probable');
    if (linkStatus === 'conflict') flags.push('organization_conflict');
    if (!typeCanonical) flags.push('type_needs_mapping');
    if (cluster.length > 1) flags.push('same_address_group');
    if (cluster.length > 1 && identityRecords.length < cluster.length - 1) flags.push('identity_needs_review');
    if (location.migration_review_required === true) flags.push('migration_review_required');

    return {
      ...safeLocation(location),
      organization: location.organization_id
        ? safeOrganization(organizationById.get(location.organization_id) || { id: location.organization_id, name: 'Organizatie indisponibila' }, organizationCounts.get(location.organization_id) || 0)
        : null,
      active_link: activeLink ? {
        id: activeLink.id,
        organization_id: activeLink.organization_id || null,
        link_status: activeLink.link_status,
        confidence: activeLink.confidence || 'medium',
        evidence_summary: activeLink.evidence_summary || '',
        review_note: activeLink.review_note || '',
        reviewed_at: activeLink.reviewed_at || null,
      } : null,
      canonical_type_key: canonicalLocationTypeKey(location.provider_type, location.provider_profile_type),
      type_is_canonical: typeCanonical,
      address_cluster_key: clusterKey,
      same_address_count: cluster.length,
      unit_discriminator: extractUnitDiscriminator(location.address),
      identity_record_count: identityRecords.length,
      flags,
    };
  });

  const summary = {
    total_locations: rows.length,
    total_organizations: organizations.length,
    organization_unassigned: rows.filter((row) => row.flags.includes('organization_unassigned')).length,
    organization_probable: rows.filter((row) => row.flags.includes('organization_probable')).length,
    organization_conflict: rows.filter((row) => row.flags.includes('organization_conflict')).length,
    type_needs_mapping: rows.filter((row) => row.flags.includes('type_needs_mapping')).length,
    same_address_group: rows.filter((row) => row.flags.includes('same_address_group')).length,
    identity_needs_review: rows.filter((row) => row.flags.includes('identity_needs_review')).length,
  };

  return {
    rows,
    summary,
    clusters,
    identityByPair,
    organizationCounts,
    organizationById,
    activeLinkByLocation,
  };
}

function filterRows(rows, input) {
  const queue = clean(input.queue, 80) || 'all';
  const query = normalizeIdentityText(input.query);
  return rows.filter((row) => {
    if (queue !== 'all' && !row.flags.includes(queue)) return false;
    if (!query) return true;
    const haystack = normalizeIdentityText([
      row.name,
      row.locality_name,
      row.county_name,
      row.address,
      row.organization?.name,
      row.provider_type,
      row.provider_profile_type,
    ].filter(Boolean).join(' '));
    return haystack.includes(query);
  });
}

async function writeAudit(svc, user, entityType, entityId, actionType, previousValues, newValues, note) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    changed_fields: Object.keys(newValues || {}),
    previous_values: JSON.stringify(previousValues || {}),
    new_values: JSON.stringify(newValues || {}),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: note || '',
    performed_at: new Date().toISOString(),
  });
}

async function loadAll(svc) {
  const [organizations, locations, links, identityLinks] = await Promise.all([
    svc.entities.ProviderOrganization.list('name', 1000).catch(() => []),
    svc.entities.ProviderLocation.list('name', 3000).catch(() => []),
    svc.entities.DirectoryOrganizationLocationLink.list('-reviewed_at', 5000).catch(() => []),
    svc.entities.DirectoryLocationIdentityLink.list('-reviewed_at', 5000).catch(() => []),
  ]);
  return { organizations, locations, links, identityLinks };
}

async function overview(svc, input) {
  const loaded = await loadAll(svc);
  const state = buildDirectoryState(loaded.locations, loaded.organizations, loaded.links, loaded.identityLinks);
  const filtered = filterRows(state.rows, input);
  const limit = numberInRange(input.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const skip = numberInRange(input.skip, 0, 0, Math.max(0, filtered.length));
  return response({
    contract_version: 'directory-mapping-v1',
    generated_at: new Date().toISOString(),
    summary: state.summary,
    queue: clean(input.queue, 80) || 'all',
    query: clean(input.query, 200),
    total_filtered: filtered.length,
    skip,
    limit,
    rows: filtered.slice(skip, skip + limit),
    organizations: loaded.organizations.map((organization) => safeOrganization(
      organization,
      state.organizationCounts.get(organization.id) || 0,
    )),
    canonical_type_options: CANONICAL_LOCATION_TYPE_OPTIONS,
    identity_relationships: DIRECTORY_IDENTITY_RELATIONSHIPS,
  });
}

async function locationContext(svc, input) {
  const locationId = clean(input.location_id, 160);
  if (!locationId) return response({ error: 'location_id este obligatoriu.' }, 400);
  const loaded = await loadAll(svc);
  const state = buildDirectoryState(loaded.locations, loaded.organizations, loaded.links, loaded.identityLinks);
  const current = state.rows.find((row) => row.id === locationId);
  if (!current) return response({ error: 'Locatia nu exista.' }, 404);

  const currentRaw = loaded.locations.find((location) => location.id === locationId);
  const cluster = current.address_cluster_key
    ? loaded.locations.filter((location) => addressClusterKey(location) === current.address_cluster_key && location.id !== locationId)
    : [];
  const similar = loaded.locations
    .filter((location) => location.id !== locationId)
    .map((location) => {
      const nameScore = tokenSimilarity(locationName(currentRaw), locationName(location));
      const addressScore = current.address_cluster_key && addressClusterKey(location) === current.address_cluster_key ? 1 : 0;
      const localityScore = normalizeIdentityText(localityName(currentRaw)) === normalizeIdentityText(localityName(location)) ? 1 : 0;
      const score = Math.round((nameScore * 60) + (addressScore * 30) + (localityScore * 10));
      return { location, score };
    })
    .filter((item) => item.score >= 35)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map((item) => ({
      ...safeLocation(item.location),
      similarity_score: item.score,
      pair_key: stableLocationPairKey(locationId, item.location.id),
      identity_record: state.identityByPair.get(stableLocationPairKey(locationId, item.location.id)) || null,
    }));

  return response({
    contract_version: 'directory-mapping-v1',
    location: current,
    same_address_candidates: cluster.map((location) => ({
      ...safeLocation(location),
      pair_key: stableLocationPairKey(locationId, location.id),
      unit_discriminator: extractUnitDiscriminator(location.address),
      identity_record: state.identityByPair.get(stableLocationPairKey(locationId, location.id)) || null,
    })),
    similar_candidates: similar,
  });
}

async function previewOrganizationLink(svc, input) {
  const locationId = clean(input.location_id, 160);
  const organizationId = clean(input.organization_id, 160);
  const linkStatus = clean(input.link_status, 80);
  const confidence = clean(input.confidence, 40) || 'medium';
  if (!locationId) return response({ error: 'Locatia este obligatorie.' }, 400);
  if (!DIRECTORY_LINK_STATUSES.includes(linkStatus)) return response({ error: 'Statusul relatiei nu este valid.' }, 400);
  if (!DIRECTORY_LINK_CONFIDENCE.includes(confidence)) return response({ error: 'Nivelul de incredere nu este valid.' }, 400);
  if (linkStatus !== 'unassigned' && !organizationId) return response({ error: 'Selecteaza organizatia evaluata.' }, 400);

  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return response({ error: 'Locatia nu exista.' }, 404);
  const organization = organizationId ? await svc.entities.ProviderOrganization.get(organizationId).catch(() => null) : null;
  if (organizationId && !organization) return response({ error: 'Organizatia nu exista.' }, 404);
  const currentLinks = await svc.entities.DirectoryOrganizationLocationLink.filter({
    location_id: locationId,
    link_record_status: 'active',
  }, '-reviewed_at', 100).catch(() => []);
  const currentLink = currentLinks[0] || null;
  const changesOrganization = linkStatus === 'confirmed'
    ? clean(location.organization_id) !== organizationId
    : linkStatus === 'unassigned'
      ? Boolean(location.organization_id)
      : false;
  const warnings = [];
  if (linkStatus === 'unassigned' && location.organization_id) warnings.push('Aplicarea va elimina asocierea organizationala curenta a locatiei.');
  if (['probable', 'conflict', 'rejected'].includes(linkStatus)) warnings.push('Statusul de analiza nu schimba automat organization_id al locatiei.');
  if (linkStatus === 'confirmed' && currentLink?.organization_id && currentLink.organization_id !== organizationId) warnings.push('Relatia activa existenta va fi inlocuita si pastrata ca superseded.');

  return response({
    preview: true,
    confirmation_token: mappingConfirmationToken(['organization-link', locationId, organizationId || 'unassigned', linkStatus, confidence]),
    location: safeLocation(location),
    organization: organization ? safeOrganization(organization) : null,
    before: {
      organization_id: location.organization_id || null,
      active_link: currentLink,
    },
    after: {
      organization_id: linkStatus === 'confirmed' ? organizationId : linkStatus === 'unassigned' ? null : location.organization_id || null,
      link_status: linkStatus,
      confidence,
    },
    changes_organization: changesOrganization,
    warnings,
  });
}

async function applyOrganizationLink(svc, user, input) {
  const note = clean(input.note, 1200);
  if (!note) return response({ error: 'Nota administrativa este obligatorie.' }, 400);
  const previewResult = await previewOrganizationLink(svc, input);
  const previewPayload = await previewResult.clone().json();
  if (!previewResult.ok) return previewResult;
  if (clean(input.confirmation_token, 500) !== previewPayload.confirmation_token) {
    return response({ error: 'Preview-ul nu mai este valid. Reincarca si confirma din nou.' }, 409);
  }
  if (previewPayload.after.link_status === 'unassigned' && previewPayload.before.organization_id && input.detach_confirmed !== true) {
    return response({ error: 'Confirma explicit eliminarea asocierii organizationale.' }, 400);
  }

  const locationId = previewPayload.location.id;
  const organizationId = previewPayload.organization?.id || null;
  const now = new Date().toISOString();
  const activeRows = await svc.entities.DirectoryOrganizationLocationLink.filter({
    location_id: locationId,
    link_record_status: 'active',
  }, '-reviewed_at', 100).catch(() => []);
  for (const row of activeRows) {
    await svc.entities.DirectoryOrganizationLocationLink.update(row.id, { link_record_status: 'superseded' });
  }
  const created = await svc.entities.DirectoryOrganizationLocationLink.create({
    organization_id: organizationId,
    location_id: locationId,
    source_row_key: previewPayload.location.id,
    source_version: 'admin-mapping-v1',
    link_status: previewPayload.after.link_status,
    confidence: previewPayload.after.confidence,
    evidence_summary: clean(input.evidence_summary, 1600),
    review_note: note,
    reviewed_by_user_id: user.id,
    reviewed_at: now,
    link_record_status: 'active',
  });

  if (previewPayload.after.link_status === 'confirmed') {
    await svc.entities.ProviderLocation.update(locationId, { organization_id: organizationId });
  } else if (previewPayload.after.link_status === 'unassigned') {
    await svc.entities.ProviderLocation.update(locationId, { organization_id: null });
  }

  await writeAudit(svc, user, 'ProviderLocation', locationId, 'apply_directory_organization_location_mapping', previewPayload.before, {
    organization_id: previewPayload.after.organization_id,
    link_id: created.id,
    link_status: previewPayload.after.link_status,
    confidence: previewPayload.after.confidence,
  }, note);

  return response({ success: true, location_id: locationId, link_id: created.id });
}

async function previewCanonicalType(svc, input) {
  const locationId = clean(input.location_id, 160);
  const providerType = clean(input.provider_type, 100);
  const providerProfileType = clean(input.provider_profile_type, 120);
  if (!locationId) return response({ error: 'Locatia este obligatorie.' }, 400);
  if (!isCanonicalLocationTypePair(providerType, providerProfileType)) {
    return response({ error: 'Combinatia de tipuri nu apartine contractului canonic.' }, 400);
  }
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return response({ error: 'Locatia nu exista.' }, 404);
  return response({
    preview: true,
    confirmation_token: mappingConfirmationToken(['canonical-type', locationId, providerType, providerProfileType]),
    location: safeLocation(location),
    before: {
      provider_type: location.provider_type || '',
      provider_profile_type: location.provider_profile_type || '',
    },
    after: { provider_type: providerType, provider_profile_type: providerProfileType },
    publication_unchanged: true,
    verification_unchanged: true,
  });
}

async function applyCanonicalType(svc, user, input) {
  const note = clean(input.note, 1200);
  if (!note) return response({ error: 'Nota administrativa este obligatorie.' }, 400);
  const previewResult = await previewCanonicalType(svc, input);
  const previewPayload = await previewResult.clone().json();
  if (!previewResult.ok) return previewResult;
  if (clean(input.confirmation_token, 500) !== previewPayload.confirmation_token) {
    return response({ error: 'Preview-ul nu mai este valid. Reincarca si confirma din nou.' }, 409);
  }
  await svc.entities.ProviderLocation.update(previewPayload.location.id, {
    provider_type: previewPayload.after.provider_type,
    provider_profile_type: previewPayload.after.provider_profile_type,
    profile_updated_at: new Date().toISOString(),
  });
  await writeAudit(svc, user, 'ProviderLocation', previewPayload.location.id, 'apply_directory_canonical_location_type', previewPayload.before, previewPayload.after, note);
  return response({ success: true, location_id: previewPayload.location.id, ...previewPayload.after });
}

async function previewIdentityRelation(svc, input) {
  const validated = validateIdentityRelationship(input);
  if (!validated.ok) return response({ error: validated.error }, 400);
  const confidence = clean(input.confidence, 40) || 'medium';
  if (!DIRECTORY_LINK_CONFIDENCE.includes(confidence)) return response({ error: 'Nivelul de incredere nu este valid.' }, 400);
  const [primary, related] = await Promise.all([
    svc.entities.ProviderLocation.get(validated.primary_location_id).catch(() => null),
    svc.entities.ProviderLocation.get(validated.related_location_id).catch(() => null),
  ]);
  if (!primary || !related) return response({ error: 'Una dintre locatii nu exista.' }, 404);
  const sameAddress = addressClusterKey(primary) && addressClusterKey(primary) === addressClusterKey(related);
  if (validated.relationship_type === 'same_address_distinct_unit' && !sameAddress) {
    return response({ error: 'Unitatile distincte trebuie sa apartina aceluiasi grup de adresa.' }, 400);
  }
  const activeRows = await svc.entities.DirectoryLocationIdentityLink.filter({
    pair_key: validated.pair_key,
    record_status: 'active',
  }, '-reviewed_at', 20).catch(() => []);
  const warnings = [];
  if (['duplicate_same_entity', 'rebrand_successor'].includes(validated.relationship_type)) {
    warnings.push('Decizia nu combina si nu ascunde automat profilurile. Marcheaza perechea pentru consolidare controlata.');
  }
  if (validated.relationship_type === 'same_address_distinct_unit' && !extractUnitDiscriminator(primary.address) && !extractUnitDiscriminator(related.address)) {
    warnings.push('Adresele nu contin un discriminator clar de unitate; nota trebuie sa explice diferenta functionala.');
  }
  return response({
    preview: true,
    confirmation_token: mappingConfirmationToken(['identity', validated.pair_key, validated.relationship_type, validated.canonical_location_id || 'none', confidence]),
    pair_key: validated.pair_key,
    primary_location: safeLocation(primary),
    related_location: safeLocation(related),
    relationship_type: validated.relationship_type,
    canonical_location_id: validated.canonical_location_id,
    confidence,
    same_address: Boolean(sameAddress),
    existing_record: activeRows[0] || null,
    warnings,
  });
}

async function applyIdentityRelation(svc, user, input) {
  const note = clean(input.note, 1200);
  if (!note) return response({ error: 'Nota administrativa este obligatorie.' }, 400);
  const previewResult = await previewIdentityRelation(svc, input);
  const previewPayload = await previewResult.clone().json();
  if (!previewResult.ok) return previewResult;
  if (clean(input.confirmation_token, 500) !== previewPayload.confirmation_token) {
    return response({ error: 'Preview-ul nu mai este valid. Reincarca si confirma din nou.' }, 409);
  }
  const now = new Date().toISOString();
  const activeRows = await svc.entities.DirectoryLocationIdentityLink.filter({
    pair_key: previewPayload.pair_key,
    record_status: 'active',
  }, '-reviewed_at', 20).catch(() => []);
  for (const row of activeRows) {
    await svc.entities.DirectoryLocationIdentityLink.update(row.id, { record_status: 'superseded' });
  }
  const created = await svc.entities.DirectoryLocationIdentityLink.create({
    pair_key: previewPayload.pair_key,
    primary_location_id: previewPayload.primary_location.id,
    related_location_id: previewPayload.related_location.id,
    canonical_location_id: previewPayload.canonical_location_id,
    relationship_type: previewPayload.relationship_type,
    confidence: previewPayload.confidence,
    evidence_summary: clean(input.evidence_summary, 1600),
    review_note: note,
    reviewed_by_user_id: user.id,
    reviewed_at: now,
    record_status: 'active',
  });

  if (['duplicate_same_entity', 'rebrand_successor'].includes(previewPayload.relationship_type)) {
    await Promise.all([
      svc.entities.ProviderLocation.update(previewPayload.primary_location.id, { migration_review_required: true }),
      svc.entities.ProviderLocation.update(previewPayload.related_location.id, { migration_review_required: true }),
    ]);
  }

  await writeAudit(svc, user, 'DirectoryLocationIdentityLink', created.id, 'record_directory_location_identity_relationship', previewPayload.existing_record || {}, {
    pair_key: previewPayload.pair_key,
    relationship_type: previewPayload.relationship_type,
    canonical_location_id: previewPayload.canonical_location_id,
    confidence: previewPayload.confidence,
  }, note);
  return response({ success: true, identity_link_id: created.id, pair_key: previewPayload.pair_key });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return response({ error: 'Autentificare necesara.' }, 401);
    if (user.role !== 'admin') return response({ error: 'Acces interzis.' }, 403);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action, 80);

    if (action === 'overview') return overview(svc, input);
    if (action === 'location_context') return locationContext(svc, input);
    if (action === 'preview_organization_link') return previewOrganizationLink(svc, input);
    if (action === 'apply_organization_link') return applyOrganizationLink(svc, user, input);
    if (action === 'preview_canonical_type') return previewCanonicalType(svc, input);
    if (action === 'apply_canonical_type') return applyCanonicalType(svc, user, input);
    if (action === 'preview_identity_relation') return previewIdentityRelation(svc, input);
    if (action === 'apply_identity_relation') return applyIdentityRelation(svc, user, input);
    return response({ error: 'Actiune necunoscuta.' }, 400);
  } catch (error) {
    return response({ error: error?.message || 'Operatia de mapare nu a putut fi finalizata.' }, 500);
  }
}
