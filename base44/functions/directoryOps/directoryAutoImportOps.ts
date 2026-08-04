import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { strFromU8, unzipSync } from 'npm:fflate@0.8.2';
import {
  batchApprovalToken,
  inferCanonicalLocationType,
  normalizeAddressForFingerprint,
  normalizeDirectoryImportRow,
  normalizeIdentityText,
  stableTextHash,
} from '../../shared/directoryImportPipeline.js';
import {
  getDirectoryEntityOrNull,
  isDirectoryReadFailure,
  isTransientDirectoryExecutionFailure,
  requireDirectoryRows,
} from '../../shared/directoryImportReadPolicy.js';
import {
  appendRows,
  approveBatch,
  createSnapshot,
  executeBatch,
  finalizeSnapshot,
  planBatch,
  publishCompletedBatchAsBasicDirectory,
  resumeBatchAfterTransientFailure,
} from './directoryImportOps.ts';

export const DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION = 'viasee-directory-auto-import-v2';
const CAMPAIGN_MODE_STRICT = 'strict_import';
const CAMPAIGN_MODE_NATIONAL = 'national_directory';
const PUBLICATION_MODE_BASIC = 'public_basic_directory';
const MAX_BATCHES = 50;
const MAX_ROWS_PER_BATCH = 40;
const EXECUTION_CHUNK = 5;
const PAYLOAD_CHUNK_SIZE = 12_000;
const LOCK_MINUTES = 4;
const ALLOWED_ACTIONS = new Set([
  'create_organization_and_location',
  'create_location_use_existing_organization',
]);
const TERMINAL_ITEM_STATUSES = new Set(['completed', 'blocked', 'failed', 'skipped']);

function clean(value, maxLength = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function now() {
  return new Date().toISOString();
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function response(body, status = 200) {
  return Response.json(body, { status });
}

function safeJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  try { return value ? JSON.parse(value) : fallback; } catch (_error) { return fallback; }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function campaignMode(value) {
  return clean(value, 80) === CAMPAIGN_MODE_NATIONAL
    ? CAMPAIGN_MODE_NATIONAL
    : CAMPAIGN_MODE_STRICT;
}

function runCampaignMode(run = {}) {
  const direct = campaignMode(run.campaign_mode);
  if (direct === CAMPAIGN_MODE_NATIONAL) return direct;
  const policy = safeJson(run.safety_policy_json, {});
  return campaignMode(policy.campaign_mode);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function responsePayload(value) {
  if (!(value instanceof Response)) return value || {};
  return value.clone().json().catch(() => ({}));
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: response({ error: 'Autentificare necesara.' }, 401) };
  if (user.role !== 'admin') return { error: response({ error: 'Acces administrativ necesar.' }, 403) };
  return { user, svc: base44.asServiceRole };
}

function automationUser(run = {}) {
  return {
    id: clean(run.approved_by_user_id || run.created_by_user_id || 'directory-auto-import', 160),
    email: clean(run.approved_by_email || run.created_by_email || 'automation@viasee.internal', 240),
    role: 'admin',
  };
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

async function sha256HexBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256HexText(value) {
  return sha256HexBytes(new TextEncoder().encode(String(value ?? '')));
}

function splitPayloadText(value) {
  const text = String(value ?? '');
  const chunks = [];
  for (let offset = 0; offset < text.length; offset += PAYLOAD_CHUNK_SIZE) {
    chunks.push(text.slice(offset, offset + PAYLOAD_CHUNK_SIZE));
  }
  return chunks.length ? chunks : [''];
}

async function persistPayloadChunks(svc, runId, itemKey, payloadJson, selectedRows) {
  const text = String(payloadJson ?? '[]');
  const payloadSha256 = await sha256HexText(text);
  const chunks = splitPayloadText(text);
  const existing = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportPayloadChunk.filter(
      { run_id: runId, item_key: itemKey },
      'chunk_index',
      200,
    ),
    'fragmentelor private ale lotului automat',
  );
  const byIndex = new Map();
  for (const entry of existing) {
    const index = Number(entry.chunk_index);
    if (byIndex.has(index)) throw new Error(`Fragmente private duplicate pentru ${itemKey}.`);
    byIndex.set(index, entry);
  }
  let created = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const current = byIndex.get(index) || null;
    if (current) {
      const matches = Number(current.chunk_count) === chunks.length
        && clean(current.payload_sha256, 80) === payloadSha256
        && current.payload_chunk === chunks[index];
      if (!matches) throw new Error(`Persistenta privata este neconforma pentru ${itemKey}, fragmentul ${index}.`);
      continue;
    }
    await svc.entities.DirectoryAutoImportPayloadChunk.create({
      run_id: runId,
      item_key: itemKey,
      chunk_index: index,
      chunk_count: chunks.length,
      payload_chunk: chunks[index],
      payload_sha256: payloadSha256,
      created_for_selected_rows: Number(selectedRows || 0),
    });
    created += 1;
  }
  for (const index of byIndex.keys()) {
    if (index < 0 || index >= chunks.length) throw new Error(`Fragment privat excedentar pentru ${itemKey}.`);
  }
  return { payload_sha256: payloadSha256, chunk_count: chunks.length, reused: created === 0, created };
}

async function loadPayloadChunks(svc, item) {
  const chunks = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportPayloadChunk.filter(
      { run_id: item.run_id, item_key: item.item_key },
      'chunk_index',
      200,
    ),
    'fragmentelor private ale lotului automat pentru reluare',
  );
  if (!chunks.length) return null;
  const expectedCount = Number(chunks[0].chunk_count || 0);
  if (!expectedCount || chunks.length !== expectedCount) {
    throw new Error(`Fragmente private incomplete pentru ${item.item_key}.`);
  }
  for (let index = 0; index < chunks.length; index += 1) {
    if (Number(chunks[index].chunk_index) !== index || Number(chunks[index].chunk_count) !== expectedCount) {
      throw new Error(`Ordine invalida a fragmentelor private pentru ${item.item_key}.`);
    }
  }
  const text = chunks.map((entry) => entry.payload_chunk || '').join('');
  const actualSha256 = await sha256HexText(text);
  if (actualSha256 !== clean(chunks[0].payload_sha256, 80)) {
    throw new Error(`SHA invalid pentru persistenta privata a ${item.item_key}.`);
  }
  const payload = JSON.parse(text);
  if (!Array.isArray(payload)) throw new Error(`Payload privat invalid pentru ${item.item_key}.`);
  return payload;
}

async function fetchJson(sourceUrl, expectedSha256 = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const result = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!result.ok) throw new Error(`Fisierul sursa nu poate fi descarcat (${result.status}).`);
    const bytes = await result.arrayBuffer();
    if (bytes.byteLength > 8_000_000) throw new Error('Fisierul sursa depaseste limita de 8 MB.');
    const sha256 = await sha256HexBytes(bytes);
    const expected = clean(expectedSha256, 80).toLowerCase();
    if (expected && expected !== sha256) throw new Error('SHA-256 al fisierului nu corespunde manifestului.');
    return {
      payload: JSON.parse(new TextDecoder().decode(bytes)),
      sha256,
      bytes: bytes.byteLength,
    };
  } finally {
    clearTimeout(timer);
  }
}

function sourceUrlFor(entry) {
  if (typeof entry === 'string') return clean(entry, 2000);
  return clean(
    entry?.source_url
    || entry?.file_url
    || entry?.url
    || entry?.batch_url
    || entry?.batch_file_url
    || entry?.clean_batch_file_url,
    2000,
  );
}

