import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  DIRECTORY_CARE_SETTING,
  DIRECTORY_CONTROL_STATUS,
  DIRECTORY_DATA_QUALITY_STATUS,
  DIRECTORY_DETAIL_LEVEL,
  DIRECTORY_LOCATION_TYPE,
  DIRECTORY_OPERATIONAL_STATUS,
  DIRECTORY_PUBLICATION_STATUS,
  ORGANIZATION_LINK_STATUS,
  deriveCanonicalDirectoryState,
  directorySourceCheckedAt,
} from '../shared/directoryCanonicalModel.js';
import { getPublicLocationDisclosure } from '../shared/providerPublicTrust.js';

const legacyDirectoryLocation = {
  status: 'publicata',
  active_status: 'activa',
  profile_control_status: 'directory',
  verification_state: 'unclaimed',
  claim_verification_status: 'none',
  provider_type: 'optica_medicala',
  provider_profile_type: 'independent_optical_store',
  organization_id: 'org-1',
  address: 'Strada Exemplu nr. 10',
  phone_public: '0700000000',
  public_email: 'contact@example.test',
  website: 'https://example.test',
  lat: 45.75,
  lng: 21.22,
  opening_hours: 'L-V 09:00-18:00',
  source_checked_at: '2026-07-19T10:00:00.000Z',
  data_confidence: 'high',
};

const legacyState = deriveCanonicalDirectoryState(legacyDirectoryLocation);
assert.equal(legacyState.control_status, DIRECTORY_CONTROL_STATUS.DIRECTORY);
assert.equal(legacyState.publication_status, DIRECTORY_PUBLICATION_STATUS.PUBLISHED);
assert.equal(legacyState.operational_status, DIRECTORY_OPERATIONAL_STATUS.ACTIVE);
assert.equal(legacyState.data_quality_status, DIRECTORY_DATA_QUALITY_STATUS.HIGH);
assert.equal(legacyState.directory_detail_level, DIRECTORY_DETAIL_LEVEL.SUMMARY);
assert.equal(legacyState.organization_link_status, ORGANIZATION_LINK_STATUS.PROBABLE);
assert.equal(legacyState.location_type_code, DIRECTORY_LOCATION_TYPE.OPTICAL_STORE);
assert.equal(legacyState.care_setting_code, DIRECTORY_CARE_SETTING.RETAIL);
assert.equal(legacyState.is_publicly_available, true);
assert.equal(directorySourceCheckedAt(legacyDirectoryLocation), legacyDirectoryLocation.source_checked_at);

const summaryDisclosure = getPublicLocationDisclosure(legacyDirectoryLocation);
assert.equal(summaryDisclosure.public_detail_level, DIRECTORY_DETAIL_LEVEL.SUMMARY);
assert.equal(summaryDisclosure.address, null);
assert.equal(summaryDisclosure.phone, null);
assert.equal(summaryDisclosure.website, null);
assert.equal(summaryDisclosure.source_label, 'Sursa publica');
assert.equal(summaryDisclosure.source_checked_at, legacyDirectoryLocation.source_checked_at);
assert.equal(summaryDisclosure.expose_basic_details, false);
assert.equal(summaryDisclosure.expose_full_details, false);

const approvedBasicDirectory = {
  ...legacyDirectoryLocation,
  directory_detail_level: 'basic',
  directory_basic_details_approved: true,
};
const basicDisclosure = getPublicLocationDisclosure(approvedBasicDirectory);
assert.equal(basicDisclosure.public_detail_level, DIRECTORY_DETAIL_LEVEL.BASIC);
assert.equal(basicDisclosure.address, approvedBasicDirectory.address);
assert.equal(basicDisclosure.phone, approvedBasicDirectory.phone_public);
assert.equal(basicDisclosure.website, approvedBasicDirectory.website);
assert.equal(basicDisclosure.public_email, null);
// 2026-09-05, aprobat explicit de owner: pozitia se expune si la nivel basic, marcata ca
// aproximativa. Adresa acestor profiluri este deja publica, deci coordonata derivata din ea nu
// adauga informatie noua - iar fara ea harta rezultatelor ramanea aproape goala. Ce ramane
// rezervat detaliului complet: place_id, programul si emailul.
assert.equal(basicDisclosure.lat, approvedBasicDirectory.lat);
assert.equal(basicDisclosure.lng, approvedBasicDirectory.lng);
assert.equal(basicDisclosure.map_precision, 'approximate');
assert.equal(basicDisclosure.place_id, null);
assert.equal(basicDisclosure.opening_hours, null);
assert.equal(basicDisclosure.expose_basic_details, true);
assert.equal(basicDisclosure.expose_full_details, false);

