import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  DIRECTORY_IMPORT_CONTRACT_VERSION,
  DIRECTORY_IMPORT_MAX_CHUNK_SIZE,
  batchApprovalToken,
  normalizeDirectoryImportRow,
  normalizeIdentityText,
  rollbackApprovalToken,
  rowIdempotencyKey,
  stableTextHash,
  validateNormalizedDirectoryRow,
} from '../../shared/directoryImportPipeline.js';
import {
  isDirectoryOrganizationTypeCode,
  resolveProviderOrganizationType,
} from '../../shared/directoryOrganizationTypeMapping.js';
import {
  planDirectoryOrganizationReconciliation,
  resolveDirectoryOrganizationCanonicalPayload,
} from '../../shared/directoryOrganizationReconciliation.js';
import {
  resolveDirectoryLocationMatch,
  resolveDirectoryOrganizationMatch,
} from '../../shared/directoryIdentityMatchPolicy.js';
import {
  directoryFieldsEqual,
  planDirectoryLocationReconciliation,
  resolveDirectoryEvidencePayload,
  resolveDirectoryLinkPayload,
  resolveDirectoryLocationUpdatePayload,
  resolveDirectoryStateCreatePayload,
  resolveDirectoryStateUpdatePayload,
} from '../../shared/directoryLocationReconciliation.js';

const MAX_ROWS = 5000;
const EXECUTION_CHUNK = 20;
const FINALIZATION_CHUNK = 50;
const PLANNING_CHUNK = 50;
const LOCK_MINUTES = 5;
const CONTROLLED_PROFILES = new Set(['claimed', 'verified', 'suspended']);

function clean(value, maxLength = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  try { return value ? JSON.parse(value) : fallback; } catch (_error) { return fallback; }
}