function descriptorFor(entry, index = 0) {
  const sourceUrl = sourceUrlFor(entry);
  if (!/^https:\/\//i.test(sourceUrl)) return null;
  const expectedRows = Number(
    entry?.row_count
    ?? entry?.location_count
    ?? entry?.expected_rows
    ?? 0,
  );
  return {
    source_url: sourceUrl,
    source_filename: clean(
      entry?.file_name
      || entry?.filename
      || sourceUrl.split('/').pop()?.split('?')[0]
      || `batch-${index + 1}.json`,
      240,
    ),
    expected_sha256: clean(
      entry?.clean_batch_file_sha256
      || entry?.file_sha256
      || entry?.sha256
      || '',
      80,
    ).toLowerCase(),
    expected_rows: Number.isFinite(expectedRows) && expectedRows > 0 ? expectedRows : 0,
    organization_count: Math.max(0, Number(entry?.organization_count || 0)),
  };
}

function descriptorsFromManifest(payload, manifestUrl = '') {
  const collections = [
    payload?.clean_batches,
    payload?.batches,
    payload?.batch_files,
    payload?.files,
    payload?.items,
  ].filter(Array.isArray);
  const descriptors = (collections[0] || [])
    .map((entry, index) => descriptorFor(entry, index))
    .filter(Boolean)
    .filter((entry) => /\.json(?:$|\?)/i.test(entry.source_url))
    .filter((entry) => {
      const name = clean(entry.source_filename, 240).toLowerCase();
      if (/(needs-review|excluded|audit|report|manifest)/.test(name)) return false;
      return /batch/.test(name);
    });
  if (descriptors.length) return descriptors;
  if (Array.isArray(payload?.rows)) {
    const direct = descriptorFor({
      source_url: manifestUrl,
      file_name: payload?.batch_key ? `${payload.batch_key}.json` : undefined,
      row_count: payload.rows.length,
      organization_count: payload?.organization_count,
      file_sha256: payload?.clean_batch_file_sha256 || payload?.file_sha256 || '',
    });
    return direct ? [direct] : [];
  }
  return [];
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function decodeBase64Bytes(value) {
  const source = String(value || '').replace(/^data:[^,]*;base64,/i, '').replace(/\s+/g, '');
  if (!source) throw new Error('Arhiva ZIP lipseste.');
  if (source.length > 12_000_000) throw new Error('Arhiva ZIP depaseste limita acceptata.');
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function archiveEntryByName(entries, requestedName) {
  const expected = clean(requestedName, 500).replace(/^\.\//, '');
  if (!expected) return null;
  if (entries[expected]) return { name: expected, bytes: entries[expected] };
  const exactSuffix = Object.keys(entries).find((name) => name === expected || name.endsWith(`/${expected}`));
  if (exactSuffix) return { name: exactSuffix, bytes: entries[exactSuffix] };
  const baseName = expected.split('/').pop();
  const byBaseName = Object.keys(entries).filter((name) => name.split('/').pop() === baseName);
  if (byBaseName.length === 1) return { name: byBaseName[0], bytes: entries[byBaseName[0]] };
  return null;
}

async function descriptorsFromZipBase64(zipBase64, archiveFilename = '') {
  const zipBytes = decodeBase64Bytes(zipBase64);
  if (zipBytes.byteLength > 8_000_000) throw new Error('Arhiva ZIP depaseste limita de 8 MB.');
  const archiveSha256 = await sha256HexBytes(zipBytes);
  let entries;
  try {
    entries = unzipSync(zipBytes);
  } catch (_error) {
    throw new Error('Arhiva ZIP nu poate fi deschisa.');
  }
  const names = Object.keys(entries).filter((name) => !name.endsWith('/'));
  const manifestName = names.find((name) => /(^|\/)(manifest-index|manifest)\.json$/i.test(name));
  let manifest = null;
  if (manifestName) {
    try {
      manifest = JSON.parse(strFromU8(entries[manifestName]));
    } catch (_error) {
      throw new Error('Manifestul JSON din arhiva este invalid.');
    }
  }
  const manifestCollections = [
    manifest?.automatic_batches,
    manifest?.clean_batches,
    manifest?.batches,
    manifest?.batch_files,
    manifest?.files,
    manifest?.items,
  ].filter(Array.isArray);
  const descriptors = [];
  if (manifestCollections[0]?.length) {
    for (let index = 0; index < manifestCollections[0].length; index += 1) {
      const entry = manifestCollections[0][index];
      const fileName = clean(
        entry?.file || entry?.file_name || entry?.filename || entry?.path,
        500,
      );
      const located = archiveEntryByName(entries, fileName);
      if (!located) throw new Error(`Fisierul ${fileName || index + 1} declarat in manifest lipseste din arhiva.`);
      const actualSha256 = await sha256HexBytes(located.bytes);
      const expectedSha256 = clean(entry?.sha256 || entry?.file_sha256 || '', 80).toLowerCase();
      if (expectedSha256 && expectedSha256 !== actualSha256) {
        throw new Error(`SHA-256 nu corespunde pentru ${fileName}.`);
      }
      let payload;
      try {
        payload = JSON.parse(strFromU8(located.bytes));
      } catch (_error) {
        throw new Error(`Fisierul ${fileName} nu contine JSON valid.`);
      }
      const rows = rowsFromPayload(payload);
      descriptors.push({
        source_url: `archive://${archiveSha256}/${located.name}`,
        source_filename: located.name.split('/').pop() || `batch-${index + 1}.json`,
        source_sha256: actualSha256,
        expected_sha256: actualSha256,
        expected_rows: Math.max(0, Number(entry?.rows ?? entry?.row_count ?? entry?.location_count ?? rows.length)),
        organization_count: Math.max(0, Number(entry?.organizations ?? entry?.organization_count ?? 0)),
        inline_rows: rows,
      });
    }
  } else {
    const batchNames = names.filter((name) => {
      const baseName = name.split('/').pop()?.toLowerCase() || '';
      return /\.json$/.test(baseName)
        && /batch/.test(baseName)
        && !/(needs-review|requires-review|excluded|blocked|audit|report|manifest|invalid)/.test(baseName);
    }).sort();
    for (let index = 0; index < batchNames.length; index += 1) {
      const name = batchNames[index];
      let payload;
      try {
        payload = JSON.parse(strFromU8(entries[name]));
      } catch (_error) {
        throw new Error(`Fisierul ${name} nu contine JSON valid.`);
      }
      const rows = rowsFromPayload(payload);
      const sourceSha256 = await sha256HexBytes(entries[name]);
      descriptors.push({
        source_url: `archive://${archiveSha256}/${name}`,
        source_filename: name.split('/').pop() || `batch-${index + 1}.json`,
        source_sha256: sourceSha256,
        expected_sha256: sourceSha256,
        expected_rows: rows.length,
        organization_count: 0,
        inline_rows: rows,
      });
    }
  }
  if (!descriptors.length) throw new Error('Arhiva nu contine loturi JSON recunoscute.');
  return {
    archive_filename: clean(archiveFilename, 240),
    archive_sha256: archiveSha256,
    descriptors,
  };
}

function nationalPseudoRowReason(row = {}) {
  const name = normalizeIdentityText(row.location_display_name || row.location_name);
  const locality = clean(row.official_locality || row.locality_name, 160);
  const address = normalizeIdentityText(row.confirmed_address || row.address);
  if (!name) return 'missing_location_name';
  if (
    name === 'organizatie'
    || /^(?:locatii|acoperire|retea|network)(?:\s|$)/.test(name)
    || /^total(?:\s*:?\s*\d|\s+(?:locatii|puncte|sedii)\b)/.test(name)
  ) return 'aggregate_or_summary_row';
  if (/^~?\d+\+?$/.test(locality) || /^~?\d+\+?$/.test(clean(row.location_display_name || row.location_name))) {
    return 'aggregate_count_row';
  }
  if (!address && /\b(locatii|puncte|sedii)\b/.test(name)) return 'aggregate_without_address';
  return '';
}

function nationalOrganizationTypeCode(row = {}, resolvedType = null) {
  const explicit = clean(row.organization_type_code, 120);
  if (explicit && explicit !== 'other') return explicit;
  const text = normalizeIdentityText([
    row.organization_display_name,
    row.location_display_name,
    row.confirmed_activity_category,
    row.observations,
  ].filter(Boolean).join(' '));
  if (/\bspital\b|\binstitut\b|\bambulator\b|\bsectie\b/.test(text)) return 'public_healthcare_institution';
  if (/\bpoliclinica\b|\bhiperclinica\b|\bmulti specialitate\b|\bcentru medical\b/.test(text)) return 'multi_specialty_healthcare_provider';
  if (/\bretea\b|\bnetwork\b/.test(text)) return 'healthcare_network';
  const profileType = clean(resolvedType?.provider_profile_type || row.provider_profile_type, 120);
  if (profileType === 'optical_chain') return 'optical_chain';
  if (profileType === 'independent_optical_store') return 'independent_optical_store';
  if (profileType === 'ophthalmology_clinic') return 'ophthalmology_clinic';
  if (profileType === 'ophthalmology_office') return 'ophthalmology_office';
  if (profileType.startsWith('independent_')) return 'independent_professional';
  if (profileType.startsWith('optical_laboratory_')) return 'optical_laboratory';
  if (resolvedType?.provider_type === 'optica_medicala') return 'independent_optical_store';
  if (resolvedType?.provider_type === 'cabinet_oftalmologic') return 'ophthalmology_office';
  if (resolvedType?.provider_type === 'clinica_oftalmologica') return 'ophthalmology_clinic';
  return 'independent_professional';
}

function inferNationalLocationType(activityText = '') {
  const text = normalizeIdentityText(activityText);
  if (/\bspital\b|\binstitut\b|\bambulator\b|\bsectie\b|\bcompartiment\b/.test(text)) {
    const outpatient = /\bambulator\b|\bcabinet\b/.test(text);
    return {
      provider_type: 'clinica_oftalmologica',
      provider_profile_type: 'ophthalmology_clinic',
      location_type_code: outpatient ? 'hospital_outpatient_unit' : 'hospital_department',
      care_setting_code: outpatient ? 'hospital_outpatient' : 'hospital_inpatient',
    };
  }
  if (/\bpoliclinica\b|\bhiperclinica\b|\bmulti specialitate\b|\bcentru medical\b/.test(text)) {
    return {
      provider_type: 'clinica_oftalmologica',
      provider_profile_type: 'ophthalmology_clinic',
      location_type_code: 'multi_specialty_clinic',
      care_setting_code: 'outpatient',
    };
  }
  return inferCanonicalLocationType(activityText);
}

function normalizeNationalDirectoryRow(row = {}) {
  const explicitComplete = [
    row.provider_type,
    row.provider_profile_type,
    row.location_type_code,
    row.care_setting_code,
  ].every((value) => Boolean(clean(value, 120)));
  const activityText = [
    row.confirmed_activity_category,
    row.location_display_name,
    row.organization_display_name,
    row.observations,
  ].filter(Boolean).join(' | ');
  const resolvedType = explicitComplete ? {
    provider_type: clean(row.provider_type, 120),
    provider_profile_type: clean(row.provider_profile_type, 120),
    location_type_code: clean(row.location_type_code, 120),
    care_setting_code: clean(row.care_setting_code, 120),
  } : inferNationalLocationType(activityText);
  const organizationName = clean(row.organization_display_name || row.location_display_name, 240);
  const localityKey = normalizeIdentityText(row.official_locality || row.locality_name);
  const addressKey = normalizeAddressForFingerprint(row.confirmed_address || row.address);
  const locationNameKey = normalizeIdentityText(row.location_display_name || row.location_name);
  const organizationExternalKey = clean(row.organization_external_key, 240)
    || (organizationName ? `org:${stableTextHash(normalizeIdentityText(organizationName))}` : '');
  const locationExternalKey = clean(row.location_external_key, 240)
    || (localityKey && addressKey && locationNameKey
      ? `loc:${stableTextHash([localityKey, addressKey, locationNameKey].join('|'))}`
      : '');
  const addressFingerprint = clean(row.address_fingerprint, 240)
    || (localityKey && addressKey
      ? `addr:${stableTextHash([clean(row.locality_siruta_code, 40) || localityKey, addressKey].join('|'))}`
      : '');
  return {
    ...row,
    organization_display_name: organizationName,
    organization_external_key: organizationExternalKey,
    location_external_key: locationExternalKey,
    address_fingerprint: addressFingerprint,
    provider_type: resolvedType?.provider_type || '',
    provider_profile_type: resolvedType?.provider_profile_type || '',
    location_type_code: resolvedType?.location_type_code || '',
    care_setting_code: resolvedType?.care_setting_code || '',
    organization_type_code: nationalOrganizationTypeCode(row, resolvedType),
    classification_contract_version: 'viasee-directory-location-first-v1',
    national_original_import_readiness: clean(row.import_readiness, 120),
    import_readiness: 'candidate_for_manual_review',
    national_directory_candidate: true,
  };
}

function nationalSelectionReasons(row = {}) {
  const reasons = [];
  const originalReadiness = clean(row.national_original_import_readiness || row.import_readiness, 120);
  const researchStatus = clean(row.research_status, 120);
  const operationalStatus = clean(row.operational_status, 120);
  if (['not_eligible'].includes(originalReadiness) || researchStatus === 'excluded') reasons.push('not_eligible');
  if (originalReadiness === 'blocked_conflict') reasons.push('conflict_requires_review');
  if (!['official_confirmed', 'official_partial'].includes(researchStatus)) reasons.push('source_not_sufficiently_confirmed');
  if (operationalStatus !== 'active_confirmed') reasons.push('activity_not_confirmed');
  if (clean(row.geography_validation_error, 120)) reasons.push(clean(row.geography_validation_error, 120));
  const pseudoReason = nationalPseudoRowReason(row);
  if (pseudoReason) reasons.push(pseudoReason);
  for (const field of [
    'location_display_name',
    'organization_display_name',
    'official_locality',
    'county_if_confirmed',
    'confirmed_address',
    'official_source_url',
    'locality_siruta_code',
    'county_code',
    'uat_code',
    'uat_name',
    'provider_type',
    'provider_profile_type',
    'organization_type_code',
    'location_type_code',
    'care_setting_code',
  ]) {
    if (!clean(row[field], 4000)) reasons.push(`missing_${field}`);
  }
  return Array.from(new Set(reasons));
}

function nationalRowScore(row = {}) {
  let score = 0;
  if (row.research_status === 'official_confirmed') score += 100;
  if (!clean(row.review_flags, 2000)) score += 20;
  if (clean(row.confirmed_location_phone, 240)) score += 5;
  if (clean(row.confirmed_location_email, 240)) score += 3;
  if (clean(row.confirmed_schedule, 1200)) score += 2;
  if (clean(row.official_source_url, 1200)) score += 10;
  return score;
}

function nationalIdentityKey(row = {}) {
  const external = clean(row.location_external_key, 240);
  if (external) return `external:${external}`;
  const localityKey = normalizeIdentityText(row.official_locality || row.locality_name);
  const addressKey = normalizeAddressForFingerprint(row.confirmed_address || row.address);
  const nameKey = normalizeIdentityText(row.location_display_name || row.location_name);
  if (localityKey && addressKey && nameKey) {
    return `identity:${localityKey}|${addressKey}|${nameKey}`;
  }
  return `source:${clean(row.source_row_key || row.__source_row_key || row.__row_number, 260)}`;
}

function selectRowsForNationalDirectory(rows = []) {
  const excluded = [];
  const bestByIdentity = new Map();
  for (const sourceRow of rows) {
    const row = normalizeNationalDirectoryRow(sourceRow);
    const reasons = nationalSelectionReasons(row);
    if (reasons.length) {
      excluded.push({ row, reasons });
      continue;
    }
    const key = nationalIdentityKey(row);
    const current = bestByIdentity.get(key) || null;
    if (!current || nationalRowScore(row) > nationalRowScore(current)) {
      if (current) excluded.push({ row: current, reasons: ['duplicate_in_national_package'] });
      bestByIdentity.set(key, row);
    } else {
      excluded.push({ row, reasons: ['duplicate_in_national_package'] });
    }
  }
  const selected = Array.from(bestByIdentity.values()).sort((left, right) => (
    clean(left.official_locality, 160).localeCompare(clean(right.official_locality, 160), 'ro')
    || clean(left.organization_display_name, 240).localeCompare(clean(right.organization_display_name, 240), 'ro')
    || clean(left.location_display_name, 240).localeCompare(clean(right.location_display_name, 240), 'ro')
  ));
  const reasonCounts = {};
  for (const item of excluded) {
    for (const reason of item.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  return {
    selected,
    excluded,
    summary: {
      source_rows: rows.length,
      selected_rows: selected.length,
      excluded_rows: excluded.length,
      reason_counts: reasonCounts,
    },
  };
}

function recomputeNationalSelectionSummary(selected = [], excluded = [], sourceRows = 0) {
  const reasonCounts = {};
  for (const item of excluded) {
    for (const reason of asArray(item.reasons)) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  return {
    source_rows: Number(sourceRows || (selected.length + excluded.length)),
    selected_rows: selected.length,
    excluded_rows: excluded.length,
    reason_counts: reasonCounts,
  };
}

function existingLocationIdentityKey(location = {}) {
  const localityKey = normalizeIdentityText(location.locality_name || location.city);
  const addressKey = normalizeAddressForFingerprint(location.address);
  const nameKey = normalizeIdentityText(location.name || location.public_display_name);
  if (!localityKey || !addressKey || !nameKey) return '';
  return `loc:${stableTextHash([localityKey, addressKey, nameKey].join('|'))}`;
}

async function excludeControlledOrAmbiguousLiveMatches(svc, selection) {
  const [locations, states] = await Promise.all([
    requireDirectoryRows(
      svc.entities.ProviderLocation.list('name', 5000),
      'locatiilor existente pentru deduplicarea campaniei nationale',
    ),
    requireDirectoryRows(
      svc.entities.ProviderLocationDirectoryState.filter({ state_status: 'active' }, '-created_date', 5000),
      'starilor de director pentru deduplicarea campaniei nationale',
    ),
  ]);
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const statesByLocationId = new Map();
  for (const state of states) {
    if (state.location_id && !statesByLocationId.has(state.location_id)) statesByLocationId.set(state.location_id, state);
  }
  const locationIdsByExternalKey = new Map();
  const append = (map, key, value) => {
    if (!key) return;
    const values = map.get(key) || [];
    if (!values.includes(value)) values.push(value);
    map.set(key, values);
  };
  for (const state of states) append(locationIdsByExternalKey, clean(state.directory_external_key, 240), state.location_id);
  for (const location of locations) append(locationIdsByExternalKey, existingLocationIdentityKey(location), location.id);

  const selected = [];
  const excluded = [...selection.excluded];
  for (let index = 0; index < selection.selected.length; index += 1) {
    const row = selection.selected[index];
    const normalized = normalizeDirectoryImportRow(row, {
      source_version: 'national-preflight',
      source_row_key: clean(row.source_row_key || row.__source_row_key || `national:${index + 1}`, 240),
      row_number: index + 1,
    });
    const fallbackKey = existingLocationIdentityKey({
      locality_name: normalized.locality_name,
      address: normalized.address,
      name: normalized.location_name,
    });
    const candidates = Array.from(new Set([
      ...(locationIdsByExternalKey.get(normalized.location_external_key) || []),
      ...(locationIdsByExternalKey.get(fallbackKey) || []),
    ]));
    if (candidates.length > 1) {
      excluded.push({ row, reasons: ['ambiguous_existing_location_match'] });
      continue;
    }
    if (candidates.length === 1) {
      const location = locationsById.get(candidates[0]) || null;
      const controlStatus = clean(location?.profile_control_status || 'directory', 80);
      if (['claimed', 'verified', 'suspended'].includes(controlStatus)) {
        excluded.push({ row, reasons: ['existing_controlled_location'] });
        continue;
      }
      const state = statesByLocationId.get(location?.id) || null;
      const alreadyPublished = location?.status === 'publicata'
        && location?.public_visibility_status === 'approved'
        && state?.publication_status === 'published'
        && state?.control_status === 'directory';
      if (alreadyPublished) {
        excluded.push({ row, reasons: ['already_published_directory'] });
        continue;
      }
    }
    selected.push(row);
  }
  return {
    selected,
    excluded,
    summary: recomputeNationalSelectionSummary(selected, excluded, selection.summary?.source_rows),
  };
}

function safeHostname(value) {
  const text = clean(value, 1200);
  if (!text) return '';
  try {
    return new URL(text).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_error) {
    return '';
  }
}

async function reconcileNationalOrganizationKeys(svc, selection) {
  const organizations = await requireDirectoryRows(
    svc.entities.ProviderOrganization.list('name', 5000),
    'organizatiilor live pentru reconcilierea campaniei nationale',
  );
  const byExternalKey = new Map();
  const byName = new Map();
  const byDomain = new Map();
  const append = (map, key, organization) => {
    if (!key) return;
    const values = map.get(key) || [];
    values.push(organization);
    map.set(key, values);
  };
  for (const organization of organizations) {
    append(byExternalKey, clean(organization.directory_external_key, 240), organization);
    append(byName, normalizeIdentityText(organization.public_display_name || organization.name), organization);
    append(byDomain, safeHostname(organization.website_url || organization.website), organization);
  }
  const selected = [];
  const excluded = [...selection.excluded];
  for (const row of selection.selected) {
    const sourceExternalKey = clean(row.organization_external_key, 240);
    const externalMatches = sourceExternalKey ? byExternalKey.get(sourceExternalKey) || [] : [];
    if (externalMatches.length > 1) {
      excluded.push({ row, reasons: ['ambiguous_existing_organization_external_key'] });
      continue;
    }
    if (externalMatches.length === 1) {
      selected.push({ ...row, target_organization_id: externalMatches[0].id });
      continue;
    }
    const nameMatches = byName.get(normalizeIdentityText(row.organization_display_name)) || [];
    const domainMatches = byDomain.get(safeHostname(row.official_source_url || row.website)) || [];
    const candidates = Array.from(new Map(
      [...nameMatches, ...domainMatches].map((organization) => [organization.id, organization]),
    ).values());
    if (candidates.length > 1) {
      excluded.push({ row, reasons: ['ambiguous_existing_organization_match'] });
      continue;
    }
    if (candidates.length === 1) {
      const existingKey = clean(candidates[0].directory_external_key, 240);
      selected.push({
        ...row,
        ...(existingKey ? { organization_external_key: existingKey } : {}),
        target_organization_id: candidates[0].id,
      });
      continue;
    }
    selected.push(row);
  }
  return {
    selected,
    excluded,
    summary: recomputeNationalSelectionSummary(selected, excluded, selection.summary?.source_rows),
  };
}

function packNationalRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = clean(row.organization_external_key, 240)
      || `org-name:${normalizeIdentityText(row.organization_display_name)}`;
    const values = groups.get(key) || [];
    values.push(row);
    groups.set(key, values);
  }
  const batches = [];
  let current = [];
  const flush = () => {
    if (current.length) batches.push(current);
    current = [];
  };
  const orderedGroups = Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  for (const [, groupRows] of orderedGroups) {
    if (groupRows.length > MAX_ROWS_PER_BATCH) {
      flush();
      for (let offset = 0; offset < groupRows.length; offset += MAX_ROWS_PER_BATCH) {
        batches.push(groupRows.slice(offset, offset + MAX_ROWS_PER_BATCH));
      }
      continue;
    }
    if (current.length + groupRows.length > MAX_ROWS_PER_BATCH) flush();
    current.push(...groupRows);
  }
  flush();
  return batches;
}

async function nationalRowsFromPrivateSourceBase64(sourceBase64, sourceFilename = '') {
  const sourceBytes = decodeBase64Bytes(sourceBase64);
  if (sourceBytes.byteLength > 8_000_000) throw new Error('Fisierul privat depaseste limita de 8 MB.');
  const sourceSha256 = await sha256HexBytes(sourceBytes);
  if (/\.json$/i.test(clean(sourceFilename, 240))) {
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(sourceBytes));
    } catch (_error) {
      throw new Error('Registrul master JSON este invalid.');
    }
    const rows = rowsFromPayload(payload);
    if (!rows.length) throw new Error('Registrul master JSON nu contine randuri de locatie.');
    return {
      archive_filename: clean(sourceFilename, 240),
      archive_sha256: sourceSha256,
      rows,
      source_kind: 'master_json',
    };
  }
  let entries;
  try {
    entries = unzipSync(sourceBytes);
  } catch (_error) {
    throw new Error('Fisierul trebuie sa fie registrul master JSON sau o arhiva ZIP valida.');
  }
  const names = Object.keys(entries).filter((name) => !name.endsWith('/') && /\.json$/i.test(name));
  let masterRows = [];
  const aggregateRows = [];
  for (const name of names) {
    const baseName = name.split('/').pop()?.toLowerCase() || '';
    if (/(audit|report|manifest|invalid_required_fields)/.test(baseName)) continue;
    let payload;
    try {
      payload = JSON.parse(strFromU8(entries[name]));
    } catch (_error) {
      continue;
    }
    const rows = rowsFromPayload(payload);
    if (!rows.length) continue;
    if (/master|registry_v8_master|registry_v4_location_first_1329/.test(baseName) || rows.length >= 1000) {
      masterRows = rows;
      break;
    }
    if (
      /batch/.test(baseName)
      || /mapped_requires_review/.test(baseName)
      || /requires_explicit_organization_mapping/.test(baseName)
      || /blocked_and_not_eligible/.test(baseName)
    ) aggregateRows.push(...rows);
  }
  const rows = masterRows.length ? masterRows : aggregateRows;
  if (!rows.length) throw new Error('Arhiva nationala nu contine registrul master sau randuri de director recunoscute.');
  const unique = new Map();
  for (const row of rows) {
    const key = clean(row.__source_row_key || row.source_row_key, 260)
      || nationalIdentityKey(row);
    if (!unique.has(key)) unique.set(key, row);
  }
  return {
    archive_filename: clean(sourceFilename, 240),
    archive_sha256: sourceSha256,
    rows: Array.from(unique.values()),
    source_kind: masterRows.length ? 'zip_master_json' : 'zip_aggregated_batches',
  };
}

async function descriptorsForNationalSelection(selection, archiveSha256) {
  const batches = packNationalRows(selection.selected);
  if (batches.length > MAX_BATCHES) throw new Error(`Campania nationala necesita ${batches.length} loturi; limita este ${MAX_BATCHES}.`);
  const descriptors = [];
  for (let index = 0; index < batches.length; index += 1) {
    const rows = batches[index];
    const sourceSha256 = await sha256HexText(stableStringify(rows));
    descriptors.push({
      source_url: `archive://${archiveSha256}/national-directory-batch-${String(index + 1).padStart(2, '0')}.json`,
      source_filename: `national-directory-batch-${String(index + 1).padStart(2, '0')}.json`,
      source_sha256: sourceSha256,
      expected_sha256: sourceSha256,
      expected_rows: rows.length,
      organization_count: new Set(rows.map((row) => clean(row.organization_external_key || row.organization_display_name, 300))).size,
      inline_rows: rows,
      national_selection_summary: selection.summary,
    });
  }
  return descriptors;
}

async function canonicalGeographyMap(svc, rows = []) {
  const codes = Array.from(new Set(rows.map((row) => clean(row?.locality_siruta_code, 40)).filter(Boolean)));
  const geographicRows = codes.length ? await requireDirectoryRows(
    svc.entities.GeographicLocality.filter(
      { siruta_code: { $in: codes }, is_active: true },
      'siruta_code',
      Math.max(10, codes.length * 3),
    ),
    'geografiei canonice pentru importul automat',
  ) : [];
  const bySiruta = new Map();
  for (const geography of geographicRows) {
    const code = clean(geography.siruta_code, 40);
    if (code && !bySiruta.has(code)) bySiruta.set(code, geography);
  }
  return bySiruta;
}

async function enrichRowsWithCanonicalGeography(svc, rows = [], existingMap = null) {
  const bySiruta = existingMap instanceof Map ? existingMap : await canonicalGeographyMap(svc, rows);
  return rows.map((row) => {
    const code = clean(row?.locality_siruta_code, 40);
    const geography = bySiruta.get(code) || null;
    let geographyValidationError = '';
    if (!geography) geographyValidationError = 'geography_siruta_not_found';
    else if (
      clean(row?.county_if_confirmed, 160)
      && normalizeIdentityText(row.county_if_confirmed) !== normalizeIdentityText(geography.county_name)
    ) geographyValidationError = 'geography_county_mismatch';
    return {
      ...row,
      county_name: clean(geography?.county_name || row?.county_if_confirmed, 160),
      county_code: clean(geography?.county_code, 40),
      uat_code: clean(geography?.uat_code, 40),
      uat_name: clean(geography?.uat_name, 160),
      geography_validation_error: geographyValidationError,
    };
  });
}

function automaticSelectionReasons(row = {}) {
  const reasons = [];
  if (clean(row.import_readiness, 80) !== 'candidate_for_manual_review') reasons.push('not_candidate_for_manual_review');
  if (clean(row.research_status, 80) !== 'official_confirmed') reasons.push('research_not_official_confirmed');
  if (clean(row.operational_status, 80) !== 'active_confirmed') reasons.push('operational_status_not_active_confirmed');
  if (clean(row.review_flags, 2000)) reasons.push('review_flags_present');
  if (clean(row.geography_validation_error, 120)) reasons.push(clean(row.geography_validation_error, 120));
  for (const field of [
    'location_display_name',
    'organization_display_name',
    'official_locality',
    'county_if_confirmed',
    'confirmed_address',
    'official_source_url',
    'locality_siruta_code',
    'county_code',
    'uat_code',
    'uat_name',
    'provider_type',
    'provider_profile_type',
    'organization_type_code',
    'location_type_code',
    'care_setting_code',
  ]) {
    if (!clean(row[field], 4000)) reasons.push(`missing_${field}`);
  }
  if (
    clean(row.classification_contract_version, 120)
    && clean(row.classification_contract_version, 120) !== 'viasee-directory-location-first-v1'
  ) reasons.push('classification_contract_version_mismatch');
  return reasons;
}

function selectRowsForAutomaticImport(rows = []) {
  const selected = [];
  const excluded = [];
  const reasonCounts = {};
  for (const row of rows) {
    const reasons = automaticSelectionReasons(row);
    if (!reasons.length) selected.push(row);
    else {
      excluded.push({
        source_row_key: clean(row?.source_row_key || row?.__source_row_key, 220),
        location_name: clean(row?.location_display_name || row?.location_name, 300),
        reasons,
      });
      for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  return {
    selected,
    excluded,
    summary: {
      source_rows: rows.length,
      selected_rows: selected.length,
      excluded_rows: excluded.length,
      reason_counts: reasonCounts,
    },
  };
}

function selectionForRun(run, rows = []) {
  return runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL
    ? selectRowsForNationalDirectory(rows)
    : selectRowsForAutomaticImport(rows);
}

function approvalPhrase(run) {
  return `AUTOIMPORT ${clean(run.run_key, 120)} ${clean(run.package_sha256, 80).slice(0, 12)} ${Number(run.total_batches || 0)}`;
}

function runKeyFor(packageSha256) {
  return `AUTODIR-${clean(packageSha256, 80).slice(0, 12)}`;
}

function autoItemRecord(runId, runKey, index, item) {
  const itemKey = `${runKey}-${String(index + 1).padStart(3, '0')}`;
  return {
    run_id: runId,
    sequence: index + 1,
    item_key: itemKey,
    status: item.selected_rows > 0 ? 'pending' : 'skipped',
    step: item.selected_rows > 0 ? 'fetch_source' : 'skipped_no_strictly_clean_rows',
    source_url: item.source_url,
    source_filename: item.source_filename,
    source_sha256: item.source_sha256,
    selected_sha256: item.selected_sha256,
    expected_sha256: item.expected_sha256,
    expected_rows: item.selected_rows,
    source_rows: item.source_rows,
    selected_rows: item.selected_rows,
    excluded_rows: item.excluded_rows,
    selection_result_json: JSON.stringify(item.selection_summary),
    source_payload_json: '',
    organization_count: item.organization_count,
    snapshot_id: '',
    batch_id: '',
    execution_lock_token: '',
    applied_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    safety_result_json: '{}',
    result_json: item.selected_rows > 0 ? '{}' : JSON.stringify({ selection: item.selection_summary }),
    failure_message: '',
    ...(item.selected_rows > 0 ? {} : { started_at: now(), finished_at: now() }),
  };
}

async function createRun(svc, user, input) {
  const manifestUrl = clean(input.manifest_url, 2000);
  const mode = campaignMode(input.campaign_mode);
  const publicationMode = PUBLICATION_MODE_BASIC;
  let archiveMetadata = null;
  let descriptors = [];
  let campaignSourceRows = 0;
  let campaignExcludedRows = 0;
  let campaignSelectionSummary = null;
  if (mode === CAMPAIGN_MODE_NATIONAL) {
    if (!input.zip_base64) return response({ error: 'Campania nationala necesita registrul master JSON sau arhiva ZIP privata.' }, 400);
    archiveMetadata = await nationalRowsFromPrivateSourceBase64(
      input.zip_base64,
      clean(input.zip_filename, 240),
    );
    const geographyMap = await canonicalGeographyMap(svc, archiveMetadata.rows);
    const canonicalRows = await enrichRowsWithCanonicalGeography(svc, archiveMetadata.rows, geographyMap);
    const selectedNationalRows = selectRowsForNationalDirectory(canonicalRows);
    const liveSafeSelection = await excludeControlledOrAmbiguousLiveMatches(svc, selectedNationalRows);
    const nationalSelection = await reconcileNationalOrganizationKeys(svc, liveSafeSelection);
    campaignSourceRows = nationalSelection.summary.source_rows;
    campaignExcludedRows = nationalSelection.summary.excluded_rows;
    campaignSelectionSummary = {
      ...nationalSelection.summary,
      source_kind: archiveMetadata.source_kind || 'private_source',
    };
    descriptors = await descriptorsForNationalSelection(nationalSelection, archiveMetadata.archive_sha256);
  } else if (input.zip_base64) {
    archiveMetadata = await descriptorsFromZipBase64(
      input.zip_base64,
      clean(input.zip_filename, 240),
    );
    descriptors = archiveMetadata.descriptors;
  } else {
    descriptors = asArray(input.batch_urls)
      .map((entry, index) => descriptorFor(entry, index))
      .filter(Boolean);
    if (manifestUrl) {
      const manifest = await fetchJson(manifestUrl, clean(input.manifest_sha256, 80));
      descriptors = descriptorsFromManifest(manifest.payload, manifestUrl);
    }
  }
  const unique = new Map();
  for (const descriptor of descriptors) {
    if (!unique.has(descriptor.source_url)) unique.set(descriptor.source_url, descriptor);
  }
  descriptors = Array.from(unique.values()).slice(0, MAX_BATCHES);
  if (!descriptors.length) return response({ error: 'Nu au fost gasite loturi JSON valide in arhiva, manifest sau lista de URL-uri.' }, 400);
  for (const descriptor of descriptors) {
    if (descriptor.expected_rows > MAX_ROWS_PER_BATCH) {
      return response({ error: `${descriptor.source_filename} depaseste ${MAX_ROWS_PER_BATCH} de randuri.` }, 400);
    }
    if (descriptor.expected_sha256 && !/^[a-f0-9]{64}$/.test(descriptor.expected_sha256)) {
      return response({ error: `SHA-256 invalid pentru ${descriptor.source_filename}.` }, 400);
    }
  }
  const loadedDescriptors = [];
  const allSourceRows = [];
  for (const descriptor of descriptors) {
    let sourceRows = Array.isArray(descriptor.inline_rows) ? descriptor.inline_rows : [];
    let sourceSha256 = clean(descriptor.source_sha256, 80).toLowerCase();
    if (!sourceRows.length) {
      const fetched = await fetchJson(descriptor.source_url, descriptor.expected_sha256);
      sourceRows = rowsFromPayload(fetched.payload);
      sourceSha256 = fetched.sha256;
    }
    if (!sourceRows.length || sourceRows.length > MAX_ROWS_PER_BATCH) {
      return response({ error: `${descriptor.source_filename} are ${sourceRows.length} randuri; limita este ${MAX_ROWS_PER_BATCH}.` }, 400);
    }
    if (descriptor.expected_rows > 0 && descriptor.expected_rows !== sourceRows.length) {
      return response({ error: `${descriptor.source_filename}: manifestul declara ${descriptor.expected_rows} randuri, fisierul contine ${sourceRows.length}.` }, 400);
    }
    loadedDescriptors.push({ ...descriptor, source_sha256: sourceSha256, source_rows_payload: sourceRows });
    allSourceRows.push(...sourceRows);
  }
  const geographyMap = await canonicalGeographyMap(svc, allSourceRows);
  const preparedDescriptors = [];
  for (const descriptor of loadedDescriptors) {
    const sourceRows = descriptor.source_rows_payload;
    const canonicalRows = await enrichRowsWithCanonicalGeography(svc, sourceRows, geographyMap);
    const selection = mode === CAMPAIGN_MODE_NATIONAL
      ? {
        selected: canonicalRows,
        excluded: [],
        summary: {
          source_rows: canonicalRows.length,
          selected_rows: canonicalRows.length,
          excluded_rows: 0,
          reason_counts: {},
        },
      }
      : selectRowsForAutomaticImport(canonicalRows);
    const selectedSha256 = await sha256HexText(stableStringify(selection.selected));
    preparedDescriptors.push({
      ...descriptor,
      source_rows_payload: undefined,
      source_rows: sourceRows.length,
      selected_rows: selection.selected.length,
      excluded_rows: selection.excluded.length,
      selected_sha256: selectedSha256,
      selected_payload_json: JSON.stringify(selection.selected),
      selection_summary: selection.summary,
      organization_count: new Set(selection.selected.map((row) => clean(row.organization_external_key || row.organization_display_name, 300)).filter(Boolean)).size,
    });
  }
  descriptors = preparedDescriptors;
  if (mode === CAMPAIGN_MODE_STRICT) {
    campaignSourceRows = descriptors.reduce((total, item) => total + Number(item.source_rows || 0), 0);
    campaignExcludedRows = descriptors.reduce((total, item) => total + Number(item.excluded_rows || 0), 0);
    campaignSelectionSummary = {
      source_rows: campaignSourceRows,
      selected_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
      excluded_rows: campaignExcludedRows,
      reason_counts: {},
    };
  }
  const packageSha256 = await sha256HexText(stableStringify({
    campaign_mode: mode,
    selection_summary: campaignSelectionSummary,
    batches: descriptors.map((item) => ({
    source_url: item.source_url,
    source_sha256: item.source_sha256,
    selected_sha256: item.selected_sha256,
    source_rows: item.source_rows,
    selected_rows: item.selected_rows,
    excluded_rows: item.excluded_rows,
  })),
  }));
  const runKey = clean(input.run_key, 120) || runKeyFor(packageSha256);
  const existing = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportRun.filter({ run_key: runKey }, '-created_date', 5),
    'rularilor automate existente',
  );
  if (existing[0]) {
    const run = existing[0];
    const currentItems = await requireDirectoryRows(
      svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, 'sequence', 100),
      'loturilor rularii automate existente',
    );
    if (run.status !== 'awaiting_approval') {
      return response({
        success: true,
        reused: true,
        run,
        items: currentItems,
        approval_confirmation: approvalPhrase(run),
      });
    }
    const bySequence = new Map(currentItems.map((entry) => [Number(entry.sequence), entry]));
    let repairedItems = 0;
    for (let index = 0; index < descriptors.length; index += 1) {
      const descriptor = descriptors[index];
      const expectedRecord = autoItemRecord(run.id, runKey, index, descriptor);
      let existingItem = bySequence.get(index + 1) || null;
      if (!existingItem) {
        existingItem = await svc.entities.DirectoryAutoImportItem.create(expectedRecord);
        repairedItems += 1;
      }
      await persistPayloadChunks(
        svc,
        run.id,
        expectedRecord.item_key,
        descriptor.selected_payload_json,
        descriptor.selected_rows,
      );
      if (clean(existingItem.source_payload_json, 200_000)) {
        await svc.entities.DirectoryAutoImportItem.update(existingItem.id, { source_payload_json: '' });
      }
    }
    const runValues = {
      campaign_mode: mode,
      publication_mode: publicationMode,
      total_batches: descriptors.length,
      skipped_batches: descriptors.filter((item) => Number(item.selected_rows || 0) === 0).length,
      excluded_rows: campaignExcludedRows,
      total_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
      failure_message: '',
    };
    await svc.entities.DirectoryAutoImportRun.update(run.id, runValues);
    const items = await requireDirectoryRows(
      svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, 'sequence', 100),
      'loturilor rularii automate reparate',
    );
    const repairedRun = { ...run, ...runValues };
    return response({
      success: true,
      reused: true,
      repaired: repairedItems > 0,
      repaired_items: repairedItems,
      run: repairedRun,
      items,
      approval_confirmation: approvalPhrase(repairedRun),
      preflight: {
        source_rows: campaignSourceRows,
        selected_rows: runValues.total_rows,
        excluded_rows: campaignExcludedRows,
        skipped_batches: runValues.skipped_batches,
      },
    });
  }
  const safetyPolicy = {
    campaign_mode: mode,
    publication_mode: publicationMode,
    max_rows_per_batch: MAX_ROWS_PER_BATCH,
    execution_chunk: EXECUTION_CHUNK,
    requires_zero_snapshot_blocks: true,
    requires_zero_snapshot_duplicates: true,
    requires_zero_snapshot_warnings: mode === CAMPAIGN_MODE_STRICT,
    allowed_actions: mode === CAMPAIGN_MODE_NATIONAL
      ? [
        'create_organization_and_location',
        'create_location_use_existing_organization',
        'update_existing_location',
        'skip_unchanged',
      ]
      : Array.from(ALLOWED_ACTIONS),
    exact_external_key_required_for_existing_organization: true,
    source_filter: mode === CAMPAIGN_MODE_NATIONAL
      ? {
        import_readiness: 'normalized_candidate',
        research_status: ['official_confirmed', 'official_partial'],
        operational_status: 'active_confirmed',
        conflicts_are_excluded: true,
        deterministic_type_inference_allowed: true,
      }
      : {
        import_readiness: 'candidate_for_manual_review',
        research_status: 'official_confirmed',
        operational_status: 'active_confirmed',
        review_flags_must_be_empty: true,
        explicit_location_first_classification_required: true,
      },
    publishes_profiles: true,
    publication_trust_label: 'directory_unclaimed_unverified',
    verifies_profiles: false,
    creates_services: false,
    grants_access: false,
  };
  const run = await svc.entities.DirectoryAutoImportRun.create({
    run_key: runKey,
    contract_version: DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION,
    campaign_mode: mode,
    publication_mode: publicationMode,
    status: 'awaiting_approval',
    manifest_url: manifestUrl,
    package_sha256: packageSha256,
    total_batches: descriptors.length,
    completed_batches: 0,
    blocked_batches: 0,
    failed_batches: 0,
    skipped_batches: descriptors.filter((item) => Number(item.selected_rows || 0) === 0).length,
    excluded_rows: campaignExcludedRows,
    total_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
    applied_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    current_sequence: 1,
    current_step: 'awaiting_approval',
    safety_policy_json: JSON.stringify(safetyPolicy),
    result_json: '{}',
    approval_token_hash: '',
    created_by_user_id: user.id,
    created_by_email: user.email || '',
    failure_message: '',
    notes: clean(input.notes, 2000) || (mode === CAMPAIGN_MODE_NATIONAL
      ? 'Campanie nationala automata: profile de director neconfirmate, publicate la nivel basic sau summary.'
      : 'Import automat controlat cu publicare ca profil de director neconfirmat.'),
  });
  for (let index = 0; index < descriptors.length; index += 1) {
    const item = descriptors[index];
    const itemRecord = autoItemRecord(run.id, runKey, index, item);
    await svc.entities.DirectoryAutoImportItem.create(itemRecord);
    await persistPayloadChunks(
      svc,
      run.id,
      itemRecord.item_key,
      item.selected_payload_json,
      item.selected_rows,
    );
  }
  await writeAudit(svc, user, 'DirectoryAutoImportRun', run.id, 'directory_auto_import_run_created', {}, {
    run_key: runKey,
    package_sha256: packageSha256,
    total_batches: descriptors.length,
    selected_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
    excluded_rows: campaignExcludedRows,
    campaign_mode: mode,
  });
  return response({
    success: true,
    run,
    approval_confirmation: approvalPhrase(run),
    preflight: {
      source_rows: campaignSourceRows,
      selected_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
      excluded_rows: campaignExcludedRows,
      skipped_batches: descriptors.filter((item) => Number(item.selected_rows || 0) === 0).length,
      campaign_mode: mode,
    },
  });
}

async function listRuns(svc, input) {
  const limit = Math.max(1, Math.min(50, Number(input.limit || 20)));
  const runs = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportRun.list('-created_date', limit),
    'rularilor automate de import',
  );
  const result = [];
  for (const run of runs) {
    const items = await requireDirectoryRows(
      svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, 'sequence', 100),
      'loturilor rularii automate',
    );
    result.push({ ...run, items, approval_confirmation: approvalPhrase(run) });
  }
  return response({ success: true, runs: result, contract_version: DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION });
}

