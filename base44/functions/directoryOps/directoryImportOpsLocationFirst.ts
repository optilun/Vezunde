import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { validateNormalizedDirectoryRow } from '../../shared/directoryImportPipeline.js';
import { handle as legacyDirectoryImportOpsHandle } from './directoryImportOps.ts';

const MAX_ROWS = 5000;
const CLASSIFICATION_CONTRACT_VERSION = 'viasee-directory-location-first-v1';
const RUNTIME_ADAPTER_REVISION = 'directory-location-first-runtime-adapter-1';

const PROVIDER_TYPES = new Set([
  'optica_medicala',
  'clinica_oftalmologica',
  'cabinet_oftalmologic',
  'cabinet_optometric',
  'laborator_optic',
  'optometrist_independent',
  'medic_oftalmolog_independent',
]);

const PROVIDER_PROFILE_TYPES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
  'optical_laboratory_b2c',
  'optical_laboratory_b2b',
  'future_b2b_distributor',
]);

const ORGANIZATION_TYPE_CODES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'healthcare_network',
  'multi_specialty_healthcare_provider',
  'public_healthcare_institution',
  'independent_professional',
  'optical_laboratory',
  'b2b_distributor',
  'other',
]);

const LOCATION_TYPE_CODES = new Set([
  'optical_store',
  'optometry_office',
  'ophthalmology_office',
  'ophthalmology_clinic',
  'multi_specialty_clinic',
  'hospital_department',
  'hospital_outpatient_unit',
  'optical_laboratory',
  'independent_professional_office',
  'other',
]);

const CARE_SETTING_CODES = new Set([
  'retail',
  'outpatient',
  'hospital_outpatient',
  'hospital_inpatient',
  'mixed',
  'laboratory',
  'other',
]);

