import assert from 'node:assert/strict';
import {
  evaluateServicePrerequisites,
  getServicePrerequisiteDefinition,
} from '../shared/servicePrerequisiteEngine.js';

const verifiedLocation = {
  id: 'loc-1',
  provider_profile_type: 'ophthalmology_clinic',
  profile_control_status: 'verified',
  active_status: 'activa',
};

const opticalLocation = {
  id: 'loc-2',
  provider_profile_type: 'independent_optical_store',
  profile_control_status: 'claimed',
  active_status: 'activa',
};

const ophthalmologist = {
  id: 'pro-oph',
  professional_type: 'ophthalmologist',
  verification_status: 'verified',
};

const optometrist = {
  id: 'pro-optom',
  professional_type: 'optometrist',
  verification_status: 'verified',
};

const assignments = [
  {
    professional_id: ophthalmologist.id,
    professional_type: 'ophthalmologist',
    active_status: 'activ',
    affiliation_status: 'vezunde_verified',
  },
];

const verifiedEquipment = (key) => ({
  equipment_category_key: key,
  is_active: true,
  evidence_status: 'approved',
  confirmation_level: 'vezunde_verified',
});

const providerEquipment = (key) => ({
  equipment_category_key: key,
  is_active: true,
  evidence_status: 'approved',
  confirmation_level: 'provider_confirmed',
});

const baseContext = {
  location: verifiedLocation,
  assignments,
  professionals: [ophthalmologist],
  equipment: [verifiedEquipment('slit_lamp'), verifiedEquipment('visual_acuity_chart')],
  facilities: [],
};

const consult = evaluateServicePrerequisites('ophthalmology_consultation', baseContext);
assert.equal(consult.eligible, true);
assert.equal(consult.status, 'ready_for_review');
assert.equal(consult.blockers.length, 0);

const missingSpecialist = evaluateServicePrerequisites('ophthalmology_consultation', {
  ...baseContext,
  assignments: [],
  professionals: [],
});
assert.equal(missingSpecialist.eligible, false);
assert.equal(missingSpecialist.status, 'requires_verified_specialist');
assert.ok(missingSpecialist.blockers.some((blocker) => blocker.code === 'verified_specialist_missing'));

const octMissingEquipment = evaluateServicePrerequisites('oct', {
  ...baseContext,
  equipment: [verifiedEquipment('slit_lamp')],
});
assert.equal(octMissingEquipment.eligible, false);
assert.equal(octMissingEquipment.status, 'requires_equipment');

const octReady = evaluateServicePrerequisites('oct', {
  ...baseContext,
  equipment: [verifiedEquipment('oct')],
});
assert.equal(octReady.eligible, true);

const providerConfirmedMedicalEquipment = evaluateServicePrerequisites('oct', {
  ...baseContext,
  equipment: [providerEquipment('oct')],
});
assert.equal(providerConfirmedMedicalEquipment.eligible, false, 'Echipamentul medical trebuie verificat de Vezunde');

const cataractWithoutInfrastructure = evaluateServicePrerequisites('cataract_surgery', {
  ...baseContext,
  equipment: [verifiedEquipment('operating_microscope'), verifiedEquipment('phacoemulsification_system')],
});
assert.equal(cataractWithoutInfrastructure.eligible, false);
assert.equal(cataractWithoutInfrastructure.status, 'requires_infrastructure');

const cataractReady = evaluateServicePrerequisites('cataract_surgery', {
  ...baseContext,
  location: { ...verifiedLocation, surgical_infrastructure_verified: true },
  equipment: [verifiedEquipment('operating_microscope'), verifiedEquipment('phacoemulsification_system')],
});
assert.equal(cataractReady.eligible, true);

const incompatibleSurgery = evaluateServicePrerequisites('cataract_surgery', {
  ...baseContext,
  location: opticalLocation,
});
assert.equal(incompatibleSurgery.eligible, false);
assert.equal(incompatibleSurgery.status, 'incompatible_profile');

const retailProduct = evaluateServicePrerequisites('eyeglasses', {
  location: opticalLocation,
});
assert.equal(retailProduct.eligible, true);
assert.equal(retailProduct.status, 'available');

const optometryWithOptometrist = evaluateServicePrerequisites('optometry_consultation', {
  location: opticalLocation,
  assignments: [{
    professional_id: optometrist.id,
    professional_type: 'optometrist',
    active_status: 'activ',
    affiliation_status: 'vezunde_verified',
  }],
  professionals: [optometrist],
  equipment: [verifiedEquipment('autorefractometer')],
  facilities: [],
});
assert.equal(optometryWithOptometrist.eligible, true);

const workshopReady = evaluateServicePrerequisites('eyeglasses_repair', {
  location: opticalLocation,
  assignments: [],
  professionals: [],
  equipment: [providerEquipment('drill')],
  facilities: [{ facility_key: 'atelier_service_propriu', is_active: true }],
});
assert.equal(workshopReady.eligible, true);

const workshopMissingFacility = evaluateServicePrerequisites('eyeglasses_repair', {
  location: opticalLocation,
  equipment: [providerEquipment('drill')],
  facilities: [],
});
assert.equal(workshopMissingFacility.eligible, false);
assert.equal(workshopMissingFacility.status, 'requires_infrastructure');

const dynamicRevalidation = evaluateServicePrerequisites('oct', {
  ...baseContext,
  equipment: [{ ...verifiedEquipment('oct'), is_active: false }],
});
assert.equal(dynamicRevalidation.eligible, false, 'Dezactivarea echipamentului trebuie sa blocheze serviciul');

assert.equal(getServicePrerequisiteDefinition('camp_vizual')?.key, 'visual_field_analyzer');
assert.equal(evaluateServicePrerequisites('serviciu_necunoscut', baseContext).status, 'unknown_service');

console.log('Service prerequisite engine: PASS');