async function approveRun(svc, user, input) {
  const run = await getDirectoryEntityOrNull(
    svc.entities.DirectoryAutoImportRun.get(clean(input.run_id, 120)),
    'rularii automate pentru aprobare',
  );
  if (!run) return response({ error: 'Rularea automata nu a fost gasita.' }, 404);
  if (run.status !== 'awaiting_approval') return response({ error: 'Rularea nu mai asteapta aprobarea.' }, 409);
  const items = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, 'sequence', 100),
    'loturilor rularii automate pentru aprobarea finala',
  );
  if (items.length !== Number(run.total_batches || 0)) {
    return response({
      error: `Analiza este partiala: ${items.length} din ${Number(run.total_batches || 0)} loturi sunt persistate. Reincarca aceeasi arhiva pentru reparare.`,
      requires_repair: true,
    }, 409);
  }
  const sequences = new Set(items.map((item) => Number(item.sequence)));
  for (let sequence = 1; sequence <= Number(run.total_batches || 0); sequence += 1) {
    if (!sequences.has(sequence)) {
      return response({ error: `Lipseste lotul ${sequence}. Reincarca aceeasi arhiva pentru reparare.`, requires_repair: true }, 409);
    }
  }
  for (const item of items) {
    if (Number(item.selected_rows || 0) < 1) continue;
    const rows = await loadItemSourceRows(svc, item);
    if (!Array.isArray(rows.rows) || rows.rows.length !== Number(item.selected_rows || 0)) {
      return response({ error: `Payload incomplet pentru ${item.item_key}. Reincarca arhiva pentru reparare.`, requires_repair: true }, 409);
    }
    const selectedSha256 = await sha256HexText(stableStringify(rows.rows));
    if (selectedSha256 !== clean(item.selected_sha256, 80)) {
      return response({ error: `SHA invalid pentru ${item.item_key}. Reincarca arhiva pentru reparare.`, requires_repair: true }, 409);
    }
  }
  const expected = approvalPhrase(run);
  if (clean(input.confirmation, 300) !== expected) {
    return response({ error: 'Confirmarea nu corespunde.', expected_confirmation: expected }, 400);
  }
  const approvedAt = now();
  await svc.entities.DirectoryAutoImportRun.update(run.id, {
    status: 'approved',
    current_step: 'scheduled',
    approval_token_hash: stableTextHash(expected),
    approved_by_user_id: user.id,
    approved_by_email: user.email || '',
    approved_at: approvedAt,
    started_at: approvedAt,
    failure_message: '',
  });
  await writeAudit(svc, user, 'DirectoryAutoImportRun', run.id, 'directory_auto_import_run_approved', {}, {
    run_key: run.run_key,
    total_batches: run.total_batches,
  });
  return response({ success: true, run_id: run.id, status: 'approved' });
}

