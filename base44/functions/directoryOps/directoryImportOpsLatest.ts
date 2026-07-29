import { handle as directoryImportOpsLocationFirstHandle } from './directoryImportOpsLocationFirst.ts';

export const DIRECTORY_IMPORT_RUNTIME_REVISION = 'directory-import-runtime-extended-organization-types-3';

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
    });
  }

  return directoryImportOpsLocationFirstHandle(req);
}