function boundedChunkSize(value, maximum, fallback = maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function snapshotDuplicateKey(row) {
  const externalKey = clean(row?.location_external_key, 220);
  if (externalKey) return `external:${externalKey}`;
  const addressFingerprint = clean(row?.address_fingerprint, 220);
  const locationName = normalizeIdentityText(row?.location_name);
  if (!addressFingerprint || !locationName) return '';
  return `identity:${addressFingerprint}|${locationName}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function response(body, status = 200) {
  return Response.json(body, { status });
}

function now() {
  return new Date().toISOString();
}

function lockExpiry() {
  return new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
}

function randomToken(prefix = 'lock') {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
}

function normalizeDate(value) {
  const text = clean(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sourceSnapshotKey(sourceVersion, sha256) {
  return `snapshot:${stableTextHash(`${sourceVersion}|${sha256}`)}`;
}

function batchKeyFor(snapshot, sequence) {
  return `DIR-${clean(snapshot.source_version, 60).replace(/[^a-zA-Z0-9_-]+/g, '-')}-${String(sequence).padStart(3, '0')}`;
}

function pickFields(source, keys) {
  return Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));
}

function equalFieldSubset(current, expected) {
  return Object.entries(expected || {}).every(([key, value]) => stableStringify(current?.[key] ?? null) === stableStringify(value ?? null));
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: response({ error: 'Autentificare necesara.' }, 401) };
  if (user.role !== 'admin') return { error: response({ error: 'Acces administrativ necesar.' }, 403) };
  return { user, svc: base44.asServiceRole };
}

async function writeAudit(svc, user, entityType, entityId, actionType, previousValues, nextValues, note = '') {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    changed_fields: Object.keys(nextValues || {}),
    previous_values: JSON.stringify(previousValues || {}),
    new_values: JSON.stringify(nextValues || {}),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note,
    performed_at: now(),
  });
}

async function createMutation(svc, input) {
  const existing = await svc.entities.DirectoryImportMutation.filter({ mutation_key: input.mutation_key }, '-created_date', 2).catch(() => []);
  if (existing[0]) return existing[0];
  return svc.entities.DirectoryImportMutation.create(input);
}

async function getEntity(svc, entityType, entityId) {
  if (entityType === 'ProviderOrganization') return svc.entities.ProviderOrganization.get(entityId).catch(() => null);
  if (entityType === 'ProviderLocation') return svc.entities.ProviderLocation.get(entityId).catch(() => null);
  if (entityType === 'ProviderLocationDirectoryState') return svc.entities.ProviderLocationDirectoryState.get(entityId).catch(() => null);
  if (entityType === 'DirectoryOrganizationLocationLink') return svc.entities.DirectoryOrganizationLocationLink.get(entityId).catch(() => null);
  if (entityType === 'ProviderEvidence') return svc.entities.ProviderEvidence.get(entityId).catch(() => null);
  return null;
}

async function updateEntity(svc, entityType, entityId, values) {
  if (entityType === 'ProviderOrganization') return svc.entities.ProviderOrganization.update(entityId, values);
  if (entityType === 'ProviderLocation') return svc.entities.ProviderLocation.update(entityId, values);
  if (entityType === 'ProviderLocationDirectoryState') return svc.entities.ProviderLocationDirectoryState.update(entityId, values);
  if (entityType === 'DirectoryOrganizationLocationLink') return svc.entities.DirectoryOrganizationLocationLink.update(entityId, values);
  if (entityType === 'ProviderEvidence') return svc.entities.ProviderEvidence.update(entityId, values);
  throw new Error(`Entitate nerecunoscuta: ${entityType}`);
}

async function deleteEntity(svc, entityType, entityId) {
  if (entityType === 'ProviderOrganization') return svc.entities.ProviderOrganization.delete(entityId);
  if (entityType === 'ProviderLocation') return svc.entities.ProviderLocation.delete(entityId);
  if (entityType === 'ProviderLocationDirectoryState') return svc.entities.ProviderLocationDirectoryState.delete(entityId);
  if (entityType === 'DirectoryOrganizationLocationLink') return svc.entities.DirectoryOrganizationLocationLink.delete(entityId);
  if (entityType === 'ProviderEvidence') return svc.entities.ProviderEvidence.delete(entityId);
  throw new Error(`Entitate nerecunoscuta: ${entityType}`);
}

async function listSnapshots(svc, input) {
  const limit = Math.max(1, Math.min(200, Number(input.limit || 50)));
  const snapshots = await svc.entities.DirectorySourceSnapshot.list('-created_date', limit).catch(() => []);
  const batches = await svc.entities.DirectoryImportBatch.list('-created_date', 500).catch(() => []);
  const latestBatchBySnapshot = new Map();
  for (const batch of batches) {
    if (!batch.snapshot_id || latestBatchBySnapshot.has(batch.snapshot_id)) continue;
    latestBatchBySnapshot.set(batch.snapshot_id, batch);
  }
  return snapshots.map((snapshot) => ({
    ...snapshot,
    latest_batch: latestBatchBySnapshot.get(snapshot.id) || null,
  }));
}

async function createSnapshot(svc, user, input) {
  const sourceVersion = clean(input.source_version, 160);
  const sourceSha256 = clean(input.source_sha256, 80).toLowerCase();
  const sourceName = clean(input.source_name, 200);
  const sourceFormat = clean(input.source_format, 30);
  if (!sourceVersion || !sourceName || !/^[a-f0-9]{64}$/.test(sourceSha256)) {
    return response({ error: 'Versiunea, numele sursei si SHA-256 valid sunt obligatorii.' }, 400);
  }
  if (!['json', 'ndjson', 'csv', 'markdown'].includes(sourceFormat)) {
    return response({ error: 'Formatul sursei nu este acceptat.' }, 400);
  }
  const existing = await svc.entities.DirectorySourceSnapshot.filter({ source_sha256: sourceSha256 }, '-created_date', 10).catch(() => []);
  const same = existing.find((item) => item.source_version === sourceVersion && item.status !== 'archived');
  if (same) return response({ success: true, reused: true, snapshot: same });

  const snapshot = await svc.entities.DirectorySourceSnapshot.create({
    snapshot_key: sourceSnapshotKey(sourceVersion, sourceSha256),
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    source_name: sourceName,
    source_version: sourceVersion,
    source_sha256: sourceSha256,
    source_format: sourceFormat,
    original_filename: clean(input.original_filename, 240),
    column_map_json: JSON.stringify(input.column_map || {}),
    status: 'uploading',
    total_rows: Number(input.total_rows || 0),
    uploaded_rows: 0,
    valid_rows: 0,
    blocked_rows: 0,
    duplicate_rows: 0,
    warning_rows: 0,
    summary_json: '{}',
    created_by_user_id: user.id,
    created_by_email: user.email || '',
    created_at_source: normalizeDate(input.created_at_source),
    notes: clean(input.notes, 2000),
  });
  await writeAudit(svc, user, 'DirectorySourceSnapshot', snapshot.id, 'directory_snapshot_created', {}, {
    source_version: sourceVersion,
    source_sha256: sourceSha256,
    source_format: sourceFormat,
  });
  return response({ success: true, reused: false, snapshot });
}

async function appendRows(svc, user, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: 'Snapshotul nu a fost gasit.' }, 404);
  if (!['draft', 'uploading'].includes(snapshot.status) || snapshot.immutable_at) {
    return response({ error: 'Snapshotul este blocat si nu mai accepta randuri.' }, 409);
  }
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (!rows.length || rows.length > DIRECTORY_IMPORT_MAX_CHUNK_SIZE) {
    return response({ error: `Trimite intre 1 si ${DIRECTORY_IMPORT_MAX_CHUNK_SIZE} randuri per lot.` }, 400);
  }

  let created = 0;
  let reused = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const sourceRow = rows[index] && typeof rows[index] === 'object' ? rows[index] : {};
    const rowNumber = Number(sourceRow.__row_number || input.start_row_number || 0) + (sourceRow.__row_number ? 0 : index);
    const sourceRowKey = clean(sourceRow.__source_row_key || `${snapshot.snapshot_key}:${rowNumber}`, 220);
    const raw = Object.fromEntries(Object.entries(sourceRow).filter(([key]) => !key.startsWith('__')));
    const rawPayload = stableStringify(raw);
    const rowHash = stableTextHash(rawPayload);
    const idempotencyKey = rowIdempotencyKey(snapshot.snapshot_key, sourceRowKey, rowHash);
    const existing = await svc.entities.DirectoryImportRow.filter({ snapshot_id: snapshot.id, idempotency_key: idempotencyKey }, '-created_date', 2).catch(() => []);
    if (existing[0]) {
      reused += 1;
      continue;
    }
    await svc.entities.DirectoryImportRow.create({
      snapshot_id: snapshot.id,
      row_number: rowNumber,
      source_row_key: sourceRowKey,
      row_hash: rowHash,
      idempotency_key: idempotencyKey,
      raw_payload_json: rawPayload,
      normalized_payload_json: '{}',
      planned_actions_json: '[]',
      status: 'raw',
      validation_codes: [],
      validation_errors_json: '[]',
      validation_warnings_json: '[]',
      match_confidence: 'none',
      candidate_matches_json: '[]',
      rollback_status: 'not_required',
    });
    created += 1;
  }

  const uploadedRows = Number(snapshot.uploaded_rows || 0) + created;
  await svc.entities.DirectorySourceSnapshot.update(snapshot.id, {
    status: 'uploading',
    uploaded_rows: uploadedRows,
    total_rows: Math.max(Number(snapshot.total_rows || 0), uploadedRows),
  });
  await writeAudit(svc, user, 'DirectorySourceSnapshot', snapshot.id, 'directory_snapshot_rows_appended', {
    uploaded_rows: snapshot.uploaded_rows || 0,
  }, { uploaded_rows: uploadedRows, created, reused });
  return response({ success: true, created, reused, uploaded_rows: uploadedRows });
}

async function finalizeSnapshot(svc, user, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: 'Snapshotul nu a fost gasit.' }, 404);
  if (snapshot.immutable_at) {
    return response({
      success: true,
      reused: true,
      remaining: false,
      processed: 0,
      snapshot,
    });
  }
  if (!['draft', 'uploading', 'validating'].includes(snapshot.status)) {
    return response({ error: 'Snapshotul nu poate fi finalizat din starea curenta.' }, 409);
  }

  if (snapshot.status !== 'validating') {
    await svc.entities.DirectorySourceSnapshot.update(snapshot.id, { status: 'validating' });
  }
  const rows = await svc.entities.DirectoryImportRow.filter({ snapshot_id: snapshot.id }, 'row_number', MAX_ROWS).catch(() => []);
  const seenKeys = new Map();
  let validRows = 0;
  let blockedRows = 0;
  let duplicateRows = 0;
  let warningRows = 0;
  const codeCounts = {};
  const rawRows = [];

  for (const row of rows) {
    if (row.status === 'raw') {
      rawRows.push(row);
      continue;
    }
    const validationCodes = Array.isArray(row.validation_codes) ? row.validation_codes : [];
    const normalized = safeJson(row.normalized_payload_json, {});
    for (const code of validationCodes) codeCounts[code] = (codeCounts[code] || 0) + 1;
    if (asArray(safeJson(row.validation_warnings_json, [])).length) warningRows += 1;
    if (row.status === 'valid') validRows += 1;
    else blockedRows += 1;
    if (validationCodes.includes('duplicate_within_snapshot')) duplicateRows += 1;
    const duplicateKey = snapshotDuplicateKey({
      ...normalized,
      location_external_key: row.location_external_key || normalized.location_external_key,
      address_fingerprint: row.address_fingerprint || normalized.address_fingerprint,
    });
    if (duplicateKey) seenKeys.set(duplicateKey, row.id);
  }

  const requestedLimit = boundedChunkSize(
    input.limit,
    FINALIZATION_CHUNK,
  );
  const processingRows = rawRows.slice(0, requestedLimit);
  for (const row of processingRows) {
    const raw = safeJson(row.raw_payload_json, {});
    const normalized = normalizeDirectoryImportRow(raw, {
      source_version: snapshot.source_version,
      source_row_key: row.source_row_key,
      row_number: row.row_number,
    });
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: input.require_siruta !== false });
    const duplicateKey = snapshotDuplicateKey(normalized);
    if (duplicateKey && seenKeys.has(duplicateKey)) {
      validation.errors.push('duplicate_within_snapshot');
      validation.validation_codes.push('duplicate_within_snapshot');
      validation.valid = false;
      validation.blocked = true;
      duplicateRows += 1;
    } else if (duplicateKey) {
      seenKeys.set(duplicateKey, row.id);
    }
    for (const code of validation.validation_codes) codeCounts[code] = (codeCounts[code] || 0) + 1;
    if (validation.warnings.length) warningRows += 1;
    if (validation.valid) validRows += 1;
    else blockedRows += 1;
    await svc.entities.DirectoryImportRow.update(row.id, {
      organization_external_key: normalized.organization_external_key || '',
      location_external_key: normalized.location_external_key || '',
      address_fingerprint: normalized.address_fingerprint || '',
      normalized_payload_json: JSON.stringify(normalized),
      status: validation.valid ? 'valid' : 'blocked',
      validation_codes: validation.validation_codes,
      validation_errors_json: JSON.stringify(validation.errors),
      validation_warnings_json: JSON.stringify(validation.warnings),
      planned_action: validation.valid ? undefined : (normalized.pseudo_row_reason || validation.errors.includes('source_row_not_eligible') ? 'reject_invalid' : 'block_conflict'),
      error_message: validation.valid ? '' : validation.errors.join(', '),
    });
  }

  const remainingRows = rawRows.length - processingRows.length;
  const summary = {
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    code_counts: codeCounts,
    require_siruta: input.require_siruta !== false,
    finalization_chunk_size: requestedLimit,
    finalization_processed_rows: rows.length - remainingRows,
    finalization_remaining_rows: remainingRows,
  };
  const progressUpdates = {
    status: remainingRows > 0 ? 'validating' : (validRows > 0 ? 'ready' : 'blocked'),
    total_rows: rows.length,
    uploaded_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    duplicate_rows: duplicateRows,
    warning_rows: warningRows,
    summary_json: JSON.stringify(summary),
  };
  if (remainingRows > 0) {
    await svc.entities.DirectorySourceSnapshot.update(snapshot.id, progressUpdates);
    return response({
      success: true,
      remaining: true,
      processed: processingRows.length,
      remaining_rows: remainingRows,
      snapshot: { ...snapshot, ...progressUpdates },
    });
  }

  const finalizedAt = now();
  const finalUpdates = {
    ...progressUpdates,
    finalized_at: finalizedAt,
    immutable_at: finalizedAt,
  };
  await svc.entities.DirectorySourceSnapshot.update(snapshot.id, finalUpdates);
  await writeAudit(svc, user, 'DirectorySourceSnapshot', snapshot.id, 'directory_snapshot_finalized', {}, {
    status: finalUpdates.status,
    total_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    duplicate_rows: duplicateRows,
  });
  return response({
    success: true,
    remaining: false,
    processed: processingRows.length,
    remaining_rows: 0,
    snapshot: { ...snapshot, ...finalUpdates },
  });
}

function locationCreatePayload(row, organizationId = null) {
  const canonical = resolveDirectoryLocationUpdatePayload(row);
  return {
    organization_id: organizationId || null,
    ...canonical,
    request_intake_status: 'inactive',
    public_visibility_status: 'draft',
    status: 'draft',
    profile_control_status: 'directory',
    claim_verification_status: 'none',
    verification_state: 'unclaimed',
    is_verified: false,
    last_confirmed_at: canonical.last_confirmed_at || now(),
  };
}

async function loadPlanningContext(svc) {
  const [organizations, locations, states, links, evidenceRows] = await Promise.all([
    svc.entities.ProviderOrganization.list('name', MAX_ROWS).catch(() => []),
    svc.entities.ProviderLocation.list('name', MAX_ROWS).catch(() => []),
    svc.entities.ProviderLocationDirectoryState.filter({ state_status: 'active' }, '-created_date', MAX_ROWS).catch(() => []),
    svc.entities.DirectoryOrganizationLocationLink.filter({ link_record_status: 'active' }, '-created_date', MAX_ROWS).catch(() => []),
    svc.entities.ProviderEvidence.filter({
      field_name: 'directory_import_snapshot',
      evidence_status: 'active',
    }, '-created_date', MAX_ROWS).catch(() => []),
  ]);
  const organizationsByExternalKey = new Map();
  const organizationsByName = new Map();
  const append = (map, key, value) => {
    if (!key) return;
    const rows = map.get(key) || [];
    rows.push(value);
    map.set(key, rows);
  };
  for (const organization of organizations) {
    append(
      organizationsByExternalKey,
      organization.directory_external_key,
      organization,
    );
    const normalizedName = normalizeIdentityText(organization.public_display_name || organization.name);
    append(organizationsByName, normalizedName, organization);
  }
  const statesByExternalKey = new Map();
  const statesByAddress = new Map();
  const statesByLocationId = new Map();
  for (const state of states) {
    append(statesByExternalKey, state.directory_external_key, state);
    append(statesByAddress, state.address_fingerprint, state);
    append(statesByLocationId, state.location_id, state);
  }
  const linksByLocationId = new Map();
  for (const link of links) append(linksByLocationId, link.location_id, link);
  const evidenceByLocationId = new Map();
  for (const evidence of evidenceRows) {
    append(evidenceByLocationId, evidence.entity_id, evidence);
  }
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const locationsByFallback = new Map();
  for (const location of locations) {
    const key = [normalizeIdentityText(location.locality_name || location.city), normalizeIdentityText(location.address), normalizeIdentityText(location.public_display_name || location.name)].join('|');
    if (key.replace(/\|/g, '')) append(locationsByFallback, key, location);
  }
  return {
    organizationsByExternalKey,
    organizationsByName,
    statesByExternalKey,
    statesByAddress,
    statesByLocationId,
    linksByLocationId,
    evidenceByLocationId,
    locationsById,
    locationsByFallback,
  };
}

function applyAdminOverride(normalized, row) {
  const override = safeJson(row.admin_override_json, {});
  const merged = {
    ...normalized,
    ...override,
    source_row_key: normalized.source_row_key,
    row_number: normalized.row_number,
    contract_version: normalized.contract_version,
  };
  if (Object.prototype.hasOwnProperty.call(override, 'organization_type_code')) {
    const organizationTypeCode = clean(override.organization_type_code, 120);
    merged.organization_type_code = organizationTypeCode;
    merged.organization_type_source = 'admin_override';
    merged.organization_type_invalid = Boolean(organizationTypeCode)
      && !isDirectoryOrganizationTypeCode(organizationTypeCode);
    merged.organization_type_legacy_fallback = false;
  }
  return merged;
}

async function planBatch(svc, user, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: 'Snapshotul nu a fost gasit.' }, 404);
  if (!['ready', 'blocked'].includes(snapshot.status) || !snapshot.immutable_at) {
    return response({ error: 'Finalizeaza snapshotul inainte de dry-run.' }, 409);
  }
  const existingBatches = await svc.entities.DirectoryImportBatch.filter({ snapshot_id: snapshot.id }, '-created_date', 100).catch(() => []);
  const active = existingBatches.find((batch) => !['completed', 'completed_with_errors', 'failed', 'rolled_back', 'rollback_failed'].includes(batch.status));
  if (active && active.status !== 'planning') {
    return response({ success: true, reused: true, remaining: false, batch: active });
  }

  const batchKey = active?.batch_key
    || batchKeyFor(snapshot, existingBatches.length + 1);
  const batch = active || await svc.entities.DirectoryImportBatch.create({
    batch_key: batchKey,
    snapshot_id: snapshot.id,
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    source_version: snapshot.source_version,
    source_sha256: snapshot.source_sha256,
    idempotency_key: `batch:${stableTextHash(`${snapshot.id}|${snapshot.source_sha256}|${existingBatches.length + 1}`)}`,
    mode: 'dry_run',
    status: 'planning',
    execution_cursor: 0,
    rollback_cursor: 0,
    total_rows: 0,
    valid_rows: 0,
    blocked_rows: 0,
    ready_rows: 0,
    applied_rows: 0,
    failed_rows: 0,
    skipped_rows: 0,
    created_organizations: 0,
    created_locations: 0,
    updated_locations: 0,
    created_links: 0,
    summary_json: '{}',
    created_by_user_id: user.id,
  });

  const rows = await svc.entities.DirectoryImportRow.filter({ snapshot_id: snapshot.id }, 'row_number', MAX_ROWS).catch(() => []);
  const context = await loadPlanningContext(svc);
  const actionNames = [
    'create_organization_and_location',
    'create_location_use_existing_organization',
    'create_location_without_organization',
    'update_existing_location',
    'link_existing_location',
    'skip_unchanged',
    'skip_duplicate',
    'block_conflict',
    'reject_invalid',
  ];
  const counts = Object.fromEntries(actionNames.map((key) => [key, 0]));
  let readyRows = 0;
  let blockedRows = 0;
  let validRows = 0;
  const organizationsPlannedForUpdate = new Set();
  const alreadyPlannedRows = rows.filter((row) => row.batch_id === batch.id);
  for (const row of alreadyPlannedRows) {
    const action = clean(row.planned_action, 80);
    if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action] += 1;
    if (row.status === 'ready') readyRows += 1;
    else blockedRows += 1;
    const normalized = applyAdminOverride(safeJson(row.normalized_payload_json, {}), row);
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: true });
    const organizationTypeResolution = normalized.organization_name
      ? resolveProviderOrganizationType(normalized)
      : null;
    if (
      validation.valid
      && normalized.provider_type
      && normalized.provider_profile_type
      && normalized.location_type_code
      && normalized.care_setting_code
      && (!organizationTypeResolution || organizationTypeResolution.valid)
    ) {
      validRows += 1;
    }
    const plannedActions = asArray(safeJson(row.planned_actions_json, []));
    if (
      plannedActions.includes('update_directory_organization')
      && row.target_organization_id
    ) {
      organizationsPlannedForUpdate.add(row.target_organization_id);
    }
  }
  const requestedLimit = boundedChunkSize(input.limit, PLANNING_CHUNK);
  const unplannedRows = rows.filter((row) => row.batch_id !== batch.id);
  const planningRows = unplannedRows.slice(0, requestedLimit);

  for (const row of planningRows) {
    const normalized = applyAdminOverride(safeJson(row.normalized_payload_json, {}), row);
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: true });
    const organizationTypeResolution = normalized.organization_name
      ? resolveProviderOrganizationType(normalized)
      : null;
    let plannedAction = 'block_conflict';
    let targetOrganization = null;
    let targetLocation = null;
    let matchStrategy = 'none';
    let matchConfidence = 'none';
    const candidates = [];
    const supplementalActions = [];
    let organizationReconciliation = null;
    let locationReconciliation = null;
    let organizationMatchError = '';
    let locationMatchError = '';

    if (!validation.valid) {
      plannedAction = normalized.pseudo_row_reason || validation.errors.includes('source_row_not_eligible') ? 'reject_invalid' : 'block_conflict';
    } else if (!normalized.provider_type || !normalized.provider_profile_type || !normalized.location_type_code || !normalized.care_setting_code) {
      plannedAction = 'block_conflict';
      validation.errors.push('canonical_type_not_resolved');
      validation.validation_codes.push('canonical_type_not_resolved');
    } else if (organizationTypeResolution && !organizationTypeResolution.valid) {
      plannedAction = 'block_conflict';
      validation.errors.push(organizationTypeResolution.error_code);
      validation.validation_codes.push(organizationTypeResolution.error_code);
    } else {
      validRows += 1;
      const organizationMatch = resolveDirectoryOrganizationMatch({
        externalCandidates: normalized.organization_external_key
          ? context.organizationsByExternalKey.get(normalized.organization_external_key) || []
          : [],
        nameCandidates: normalized.organization_name
          ? context.organizationsByName.get(normalizeIdentityText(normalized.organization_name)) || []
          : [],
      });
      targetOrganization = organizationMatch.target;
      organizationMatchError = organizationMatch.error_code;
      for (const id of organizationMatch.candidate_ids) {
        candidates.push({
          entity_type: 'ProviderOrganization',
          id,
          strategy: organizationMatch.strategy,
          confidence: organizationMatch.confidence,
        });
      }
      if (organizationMatchError) {
        validation.errors.push(organizationMatchError);
        validation.validation_codes.push(organizationMatchError);
      }
      if (targetOrganization) {
        organizationReconciliation = planDirectoryOrganizationReconciliation(targetOrganization, normalized);
        if (!organizationReconciliation.valid) {
          validation.errors.push(organizationReconciliation.error_code);
          validation.validation_codes.push(organizationReconciliation.error_code);
        }
      }

      const fallbackKey = [
        normalizeIdentityText(normalized.locality_name),
        normalizeIdentityText(normalized.address),
        normalizeIdentityText(normalized.location_name),
      ].join('|');
      const locationMatch = resolveDirectoryLocationMatch({
        externalStates:
          context.statesByExternalKey.get(normalized.location_external_key) || [],
        exactFallbackCandidates: context.locationsByFallback.get(fallbackKey) || [],
        addressStates: context.statesByAddress.get(normalized.address_fingerprint) || [],
        locationsById: context.locationsById,
      });
      targetLocation = locationMatch.target;
      matchStrategy = locationMatch.strategy;
      matchConfidence = locationMatch.confidence;
      locationMatchError = locationMatch.error_code;
      for (const id of locationMatch.candidate_ids) {
        candidates.push({
          entity_type: 'ProviderLocation',
          id,
          strategy: locationMatch.strategy,
          confidence: locationMatch.confidence,
        });
      }
      if (locationMatchError) {
        validation.errors.push(locationMatchError);
        validation.validation_codes.push(locationMatchError);
      }

      if (
        organizationMatchError
        || locationMatchError
        || (organizationReconciliation && !organizationReconciliation.valid)
      ) {
        plannedAction = 'block_conflict';
      } else if (targetLocation && CONTROLLED_PROFILES.has(targetLocation.profile_control_status || 'directory')) {
        plannedAction = 'block_conflict';
        validation.errors.push('controlled_profile_requires_manual_update');
        validation.validation_codes.push('controlled_profile_requires_manual_update');
      } else if (targetLocation) {
        locationReconciliation = planDirectoryLocationReconciliation({
          location: targetLocation,
          directoryStates: context.statesByLocationId.get(targetLocation.id) || [],
          organizationLinks: context.linksByLocationId.get(targetLocation.id) || [],
          evidenceRows: context.evidenceByLocationId.get(targetLocation.id) || [],
          row: normalized,
          organizationId: targetOrganization?.id || '',
        });
        if (
          !locationReconciliation.requires_update
          && (!targetOrganization || targetLocation.organization_id === targetOrganization.id)
        ) plannedAction = 'skip_unchanged';
        else if (targetOrganization && targetLocation.organization_id !== targetOrganization.id) plannedAction = 'link_existing_location';
        else plannedAction = 'update_existing_location';
      } else if (targetOrganization) {
        plannedAction = 'create_location_use_existing_organization';
      } else if (normalized.organization_name) {
        plannedAction = 'create_organization_and_location';
      } else {
        plannedAction = 'create_location_without_organization';
      }
    }

    const rowReady = !['block_conflict', 'reject_invalid'].includes(plannedAction);
    if (rowReady && organizationReconciliation?.requires_update) {
      supplementalActions.push('update_directory_organization');
      organizationsPlannedForUpdate.add(targetOrganization.id);
    }
    if (rowReady && locationReconciliation?.components) {
      for (const [component, requiresUpdate] of Object.entries(
        locationReconciliation.components,
      )) {
        if (requiresUpdate) supplementalActions.push(`reconcile_${component}`);
      }
    }
    if (rowReady) readyRows += 1;
    else blockedRows += 1;
    counts[plannedAction] += 1;
    await svc.entities.DirectoryImportRow.update(row.id, {
      batch_id: batch.id,
      normalized_payload_json: JSON.stringify(normalized),
      planned_action: plannedAction,
      planned_actions_json: JSON.stringify([...supplementalActions, plannedAction]),
      status: rowReady ? 'ready' : 'blocked',
      validation_codes: [...new Set(validation.validation_codes)],
      validation_errors_json: JSON.stringify(validation.errors),
      validation_warnings_json: JSON.stringify(validation.warnings),
      match_strategy: matchStrategy,
      match_confidence: matchConfidence,
      candidate_matches_json: JSON.stringify(candidates),
      target_organization_id: targetOrganization?.id || '',
      target_location_id: targetLocation?.id || '',
      error_message: rowReady ? '' : validation.errors.join(', '),
    });
  }

  const remainingRows = unplannedRows.length - planningRows.length;
  const planningState = {
    chunk_size: requestedLimit,
    processed_rows: rows.length - remainingRows,
    remaining_rows: remainingRows,
    organization_update_ids: [...organizationsPlannedForUpdate].sort(),
  };
  const summary = {
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    action_counts: counts,
    supplemental_action_counts: {
      update_directory_organization: organizationsPlannedForUpdate.size,
    },
    planning_state: planningState,
    approval_token: remainingRows > 0
      ? ''
      : batchApprovalToken(batchKey, snapshot.source_sha256, readyRows),
    safety: {
      publishes_profiles: false,
      verifies_profiles: false,
      creates_services: false,
      grants_access: false,
      updates_controlled_profiles: false,
      updates_controlled_organizations: false,
      updates_directory_organizations: organizationsPlannedForUpdate.size > 0,
    },
  };
  const updates = {
    status: remainingRows > 0 ? 'planning' : (readyRows > 0 ? 'ready' : 'failed'),
    total_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    ready_rows: readyRows,
    summary_json: JSON.stringify(summary),
    failure_message:
      remainingRows > 0 || readyRows > 0
        ? ''
        : 'Nu exista randuri pregatite pentru import.',
  };
  await svc.entities.DirectoryImportBatch.update(batch.id, updates);
  if (remainingRows > 0) {
    return response({
      success: true,
      reused: Boolean(active),
      remaining: true,
      processed: planningRows.length,
      remaining_rows: remainingRows,
      batch: { ...batch, ...updates },
      summary,
    });
  }
  await writeAudit(svc, user, 'DirectoryImportBatch', batch.id, 'directory_import_dry_run_created', {}, { ...updates, summary });
  return response({
    success: true,
    reused: Boolean(active),
    remaining: false,
    processed: planningRows.length,
    remaining_rows: 0,
    batch: { ...batch, ...updates },
    summary,
  });
}

async function overrideRow(svc, user, input) {
  const row = await svc.entities.DirectoryImportRow.get(clean(input.row_id, 120)).catch(() => null);
  if (!row) return response({ error: 'Randul nu a fost gasit.' }, 404);
  if (['applied', 'rolled_back'].includes(row.status)) return response({ error: 'Randul executat nu mai poate fi modificat.' }, 409);
  const allowedKeys = [
    'organization_name', 'organization_external_key', 'location_name', 'location_external_key',
    'locality_name', 'county_name', 'locality_siruta_code', 'address', 'address_fingerprint',
    'provider_type', 'provider_profile_type', 'organization_type_code', 'location_type_code', 'care_setting_code',
    'ownership_type_code', 'operational_status', 'source_url', 'source_name', 'source_type',
    'source_checked_at', 'phone', 'email', 'website', 'schedule',
  ];
  const override = pickFields(input.override || {}, allowedKeys);
  if (!Object.keys(override).length) return response({ error: 'Nu exista campuri de corectat.' }, 400);
  const previous = safeJson(row.admin_override_json, {});
  if (row.batch_id) {
    const batch = await svc.entities.DirectoryImportBatch.get(row.batch_id).catch(() => null);
    if (batch && ['planning', 'ready'].includes(batch.status)) {
      await svc.entities.DirectoryImportBatch.update(batch.id, {
        status: 'failed',
        failure_message:
          `Randul ${row.row_number} a fost modificat dupa dry-run. Genereaza un dry-run nou.`,
      });
    }
  }
  await svc.entities.DirectoryImportRow.update(row.id, {
    admin_override_json: JSON.stringify({ ...previous, ...override }),
    status: 'valid',
    batch_id: '',
    planned_action: undefined,
    planned_actions_json: '[]',
    error_message: '',
  });
  await writeAudit(svc, user, 'DirectoryImportRow', row.id, 'directory_import_row_overridden', previous, override, clean(input.note, 1200));
  return response({ success: true, row_id: row.id });
}

async function approveBatch(svc, user, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: 'Lotul nu a fost gasit.' }, 404);
  if (batch.status !== 'ready') return response({ error: 'Lotul nu este pregatit pentru aprobare.' }, 409);
  const expected = batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows);
  if (clean(input.confirmation, 240) !== expected) {
    return response({ error: 'Confirmarea nu corespunde lotului curent.', expected_confirmation: expected }, 400);
  }
  const approvalTokenHash = stableTextHash(expected);
  const updates = {
    mode: 'import',
    status: 'approved',
    approval_token_hash: approvalTokenHash,
    approved_by_user_id: user.id,
    approved_at: now(),
  };
  await svc.entities.DirectoryImportBatch.update(batch.id, updates);
  await writeAudit(svc, user, 'DirectoryImportBatch', batch.id, 'directory_import_batch_approved', { status: batch.status }, updates);
  return response({ success: true, batch: { ...batch, ...updates } });
}

async function ensureOrganization(
  svc,
  user,
  batch,
  rowRecord,
  row,
  allowDirectoryOrganizationUpdate = false,
) {
  if (!row.organization_name) return { organization: null, created: false, updated: false };
  let target = null;
  if (rowRecord.target_organization_id) {
    target = await svc.entities.ProviderOrganization.get(rowRecord.target_organization_id).catch(() => null);
  }
  if (!target) {
    const existing = row.organization_external_key
      ? await svc.entities.ProviderOrganization.filter({ directory_external_key: row.organization_external_key }, '-created_date', 5).catch(() => [])
      : [];
    if (existing.length > 1) {
      throw new Error('Mai multe organizatii folosesc aceeasi cheie externa; executia este blocata pentru verificare manuala.');
    }
    target = existing[0] || null;
  }
  if (target) {
    const reconciliation = planDirectoryOrganizationReconciliation(target, row);
    if (!reconciliation.valid) {
      throw new Error(`Organizatia existenta necesita verificare manuala: ${reconciliation.error_code}.`);
    }
    if (!reconciliation.requires_update) {
      return { organization: target, created: false, updated: false };
    }
    if (!allowDirectoryOrganizationUpdate) {
      throw new Error('Organizatia s-a schimbat dupa dry-run; regenereaza planul inainte de executie.');
    }
    const before = pickFields(target, Object.keys(reconciliation.updates));
    const updated = await svc.entities.ProviderOrganization.update(target.id, reconciliation.updates);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: Number(batch.applied_rows || 0) * 10 + 1,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderOrganization:${target.id}:update`,
      entity_type: 'ProviderOrganization',
      entity_id: target.id,
      operation: 'update',
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(reconciliation.updates),
      rollback_status: 'pending',
      applied_at: now(),
    });
    await writeAudit(
      svc,
      user,
      'ProviderOrganization',
      target.id,
      'directory_import_organization_updated',
      before,
      reconciliation.updates,
      `Lot ${batch.batch_key}`,
    );
    return {
      organization: updated || { ...target, ...reconciliation.updates },
      created: false,
      updated: true,
    };
  }

  const canonical = resolveDirectoryOrganizationCanonicalPayload(row);
  if (!canonical.valid) {
    throw new Error(`Tipul organizatiei nu poate fi rezolvat: ${canonical.error_code}.`);
  }
  const values = {
    ...canonical.values,
    legal_name: '',
    website: row.website || '',
    control_status: 'directory',
    publication_status: 'draft',
    data_quality_status: row.data_quality_status,
    source_checked_at: normalizeDate(row.source_checked_at),
    public_visibility_status: 'draft',
    status: 'activa',
  };
  const organization = await svc.entities.ProviderOrganization.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence: Number(batch.applied_rows || 0) * 10 + 1,
    mutation_key: `${batch.id}:${rowRecord.id}:ProviderOrganization:${organization.id}:create`,
    entity_type: 'ProviderOrganization',
    entity_id: organization.id,
    operation: 'create',
    before_json: '{}',
    after_json: JSON.stringify(values),
    rollback_status: 'pending',
    applied_at: now(),
  });
  await writeAudit(svc, user, 'ProviderOrganization', organization.id, 'directory_import_organization_created', {}, values, `Lot ${batch.batch_key}`);
  return { organization, created: true, updated: false };
}