async function changeRunStatus(svc, user, input, nextStatus) {
  const run = await getDirectoryEntityOrNull(
    svc.entities.DirectoryAutoImportRun.get(clean(input.run_id, 120)),
    'rularii automate pentru schimbarea starii',
  );
  if (!run) return response({ error: 'Rularea automata nu a fost gasita.' }, 404);
  const allowed = {
    paused: new Set(['approved', 'running']),
    approved: new Set(['paused']),
    cancelled: new Set(['awaiting_approval', 'approved', 'running', 'paused', 'blocked']),
  };
  if (!allowed[nextStatus]?.has(run.status)) {
    return response({ error: `Tranzitie invalida: ${run.status} -> ${nextStatus}.` }, 409);
  }
  await svc.entities.DirectoryAutoImportRun.update(run.id, {
    status: nextStatus,
    current_step: nextStatus === 'approved' ? 'scheduled' : nextStatus,
    failure_message: nextStatus === 'approved' ? '' : run.failure_message || '',
    finished_at: nextStatus === 'cancelled' ? now() : null,
    execution_lock_token: '',
    execution_lock_expires_at: null,
  });
  await writeAudit(svc, user, 'DirectoryAutoImportRun', run.id, `directory_auto_import_run_${nextStatus}`, { status: run.status }, { status: nextStatus });
  return response({ success: true, run_id: run.id, status: nextStatus });
}

