import assert from 'node:assert/strict';
import {
  derivePublicProfileControlStatus,
  getPublicLocationDisclosure,
} from '../shared/providerPublicTrust.js';

const importedLocationWithStaleStatus = {
  profile_control_status: 'verified',
  claim_verification_status: 'none',
  verification_state: 'unclaimed',
  is_verified: false,
  research_status: 'published',
  data_source: 'public_source',
  address: 'Strada Exemplu 10',
  lat: 45.75,
  lng: 21.22,
  place_id: 'public-place-id',
  phone_public: '0700000000',
  public_email: 'contact@example.test',
  website: 'https://example.test',
  opening_hours: 'Luni-Vineri 09:00-18:00',
};

assert.equal(
  derivePublicProfileControlStatus(importedLocationWithStaleStatus),
  'directory',
  'Un profil importat nu devine verificat doar din profile_control_status.',
);

const directoryDisclosure = getPublicLocationDisclosure(importedLocationWithStaleStatus);
assert.equal(directoryDisclosure.public_detail_level, 'summary');
assert.equal(directoryDisclosure.exact_location_visible, false);
assert.equal(directoryDisclosure.contact_details_visible, false);
assert.equal(directoryDisclosure.address, null);
assert.equal(directoryDisclosure.lat, null);
assert.equal(directoryDisclosure.lng, null);
assert.equal(directoryDisclosure.place_id, null);
assert.equal(directoryDisclosure.phone, null);
assert.equal(directoryDisclosure.public_email, null);
assert.equal(directoryDisclosure.website, null);
assert.equal(directoryDisclosure.opening_hours, null);

const verifiedLocation = {
  ...importedLocationWithStaleStatus,
  profile_control_status: 'verified',
  claim_verification_status: 'approved',
  verification_state: 'verified',
  is_verified: true,
  data_source: 'claim',
};

assert.equal(derivePublicProfileControlStatus(verifiedLocation), 'verified');
const verifiedDisclosure = getPublicLocationDisclosure(verifiedLocation);
assert.equal(verifiedDisclosure.public_detail_level, 'full');
assert.equal(verifiedDisclosure.address, verifiedLocation.address);
assert.equal(verifiedDisclosure.phone, verifiedLocation.phone_public);
assert.equal(verifiedDisclosure.website, verifiedLocation.website);

assert.equal(derivePublicProfileControlStatus({ profile_control_status: 'claimed' }), 'claimed');
assert.equal(derivePublicProfileControlStatus({ claim_verification_status: 'pending' }), 'claimed');
assert.equal(derivePublicProfileControlStatus({ verification_state: 'in_verification' }), 'claimed');
assert.equal(derivePublicProfileControlStatus({ profile_control_status: 'suspended' }), 'suspended');
assert.equal(derivePublicProfileControlStatus({ status: 'suspendata' }), 'suspended');

console.log('Provider public trust regression checks passed.');