async function ensureEvidence(
  svc,
  user,
  batch,
  rowRecord,
  row,
  entityType,
  entityId,
  sequence,
) {
  if (!row.source_url) {
    return { id: null, created: false, superseded: 0 };
  }
  const expected = resolveDirectoryEvidencePayload(row, entityType, entityId);
  const active = await svc.entities.ProviderEvidence.filter({
    entity_type: entityType,
    entity_id: entityId,
    field_name: 'directory_import_snapshot',
    evidence_status: 'active',
  }, '-created_date', 20).catch(() => []);
  const retained = active.find((item) => directoryFieldsEqual(item, expected)) || null;
  const stale = active.filter((item) => item.id !== retained?.id);

  for (const [index, existing] of stale.entries()) {
    const before = { evidence_status: existing.evidence_status };
    const after = { evidence_status: 'superseded' };
    await svc.entities.ProviderEvidence.update(existing.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 0.5 + index / 100,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderEvidence:${existing.id}:update`,
      entity_type: 'ProviderEvidence',
      entity_id: existing.id,
      operation: 'update',
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
      rollback_status: 'pending',
      applied_at: now(),
    });
    await writeAudit(
      svc,
      user,
      'ProviderEvidence',
      existing.id,
      'directory_import_evidence_superseded',
      before,
      after,
      `Lot ${batch.batch_key}`,
    );
  }

  if (retained) {
    return { id: retained.id, created: false, superseded: stale.length };
  }

  const values = {
    ...expected,
    collected_at: now(),
    collected_by: user.id,
  };
  const evidence = await svc.entities.ProviderEvidence.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence,
    mutation_key: `${batch.id}:${rowRecord.id}:ProviderEvidence:${evidence.id}:create`,
    entity_type: 'ProviderEvidence',
    entity_id: evidence.id,
    operation: 'create',
    before_json: '{}',
    after_json: JSON.stringify(values),
    rollback_status: 'pending',
    applied_at: now(),
  });
  return { id: evidence.id, created: true, superseded: stale.length };
}

async function ensureDirectoryState(
  svc,
  user,
  batch,
  rowRecord,
  row,
  location,
  organizationLinked,
  sequence,
) {
  const active = await svc.entities.ProviderLocationDirectoryState.filter({
    location_id: location.id,
    state_status: 'active',
  }, '-created_date', 20).catch(() => []);
  const current = active[0] || null;
  const duplicates = active.slice(1);
  const expected = resolveDirectoryStateUpdatePayload(
    row,
    location.id,
    organizationLinked,
  );
  let stateId = current?.id || null;
  let created = false;
  let updated = false;

  if (current && !directoryFieldsEqual(current, expected)) {
    const values = { ...expected, normalized_at: now() };
    const before = pickFields(current, Object.keys(values));
    await svc.entities.ProviderLocationDirectoryState.update(current.id, values);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${current.id}:update`,
      entity_type: 'ProviderLocationDirectoryState',
      entity_id: current.id,
      operation: 'update',
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(values),
      rollback_status: 'pending',
      applied_at: now(),
    });
    await writeAudit(
      svc,
      user,
      'ProviderLocationDirectoryState',
      current.id,
      'directory_import_state_updated',
      before,
      values,
      `Lot ${batch.batch_key}`,
    );
    updated = true;
  } else if (!current) {
    const values = {
      ...resolveDirectoryStateCreatePayload(
        row,
        location.id,
        organizationLinked,
      ),
      normalized_at: now(),
    };
    const state = await svc.entities.ProviderLocationDirectoryState.create(values);
    stateId = state.id;
    created = true;
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${state.id}:create`,
      entity_type: 'ProviderLocationDirectoryState',
      entity_id: state.id,
      operation: 'create',
      before_json: '{}',
      after_json: JSON.stringify(values),
      rollback_status: 'pending',
      applied_at: now(),
    });
    await writeAudit(
      svc,
      user,
      'ProviderLocationDirectoryState',
      state.id,
      'directory_import_state_created',
      {},
      values,
      `Lot ${batch.batch_key}`,
    );
  }

  for (const [index, duplicate] of duplicates.entries()) {
    const before = { state_status: duplicate.state_status };
    const after = { state_status: 'superseded' };
    await svc.entities.ProviderLocationDirectoryState.update(duplicate.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 0.5 + index / 100,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${duplicate.id}:update`,
      entity_type: 'ProviderLocationDirectoryState',
      entity_id: duplicate.id,
      operation: 'update',
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
      rollback_status: 'pending',
      applied_at: now(),
    });
    updated = true;
  }
  return {
    id: stateId,
    created,
    updated,
    superseded: duplicates.length,
  };
}