function lockExpiry() {
  return new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
}

async function acquireRunLock(svc, run) {
  const expiry = run.execution_lock_expires_at ? new Date(run.execution_lock_expires_at).getTime() : 0;
  if (clean(run.execution_lock_token, 200) && expiry > Date.now()) return null;
  const token = `auto_${Date.now()}_${crypto.randomUUID()}`;
  await svc.entities.DirectoryAutoImportRun.update(run.id, {
    execution_lock_token: token,
    execution_lock_expires_at: lockExpiry(),
    last_heartbeat_at: now(),
  });
  return token;
}

async function releaseRunLock(svc, runId, values = {}) {
  await svc.entities.DirectoryAutoImportRun.update(runId, {
    ...values,
    execution_lock_token: '',
    execution_lock_expires_at: null,
    last_heartbeat_at: now(),
  });
}

async function blockItem(svc, run, item, errors, stage) {
  const message = asArray(errors).map((value) => clean(value, 500)).filter(Boolean).join(' | ') || 'Lot blocat de verificarea automata.';
  await svc.entities.DirectoryAutoImportItem.update(item.id, {
    status: 'blocked',
    step: stage,
    failure_message: message,
    safety_result_json: JSON.stringify({ safe: false, stage, errors: asArray(errors) }),
    finished_at: now(),
    last_heartbeat_at: now(),
  });
  await releaseRunLock(svc, run.id, {
    status: 'blocked',
    current_step: stage,
    failure_message: message,
  });
  return { success: false, blocked: true, error: message };
}

