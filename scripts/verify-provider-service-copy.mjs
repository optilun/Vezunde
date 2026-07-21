import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(new URL('../base44/functions/providerServiceConfigurationOps/copyProviderServiceConfiguration.ts', import.meta.url), 'utf8');
assert.match(backend, /targetIds\.includes\(sourceId\)/, 'source location must be excluded from targets');
assert.match(backend, /target\.organization_id !== source\.organization_id/, 'copy must remain inside one organization');
assert.match(backend, /EDITOR_ROLES = \['organization_owner', 'location_manager'\]/, 'only owners and location managers may copy services');
assert.match(backend, /creates_drafts_only: true/, 'copy must create drafts only');
assert.match(backend, /status: 'draft'/, 'copied service configuration must remain a draft');
assert.match(backend, /confirm_replace_services/, 'replace mode must require explicit service confirmation');
assert.match(backend, /confirm_replace_existing_drafts/, 'existing drafts must require explicit replacement confirmation');
assert.match(backend, /provider_copy_services_draft/, 'copy operation must be audited');
assert.match(backend, /duplicate_skipped/, 'copy operation must be idempotent');
assert.match(backend, /copies_resources: false/, 'specialists, equipment and facilities must not be copied');
assert.match(backend, /raw_removal_keys: \[\]/, 'legacy service keys must not be removed automatically');
assert.doesNotMatch(backend, /LocationService\.update|LocationService\.create/, 'copy must not publish or directly mutate LocationService rows');
assert.doesNotMatch(backend, /ProviderLocation\.update/, 'copy must not alter target profile fields');
assert.doesNotMatch(backend, /opening_hours|public_phone|public_email|website_url|contact_phone|contact_email/, 'copy must not alter schedule or contact fields');

const panel = readFileSync(new URL('../src/components/workspace/provider/ProviderServicesCopyPanel.jsx', import.meta.url), 'utf8');
assert.match(panel, /location\.manage_content/, 'UI must filter locations by content-management permission');
assert.match(panel, /Vezi preview-ul/, 'UI must require preview before creating drafts');
assert.match(panel, /Adauga serviciile lipsa/, 'UI must provide a non-destructive merge mode');
assert.match(panel, /Aliniaza cu sursa/, 'UI must provide an explicit replace mode');
assert.match(panel, /Creeaza drafturile/, 'UI must describe the non-publishing result');
assert.match(panel, /Specialistii, echipamentele, facilitatile, programul si datele de contact nu se copiaza/, 'UI must state the copy boundary');
assert.match(panel, /w-full items-center justify-center/, 'primary action must remain usable on mobile');

const modulePage = readFileSync(new URL('../src/components/workspace/provider/ProviderLocationModulePage.jsx', import.meta.url), 'utf8');
assert.match(modulePage, /ProviderServicesCopyPanel/, 'service copy panel must be exposed in the services module');
assert.match(modulePage, /servicesRevision/, 'current service workspace must refresh after a copied draft targets it');

console.log('Provider controlled service-copy contract: PASS');