async function ensureOrganizationLink(
  svc,
  user,
  batch,
  rowRecord,
  row,
  locationId,
  organizationId,
  sequence,
) {
  if (!organizationId) {
    return { id: null, created: false, updated: false, superseded: 0 };
  }
  const active = await svc.entities.DirectoryOrganizationLocationLink.filter({
    location_id: locationId,
    link_record_status: 'active',
  }, '-created_date', 20).catch(() => []);
  const matching = active.filter(
    (item) => item.organization_id === organizationId,
  );
  const current = matching[0] || null;
  const stale = active.filter((item) => item.id !== current?.id);

  for (const [index, existing] of stale.entries()) {
    const before = { link_record_status: existing.link_record_status };
    const after = { link_record_status: 'superseded' };
    await svc.entities.DirectoryOrganizationLocationLink.update(existing.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 0.5 + index / 100,
      mutation_key: `${batch.id}:${rowRecord.id}:DirectoryOrganizationLocationLink:${existing.id}:update`,
      entity_type: 'DirectoryOrganizationLocationLink',
      entity_id: existing.id,
      operation: 'update',
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
      rollback_status: 'pending',
      applied_at: now(),
    });
  }

  const expected = resolveDirectoryLinkPayload(
    row,
    locationId,
    organizationId,
  );
  if (current) {
    let updated = stale.length > 0;
    if (!directoryFieldsEqual(current, expected)) {
      const values = {
        ...expected,
        review_note: `Confirmata la aprobarea lotului de import ${batch.batch_key}.`,
        reviewed_by_user_id: user.id,
        reviewed_at: now(),
      };
      const before = pickFields(current, Object.keys(values));
      await svc.entities.DirectoryOrganizationLocationLink.update(current.id, values);
      await createMutation(svc, {
        batch_id: batch.id,
        row_id: rowRecord.id,
        sequence,
        mutation_key: `${batch.id}:${rowRecord.id}:DirectoryOrganizationLocationLink:${current.id}:update`,
        entity_type: 'DirectoryOrganizationLocationLink',
        entity_id: current.id,
        operation: 'update',
        before_json: JSON.stringify(before),
        after_json: JSON.stringify(values),
        rollback_status: 'pending',
        applied_at: now(),
      });
      await writeAudit(
        svc,
        user,
        'DirectoryOrganizationLocationLink',
        current.id,
        'directory_import_organization_link_updated',
        before,
        values,
        `Lot ${batch.batch_key}`,
      );
      updated = true;
    }
    return {
      id: current.id,
      created: false,
      updated,
      superseded: stale.length,
    };
  }

  const values = {
    ...expected,
    review_note: `Confirmata la aprobarea lotului de import ${batch.batch_key}.`,
    reviewed_by_user_id: user.id,
    reviewed_at: now(),
  };
  const link = await svc.entities.DirectoryOrganizationLocationLink.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence,
    mutation_key: `${batch.id}:${rowRecord.id}:DirectoryOrganizationLocationLink:${link.id}:create`,
    entity_type: 'DirectoryOrganizationLocationLink',
    entity_id: link.id,
    operation: 'create',
    before_json: '{}',
    after_json: JSON.stringify(values),
    rollback_status: 'pending',
    applied_at: now(),
  });
  await writeAudit(
    svc,
    user,
    'DirectoryOrganizationLocationLink',
    link.id,
    'directory_import_organization_link_created',
    {},
    values,
    `Lot ${batch.batch_key}`,
  );
  return {
    id: link.id,
    created: true,
    updated: stale.length > 0,
    superseded: stale.length,
  };
}