async function inspectSafety(svc, snapshot, batch, run) {
  const errors = [];
  const mode = runCampaignMode(run);
  const national = mode === CAMPAIGN_MODE_NATIONAL;
  const allowedActions = new Set(national
    ? ['create_organization_and_location', 'create_location_use_existing_organization', 'update_existing_location', 'skip_unchanged']
    : Array.from(ALLOWED_ACTIONS));
  const allowedNationalWarnings = new Set(['public_contact_missing']);
  if (!snapshot || snapshot.status !== 'ready' || !snapshot.immutable_at) errors.push('snapshot_not_ready');
  if (Number(snapshot?.total_rows || 0) < 1 || Number(snapshot?.total_rows || 0) > MAX_ROWS_PER_BATCH) errors.push('snapshot_row_count_out_of_bounds');
  if (Number(snapshot?.valid_rows || 0) !== Number(snapshot?.total_rows || 0)) errors.push('snapshot_not_all_valid');
  if (Number(snapshot?.blocked_rows || 0)) errors.push('snapshot_has_blocked_rows');
  if (Number(snapshot?.duplicate_rows || 0)) errors.push('snapshot_has_duplicates');
  if (!national && Number(snapshot?.warning_rows || 0)) errors.push('snapshot_has_warnings');
  if (!batch || batch.status !== 'ready') errors.push('batch_not_ready');
  if (Number(batch?.blocked_rows || 0)) errors.push('batch_has_blocked_rows');
  if (Number(batch?.ready_rows || 0) !== Number(batch?.total_rows || 0)) errors.push('batch_not_all_ready');
  const summary = safeJson(batch?.summary_json, {});
  for (const key of ['publishes_profiles', 'verifies_profiles', 'creates_services', 'grants_access', 'updates_controlled_profiles', 'updates_controlled_organizations']) {
    if (summary.safety?.[key] === true) errors.push(`unsafe_batch_flag:${key}`);
  }
  const rows = batch?.id ? await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter({ batch_id: batch.id }, 'row_number', MAX_ROWS_PER_BATCH + 5),
    'randurilor lotului automat pentru verificare',
  ) : [];
  if (rows.length !== Number(batch?.total_rows || 0)) errors.push('batch_row_count_mismatch');
  for (const row of rows) {
    const warnings = asArray(safeJson(row.validation_warnings_json, []));
    const validationErrors = asArray(safeJson(row.validation_errors_json, []));
    const normalized = safeJson(row.normalized_payload_json, {});
    const override = safeJson(row.admin_override_json, {});
    const plannedActions = asArray(safeJson(row.planned_actions_json, []));
    if (normalized.import_readiness !== 'candidate_for_manual_review') errors.push(`row_${row.row_number}:not_candidate_for_manual_review`);
    if (national) {
      if (!['official_confirmed', 'official_partial'].includes(normalized.research_status)) errors.push(`row_${row.row_number}:research_not_public_directory_eligible`);
      if (!['source_explicit', 'activity_inferred'].includes(normalized.canonical_type_source)) errors.push(`row_${row.row_number}:canonical_type_unresolved`);
      const unexpectedWarnings = warnings.filter((warning) => !allowedNationalWarnings.has(warning));
      if (unexpectedWarnings.length) errors.push(`row_${row.row_number}:warnings:${unexpectedWarnings.join(',')}`);
    } else {
      if (normalized.research_status !== 'official_confirmed') errors.push(`row_${row.row_number}:research_not_official_confirmed`);
      if (clean(normalized.review_flags, 2000)) errors.push(`row_${row.row_number}:review_flags_present`);
      if (normalized.canonical_type_source !== 'source_explicit') errors.push(`row_${row.row_number}:canonical_type_not_explicit`);
      if (warnings.length) errors.push(`row_${row.row_number}:warnings:${warnings.join(',')}`);
    }
    if (normalized.source_operational_status !== 'active_confirmed' || normalized.operational_status !== 'active') errors.push(`row_${row.row_number}:operational_status_not_active_confirmed`);
    if (normalized.organization_type_source !== 'source_explicit') errors.push(`row_${row.row_number}:organization_type_not_explicit`);
    if (normalized.organization_type_legacy_fallback === true) errors.push(`row_${row.row_number}:organization_type_legacy_fallback`);
    if (validationErrors.length) errors.push(`row_${row.row_number}:errors:${validationErrors.join(',')}`);
    if (!allowedActions.has(row.planned_action)) errors.push(`row_${row.row_number}:unsafe_action:${row.planned_action}`);
    if (Object.keys(override).length) errors.push(`row_${row.row_number}:admin_override_present`);

    const targetLocationId = clean(row.target_location_id, 160);
    if (targetLocationId) {
      if (!national || !['update_existing_location', 'skip_unchanged'].includes(row.planned_action)) {
        errors.push(`row_${row.row_number}:existing_location_target`);
      } else {
        const targetLocation = await getDirectoryEntityOrNull(
          svc.entities.ProviderLocation.get(targetLocationId),
          'locatiei existente reutilizate de campania nationala',
        );
        if (!targetLocation || (targetLocation.profile_control_status || 'directory') !== 'directory') {
          errors.push(`row_${row.row_number}:controlled_existing_location_target`);
        }
      }
    }

    if (row.planned_action === 'create_location_use_existing_organization') {
      if (plannedActions.includes('reuse_planned_organization') && !row.target_organization_id) continue;
      if (!row.target_organization_id) {
        errors.push(`row_${row.row_number}:existing_organization_target_missing`);
        continue;
      }
      const organization = await getDirectoryEntityOrNull(
        svc.entities.ProviderOrganization.get(row.target_organization_id),
        'organizatiei reutilizate de importul automat',
      );
      const explicitNationalTarget = national
        && clean(normalized.target_organization_id, 160) === clean(row.target_organization_id, 160);
      if (!organization) {
        errors.push(`row_${row.row_number}:existing_organization_target_not_found`);
      } else if (!explicitNationalTarget && (
        !normalized.organization_external_key
        || organization.directory_external_key !== normalized.organization_external_key
      )) {
        errors.push(`row_${row.row_number}:existing_organization_external_key_mismatch`);
      }
    }
  }
  return { safe: errors.length === 0, errors, checked_rows: rows.length, campaign_mode: mode };
}

async function refreshProgress(svc, run) {
  const items = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, 'sequence', 100),
    'loturilor rularii automate pentru progres',
  );
  const totals = items.reduce((acc, item) => {
    if (item.status === 'completed') acc.completed_batches += 1;
    if (item.status === 'blocked') acc.blocked_batches += 1;
    if (item.status === 'failed') acc.failed_batches += 1;
    if (item.status === 'skipped') acc.skipped_batches += 1;
    const selectedRows = Number(item.selected_rows || 0);
    const sourceRows = Number(item.source_rows || item.expected_rows || 0);
    acc.total_rows += Number(item.source_rows || 0) > 0 ? selectedRows : sourceRows;
    acc.excluded_rows += Number(item.excluded_rows || 0);
    acc.applied_rows += Number(item.applied_rows || 0);
    acc.skipped_rows += Number(item.skipped_rows || 0);
    acc.failed_rows += Number(item.failed_rows || 0);
    return acc;
  }, { completed_batches: 0, blocked_batches: 0, failed_batches: 0, skipped_batches: 0, excluded_rows: 0, total_rows: 0, applied_rows: 0, skipped_rows: 0, failed_rows: 0 });
  if (runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL) {
    totals.excluded_rows = Number(run.excluded_rows || 0);
  }
  const nextItem = items.find((item) => !TERMINAL_ITEM_STATUSES.has(item.status)) || null;
  const completed = !nextItem
    && totals.blocked_batches === 0
    && totals.failed_batches === 0
    && totals.completed_batches + totals.skipped_batches === items.length;
  const values = {
    ...totals,
    excluded_rows: runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL
      ? Number(run.excluded_rows || 0)
      : totals.excluded_rows,
    current_sequence: nextItem?.sequence || items.length + 1,
    current_step: completed ? 'completed' : (nextItem?.step || run.current_step || 'scheduled'),
    status: completed ? 'completed' : run.status,
    finished_at: completed ? now() : null,
    result_json: JSON.stringify({ total_items: items.length, ...totals }),
  };
  await svc.entities.DirectoryAutoImportRun.update(run.id, values);
  return { items, nextItem, completed, values };
}

