import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../shared/canonicalServiceRegistryExtended.js';
import '../shared/serviceOperationalTaxonomyExtended.js';
import {
  evaluateServicePrerequisites,
  getServicePrerequisiteDefinition,
  SERVICE_PREREQUISITE_POLICY,
} from '../shared/servicePrerequisiteEngine.js';

const expectedLaunchPolicy = {
  enforce_profile_compatibility: false,
  enforce_functional_unit: false,
  enforce_capability: false,
  enforce_verified_specialist: false,
  enforce_verified_equipment: false,
  enforce_verified_infrastructure: false,
  show_review_status: false,
};
assert.deepEqual(SERVICE_PREREQUISITE_POLICY, expectedLaunchPolicy);

const emptyContext = {
  location: {
    id: 'loc-provider-declared',
    provider_profile_type: 'independent_optical_store',
    profile_control_status: 'claimed',
    active_status: 'activa',
  },
  assignments: [],
  professionals: [],
  equipment: [],
  facilities: [],
  functionalUnits: [],
  capabilities: [],
  enforceUnitScope: true,
};

for (const serviceKey of [
  'ophthalmology_consultation',
  'oct',
  'contact_lens_fitting',
  'metal_frame_soldering',
  'cataract_surgery',
  'orthokeratology',
  'home_visit_eye_care',
  'workplace_vision_screening',
  'employer_glasses_reimbursement',
]) {
  const result = evaluateServicePrerequisites(serviceKey, emptyContext);
  assert.equal(result.eligible, true, serviceKey + ' trebuie să fie non-blocant la lansare');
  assert.equal(result.status, 'available', serviceKey + ' trebuie să fie disponibil ca declarație');
  assert.deepEqual(result.blockers, [], serviceKey + ' nu trebuie să solicite dovezi');
  assert.equal(result.evidence.profile_compatibility_enforced, false);
  assert.equal(result.evidence.functional_unit_enforced, false);
  assert.equal(result.evidence.capability_enforced, false);
  assert.equal(result.evidence.verified_specialist_enforced, false);
  assert.equal(result.evidence.verified_equipment_enforced, false);
  assert.equal(result.evidence.verified_infrastructure_enforced, false);
}

const incompleteOperationalContext = evaluateServicePrerequisites('oct', {
  ...emptyContext,
  functionalUnits: [{ unit_key: 'ophthalmology_office', is_active: true }],
  equipment: [{
    id: 'oct-inactive',
    equipment_category_key: 'oct',
    functional_unit_key: 'ophthalmology_diagnostics',
    is_active: false,
  }],
});
assert.equal(incompleteOperationalContext.eligible, true);
assert.equal(incompleteOperationalContext.status, 'available');

const incompatibleProfile = evaluateServicePrerequisites('cataract_surgery', emptyContext);
assert.equal(incompatibleProfile.eligible, true, 'Tipul profilului rămâne informație, nu blocaj de serviciu');

// Decontarea CAS nu mai e un serviciu separat (2026-08-06): se marcheaza per serviciu.
// Verificam in schimb ca declararea documentelor pentru angajator ramane non-blocanta.
const employerDocs = evaluateServicePrerequisites('employer_glasses_reimbursement', emptyContext);
assert.equal(employerDocs.eligible, true);
assert.equal(employerDocs.status, 'available', 'Documentele HG 1028 sunt doar informatie declarata de furnizor');

assert.ok(
  getServicePrerequisiteDefinition('orthokeratology').required_equipment_types.includes('corneal_topographer'),
  'Metadatele pot rămâne pentru o etapă viitoare fără a fi aplicate ca blocaj',
);
assert.ok(
  getServicePrerequisiteDefinition('vitreoretinal_surgery').required_infrastructure_types.includes('surgical_infrastructure'),
);
assert.equal(getServicePrerequisiteDefinition('camp_vizual')?.key, 'visual_field_analyzer');

const unknown = evaluateServicePrerequisites('serviciu_necunoscut', emptyContext);
assert.equal(unknown.eligible, false);
assert.equal(unknown.status, 'unknown_service');