async function loadLocationReconciliationArtifacts(svc, locationId) {
  const [directoryStates, organizationLinks, evidenceRows] = await Promise.all([
    svc.entities.ProviderLocationDirectoryState.filter({
      location_id: locationId,
      state_status: 'active',
    }, '-created_date', 20).catch(() => []),
    svc.entities.DirectoryOrganizationLocationLink.filter({
      location_id: locationId,
      link_record_status: 'active',
    }, '-created_date', 20).catch(() => []),
    svc.entities.ProviderEvidence.filter({
      entity_type: 'ProviderLocation',
      entity_id: locationId,
      field_name: 'directory_import_snapshot',
      evidence_status: 'active',
    }, '-created_date', 20).catch(() => []),
  ]);
  return { directoryStates, organizationLinks, evidenceRows };
}

async function executeRow(svc, user, batch, rowRecord) {
  const row = applyAdminOverride(safeJson(rowRecord.normalized_payload_json, {}), rowRecord);
  const plannedActions = safeJson(rowRecord.planned_actions_json, []);
  const updatesDirectoryOrganization = Array.isArray(plannedActions)
    && plannedActions.includes('update_directory_organization');
  const result = {
    action: rowRecord.planned_action,
    created_organization: false,
    updated_organization: false,
    created_location: false,
    updated_location: false,
    created_directory_state: false,
    updated_directory_state: false,
    superseded_directory_states: 0,
    created_link: false,
    updated_link: false,
    superseded_links: 0,
    created_evidence: false,
    superseded_evidence: 0,
  };
  if (rowRecord.planned_action === 'skip_duplicate') {
    await svc.entities.DirectoryImportRow.update(rowRecord.id, { status: 'skipped', result_json: JSON.stringify(result), applied_at: now(), rollback_status: 'not_required' });
    return { status: 'skipped', result };
  }
  if (['block_conflict', 'reject_invalid'].includes(rowRecord.planned_action)) throw new Error('Randul nu este eligibil pentru executie.');

  let organization = null;
  if (row.organization_name) {
    const organizationResult = await ensureOrganization(
      svc,
      user,
      batch,
      rowRecord,
      row,
      updatesDirectoryOrganization,
    );
    organization = organizationResult.organization;
    result.created_organization = organizationResult.created;
    result.updated_organization = organizationResult.updated;
  }

  let location = rowRecord.target_location_id
    ? await svc.entities.ProviderLocation.get(rowRecord.target_location_id).catch(() => null)
    : null;
  if (location && CONTROLLED_PROFILES.has(location.profile_control_status || 'directory')) throw new Error('Profilul este controlat si necesita actualizare manuala.');

  if (rowRecord.planned_action === 'skip_unchanged') {
    if (!location) {
      throw new Error('Locatia existenta nu mai poate fi gasita; regenereaza dry-run-ul.');
    }
    const artifacts = await loadLocationReconciliationArtifacts(svc, location.id);
    const currentPlan = planDirectoryLocationReconciliation({
      location,
      ...artifacts,
      row,
      organizationId: organization?.id || '',
    });
    if (
      currentPlan.requires_update
      || (organization?.id && location.organization_id !== organization.id)
    ) {
      throw new Error('Locatia s-a schimbat dupa dry-run; regenereaza planul inainte de executie.');
    }
    result.organization_id = organization?.id || null;
    result.location_id = location.id;
    const status = result.created_organization || result.updated_organization ? 'applied' : 'skipped';
    await svc.entities.DirectoryImportRow.update(rowRecord.id, {
      status,
      result_json: JSON.stringify(result),
      applied_at: now(),
      rollback_status: status === 'applied' ? 'pending' : 'not_required',
      error_message: '',
    });
    return { status, result };
  }

  if (!location) {
    const values = locationCreatePayload(row, organization?.id || null);
    location = await svc.entities.ProviderLocation.create(values);
    result.created_location = true;
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: Number(batch.applied_rows || 0) * 10 + 2,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocation:${location.id}:create`,
      entity_type: 'ProviderLocation',
      entity_id: location.id,
      operation: 'create',
      before_json: '{}',
      after_json: JSON.stringify(values),
      rollback_status: 'pending',
      applied_at: now(),
    });
    await writeAudit(svc, user, 'ProviderLocation', location.id, 'directory_import_location_created', {}, values, `Lot ${batch.batch_key}`);
  } else {
    const updates = resolveDirectoryLocationUpdatePayload(row);
    if (organization?.id) updates.organization_id = organization.id;
    if (!directoryFieldsEqual(location, updates)) {
      const before = pickFields(location, Object.keys(updates));
      await svc.entities.ProviderLocation.update(location.id, updates);
      result.updated_location = true;
      await createMutation(svc, {
        batch_id: batch.id,
        row_id: rowRecord.id,
        sequence: Number(batch.applied_rows || 0) * 10 + 2,
        mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocation:${location.id}:update`,
        entity_type: 'ProviderLocation',
        entity_id: location.id,
        operation: 'update',
        before_json: JSON.stringify(before),
        after_json: JSON.stringify(updates),
        rollback_status: 'pending',
        applied_at: now(),
      });
      await writeAudit(svc, user, 'ProviderLocation', location.id, 'directory_import_location_updated', before, updates, `Lot ${batch.batch_key}`);
      location = { ...location, ...updates };
    }
  }

  const stateResult = await ensureDirectoryState(
    svc,
    user,
    batch,
    rowRecord,
    row,
    location,
    Boolean(organization?.id),
    Number(batch.applied_rows || 0) * 10 + 4,
  );
  result.created_directory_state = stateResult.created;
  result.updated_directory_state = stateResult.updated;
  result.superseded_directory_states = stateResult.superseded;
  if (organization?.id) {
    const linkResult = await ensureOrganizationLink(
      svc,
      user,
      batch,
      rowRecord,
      row,
      location.id,
      organization.id,
      Number(batch.applied_rows || 0) * 10 + 6,
    );
    result.created_link = linkResult.created;
    result.updated_link = linkResult.updated;
    result.superseded_links = linkResult.superseded;
  }
  const evidenceResult = await ensureEvidence(
    svc,
    user,
    batch,
    rowRecord,
    row,
    'ProviderLocation',
    location.id,
    Number(batch.applied_rows || 0) * 10 + 8,
  );
  result.created_evidence = evidenceResult.created;
  result.superseded_evidence = evidenceResult.superseded;

  result.organization_id = organization?.id || null;
  result.location_id = location.id;
  const status = [
    result.created_organization,
    result.updated_organization,
    result.created_location,
    result.updated_location,
    result.created_directory_state,
    result.updated_directory_state,
    result.created_link,
    result.updated_link,
    result.created_evidence,
    result.superseded_evidence > 0,
  ].some(Boolean) ? 'applied' : 'skipped';
  await svc.entities.DirectoryImportRow.update(rowRecord.id, {
    status,
    target_organization_id: organization?.id || '',
    target_location_id: location.id,
    result_json: JSON.stringify(result),
    applied_at: now(),
    rollback_status: status === 'applied' ? 'pending' : 'not_required',
    error_message: '',
  });
  return { status, result };
}