async function reopenItemsMissingPublication(svc, run) {
  const items = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, 'sequence', 100),
    'loturilor pentru reconcilierea publicarii',
  );
  let reopened = 0;
  for (const item of items) {
    if (item.status !== 'completed' || !clean(item.batch_id, 160)) continue;
    const result = safeJson(item.result_json, {});
    if (result.publication?.success === true) continue;
    await svc.entities.DirectoryAutoImportItem.update(item.id, {
      status: 'running',
      step: 'publish_batch',
      finished_at: null,
      failure_message: '',
    });
    reopened += 1;
  }
  if (reopened > 0 && run.status === 'completed') {
    await svc.entities.DirectoryAutoImportRun.update(run.id, {
      status: 'running',
      current_step: 'publication_repair',
      finished_at: null,
      failure_message: '',
    });
  }
  return reopened;
}

async function loadItemSourceRows(svc, item) {
  const legacyPersisted = safeJson(item.source_payload_json, null);
  if (Array.isArray(legacyPersisted)) {
    return {
      rows: legacyPersisted,
      source_sha256: clean(item.source_sha256, 80),
      persisted: true,
    };
  }
  const chunkedPersisted = await loadPayloadChunks(svc, item);
  if (Array.isArray(chunkedPersisted)) {
    return {
      rows: chunkedPersisted,
      source_sha256: clean(item.source_sha256, 80),
      persisted: true,
    };
  }
  if (String(item.source_url || '').startsWith('archive://')) {
    throw new Error(`Payloadul privat lipseste pentru ${item.item_key}. Reanalizeaza aceeasi arhiva pentru reparare.`);
  }
  const fetched = await fetchJson(item.source_url, item.source_sha256 || item.expected_sha256);
  return {
    rows: rowsFromPayload(fetched.payload),
    source_sha256: fetched.sha256,
    persisted: false,
  };
}