function clean(value: unknown, maxLength = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeJson(value: unknown, fallback: any = {}) {
  if (value && typeof value === 'object') return value;
  try {
    return value ? JSON.parse(String(value)) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function reconcileNormalizedPayload(raw: Record<string, unknown>, current: Record<string, any>) {
  const normalized = { ...current };
  const explicitLocation = {
    provider_type: clean(raw.provider_type, 120),
    provider_profile_type: clean(raw.provider_profile_type, 120),
    location_type_code: clean(raw.location_type_code, 120),
    care_setting_code: clean(raw.care_setting_code, 120),
  };
  const hasExplicitLocation = Object.values(explicitLocation).some(Boolean);
  if (hasExplicitLocation) {
    const valid = PROVIDER_TYPES.has(explicitLocation.provider_type)
      && PROVIDER_PROFILE_TYPES.has(explicitLocation.provider_profile_type)
      && LOCATION_TYPE_CODES.has(explicitLocation.location_type_code)
      && CARE_SETTING_CODES.has(explicitLocation.care_setting_code);
    normalized.provider_type = valid ? explicitLocation.provider_type : '';
    normalized.provider_profile_type = valid ? explicitLocation.provider_profile_type : '';
    normalized.location_type_code = valid ? explicitLocation.location_type_code : '';
    normalized.care_setting_code = valid ? explicitLocation.care_setting_code : '';
    normalized.canonical_type_source = 'source_explicit';
    normalized.canonical_type_invalid = !valid;
  }

  const explicitOrganizationType = clean(raw.organization_type_code || raw.organization_type, 120);
  if (explicitOrganizationType) {
    const valid = ORGANIZATION_TYPE_CODES.has(explicitOrganizationType);
    normalized.organization_type_code = valid ? explicitOrganizationType : '';
    normalized.organization_type_source = 'source_explicit';
    normalized.organization_type_invalid = !valid;
    normalized.organization_type_legacy_fallback = false;
  } else if (
    !normalized.organization_type_code
    && ORGANIZATION_TYPE_CODES.has(clean(normalized.provider_profile_type, 120))
  ) {
    normalized.organization_type_code = clean(normalized.provider_profile_type, 120);
    normalized.organization_type_source = 'legacy_profile_fallback';
    normalized.organization_type_invalid = false;
    normalized.organization_type_legacy_fallback = true;
  }

  normalized.classification_contract_version = CLASSIFICATION_CONTRACT_VERSION;
  normalized.runtime_adapter_revision = RUNTIME_ADAPTER_REVISION;
  return normalized;
}

async function reconcileFinalizedSnapshot(req: Request, input: Record<string, any>) {
  const snapshotId = clean(input.snapshot_id, 120);
  if (!snapshotId) return;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') return;
  const svc = base44.asServiceRole;
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(snapshotId).catch(() => null);
  if (!snapshot) return;

  const rows = await svc.entities.DirectoryImportRow.filter(
    { snapshot_id: snapshotId },
    'row_number',
    MAX_ROWS,
  ).catch(() => []);

  let validRows = 0;
  let blockedRows = 0;
  let warningRows = 0;
  const codeCounts: Record<string, number> = {};

  for (const row of rows) {
    const raw = safeJson(row.raw_payload_json, {});
    const current = safeJson(row.normalized_payload_json, {});
    const normalized = reconcileNormalizedPayload(raw, current);
    const validation = validateNormalizedDirectoryRow(normalized, {
      require_siruta: input.require_siruta !== false,
    });

    const priorErrors = safeJson(row.validation_errors_json, []);
    const priorWarnings = safeJson(row.validation_warnings_json, []);
    const errors = unique([
      ...validation.errors,
      ...priorErrors.filter((code: string) => ![
        'invalid_explicit_canonical_type',
        'invalid_explicit_organization_type',
        'canonical_type_not_resolved',
        'organization_type_not_resolved',
      ].includes(code)),
    ]);
    const warnings = unique([
      ...validation.warnings,
      ...priorWarnings.filter((code: string) => ![
        'canonical_type_not_inferred',
        'organization_type_not_resolved',
        'organization_type_inferred_from_legacy_profile',
      ].includes(code)),
    ]);

    if (normalized.canonical_type_invalid && !errors.includes('invalid_explicit_canonical_type')) {
      errors.push('invalid_explicit_canonical_type');
    }
    if (normalized.organization_type_invalid && !errors.includes('invalid_explicit_organization_type')) {
      errors.push('invalid_explicit_organization_type');
    }
    if (normalized.organization_name && !normalized.organization_type_code && !errors.includes('organization_type_not_resolved')) {
      errors.push('organization_type_not_resolved');
    }
    if (normalized.organization_type_legacy_fallback && !warnings.includes('organization_type_inferred_from_legacy_profile')) {
      warnings.push('organization_type_inferred_from_legacy_profile');
    }

    const validationCodes = unique([...errors, ...warnings]);
    for (const code of validationCodes) codeCounts[code] = (codeCounts[code] || 0) + 1;
    const valid = errors.length === 0;
    if (valid) validRows += 1;
    else blockedRows += 1;
    if (warnings.length) warningRows += 1;

    await svc.entities.DirectoryImportRow.update(row.id, {
      normalized_payload_json: JSON.stringify(normalized),
      status: valid ? 'valid' : 'blocked',
      validation_codes: validationCodes,
      validation_errors_json: JSON.stringify(errors),
      validation_warnings_json: JSON.stringify(warnings),
      planned_action: valid
        ? undefined
        : (normalized.pseudo_row_reason || errors.includes('source_row_not_eligible') ? 'reject_invalid' : 'block_conflict'),
      error_message: valid ? '' : errors.join(', '),
    });
  }

  const summary = {
    ...safeJson(snapshot.summary_json, {}),
    classification_contract_version: CLASSIFICATION_CONTRACT_VERSION,
    runtime_adapter_revision: RUNTIME_ADAPTER_REVISION,
    code_counts: codeCounts,
    require_siruta: input.require_siruta !== false,
  };
  const status = validRows > 0 ? 'ready' : 'blocked';
  await svc.entities.DirectorySourceSnapshot.update(snapshotId, {
    status,
    total_rows: rows.length,
    uploaded_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    warning_rows: warningRows,
    summary_json: JSON.stringify(summary),
  });

  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'DirectorySourceSnapshot',
    entity_id: snapshotId,
    action_type: 'directory_snapshot_location_first_reconciled',
    changed_fields: [
      'normalized_payload_json',
      'valid_rows',
      'blocked_rows',
      'warning_rows',
      'summary_json',
    ],
    previous_values: JSON.stringify({
      valid_rows: snapshot.valid_rows || 0,
      blocked_rows: snapshot.blocked_rows || 0,
      warning_rows: snapshot.warning_rows || 0,
    }),
    new_values: JSON.stringify({
      valid_rows: validRows,
      blocked_rows: blockedRows,
      warning_rows: warningRows,
      classification_contract_version: CLASSIFICATION_CONTRACT_VERSION,
      runtime_adapter_revision: RUNTIME_ADAPTER_REVISION,
    }),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: 'Reconciliere fail-closed a tipurilor canonice explicite dupa finalizarea snapshotului.',
    performed_at: new Date().toISOString(),
  });
}

export async function handle(req: Request) {
  const reconciliationRequest = req.clone();
  const input = await req.clone().json().catch(() => ({}));
  const result = await legacyDirectoryImportOpsHandle(req);

  if (clean(input.action, 80) === 'finalize_snapshot' && result.ok) {
    await reconcileFinalizedSnapshot(reconciliationRequest, input);
  }

  return result;
}
