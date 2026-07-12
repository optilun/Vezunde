import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../shared/canonicalServiceRegistryExtended.js';
import '../shared/serviceOperationalTaxonomyExtended.js';
import {
  evaluateServicePrerequisites,
  getServicePrerequisiteDefinition,
  SERVICE_PREREQUISITE_POLICY,
} from '../shared/servicePrerequisiteEngine.js';

const verifiedClinic = {
  id: 'loc-clinic',
  provider_profile_type: 'ophthalmology_clinic',
  profile_control_status: 'verified',
  active_status: 'activa',
};

const opticalLocation = {
  id: 'loc-optical',
  provider_profile_type: 'independent_optical_store',
  profile_control_status: 'claimed',
  active_status: 'activa',
};

const ophthalmologist = { id: 'pro-oph', professional_type: 'ophthalmologist', verification_status: 'verified' };
const optometrist = { id: 'pro-optom', professional_type: 'optometrist', verification_status: 'verified' };

const assignment = (profile, unitKeys) => ({
  id: `assign-${profile.id}-${unitKeys.join('-')}`,
  professional_id: profile.id,
  professional_type: profile.professional_type,
  active_status: 'activ',
  affiliation_status: 'vezunde_verified',
  functional_unit_keys: unitKeys,
});

const verifiedEquipment = (key, unitKey) => ({
  id: `eq-${key}-${unitKey || 'none'}`,
  equipment_category_key: key,
  functional_unit_key: unitKey || '',
  is_active: true,
  evidence_status: 'approved',
  confirmation_level: 'vezunde_verified',
});

const providerEquipment = (key, unitKey) => ({
  ...verifiedEquipment(key, unitKey),
  confirmation_level: 'provider_confirmed',
});

const unit = (unitKey) => ({ unit_key: unitKey, is_active: true, confirmation_level: 'vezunde_verified' });
const capability = (capabilityKey, parentUnitKey) => ({ capability_key: capabilityKey, parent_unit_key: parentUnitKey, is_active: true });
const facility = (key, unitKey) => ({ id: `facility-${key}`, facility_key: key, functional_unit_key: unitKey || '', is_active: true });

const consultContext = {
  location: verifiedClinic,
  assignments: [assignment(ophthalmologist, ['ophthalmology_office'])],
  professionals: [ophthalmologist],
  equipment: [verifiedEquipment('slit_lamp', 'ophthalmology_office'), verifiedEquipment('visual_acuity_chart', 'ophthalmology_office')],
  facilities: [],
  functionalUnits: [unit('ophthalmology_office')],
  capabilities: [],
  enforceUnitScope: true,
};

const consult = evaluateServicePrerequisites('ophthalmology_consultation', consultContext);
assert.equal(consult.eligible, true);
assert.equal(consult.status, 'ready_for_review');
assert.equal(consult.evidence.service_unit_key, 'ophthalmology_office');

const missingUnit = evaluateServicePrerequisites('oct', {
  ...consultContext,
  functionalUnits: [unit('ophthalmology_office')],
  equipment: [verifiedEquipment('oct', 'ophthalmology_diagnostics')],
});
assert.equal(missingUnit.eligible, false);
assert.equal(missingUnit.status, 'requires_functional_unit');

assert.equal(SERVICE_PREREQUISITE_POLICY.enforce_verified_specialist, false, 'Politica MVP trebuie să permită configurarea fără profil individual de specialist');

const consultWithoutSpecialist = evaluateServicePrerequisites('ophthalmology_consultation', {
  ...consultContext,
  assignments: [],
  professionals: [],
});
assert.equal(consultWithoutSpecialist.eligible, true, 'Consultația poate fi configurată fără specialist individual în etapa MVP');
assert.equal(consultWithoutSpecialist.status, 'ready_for_review');
assert.equal(consultWithoutSpecialist.evidence.verified_specialist_enforced, false);

const wrongUnitEquipment = evaluateServicePrerequisites('oct', {
  ...consultContext,
  functionalUnits: [unit('ophthalmology_diagnostics')],
  assignments: [assignment(ophthalmologist, ['ophthalmology_diagnostics'])],
  equipment: [verifiedEquipment('oct', 'ophthalmology_office')],
});
assert.equal(wrongUnitEquipment.eligible, false);
assert.equal(wrongUnitEquipment.status, 'requires_equipment');

const octReady = evaluateServicePrerequisites('oct', {
  ...consultContext,
  functionalUnits: [unit('ophthalmology_diagnostics')],
  assignments: [assignment(ophthalmologist, ['ophthalmology_diagnostics'])],
  equipment: [verifiedEquipment('oct', 'ophthalmology_diagnostics')],
});
assert.equal(octReady.eligible, true);