const conflictedBasicDirectory = {
  ...approvedBasicDirectory,
  data_quality_status: 'conflict',
};
const conflictedDisclosure = getPublicLocationDisclosure(conflictedBasicDirectory);
assert.equal(conflictedDisclosure.public_detail_level, DIRECTORY_DETAIL_LEVEL.SUMMARY);
assert.equal(conflictedDisclosure.address, null);
assert.equal(conflictedDisclosure.contact_details_visible, false);
// Un profil cu date in conflict coboara la 'summary' si nu mai expune nici pozitia: nu punem
// un pin pentru o locatie despre care nu suntem siguri.
assert.equal(conflictedDisclosure.lat, null);
assert.equal(conflictedDisclosure.map_precision, null);

const closedCanonicalLocation = {
  ...legacyDirectoryLocation,
  operational_status: 'closed',
};
const closedState = deriveCanonicalDirectoryState(closedCanonicalLocation);
assert.equal(closedState.operational_status, DIRECTORY_OPERATIONAL_STATUS.CLOSED);
assert.equal(closedState.is_publicly_available, false);

const verifiedLocation = {
  ...legacyDirectoryLocation,
  profile_control_status: 'verified',
  verification_state: 'verified',
  claim_verification_status: 'approved',
  is_verified: true,
  data_source: 'claim',
};
const verifiedDisclosure = getPublicLocationDisclosure(verifiedLocation);
assert.equal(verifiedDisclosure.public_detail_level, DIRECTORY_DETAIL_LEVEL.FULL);
assert.equal(verifiedDisclosure.address, verifiedLocation.address);
assert.equal(verifiedDisclosure.public_email, verifiedLocation.public_email);
assert.equal(verifiedDisclosure.lat, verifiedLocation.lat);
assert.equal(verifiedDisclosure.opening_hours, verifiedLocation.opening_hours);
assert.equal(verifiedDisclosure.source_label, null);

const canonicalSource = await readFile(new URL('../shared/directoryCanonicalModel.js', import.meta.url), 'utf8');
const bundledCanonicalFiles = [
  '../base44/functions/matchProvidersSemantic/directoryCanonicalModel.js',
  '../base44/functions/browseDirectoryProviders/directoryCanonicalModel.js',
  '../base44/functions/getPublicProviderProfile/directoryCanonicalModel.js',
  '../base44/functions/getPublicOrganizationBrand/directoryCanonicalModel.js',
  '../base44/functions/matchProviders/directoryCanonicalModel.js',
];

for (const relativePath of bundledCanonicalFiles) {
  const bundledSource = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  assert.equal(
    bundledSource.trimEnd(),
    canonicalSource.trimEnd(),
    `${fileURLToPath(new URL(relativePath, import.meta.url))} trebuie sincronizat cu sursa canonica.`,
  );
}

const publicProfileEntry = await readFile(
  new URL('../base44/functions/getPublicProviderProfile/entry.ts', import.meta.url),
  'utf8',
);
assert.match(publicProfileEntry, /publicDisclosure\?\.is_publicly_available !== true/);
assert.match(publicProfileEntry, /assignment\.visibility_consent_status !== 'accepted'/);
assert.match(publicProfileEntry, /source_checked_at: publicDisclosure\.source_checked_at/);

const directoryNotice = await readFile(
  new URL('../src/components/provider/DirectoryProfileNotice.jsx', import.meta.url),
  'utf8',
);
assert.match(directoryNotice, /source_checked_at/);
assert.match(directoryNotice, /nu reprezintă un parteneriat sau o recomandare VIASEE/);
assert.match(directoryNotice, /Date de bază verificate editorial/);

const requiredEntitySchemas = [
  '../base44/entities/ProviderLocationDirectoryState.jsonc',
  '../base44/entities/DirectoryOrganizationLocationLink.jsonc',
  '../base44/entities/DirectoryImportBatch.jsonc',
  '../base44/entities/DirectoryImportRow.jsonc',
];
for (const relativePath of requiredEntitySchemas) {
  const schema = JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
  assert.ok(schema.name, `${relativePath} trebuie sa aiba nume.`);
  assert.equal(schema.rls?.read?.user_condition?.role, 'admin');
  assert.equal(schema.rls?.write?.user_condition?.role, 'admin');
}

console.log('Directory canonical model regression checks passed.');