async function acquireBatchLock(svc, batch, requestedToken = '') {
  const currentExpiry = batch.execution_lock_expires_at ? new Date(batch.execution_lock_expires_at).getTime() : 0;
  const currentToken = clean(batch.execution_lock_token, 200);
  const supplied = clean(requestedToken, 200);
  if (currentToken && currentExpiry > Date.now() && supplied !== currentToken) return { error: 'Lotul este procesat de alta executie.' };
  const token = supplied && supplied === currentToken ? supplied : randomToken('import');
  await svc.entities.DirectoryImportBatch.update(batch.id, { execution_lock_token: token, execution_lock_expires_at: lockExpiry() });
  return { token };
}

async function executeBatch(svc, user, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: 'Lotul nu a fost gasit.' }, 404);
  if (!['approved', 'running'].includes(batch.status)) return response({ error: 'Lotul nu este aprobat sau nu poate continua.' }, 409);
  const lock = await acquireBatchLock(svc, batch, input.lock_token);
  if (lock.error) return response({ error: lock.error }, 409);

  if (batch.status === 'approved') {
    await svc.entities.DirectoryImportBatch.update(batch.id, { status: 'running', started_at: now() });
  }
  const limit = boundedChunkSize(input.limit, EXECUTION_CHUNK);
  const rows = await svc.entities.DirectoryImportRow.filter({ batch_id: batch.id, status: 'ready' }, 'row_number', limit).catch(() => []);
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  let createdOrganizations = 0;
  let updatedOrganizations = 0;
  let createdLocations = 0;
  let updatedLocations = 0;
  let createdLinks = 0;

  for (const row of rows) {
    try {
      const outcome = await executeRow(svc, user, { ...batch, applied_rows: Number(batch.applied_rows || 0) + applied }, row);
      if (outcome.status === 'applied') {
        applied += 1;
        if (outcome.result.created_organization) createdOrganizations += 1;
        if (outcome.result.updated_organization) updatedOrganizations += 1;
        if (outcome.result.created_location) createdLocations += 1;
        if (outcome.result.updated_location) updatedLocations += 1;
        if (outcome.result.created_link) createdLinks += 1;
      } else skipped += 1;
    } catch (error) {
      failed += 1;
      await svc.entities.DirectoryImportRow.update(row.id, { status: 'failed', error_message: error?.message || 'Executia randului a esuat.', result_json: '{}' });
    }
  }

  const remaining = await svc.entities.DirectoryImportRow.filter({ batch_id: batch.id, status: 'ready' }, 'row_number', 2).catch(() => []);
  const totals = {
    execution_cursor: Number(batch.execution_cursor || 0) + rows.length,
    applied_rows: Number(batch.applied_rows || 0) + applied,
    skipped_rows: Number(batch.skipped_rows || 0) + skipped,
    failed_rows: Number(batch.failed_rows || 0) + failed,
    created_organizations: Number(batch.created_organizations || 0) + createdOrganizations,
    created_locations: Number(batch.created_locations || 0) + createdLocations,
    updated_locations: Number(batch.updated_locations || 0) + updatedLocations,
    created_links: Number(batch.created_links || 0) + createdLinks,
  };
  const previousSummary = safeJson(batch.summary_json, {});
  const executionCounts = {
    ...(previousSummary.execution_counts || {}),
    updated_organizations: Number(previousSummary.execution_counts?.updated_organizations || 0) + updatedOrganizations,
  };
  const completed = remaining.length === 0;
  const status = completed ? (totals.failed_rows > 0 ? 'completed_with_errors' : 'completed') : 'running';
  await svc.entities.DirectoryImportBatch.update(batch.id, {
    ...totals,
    summary_json: JSON.stringify({ ...previousSummary, execution_counts: executionCounts }),
    status,
    finished_at: completed ? now() : null,
    execution_lock_token: completed ? '' : lock.token,
    execution_lock_expires_at: completed ? null : lockExpiry(),
  });
  if (completed) {
    await svc.entities.DirectorySourceSnapshot.update(batch.snapshot_id, { status: 'imported' });
    await writeAudit(svc, user, 'DirectoryImportBatch', batch.id, 'directory_import_batch_completed', {}, { ...totals, status });
  }
  return response({
    success: true,
    batch_id: batch.id,
    status,
    lock_token: completed ? '' : lock.token,
    processed: rows.length,
    applied,
    skipped,
    failed,
    remaining: !completed,
    totals: { ...totals, updated_organizations: executionCounts.updated_organizations },
  });
}