const providerConfirmedMedicalEquipment = evaluateServicePrerequisites('oct', {
  ...consultContext,
  functionalUnits: [unit('ophthalmology_diagnostics')],
  assignments: [assignment(ophthalmologist, ['ophthalmology_diagnostics'])],
  equipment: [providerEquipment('oct', 'ophthalmology_diagnostics')],
});
assert.equal(providerConfirmedMedicalEquipment.eligible, false, 'Echipamentul medical trebuie verificat de Vezunde');

const missingCapability = evaluateServicePrerequisites('contact_lens_fitting', {
  location: opticalLocation,
  assignments: [assignment(optometrist, ['optometry_cabinet'])],
  professionals: [optometrist],
  equipment: [verifiedEquipment('slit_lamp', 'optometry_cabinet'), verifiedEquipment('contact_lens_trial_set', 'optometry_cabinet')],
  facilities: [],
  functionalUnits: [unit('optometry_cabinet')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(missingCapability.eligible, false);
assert.equal(missingCapability.status, 'requires_capability');

const contactLensReady = evaluateServicePrerequisites('contact_lens_fitting', {
  location: opticalLocation,
  assignments: [assignment(optometrist, ['optometry_cabinet'])],
  professionals: [optometrist],
  equipment: [verifiedEquipment('slit_lamp', 'optometry_cabinet'), verifiedEquipment('contact_lens_trial_set', 'optometry_cabinet')],
  facilities: [],
  functionalUnits: [unit('optometry_cabinet')],
  capabilities: [capability('contact_lens_professional_services', 'optometry_cabinet')],
  enforceUnitScope: true,
});
assert.equal(contactLensReady.eligible, true);

const optometryReady = evaluateServicePrerequisites('optometry_consultation', {
  location: opticalLocation,
  assignments: [assignment(optometrist, ['optometry_cabinet'])],
  professionals: [optometrist],
  equipment: [verifiedEquipment('autorefractometer', 'optometry_cabinet')],
  facilities: [],
  functionalUnits: [unit('optometry_cabinet')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(optometryReady.eligible, true);

const solderingMissingEquipment = evaluateServicePrerequisites('metal_frame_soldering', {
  location: opticalLocation,
  assignments: [],
  professionals: [],
  equipment: [providerEquipment('polisher', 'optical_workshop')],
  facilities: [facility('optical_workshop', 'optical_workshop')],
  functionalUnits: [unit('optical_workshop')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(solderingMissingEquipment.eligible, false);
assert.equal(solderingMissingEquipment.status, 'requires_equipment');

const solderingReady = evaluateServicePrerequisites('metal_frame_soldering', {
  location: opticalLocation,
  assignments: [],
  professionals: [],
  equipment: [providerEquipment('frame_welding_system', 'optical_workshop')],
  facilities: [facility('optical_workshop', 'optical_workshop')],
  functionalUnits: [unit('optical_workshop')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(solderingReady.eligible, true);

const cataractMissingSurgeryUnit = evaluateServicePrerequisites('cataract_surgery', {
  ...consultContext,
  equipment: [verifiedEquipment('operating_microscope', 'ophthalmology_surgery_unit'), verifiedEquipment('phacoemulsification_system', 'ophthalmology_surgery_unit')],
  facilities: [facility('surgical_unit', 'ophthalmology_surgery_unit')],
  functionalUnits: [unit('ophthalmology_office')],
});
assert.equal(cataractMissingSurgeryUnit.eligible, false);
assert.equal(cataractMissingSurgeryUnit.status, 'requires_functional_unit');

const cataractReady = evaluateServicePrerequisites('cataract_surgery', {
  location: verifiedClinic,
  assignments: [assignment(ophthalmologist, ['ophthalmology_surgery_unit'])],
  professionals: [ophthalmologist],
  equipment: [verifiedEquipment('operating_microscope', 'ophthalmology_surgery_unit'), verifiedEquipment('phacoemulsification_system', 'ophthalmology_surgery_unit')],
  facilities: [facility('surgical_unit', 'ophthalmology_surgery_unit')],
  functionalUnits: [unit('ophthalmology_surgery_unit')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(cataractReady.eligible, true);

const incompatibleSurgery = evaluateServicePrerequisites('cataract_surgery', {
  ...cataractReady,
  location: opticalLocation,
});
assert.equal(incompatibleSurgery.eligible, false);
assert.equal(incompatibleSurgery.status, 'incompatible_profile');

const b2bReady = evaluateServicePrerequisites('wholesale_frames', {
  location: { id: 'b2b', provider_profile_type: 'future_b2b_distributor', profile_control_status: 'claimed' },
  assignments: [], professionals: [], equipment: [], facilities: [],
  functionalUnits: [unit('b2b_distribution_center')],
  capabilities: [capability('b2b_distribution', 'b2b_distribution_center')],
  enforceUnitScope: true,
});
assert.equal(b2bReady.eligible, true);
assert.equal(b2bReady.status, 'available');

const locationWideB2bReady = evaluateServicePrerequisites('onsite_eye_testing_b2b', {
  location: opticalLocation,
  assignments: [assignment(optometrist, ['optometry_cabinet'])],
  professionals: [optometrist],
  equipment: [],
  facilities: [],
  functionalUnits: [unit('optical_store'), unit('optometry_cabinet')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(locationWideB2bReady.eligible, true, 'Serviciul B2B la nivel de locație trebuie să accepte specialistul asociat unui cabinet compatibil');
assert.equal(locationWideB2bReady.status, 'ready_for_review');
assert.equal(locationWideB2bReady.evidence.validation_scope, 'location');
assert.equal(locationWideB2bReady.evidence.prerequisite_unit_key, '');

const casReadyForReview = evaluateServicePrerequisites('cas_reimbursed_services', {
  location: opticalLocation,
  assignments: [],
  professionals: [],
  equipment: [],
  facilities: [],
  functionalUnits: [unit('optical_store')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(casReadyForReview.eligible, true);
assert.equal(casReadyForReview.status, 'ready_for_review', 'Disponibilitatea CAS trebuie verificată înainte de publicare');

const dynamicRevalidation = evaluateServicePrerequisites('oct', {
  ...octReady,
  location: verifiedClinic,
  assignments: [assignment(ophthalmologist, ['ophthalmology_diagnostics'])],
  professionals: [ophthalmologist],
  equipment: [{ ...verifiedEquipment('oct', 'ophthalmology_diagnostics'), is_active: false }],
  facilities: [],
  functionalUnits: [unit('ophthalmology_diagnostics')],
  capabilities: [],
  enforceUnitScope: true,
});
assert.equal(dynamicRevalidation.eligible, false, 'Dezactivarea echipamentului trebuie să blocheze serviciul');

assert.ok(getServicePrerequisiteDefinition('orthokeratology').required_equipment_types.includes('corneal_topographer'));
assert.ok(getServicePrerequisiteDefinition('vitreoretinal_surgery').required_infrastructure_types.includes('surgical_infrastructure'));
assert.equal(getServicePrerequisiteDefinition('camp_vizual')?.key, 'visual_field_analyzer');
assert.equal(evaluateServicePrerequisites('serviciu_necunoscut', consultContext).status, 'unknown_service');

const source = async (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
for (const relativePath of [
  'base44/functions/getProviderServiceConfiguration/entry.ts',
  'base44/functions/getPublicProviderProfile/entry.ts',
  'base44/functions/browseDirectoryProviders/entry.ts',
  'base44/functions/matchProviders/entry.ts',
  'base44/functions/adminServiceConfigurationReview/entry.ts',
]) {
  assert.match(await source(relativePath), /servicePrerequisiteEngine\.js/, `${relativePath} trebuie să folosească motorul comun`);
}

const adminUiSource = await source('src/components/admin/directory/AdminWorkspaceSubmissionsReview.jsx');
assert.match(adminUiSource, /adminServiceConfigurationReview/, 'Admin UI trebuie să folosească review-ul configurației complete');
assert.match(adminUiSource, /const blocked/, 'Butonul de aprobare trebuie blocat când lipsesc cerințe');

const providerUiSource = await source('src/components/workspace/provider/ProviderServicesWorkspaceOperational.jsx');
assert.match(providerUiSource, /providerServiceConfigurationOps/, 'Provider UI trebuie să folosească fluxul operațional dedicat');
assert.match(providerUiSource, /getProviderServiceConfiguration/, 'Provider UI trebuie să consume read modelul complet');
assert.match(providerUiSource, /CapabilitySelection/, 'Provider UI trebuie să separe capabilitățile de spații');
assert.match(providerUiSource, /UnitResources/, 'Provider UI trebuie să lege resursele de unitate');

const providerOpsSource = await source('base44/functions/providerServiceConfigurationOps/entry.ts');
assert.match(providerOpsSource, /organization_owner.*location_manager/, 'Doar ownerul și managerul pot edita serviciile publice');
const adminSource = await source('base44/functions/adminServiceConfigurationReview/entry.ts');
for (const entity of ['LocationFunctionalUnit', 'LocationCapability', 'ServiceCatalogSuggestion']) {
  assert.match(adminSource, new RegExp(entity), `Admin review trebuie să persiste ${entity}`);
}

console.log('Unit-scoped service prerequisite engine and consumers: PASS');
