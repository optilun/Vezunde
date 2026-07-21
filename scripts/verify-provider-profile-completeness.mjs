import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_PROFILE_COMPLETENESS_CONTRACT_VERSION,
  computeLocationCompleteness,
  computeOrganizationCompleteness,
  summarizeProviderCompleteness,
} from '../shared/providerProfileCompleteness.js';

assert.equal(PROVIDER_PROFILE_COMPLETENESS_CONTRACT_VERSION, 'provider-profile-completeness-v1');

const organization = computeOrganizationCompleteness({
  public_display_name: 'VIASEE Optic',
  public_phone: '0256000000',
});
assert.equal(organization.publication_ready, true);
assert.ok(organization.missing_items.some((item) => item.key === 'organization_description'));
assert.equal(organization.missing_items.find((item) => item.key === 'organization_description')?.impact, 'quality');

const incompleteLocation = computeLocationCompleteness({
  location: {
    name: 'Locatie test',
    provider_type: 'optica_medicala',
    provider_profile_type: 'independent_optical_store',
    locality_name: 'Timisoara',
    address: 'Strada Test 1',
    public_phone: '0256000000',
    profile_control_status: 'claimed',
  },
  content: { approved_service_count: 0 },
});
assert.equal(incompleteLocation.publication_ready, false);
assert.ok(incompleteLocation.missing_items.some((item) => item.key === 'location_services' && item.impact === 'required'));
assert.ok(incompleteLocation.missing_items.some((item) => item.key === 'location_verification' && item.impact === 'quality'));

const completeLocation = computeLocationCompleteness({
  location: {
    name: 'Locatie test',
    provider_type: 'optica_medicala',
    provider_profile_type: 'independent_optical_store',
    locality_siruta_code: '155243',
    address: 'Strada Test 1',
    public_email: 'contact@example.com',
    opening_hours: 'L-V 09:00-18:00',
    photo_url: 'https://example.com/photo.jpg',
    profile_control_status: 'verified',
  },
  content: {
    approved_service_count: 2,
    approved_public_team_count: 1,
    approved_media_count: 1,
    has_primary_photo: true,
    has_opening_hours: true,
  },
});
assert.equal(completeLocation.percentage, 100);
assert.equal(completeLocation.publication_ready, true);

const summary = summarizeProviderCompleteness({ organizationCompletion: organization, locationCompletions: [completeLocation, incompleteLocation] });
assert.equal(summary.active_location_count, 2);
assert.equal(summary.average_location_percentage, Math.round((completeLocation.percentage + incompleteLocation.percentage) / 2));

const endpoint = await readFile(new URL('../base44/function_modules/getProviderProfileCompleteness.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/components/workspace/provider/ProviderCompletenessPanel.jsx', import.meta.url), 'utf8');
const inbox = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');
assert.match(endpoint, /computeOrganizationCompleteness/);
assert.match(endpoint, /computeLocationCompleteness/);
assert.match(endpoint, /ProviderMembership\.filter/);
assert.match(endpoint, /ProviderLocation\.filter\(\{ organization_id:/);
assert.match(endpoint, /selected_location_id/);
assert.match(endpoint, /locations: locationRows/);
assert.match(panel, /nu modifica automat publicarea sau accesul locatiei/i);
assert.match(panel, /Completarea profilului/);
assert.match(panel, /Compara locatiile/);
assert.match(panel, /Media locatiilor accesibile/);
assert.match(panel, /selected_location_id/);
assert.match(inbox, /getProviderProfileCompleteness/);
assert.match(inbox, /ProviderCompletenessPanel/);
assert.doesNotMatch(endpoint, /ProviderLocation\.update|ProviderOrganization\.update/);

console.log('Unified provider profile completeness and multi-location overview verified.');