const source = async (relativePath) => readFile(new URL('../' + relativePath, import.meta.url), 'utf8');
for (const relativePath of [
  'base44/functions/providerServiceConfigurationOps/getProviderServiceConfiguration.ts',
  'base44/functions/getPublicProviderProfile/entry.ts',
  'base44/functions/browseDirectoryProviders/entry.ts',
  'base44/functions/matchProviders/entry.ts',
  'base44/functions/directoryOps/adminServiceConfigurationReview.ts',
]) {
  const entrySource = await source(relativePath);
  if (/servicePrerequisiteEngine\.js/.test(entrySource)) continue;

  assert.match(entrySource, /from ['"]\.\/sharedDependencies\.js['"]/, relativePath + ' nu importă motorul comun sau bundle-ul local');
  const functionDirectory = relativePath.slice(0, relativePath.lastIndexOf('/'));
  const bundledSource = await source(functionDirectory + '/sharedDependencies.js');
  assert.match(bundledSource, /shared\/servicePrerequisiteEngine\.js/, relativePath + ' are un bundle local fără motorul comun');
  assert.match(bundledSource, /enforce_verified_equipment: false/, relativePath + ' are o politică veche de echipamente');
}

const adminUiSource = await source('src/components/admin/directory/AdminWorkspaceSubmissionsReview.jsx');
assert.match(adminUiSource, /Servicii declarate de furnizor/);
assert.doesNotMatch(adminUiSource, /const blocked/);
assert.doesNotMatch(adminUiSource, /Aprobarea este blocata/);

// Modulul Servicii a fost restructurat (Faza 2, plan-refactor-servicii-2026-08-18.md):
// ProviderServicesWorkspaceOperational.jsx a devenit compozitor subtire. Textele si
// starea verificate mai jos traiesc acum in fisiere separate din services/.
const providerUiSource = await source('src/components/workspace/provider/services/GlobalServiceSections.jsx');
assert.match(providerUiSource, /Nu cerem documente/);
const providerConfigSource = await source('src/components/workspace/provider/services/useProviderServicesConfig.js');
assert.match(providerConfigSource, /configurationComplete: true/);
// CapabilityPicker.jsx a fost eliminat (2026-08-18): modulul "Dotari si activitati" a
// fost desfiintat, capabilitatile traiesc acum inline, in UnitAccordion.jsx, prin
// CapabilityToggle.jsx. Acelasi principiu se verifica acolo.
const providerCapabilitySource = await source('src/components/workspace/provider/services/CapabilityToggle.jsx');
assert.doesNotMatch(providerCapabilitySource, /disabled=\{disabled \|\| !capabilityActive\}/);
assert.doesNotMatch(providerCapabilitySource, /Activează mai întâi capabilitatea/);

const providerOpsSource = await source('base44/functions/providerServiceConfigurationOps/providerServiceConfigurationOps.ts');
assert.match(providerOpsSource, /function validateSubmissionReadiness\(\)/);
assert.match(providerOpsSource, /units, capabilities and resources are optional/);
assert.doesNotMatch(providerOpsSource, /necesită activitatea asociată/);

const adminSource = await source('base44/functions/directoryOps/adminServiceConfigurationReview.ts');
assert.match(adminSource, /provider_declared_services/);
assert.doesNotMatch(adminSource, /location_not_verified/);
assert.doesNotMatch(adminSource, /verifiedKeys/);

const matchingSource = await source('base44/functions/matchProviders/entry.ts');
assert.doesNotMatch(matchingSource, /service_not_vezunde_verified/);
assert.doesNotMatch(matchingSource, /requiredRoles/);
assert.doesNotMatch(matchingSource, /matching_allowed !== true/);

const semanticMatchingSource = await source('base44/functions/matchProvidersSemantic/entry.ts');
assert.doesNotMatch(semanticMatchingSource, /requiredRoles/);
assert.doesNotMatch(semanticMatchingSource, /matching_allowed !== true/);

const backfillSource = await source('base44/functions/directoryOps/backfillLocationServiceMatching.ts');
assert.doesNotMatch(backfillSource, /Serviciul medical nu este verificat individual/);
assert.match(backfillSource, /declarat si confirmat de furnizor/);

console.log('Provider-declared, non-blocking service launch policy: PASS');


