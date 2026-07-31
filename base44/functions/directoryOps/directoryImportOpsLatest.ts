import { handle as directoryImportOpsLocationFirstHandle } from './directoryImportOpsLocationFirst.ts';
import { handleDirectoryAutoImport } from './directoryAutoImportOps.ts';

export const DIRECTORY_IMPORT_RUNTIME_REVISION = 'directory-import-runtime-national-directory-4';

export async function handle(req: Request) {
  const input = await req.clone().json().catch(() => ({}));

  if (input?.action === 'runtime_info') {
    return Response.json({
      success: true,
      runtime_revision: DIRECTORY_IMPORT_RUNTIME_REVISION,
      classification_contract_version: 'viasee-directory-location-first-v1',
      preserves_explicit_location_type: true,
      preserves_explicit_organization_type: true,
      supports_extended_organization_types: true,
      reconciles_directory_organizations: true,
      rejects_address_only_location_match: true,
      rejects_ambiguous_organization_match: true,
      chunked_snapshot_finalization: true,
      chunked_batch_planning: true,
      reconciles_existing_location_metadata: true,
      reconciles_directory_state: true,
      reconciles_directory_evidence: true,
      preserves_directory_publication_state: true,
      preserves_existing_optional_fields: true,
      fails_closed_on_directory_read_errors: true,
      supports_automated_controlled_import: true,
      automated_import_contract_version: 'viasee-directory-auto-import-v2',
      automated_import_schedule_minutes: 5,
      automated_controlled_import_orchestrator: true,
      scheduled_auto_import_runner: true,
      max_automatic_execution_chunk: 5,
      supports_private_zip_upload: true,
      persists_approved_source_subset: true,
      uses_chunked_private_payload_storage: true,
      repairs_partial_preflight_runs: true,
      supports_national_directory_campaign: true,
      supports_private_master_json: true,
      excludes_ambiguous_live_matches: true,
      publishes_unclaimed_unverified_directory_profiles: true,
      excludes_controlled_profiles_from_national_import: true,
      publishes_basic_directory_details_only_when_quality_allows: true,
      preserves_top_three_isolation: true,
    });
  }

  if (
    String(input?.action || '').startsWith('auto_')
    || input?.action === 'advance_auto_import_runs'
    || input?.action === 'list_auto_import_runs'
    || input?.action === 'create_auto_import_run'
    || input?.action === 'approve_auto_import_run'
    || input?.action === 'pause_auto_import_run'
    || input?.action === 'resume_auto_import_run'
    || input?.action === 'cancel_auto_import_run'
    || input?.action === 'advance_auto_import_run_now'
  ) {
    return handleDirectoryAutoImport(req);
  }

  return directoryImportOpsLocationFirstHandle(req);
}
