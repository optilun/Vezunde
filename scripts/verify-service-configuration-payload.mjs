import assert from 'node:assert/strict';
import { validateServiceConfigurationPayload } from '../shared/serviceConfigurationPayloadExtended.js';

const validPayload = {
  selected_ids: {
    optometry: ['optometry_consultation'],
    contact_lenses: ['contact_lens_fitting'],
    technical_activities: ['metal_frame_soldering'],
  },
  removal_ids: {},
  raw_removal_keys: ['reparatii_ochelari'],
  suggestions: [{
    group: 'technical_activities',
    label: 'Operațiune tehnică nouă',
    note: 'Propunere pentru catalog',
    functional_unit_key: 'optical_workshop',
    capability_key: '',
  }],
  functional_units: [
    { unit_key: 'optometry_cabinet', care_setting: 'outpatient', note: '' },
    { unit_key: 'optical_workshop', care_setting: 'not_applicable', note: '' },
  ],
  capabilities: [
    { capability_key: 'contact_lens_professional_services', parent_unit_key: 'optometry_cabinet', note: '' },
  ],
  service_unit_map: {
    optometry_consultation: 'optometry_cabinet',
    contact_lens_fitting: 'optometry_cabinet',
    metal_frame_soldering: 'optical_workshop',
  },
  resource_links: {
    professionals: [{ assignment_id: 'assign-1', unit_keys: ['optometry_cabinet'] }],
    equipment: [{ equipment_id: 'eq-1', unit_key: 'optometry_cabinet' }],
    facilities: [{ facility_id: 'fac-1', unit_key: 'optical_workshop' }],
  },
  removal_unit_keys: ['optical_store'],
  removal_capabilities: [{ capability_key: 'contact_lens_sales', parent_unit_key: 'optical_store' }],
  resource_removals: {
    professionals: [{ assignment_id: 'assign-2', unit_keys: ['optical_store'] }],
    equipment: [{ equipment_id: 'eq-2' }],
    facilities: [{ facility_id: 'fac-2' }],
  },
  care_setting: 'outpatient',
};

const valid = validateServiceConfigurationPayload(validPayload);
assert.equal(valid.valid, true);
assert.equal(valid.clean.functional_units.length, 2);
assert.equal(valid.clean.capabilities.length, 1);
assert.equal(valid.clean.service_unit_map.contact_lens_fitting, 'optometry_cabinet');
assert.equal(valid.clean.resource_links.professionals[0].assignment_id, 'assign-1');
assert.deepEqual(valid.clean.removal_unit_keys, ['optical_store']);
assert.equal(valid.clean.removal_capabilities[0].capability_key, 'contact_lens_sales');
assert.deepEqual(valid.clean.resource_removals.professionals[0].unit_keys, ['optical_store']);

const duplicateUnits = validateServiceConfigurationPayload({
  ...validPayload,
  functional_units: [
    { unit_key: 'optometry_cabinet', care_setting: 'outpatient' },
    { unit_key: 'optometry_cabinet', care_setting: 'outpatient' },
    { unit_key: 'optical_workshop', care_setting: 'not_applicable' },
  ],
});
assert.equal(duplicateUnits.valid, true);
assert.equal(duplicateUnits.clean.functional_units.length, 2, 'Unitățile duplicate trebuie normalizate idempotent');

const invalidCapabilityParent = validateServiceConfigurationPayload({
  ...validPayload,
  capabilities: [{ capability_key: 'contact_lens_professional_services', parent_unit_key: 'optical_workshop' }],
});
assert.equal(invalidCapabilityParent.valid, false);
assert.match(invalidCapabilityParent.error, /incompatibilă/i);

const missingCapabilityForService = validateServiceConfigurationPayload({
  ...validPayload,
  capabilities: [],
});
assert.equal(missingCapabilityForService.valid, false);
assert.match(missingCapabilityForService.error, /necesită o capabilitate/i);

const wrongServiceUnit = validateServiceConfigurationPayload({
  ...validPayload,
  service_unit_map: { ...validPayload.service_unit_map, metal_frame_soldering: 'optometry_cabinet' },
});
assert.equal(wrongServiceUnit.valid, false);
assert.match(wrongServiceUnit.error, /incompatibil/i);

const canonicalRawRemoval = validateServiceConfigurationPayload({
  ...validPayload,
  raw_removal_keys: ['eyeglasses'],
});
assert.equal(canonicalRawRemoval.valid, false);
assert.match(canonicalRawRemoval.error, /removal_ids/i);

const invalidResourceUnit = validateServiceConfigurationPayload({
  ...validPayload,
  resource_links: {
    ...validPayload.resource_links,
    equipment: [{ equipment_id: 'eq-1', unit_key: 'ophthalmology_diagnostics' }],
  },
});
assert.equal(invalidResourceUnit.valid, false);
assert.match(invalidResourceUnit.error, /unități invalide/i);

const invalidRemovalCapability = validateServiceConfigurationPayload({
  ...validPayload,
  removal_capabilities: [{ capability_key: 'contact_lens_professional_services', parent_unit_key: 'optical_workshop' }],
});
assert.equal(invalidRemovalCapability.valid, false);
assert.match(invalidRemovalCapability.error, /invalidă|incompatibilă/i);

const invalidRemovalResourceUnit = validateServiceConfigurationPayload({
  ...validPayload,
  resource_removals: {
    ...validPayload.resource_removals,
    professionals: [{ assignment_id: 'assign-2', unit_keys: ['unknown_unit'] }],
  },
});
assert.equal(invalidRemovalResourceUnit.valid, false);
assert.match(invalidRemovalResourceUnit.error, /invalidă/i);

const b2bPayload = validateServiceConfigurationPayload({
  selected_ids: { b2b_capabilities: ['wholesale_frames'] },
  removal_ids: {},
  raw_removal_keys: [],
  suggestions: [],
  functional_units: [{ unit_key: 'b2b_distribution_center', care_setting: 'not_applicable' }],
  capabilities: [{ capability_key: 'b2b_distribution', parent_unit_key: 'b2b_distribution_center' }],
  service_unit_map: { wholesale_frames: 'b2b_distribution_center' },
  resource_links: { professionals: [], equipment: [], facilities: [] },
  care_setting: 'not_applicable',
});
assert.equal(b2bPayload.valid, true);

console.log('Service configuration payload validation: PASS');