async function canDeleteCreatedLocation(svc, entity) {
  if (!entity || entity.profile_control_status !== 'directory') return false;
  const [memberships, services] = await Promise.all([
    svc.entities.ProviderMembership.filter({ location_id: entity.id, status: 'active' }, '-created_date', 2).catch(() => []),
    svc.entities.LocationService.filter({ location_id: entity.id }, '-created_date', 2).catch(() => []),
  ]);
  return memberships.length === 0 && services.length === 0;
}

async function canDeleteCreatedOrganization(svc, entity) {
  if (!entity || entity.control_status !== 'directory') return false;
  const locations = await svc.entities.ProviderLocation.filter({ organization_id: entity.id }, '-created_date', 2).catch(() => []);
  return locations.length === 0;
}

async function rollbackMutation(svc, mutation) {
  const current = await getEntity(svc, mutation.entity_type, mutation.entity_id);
  if (mutation.operation === 'create') {
    if (!current) return { success: true, already_absent: true };
    if (mutation.entity_type === 'ProviderLocation' && !(await canDeleteCreatedLocation(svc, current))) throw new Error('Locatia a primit date sau acces dupa import si nu poate fi stearsa automat.');
    if (mutation.entity_type === 'ProviderOrganization' && !(await canDeleteCreatedOrganization(svc, current))) throw new Error('Organizatia are inca locatii si nu poate fi stearsa automat.');
    const expected = safeJson(mutation.after_json, {});
    if (!equalFieldSubset(current, expected)) throw new Error('Entitatea creata a fost modificata dupa import.');
    await deleteEntity(svc, mutation.entity_type, mutation.entity_id);
    return { success: true };
  }
  if (!current) throw new Error('Entitatea actualizata nu mai exista.');
  const after = safeJson(mutation.after_json, {});
  if (!equalFieldSubset(current, after)) throw new Error('Entitatea a fost modificata dupa import; rollbackul automat este blocat.');
  const before = safeJson(mutation.before_json, {});
  await updateEntity(svc, mutation.entity_type, mutation.entity_id, before);
  return { success: true };
}

