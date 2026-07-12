import assert from 'node:assert/strict';
import {
  hasPublishedSectionChanges,
  sameSubmissionPayload,
} from '../shared/providerWorkspaceSubmissionComparison.js';

const location = {
  public_display_name: 'Lunera Optic Store',
  address: 'SAT GIROC, STR. CUPIDON, NR.40, ET.',
  public_phone: '',
  phone_public: '0721152307',
  public_email: 'contact@optilun.com',
  lat: null,
  lng: null,
  place_id: '',
};

assert.equal(hasPublishedSectionChanges('location_details', {
  public_display_name: ' Lunera Optic Store ',
  address: 'SAT GIROC, STR. CUPIDON, NR.40, ET.',
  public_phone: '0721 152 307',
  public_email: 'CONTACT@OPTILUN.COM',
  lat: '',
  lng: undefined,
  place_id: null,
}, location), false, 'location_details identical values must be a no-op');

assert.equal(sameSubmissionPayload('location_details', { lat: null, lng: '', place_id: undefined }, { lat: '', lng: null, place_id: '' }), true, 'optional empty values must be equivalent');
assert.equal(hasPublishedSectionChanges('location_details', { address: 'Alta adresa' }, location), true, 'real address change must be detected');

const organization = {
  public_display_name: 'Lunera Optic Store',
  public_description: 'Descriere',
  public_phone: '0721152307',
  public_email: 'contact@optilun.com',
  website_url: 'https://optilun.com/',
  facebook_url: '',
  instagram_url: '',
  linkedin_url: '',
};
assert.equal(hasPublishedSectionChanges('public_profile', {
  public_display_name: 'Lunera Optic Store',
  public_description: 'Descriere',
  public_phone: '0721-152-307',
  public_email: 'CONTACT@OPTILUN.COM',
  website_url: 'optilun.com',
  facebook_url: null,
  instagram_url: '',
  linkedin_url: undefined,
}, organization), false, 'public_profile identical values must be a no-op');
assert.equal(hasPublishedSectionChanges('public_profile', { public_description: 'Descriere noua' }, organization), true, 'real organization change must be detected');

console.log('provider submission comparison: 5 checks passed');