async function advanceRun(svc, run) {
  if (run.status === 'completed') {
    const reopened = await reopenItemsMissingPublication(svc, run);
    if (!reopened) return { success: true, skipped: true, reason: 'completed' };
    run = { ...run, status: 'running', current_step: 'publication_repair', finished_at: null };
  } else if (['approved', 'running'].includes(run.status)) {
    const reopened = await reopenItemsMissingPublication(svc, run);
    if (reopened) run = { ...run, current_step: 'publication_repair' };
  }
  if (!['approved', 'running'].includes(run.status)) return { success: true, skipped: true, reason: `status:${run.status}` };
  const token = await acquireRunLock(svc, run);
  if (!token) return { success: true, skipped: true, reason: 'locked' };
  try {
    if (run.status === 'approved') {
      await svc.entities.DirectoryAutoImportRun.update(run.id, { status: 'running', current_step: 'starting', started_at: run.started_at || now() });
      run = { ...run, status: 'running' };
    }
    const progress = await refreshProgress(svc, run);
    if (progress.completed) {
      await releaseRunLock(svc, run.id, { status: 'completed', current_step: 'completed', finished_at: now(), failure_message: '' });
      return { success: true, completed: true };
    }
    const item = progress.nextItem;
    if (!item) {
      await releaseRunLock(svc, run.id, { status: 'failed', current_step: 'missing_item', failure_message: 'Nu exista un lot curent.' });
      return { success: false, error: 'Nu exista un lot curent.' };
    }
    const user = automationUser(run);
    const heartbeat = { last_heartbeat_at: now(), failure_message: '' };

    if (item.step === 'fetch_source' || item.status === 'pending') {
      const loadedSource = await loadItemSourceRows(svc, item);
      const sourceRows = loadedSource.rows;
      if (!sourceRows.length || sourceRows.length > MAX_ROWS_PER_BATCH) return blockItem(svc, run, item, [`source_row_count:${sourceRows.length}`], 'fetch_source');
      if (Number(item.expected_rows || 0) > 0 && Number(item.expected_rows) !== sourceRows.length) {
        return blockItem(svc, run, item, [`expected_rows:${item.expected_rows}`, `actual_rows:${sourceRows.length}`], 'fetch_source');
      }
      const canonicalRows = await enrichRowsWithCanonicalGeography(svc, sourceRows);
      const selection = selectionForRun(run, canonicalRows);
      const selectedSha256 = await sha256HexText(stableStringify(selection.selected));
      if (selection.selected.length !== Number(item.selected_rows || 0) || selectedSha256 !== clean(item.selected_sha256, 80)) {
        return blockItem(svc, run, item, [
          `preflight_selection_changed:${item.selected_rows}->${selection.selected.length}`,
          `preflight_selection_sha_changed:${clean(item.selected_sha256, 12)}->${selectedSha256.slice(0, 12)}`,
        ], 'fetch_source');
      }
      if (!selection.selected.length) {
        await svc.entities.DirectoryAutoImportItem.update(item.id, {
          status: 'skipped',
          step: 'skipped_no_strictly_clean_rows',
          source_sha256: loadedSource.source_sha256,
          source_rows: sourceRows.length,
          selected_rows: 0,
          excluded_rows: selection.excluded.length,
          selection_result_json: JSON.stringify(selection.summary),
          skipped_rows: sourceRows.length,
          result_json: JSON.stringify({ selection: selection.summary }),
          failure_message: '',
          started_at: item.started_at || now(),
          finished_at: now(),
          ...heartbeat,
        });
        const latestRun = await getDirectoryEntityOrNull(svc.entities.DirectoryAutoImportRun.get(run.id), 'rularii automate dupa filtrarea lotului') || run;
        const refreshed = await refreshProgress(svc, latestRun);
        await releaseRunLock(svc, run.id, {
          status: refreshed.completed ? 'completed' : 'running',
          current_step: refreshed.completed ? 'completed' : `batch_${refreshed.nextItem?.sequence || item.sequence + 1}:fetch_source`,
          finished_at: refreshed.completed ? now() : null,
          failure_message: '',
        });
        return { success: true, step: 'skipped_no_strictly_clean_rows', excluded_rows: sourceRows.length, run_completed: refreshed.completed };
      }
      const sourceVersion = `${clean(run.run_key, 70)}_${String(item.sequence).padStart(3, '0')}`;
      const created = await responsePayload(await createSnapshot(svc, user, {
        source_name: 'Registru privat VIASEE - import automat controlat',
        source_version: sourceVersion,
        source_sha256: selectedSha256,
        source_format: 'json',
        original_filename: item.source_filename || `auto-batch-${item.sequence}.json`,
        total_rows: selection.selected.length,
        notes: `Rulare automata aprobata ${run.run_key}; lot ${item.sequence}/${run.total_batches}; ${Number(item.excluded_rows || 0)} randuri excluse de filtrul strict; SHA sursa completa ${loadedSource.source_sha256}.`,
        column_map: Object.fromEntries(Object.keys(selection.selected[0] || {}).map((key) => [key, key])),
      }));
      if (created.error) return blockItem(svc, run, item, [created.error], 'create_snapshot');
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: 'snapshot_created',
        step: 'append_rows',
        source_sha256: loadedSource.source_sha256,
        selected_rows: selection.selected.length,
        snapshot_id: created.snapshot.id,
        started_at: item.started_at || now(),
        ...heartbeat,
      });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:append_rows`, failure_message: '' });
      return { success: true, step: 'snapshot_created', selected_rows: selection.selected.length, excluded_rows: Number(item.excluded_rows || 0) };
    }

    if (item.step === 'append_rows') {
      const loadedSource = await loadItemSourceRows(svc, item);
      const sourceRows = loadedSource.rows;
      const canonicalRows = await enrichRowsWithCanonicalGeography(svc, sourceRows);
      const selection = selectionForRun(run, canonicalRows);
      const selectedSha256 = await sha256HexText(stableStringify(selection.selected));
      if (selection.selected.length !== Number(item.selected_rows || 0) || selectedSha256 !== clean(item.selected_sha256, 80)) {
        return blockItem(svc, run, item, [
          `selected_rows_changed:${item.selected_rows}->${selection.selected.length}`,
          `selected_sha_changed:${clean(item.selected_sha256, 12)}->${selectedSha256.slice(0, 12)}`,
        ], 'append_rows');
      }
      const appended = await responsePayload(await appendRows(svc, user, {
        snapshot_id: item.snapshot_id,
        start_row_number: 1,
        rows: selection.selected,
      }));
      if (appended.error) return blockItem(svc, run, item, [appended.error], 'append_rows');
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: 'rows_appended', step: 'validate_snapshot', ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:validate_snapshot`, failure_message: '' });
      return { success: true, step: 'rows_appended', created: appended.created, reused: appended.reused };
    }

    if (item.step === 'validate_snapshot') {
      const finalized = await responsePayload(await finalizeSnapshot(svc, user, {
        snapshot_id: item.snapshot_id, require_siruta: true, limit: 50,
      }));
      if (finalized.error) return blockItem(svc, run, item, [finalized.error], 'validate_snapshot');
      if (finalized.remaining) {
        await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:validate_snapshot`, failure_message: '' });
        return { success: true, step: 'validate_snapshot', remaining: true };
      }
      const snapshot = finalized.snapshot;
      const errors = [];
      if (snapshot.status !== 'ready') errors.push(`snapshot_status:${snapshot.status}`);
      if (Number(snapshot.valid_rows || 0) !== Number(snapshot.total_rows || 0)) errors.push('not_all_rows_valid');
      if (Number(snapshot.blocked_rows || 0)) errors.push(`blocked_rows:${snapshot.blocked_rows}`);
      if (Number(snapshot.duplicate_rows || 0)) errors.push(`duplicate_rows:${snapshot.duplicate_rows}`);
      if (runCampaignMode(run) === CAMPAIGN_MODE_STRICT && Number(snapshot.warning_rows || 0)) errors.push(`warning_rows:${snapshot.warning_rows}`);
      if (errors.length) return blockItem(svc, run, item, errors, 'validate_snapshot');
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: 'validated', step: 'plan_batch', ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:plan_batch`, failure_message: '' });
      return { success: true, step: 'validated' };
    }

    if (item.step === 'plan_batch') {
      const planned = await responsePayload(await planBatch(svc, user, { snapshot_id: item.snapshot_id, limit: 50 }));
      if (planned.error) return blockItem(svc, run, item, [planned.error], 'plan_batch');
      if (planned.remaining) {
        await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:plan_batch`, failure_message: '' });
        return { success: true, step: 'plan_batch', remaining: true };
      }
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: 'planned', step: 'inspect_batch', batch_id: planned.batch.id, ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:inspect_batch`, failure_message: '' });
      return { success: true, step: 'planned', batch_id: planned.batch.id };
    }

    if (item.step === 'inspect_batch') {
      const [snapshot, batch] = await Promise.all([
        getDirectoryEntityOrNull(svc.entities.DirectorySourceSnapshot.get(item.snapshot_id), 'snapshotului automat pentru inspectie'),
        getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), 'lotului automat pentru inspectie'),
      ]);
      const safety = await inspectSafety(svc, snapshot, batch, run);
      if (!safety.safe) return blockItem(svc, run, item, safety.errors, 'inspect_batch');
      const approved = await responsePayload(await approveBatch(svc, user, {
        batch_id: batch.id,
        confirmation: batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows),
      }));
      if (approved.error) return blockItem(svc, run, item, [approved.error], 'approve_batch');
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: 'approved', step: 'execute_batch', safety_result_json: JSON.stringify(safety), ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:execute_batch`, failure_message: '' });
      return { success: true, step: 'approved' };
    }

    if (item.step === 'execute_batch') {
      const batch = await getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), 'lotului automat pentru executie');
      if (!batch) return blockItem(svc, run, item, ['batch_not_found'], 'execute_batch');
      if (clean(batch.failure_message, 1200)) {
        const recovered = await responsePayload(await resumeBatchAfterTransientFailure(svc, user, { batch_id: batch.id, limit: 1 }));
        if (recovered.error) {
          await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:recover_batch`, failure_message: recovered.error });
          return { success: false, retryable: true, error: recovered.error };
        }
        await svc.entities.DirectoryAutoImportItem.update(item.id, { status: 'running', step: 'execute_batch', ...heartbeat });
        await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:execute_batch`, failure_message: '' });
        return { success: true, step: 'recovered_batch', recovered: recovered.recovered };
      }
      let executed;
      try {
        executed = await responsePayload(await executeBatch(svc, user, {
          batch_id: batch.id,
          lock_token: item.execution_lock_token || '',
          limit: EXECUTION_CHUNK,
        }));
      } catch (error) {
        if (isTransientDirectoryExecutionFailure(error) || isDirectoryReadFailure(error)) {
          await svc.entities.DirectoryAutoImportItem.update(item.id, {
            status: 'running', step: 'execute_batch',
            failure_message: clean(error?.message || 'Intrerupere temporara.', 1200),
            last_heartbeat_at: now(),
          });
          await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:recover_batch`, failure_message: clean(error?.message || 'Intrerupere temporara.', 1200) });
          return { success: false, retryable: true, error: error?.message || 'Intrerupere temporara.' };
        }
        throw error;
      }
      if (executed.error) {
        if (executed.retryable || executed.requires_resume) {
          await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:recover_batch`, failure_message: executed.error });
          return { success: false, retryable: true, error: executed.error };
        }
        return blockItem(svc, run, item, [executed.error], 'execute_batch');
      }
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: 'running', step: executed.remaining ? 'execute_batch' : 'verify_batch',
        execution_lock_token: executed.lock_token || '',
        applied_rows: Number(executed.totals?.applied_rows || 0),
        skipped_rows: Number(executed.totals?.skipped_rows || 0),
        failed_rows: Number(executed.totals?.failed_rows || 0),
        result_json: JSON.stringify(executed), failure_message: '', last_heartbeat_at: now(),
      });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:${executed.remaining ? 'execute_batch' : 'verify_batch'}`, failure_message: '' });
      return { success: true, step: executed.remaining ? 'execute_batch' : 'verify_batch', processed: executed.processed, remaining: executed.remaining };
    }

    if (item.step === 'verify_batch') {
      const batch = await getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), 'lotului automat pentru verificarea finala');
      const errors = [];
      if (!batch || batch.status !== 'completed') errors.push(`batch_status:${batch?.status || 'missing'}`);
      if (Number(batch?.failed_rows || 0)) errors.push(`failed_rows:${batch?.failed_rows || 0}`);
      const national = runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL;
      if (!national && Number(batch?.skipped_rows || 0)) errors.push(`skipped_rows:${batch?.skipped_rows || 0}`);
      if (national) {
        if (Number(batch?.applied_rows || 0) + Number(batch?.skipped_rows || 0) !== Number(batch?.ready_rows || 0)) errors.push('processed_rows_mismatch');
      } else if (Number(batch?.applied_rows || 0) !== Number(batch?.ready_rows || 0)) errors.push('applied_rows_mismatch');
      if (errors.length) return blockItem(svc, run, item, errors, 'verify_batch');
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: 'running', step: 'publish_batch', applied_rows: Number(batch.applied_rows || 0),
        skipped_rows: Number(batch.skipped_rows || 0), failed_rows: 0,
        result_json: JSON.stringify({ batch_id: batch.id, status: batch.status, applied_rows: batch.applied_rows, skipped_rows: batch.skipped_rows }),
        failure_message: '', last_heartbeat_at: now(),
      });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:publish_batch`, failure_message: '' });
      return { success: true, step: 'publish_batch' };
    }

    if (item.step === 'publish_batch') {
      const publication = await responsePayload(await publishCompletedBatchAsBasicDirectory(svc, user, { batch_id: item.batch_id }));
      if (publication.error) return blockItem(svc, run, item, [publication.error], 'publish_batch');
      const batch = await getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), 'lotului automat dupa publicare');
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: 'completed', step: 'completed', applied_rows: Number(batch?.applied_rows || item.applied_rows || 0),
        skipped_rows: Number(batch?.skipped_rows || item.skipped_rows || 0), failed_rows: 0,
        result_json: JSON.stringify({
          batch_id: item.batch_id,
          status: batch?.status || 'completed',
          applied_rows: Number(batch?.applied_rows || 0),
          skipped_rows: Number(batch?.skipped_rows || 0),
          publication,
        }),
        failure_message: '', finished_at: now(), last_heartbeat_at: now(),
      });
      const latestRun = await getDirectoryEntityOrNull(svc.entities.DirectoryAutoImportRun.get(run.id), 'rularii automate dupa publicarea lotului') || run;
      const refreshed = await refreshProgress(svc, latestRun);
      await releaseRunLock(svc, run.id, {
        status: refreshed.completed ? 'completed' : 'running',
        current_step: refreshed.completed ? 'completed' : `batch_${refreshed.nextItem?.sequence || item.sequence + 1}:fetch_source`,
        finished_at: refreshed.completed ? now() : null,
        failure_message: '',
      });
      return { success: true, step: 'completed', publication, run_completed: refreshed.completed };
    }

    return blockItem(svc, run, item, [`unknown_step:${item.step}`], 'unknown_step');
  } catch (error) {
    if (isTransientDirectoryExecutionFailure(error) || isDirectoryReadFailure(error)) {
      await releaseRunLock(svc, run.id, { status: 'running', current_step: run.current_step || 'retry_scheduled', failure_message: clean(error?.message || 'Intrerupere temporara.', 1200) });
      return { success: false, retryable: true, error: error?.message || 'Intrerupere temporara.' };
    }
    await releaseRunLock(svc, run.id, { status: 'failed', current_step: 'failed', failure_message: clean(error?.message || 'Rularea automata a esuat.', 1200) });
    return { success: false, error: error?.message || 'Rularea automata a esuat.' };
  }
}

async function advanceRuns(svc, input = {}) {
  const runId = clean(input.run_id, 120);
  let runs = [];
  if (runId) {
    const run = await getDirectoryEntityOrNull(svc.entities.DirectoryAutoImportRun.get(runId), 'rularii automate pentru avansare');
    if (run) runs = [run];
  } else {
    const approved = await requireDirectoryRows(svc.entities.DirectoryAutoImportRun.filter({ status: 'approved' }, 'created_date', 10), 'rularilor automate aprobate');
    const running = await requireDirectoryRows(svc.entities.DirectoryAutoImportRun.filter({ status: 'running' }, 'created_date', 10), 'rularilor automate in curs');
    const oldestApproved = approved.sort((left, right) => String(left.created_date || '').localeCompare(String(right.created_date || '')))[0] || null;
    const oldestRunning = running.sort((left, right) => String(left.created_date || '').localeCompare(String(right.created_date || '')))[0] || null;
    runs = [oldestApproved, oldestRunning].filter(Boolean);
    if (!runs.length) {
      const completed = await requireDirectoryRows(
        svc.entities.DirectoryAutoImportRun.filter({ status: 'completed' }, '-finished_at', 10),
        'rularilor finalizate pentru reconcilierea publicarii',
      );
      for (const candidate of completed) {
        const items = await requireDirectoryRows(
          svc.entities.DirectoryAutoImportItem.filter({ run_id: candidate.id }, 'sequence', 100),
          'loturilor finalizate pentru reconcilierea publicarii',
        );
        const missingPublication = items.some((item) => (
          item.status === 'completed'
          && clean(item.batch_id, 160)
          && safeJson(item.result_json, {}).publication?.success !== true
        ));
        if (missingPublication) {
          runs = [candidate];
          break;
        }
      }
    }
  }
  if (!runs.length) return response({ success: true, processed_runs: 0, message: 'Nu exista rulare automata aprobata.' });
  const outcomes = [];
  for (const initialRun of runs) {
    let run = initialRun;
    const initialSequence = Number(run.current_sequence || 1);
    for (let stepIndex = 0; stepIndex < 18; stepIndex += 1) {
      const outcome = await advanceRun(svc, run);
      outcomes.push(outcome);
      if (
        outcome?.blocked
        || outcome?.retryable
        || outcome?.completed
        || outcome?.run_completed
        || outcome?.error
      ) break;
      if (['execute_batch', 'recovered_batch'].includes(outcome?.step)) {
        await pause(3500);
      }
      const refreshed = await getDirectoryEntityOrNull(
        svc.entities.DirectoryAutoImportRun.get(run.id),
        'rularii automate intre pasii aceleiasi executii',
      );
      if (!refreshed || !['approved', 'running', 'completed'].includes(refreshed.status)) break;
      run = refreshed;
      if (Number(run.current_sequence || initialSequence) > initialSequence) break;
    }
  }
  return response({ success: true, processed_runs: runs.length, processed_steps: outcomes.length, outcomes });
}

export async function handleDirectoryAutoImport(req: Request) {
  try {
    const input = await req.clone().json().catch(() => ({}));
    const action = clean(input.action, 100);
    const base44 = createClientFromRequest(req);
    if (action === 'advance_auto_import_runs' && input.__automation_trigger === true) {
      return advanceRuns(base44.asServiceRole, input);
    }
    const auth = await requireAdmin(base44);
    if (auth.error) return auth.error;
    const { user, svc } = auth;
    if (action === 'list_auto_import_runs') return listRuns(svc, input);
    if (action === 'create_auto_import_run') return createRun(svc, user, input);
    if (action === 'approve_auto_import_run') return approveRun(svc, user, input);
    if (action === 'pause_auto_import_run') return changeRunStatus(svc, user, input, 'paused');
    if (action === 'resume_auto_import_run') return changeRunStatus(svc, user, input, 'approved');
    if (action === 'cancel_auto_import_run') return changeRunStatus(svc, user, input, 'cancelled');
    if (action === 'advance_auto_import_run_now') return advanceRuns(svc, { run_id: input.run_id });
    return response({ error: 'Actiune automata necunoscuta.' }, 400);
  } catch (error) {
    const retryable = isDirectoryReadFailure(error) || isTransientDirectoryExecutionFailure(error);
    return response({ error: error?.message || 'Eroare in orchestratorul automat.', retryable }, retryable ? 503 : 500);
  }
}