async function rollbackBatch(svc, user, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: 'Lotul nu a fost gasit.' }, 404);
  if (!['completed', 'completed_with_errors', 'rollback_failed', 'rolling_back'].includes(batch.status)) {
    return response({ error: 'Lotul nu poate fi retras in starea curenta.' }, 409);
  }
  const expected = rollbackApprovalToken(batch.batch_key, batch.applied_rows);
  if (clean(input.confirmation, 240) !== expected) return response({ error: 'Confirmarea de rollback nu corespunde.', expected_confirmation: expected }, 400);
  const lock = await acquireBatchLock(svc, batch, input.lock_token);
  if (lock.error) return response({ error: lock.error }, 409);
  if (batch.status !== 'rolling_back') await svc.entities.DirectoryImportBatch.update(batch.id, { status: 'rolling_back', rollback_started_at: now() });

  const limit = Math.max(1, Math.min(EXECUTION_CHUNK * 5, Number(input.limit || EXECUTION_CHUNK * 2)));
  const mutations = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id, rollback_status: 'pending' }, '-sequence', limit).catch(() => []);
  let completed = 0;
  let failed = 0;
  for (const mutation of mutations) {
    try {
      await rollbackMutation(svc, mutation);
      await svc.entities.DirectoryImportMutation.update(mutation.id, { rollback_status: 'completed', rolled_back_at: now(), rollback_error: '' });
      completed += 1;
    } catch (error) {
      failed += 1;
      await svc.entities.DirectoryImportMutation.update(mutation.id, { rollback_status: 'failed', rollback_error: error?.message || 'Rollback esuat.' });
    }
  }
  const pending = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id, rollback_status: 'pending' }, '-sequence', 2).catch(() => []);
  const failedMutations = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id, rollback_status: 'failed' }, '-sequence', 2).catch(() => []);
  const done = pending.length === 0;
  const status = done ? (failedMutations.length ? 'rollback_failed' : 'rolled_back') : 'rolling_back';
  await svc.entities.DirectoryImportBatch.update(batch.id, {
    status,
    rollback_cursor: Number(batch.rollback_cursor || 0) + mutations.length,
    rollback_finished_at: done ? now() : null,
    execution_lock_token: done ? '' : lock.token,
    execution_lock_expires_at: done ? null : lockExpiry(),
  });
  if (done && !failedMutations.length) {
    const rows = await svc.entities.DirectoryImportRow.filter({ batch_id: batch.id, status: 'applied' }, 'row_number', MAX_ROWS).catch(() => []);
    for (const row of rows) await svc.entities.DirectoryImportRow.update(row.id, { status: 'rolled_back', rollback_status: 'completed' });
    await svc.entities.DirectorySourceSnapshot.update(batch.snapshot_id, { status: 'ready' });
    await writeAudit(svc, user, 'DirectoryImportBatch', batch.id, 'directory_import_batch_rolled_back', {}, { status: 'rolled_back', completed_mutations: completed });
  }
  return response({ success: true, status, lock_token: done ? '' : lock.token, processed: mutations.length, completed, failed, remaining: !done });
}

async function getSnapshotDetail(svc, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: 'Snapshotul nu a fost gasit.' }, 404);
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100)));
  const skip = Math.max(0, Number(input.skip || 0));
  const query = { snapshot_id: snapshot.id };
  if (input.status) query.status = clean(input.status, 40);
  const all = await svc.entities.DirectoryImportRow.filter(query, 'row_number', Math.min(MAX_ROWS, skip + limit)).catch(() => []);
  const rows = all.slice(skip, skip + limit);
  const batches = await svc.entities.DirectoryImportBatch.filter({ snapshot_id: snapshot.id }, '-created_date', 100).catch(() => []);
  return response({ success: true, snapshot, rows, batches, pagination: { skip, limit, returned: rows.length } });
}

async function getBatchDetail(svc, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: 'Lotul nu a fost gasit.' }, 404);
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100)));
  const status = clean(input.status, 40);
  const query = { batch_id: batch.id };
  if (status) query.status = status;
  const rows = await svc.entities.DirectoryImportRow.filter(query, 'row_number', limit).catch(() => []);
  const mutationSummary = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id }, '-sequence', 5000).catch(() => []);
  const summary = mutationSummary.reduce((acc, mutation) => {
    acc.total += 1;
    acc[mutation.rollback_status] = (acc[mutation.rollback_status] || 0) + 1;
    return acc;
  }, { total: 0, pending: 0, completed: 0, failed: 0, not_required: 0 });
  return response({ success: true, batch, rows, mutation_summary: summary, approval_confirmation: batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows), rollback_confirmation: rollbackApprovalToken(batch.batch_key, batch.applied_rows) });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.error) return auth.error;
    const { user, svc } = auth;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action, 80);

    if (action === 'list_snapshots') return response({ success: true, snapshots: await listSnapshots(svc, input), contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION });
    if (action === 'create_snapshot') return createSnapshot(svc, user, input);
    if (action === 'append_rows') return appendRows(svc, user, input);
    if (action === 'finalize_snapshot') return finalizeSnapshot(svc, user, input);
    if (action === 'get_snapshot') return getSnapshotDetail(svc, input);
    if (action === 'plan_batch') return planBatch(svc, user, input);
    if (action === 'override_row') return overrideRow(svc, user, input);
    if (action === 'approve_batch') return approveBatch(svc, user, input);
    if (action === 'execute_batch') return executeBatch(svc, user, input);
    if (action === 'rollback_batch') return rollbackBatch(svc, user, input);
    if (action === 'get_batch') return getBatchDetail(svc, input);
    return response({ error: 'Actiune necunoscuta.' }, 400);
  } catch (error) {
    return response({ error: error?.message || 'Eroare neasteptata in pipeline-ul directorului.' }, 500);
  }
}
