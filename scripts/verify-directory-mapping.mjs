import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CANONICAL_LOCATION_TYPE_OPTIONS,
  DIRECTORY_MAPPING_CONTRACT_VERSION,
  extractUnitDiscriminator,
  isCanonicalLocationTypePair,
  mappingConfirmationToken,
  normalizeAddressBase,
  stableLocationPairKey,
  validateIdentityRelationship,
} from '../shared/directoryMappingPolicy.js';

assert.equal(DIRECTORY_MAPPING_CONTRACT_VERSION, 'directory-mapping-v1');
assert.ok(CANONICAL_LOCATION_TYPE_OPTIONS.length >= 8);
assert.equal(isCanonicalLocationTypePair('optica_medicala', 'independent_optical_store'), true);
assert.equal(isCanonicalLocationTypePair('optica_medicala', 'ophthalmology_clinic'), false);

const firstAddress = 'Strada Exemplu nr. 12, etaj 1, cabinet 2';
const secondAddress = 'Str. Exemplu 12, etaj 2, cabinet 7';
assert.equal(normalizeAddressBase(firstAddress), normalizeAddressBase(secondAddress));
assert.notEqual(extractUnitDiscriminator(firstAddress), extractUnitDiscriminator(secondAddress));
assert.equal(stableLocationPairKey('loc-b', 'loc-a'), 'loc-a::loc-b');
assert.equal(stableLocationPairKey('loc-a', 'loc-a'), '');

const distinctUnit = validateIdentityRelationship({
  primary_location_id: 'loc-a',
  related_location_id: 'loc-b',
  relationship_type: 'same_address_distinct_unit',
});
assert.equal(distinctUnit.ok, true);

const duplicateWithoutCanonical = validateIdentityRelationship({
  primary_location_id: 'loc-a',
  related_location_id: 'loc-b',
  relationship_type: 'duplicate_same_entity',
});
assert.equal(duplicateWithoutCanonical.ok, false);

const duplicate = validateIdentityRelationship({
  primary_location_id: 'loc-a',
  related_location_id: 'loc-b',
  relationship_type: 'duplicate_same_entity',
  canonical_location_id: 'loc-a',
});
assert.equal(duplicate.ok, true);
assert.equal(mappingConfirmationToken(['identity', duplicate.pair_key]).startsWith('directory-mapping-v1:'), true);

const backend = await readFile(new URL('../base44/functions/directoryOps/directoryMappingOps.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/components/admin/directory/DirOpsMapping.jsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/AdminDirectoryOps.jsx', import.meta.url), 'utf8');
const nav = await readFile(new URL('../src/lib/adminNavConfig.js', import.meta.url), 'utf8');
const identitySchema = JSON.parse(await readFile(new URL('../base44/entities/DirectoryLocationIdentityLink.jsonc', import.meta.url), 'utf8'));

assert.match(backend, /user\.role !== 'admin'/);
assert.match(backend, /action === 'preview_organization_link'/);
assert.match(backend, /action === 'apply_organization_link'/);
assert.match(backend, /action === 'preview_canonical_type'/);
assert.match(backend, /action === 'apply_canonical_type'/);
assert.match(backend, /action === 'preview_identity_relation'/);
assert.match(backend, /action === 'apply_identity_relation'/);
assert.match(backend, /clean\(input\.confirmation_token, 500\) !== previewPayload\.confirmation_token/);
assert.match(backend, /Preview-ul nu mai este valid[\s\S]*status: 409|Preview-ul nu mai este valid[\s\S]*, 409/);
assert.match(backend, /link_record_status: 'superseded'/);
assert.match(backend, /record_status: 'superseded'/);
assert.match(backend, /DirectoryAuditRecord\.create/);
assert.match(backend, /migration_review_required: true/);
assert.doesNotMatch(backend, /ProviderLocation\.delete/);
assert.doesNotMatch(backend, /status:\s*'publicata'/);
assert.doesNotMatch(backend, /is_verified:\s*true/);
assert.doesNotMatch(backend, /verification_state:\s*'verified'/);

assert.match(panel, /directoryMappingOps/);
assert.match(panel, /Genereaza preview/);
assert.match(panel, /Nicio decizie nu publica, verifica sau combina automat profiluri/);
assert.match(panel, /same_address_distinct_unit/);
assert.match(panel, /duplicate_same_entity/);
assert.match(panel, /rebrand_successor/);
assert.match(panel, /2xl:grid-cols/);
assert.match(page, /DirOpsMapping/);
assert.match(page, /tab === "mapping"/);
assert.match(nav, /key: "mapping"/);

assert.equal(identitySchema.name, 'DirectoryLocationIdentityLink');
assert.ok(identitySchema.properties.relationship_type.enum.includes('same_address_distinct_unit'));
assert.ok(identitySchema.properties.relationship_type.enum.includes('duplicate_same_entity'));
assert.equal(identitySchema.rls.read.user_condition.role, 'admin');
assert.equal(identitySchema.rls.write.user_condition.role, 'admin');

console.log('Directory mapping contract verified.');
