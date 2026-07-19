import assert from 'node:assert/strict';
import {
  candidateRelation,
  hasStrongDuplicateCandidate,
  validateLocationResolution,
} from '../shared/providerLocationIdentityResolution.js';

assert.equal(candidateRelation('', 'org-a'), 'unassigned_directory');
assert.equal(candidateRelation('org-a', 'org-a'), 'same_organization');
assert.equal(candidateRelation('org-b', 'org-a'), 'other_organization');

assert.equal(hasStrongDuplicateCandidate([{ score: 73 }]), true);
assert.equal(hasStrongDuplicateCandidate([{ score: 45, reasons: ['nume similar'] }]), false);
assert.equal(hasStrongDuplicateCandidate([{ reasons: ['telefon identic'] }]), true);

const createWithoutDuplicate = validateLocationResolution({
  kind: 'new_location_for_existing_organization',
  resolutionMode: 'create_new',
  candidates: [],
});
assert.equal(createWithoutDuplicate.ok, true);

const blockedSeparate = validateLocationResolution({
  kind: 'new_location_for_existing_organization',
  resolutionMode: 'create_new',
  candidates: [{ id: 'loc-1', score: 90 }],
  confirmSeparateLocation: false,
  note: '',
});
assert.equal(blockedSeparate.ok, false);

const confirmedSeparate = validateLocationResolution({
  kind: 'new_location_for_existing_organization',
  resolutionMode: 'create_new',
  candidates: [{ id: 'loc-1', score: 90 }],
  confirmSeparateLocation: true,
  note: 'Este un punct de lucru distinct, aflat la un alt numar stradal.',
});
assert.equal(confirmedSeparate.ok, true);

const attachUnassigned = validateLocationResolution({
  kind: 'associate_existing_location',
  resolutionMode: 'use_existing',
  targetLocationId: 'loc-1',
  candidates: [{ id: 'loc-1' }],
  targetOrganizationId: '',
  submissionOrganizationId: 'org-a',
});
assert.equal(attachUnassigned.ok, true);
assert.equal(attachUnassigned.relation, 'unassigned_directory');

const blockedCrossOrganizationUse = validateLocationResolution({
  kind: 'associate_existing_location',
  resolutionMode: 'use_existing',
  targetLocationId: 'loc-1',
  candidates: [{ id: 'loc-1' }],
  targetOrganizationId: 'org-b',
  submissionOrganizationId: 'org-a',
});
assert.equal(blockedCrossOrganizationUse.ok, false);

const blockedTransferWithoutConfirmation = validateLocationResolution({
  kind: 'associate_existing_location',
  resolutionMode: 'transfer_existing',
  targetLocationId: 'loc-1',
  candidates: [{ id: 'loc-1' }],
  targetOrganizationId: 'org-b',
  submissionOrganizationId: 'org-a',
  confirmCrossOrganizationTransfer: false,
  note: 'Verificare administrativa completa pentru transferul profilului.',
});
assert.equal(blockedTransferWithoutConfirmation.ok, false);

const approvedTransfer = validateLocationResolution({
  kind: 'associate_existing_location',
  resolutionMode: 'transfer_existing',
  targetLocationId: 'loc-1',
  candidates: [{ id: 'loc-1' }],
  targetOrganizationId: 'org-b',
  submissionOrganizationId: 'org-a',
  confirmCrossOrganizationTransfer: true,
  note: 'Am verificat reprezentarea si continuitatea locatiei intre organizatii.',
});
assert.equal(approvedTransfer.ok, true);
assert.equal(approvedTransfer.relation, 'other_organization');

const arbitraryTarget = validateLocationResolution({
  kind: 'associate_existing_location',
  resolutionMode: 'use_existing',
  targetLocationId: 'loc-2',
  candidates: [{ id: 'loc-1' }],
  targetOrganizationId: '',
  submissionOrganizationId: 'org-a',
});
assert.equal(arbitraryTarget.ok, false);

console.log('Provider location identity resolution checks passed.');
