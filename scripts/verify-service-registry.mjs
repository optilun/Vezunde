import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  AMBIGUOUS_LEGACY_SERVICE_KEYS,
  CANONICAL_SERVICE_KEYS,
  CANONICAL_SERVICE_REGISTRY,
  LEGACY_SERVICE_ALIASES,
  SERVICE_GROUPS,
  getCanonicalServiceDefinition,
  getCanonicalServiceGroupIds,
  isServiceMatchingEligible,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from "../shared/canonicalServiceRegistry.js";
import {
  CAPABILITY_KEYS,
  FUNCTIONAL_UNIT_KEYS,
  FUNCTIONAL_UNIT_PROFILE_LAYOUTS,
  LOCATION_CAPABILITIES,
  LOCATION_FUNCTIONAL_UNITS,
} from "../shared/locationOperationalRegistry.js";
import {
  PROVIDER_SERVICE_SECTIONS,
  validateOperationalTaxonomy,
} from "../shared/serviceOperationalTaxonomy.js";
import { CLIENT_NEED_SECTIONS } from "../src/lib/servicePresentation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sorted(values) {
  return [...values].sort();
}

function sourcePath(relativePath) {
  return path.join(root, relativePath);
}

const canonicalKeys = CANONICAL_SERVICE_KEYS;
const canonicalSet = new Set(canonicalKeys);
assert.ok(canonicalKeys.length > 94, "Catalogul extins trebuie să depășească baza istorică de 94 de chei");
assert.equal(canonicalSet.size, canonicalKeys.length, "Cheile canonice trebuie să fie unice");
assert.equal(Object.isFrozen(CANONICAL_SERVICE_REGISTRY), false, "Registrul nu trebuie înghețat înainte ca adaptoarele să derive copii locale");

const groupIds = getCanonicalServiceGroupIds();
const groupedKeys = Object.values(groupIds).flat();
assert.equal(groupedKeys.length, canonicalKeys.length, "Suma cheilor din grupuri trebuie să coincidă cu registrul");
assert.equal(new Set(groupedKeys).size, canonicalKeys.length, "O cheie nu poate exista în două grupuri canonice");
assert.deepEqual(sorted(groupedKeys), sorted(canonicalKeys), "Registrul și grupurile trebuie să aibă aceleași chei");

const acceptedKinds = new Set([
  "product", "service", "investigation", "specialty", "procedure", "surgery",
  "technical_activity", "b2b_service", "b2b_product",
]);
for (const key of canonicalKeys) {
  const definition = getCanonicalServiceDefinition(key);
  assert.ok(definition, `Lipsește definiția pentru ${key}`);
  assert.equal(definition.key, key);
  assert.ok(SERVICE_GROUPS[definition.group], `Grup invalid pentru ${key}`);
  assert.equal(SERVICE_GROUPS[definition.group].ids[key], definition.label, `Label nealiniat pentru ${key}`);
  assert.ok(acceptedKinds.has(definition.kind), `Kind invalid pentru ${key}: ${definition.kind}`);
  assert.ok(["general", "technical", "specialized_medical"].includes(definition.service_need_level), `Nivel invalid pentru ${key}`);
  assert.ok(["provider_confirmed", "vezunde_verified"].includes(definition.default_confirmation_level), `Confirmation default invalid pentru ${key}`);
  assert.equal(typeof definition.patient_facing, "boolean", `patient_facing lipsește pentru ${key}`);
  assert.equal(typeof definition.b2b_only, "boolean", `b2b_only lipsește pentru ${key}`);
  if (definition.b2b_only) assert.equal(definition.patient_facing, false, `Serviciul B2B ${key} nu poate fi patient-facing`);
}

const operationalValidation = validateOperationalTaxonomy();
assert.deepEqual(operationalValidation.duplicates, [], "O cheie nu poate apărea în două secțiuni operaționale");
assert.deepEqual(operationalValidation.unknown, [], "Taxonomia operațională nu poate conține chei necunoscute");
assert.deepEqual(operationalValidation.missing, [], "Taxonomia operațională trebuie să acopere întregul registru");
assert.equal(operationalValidation.total, canonicalKeys.length, "Taxonomia operațională trebuie să fie în paritate cu registrul");

const workspaceKeys = PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((item) => item.id));
assert.equal(workspaceKeys.length, canonicalKeys.length, "Workspace-ul trebuie să conțină toate cheile canonice");
assert.equal(new Set(workspaceKeys).size, canonicalKeys.length, "Cheile workspace-ului trebuie să fie unice");
assert.deepEqual(sorted(workspaceKeys), sorted(canonicalKeys), "Workspace-ul și registrul trebuie să fie în paritate");

const patientFacingKeys = canonicalKeys.filter((key) => getCanonicalServiceDefinition(key)?.patient_facing !== false);
const presentationKeys = new Set(CLIENT_NEED_SECTIONS.flatMap((section) => section.items.map((item) => item.id)));
assert.deepEqual(sorted(presentationKeys), sorted(patientFacingKeys), "Prezentarea publică trebuie să acopere exact cheile patient-facing");
for (const key of Object.keys(SERVICE_GROUPS.b2b_capabilities.ids)) {
  assert.equal(presentationKeys.has(key), false, `Cheia B2B ${key} nu trebuie expusă în filtrele pentru pacienți`);
}

const functionalUnitKeySet = new Set(FUNCTIONAL_UNIT_KEYS);
assert.equal(functionalUnitKeySet.size, FUNCTIONAL_UNIT_KEYS.length, "Cheile unităților funcționale trebuie să fie unice");
for (const unitKey of FUNCTIONAL_UNIT_KEYS) assert.ok(LOCATION_FUNCTIONAL_UNITS[unitKey], `Lipsește definiția unității ${unitKey}`);
const capabilityKeySet = new Set(CAPABILITY_KEYS);
assert.equal(capabilityKeySet.size, CAPABILITY_KEYS.length, "Cheile capabilităților trebuie să fie unice");
for (const capabilityKey of CAPABILITY_KEYS) {
  const capability = LOCATION_CAPABILITIES[capabilityKey];
  assert.ok(capability, `Lipsește definiția capabilității ${capabilityKey}`);
  assert.ok(capability.allowedParentUnits.length > 0, `Capabilitatea ${capabilityKey} trebuie să aibă unități părinte`);
  capability.allowedParentUnits.forEach((unitKey) => assert.ok(functionalUnitKeySet.has(unitKey), `Părinte invalid ${unitKey} pentru ${capabilityKey}`));
}
for (const section of PROVIDER_SERVICE_SECTIONS) {
  assert.ok(functionalUnitKeySet.has(section.unitKey), `Unitate invalidă pentru secțiunea ${section.key}`);
  (section.fallbackUnitKeys || []).forEach((unitKey) => assert.ok(functionalUnitKeySet.has(unitKey), `Fallback invalid pentru ${section.key}`));
  if (section.capabilityKey) assert.ok(capabilityKeySet.has(section.capabilityKey), `Capabilitate invalidă pentru ${section.key}`);
  assert.ok(section.kind, `Lipsește kind pentru ${section.key}`);
  if (section.area !== "b2b") assert.ok(section.publicLabel, `Lipsește publicLabel pentru ${section.key}`);
}
for (const [profileType, layout] of Object.entries(FUNCTIONAL_UNIT_PROFILE_LAYOUTS)) {
  const allUnits = [...(layout.primaryUnits || []), ...(layout.optionalUnits || [])];
  assert.equal(new Set(allUnits).size, allUnits.length, `Unități duplicate în layoutul ${profileType}`);
  allUnits.forEach((unitKey) => assert.ok(functionalUnitKeySet.has(unitKey), `Unitate invalidă ${unitKey} în ${profileType}`));
  const allCapabilities = [...(layout.primaryCapabilities || []), ...(layout.optionalCapabilities || [])];
  assert.equal(new Set(allCapabilities).size, allCapabilities.length, `Capabilități duplicate în layoutul ${profileType}`);
  allCapabilities.forEach((key) => assert.ok(capabilityKeySet.has(key), `Capabilitate invalidă ${key} în ${profileType}`));
}

const seenAliases = new Set();
for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_SERVICE_ALIASES)) {
  assert.ok(!seenAliases.has(legacyKey), `Alias duplicat: ${legacyKey}`);
  seenAliases.add(legacyKey);
  assert.ok(canonicalSet.has(canonicalKey), `Aliasul ${legacyKey} indică o cheie inexistentă`);
  const normalized = normalizeServiceKey(legacyKey);
  assert.equal(normalized.status, "legacy_mapped");
  assert.equal(normalized.canonicalKey, canonicalKey);
}
for (const ambiguousKey of AMBIGUOUS_LEGACY_SERVICE_KEYS) {
  assert.equal(LEGACY_SERVICE_ALIASES[ambiguousKey], undefined, `Aliasul ambiguu ${ambiguousKey} nu trebuie mapat automat`);
  assert.equal(normalizeServiceKey(ambiguousKey).status, "legacy_ambiguous");
}
assert.equal(normalizeServiceKey("serviciu_complet_necunoscut").status, "unknown");

const verifiedLocation = { active_status: "activa", profile_control_status: "verified" };
const claimedLocation = { active_status: "activa", profile_control_status: "claimed" };
const productService = { service_key: "eyeglasses", is_active: true, confirmation_level: "provider_confirmed", matching_allowed: true };
const medicalProviderConfirmed = { service_key: "ophthalmology_consultation", is_active: true, confirmation_level: "provider_confirmed", matching_allowed: true };
const medicalVerified = { ...medicalProviderConfirmed, confirmation_level: "vezunde_verified" };
const b2bService = { service_key: "wholesale_frames", is_active: true, confirmation_level: "provider_confirmed", matching_allowed: true };
const unknownService = { service_key: "serviciu_complet_necunoscut", is_active: true, confirmation_level: "vezunde_verified", matching_allowed: true };

assert.equal(isServicePubliclyEligible(productService, claimedLocation), true);
assert.equal(isServiceMatchingEligible(productService, claimedLocation), true);
assert.equal(isServicePubliclyEligible(medicalProviderConfirmed, verifiedLocation), false);
assert.equal(isServiceMatchingEligible(medicalProviderConfirmed, verifiedLocation), false);
assert.equal(isServicePubliclyEligible(medicalVerified, verifiedLocation), true);
assert.equal(isServiceMatchingEligible(medicalVerified, verifiedLocation), true);
assert.equal(isServicePubliclyEligible(b2bService, verifiedLocation), false, "B2B nu poate apărea în canalul pentru pacienți");
assert.equal(isServiceMatchingEligible(b2bService, verifiedLocation), false, "B2B nu poate intra în matching-ul pacienților");
assert.equal(isServicePubliclyEligible(unknownService, verifiedLocation), false);
assert.equal(isServiceMatchingEligible(unknownService, verifiedLocation), false);

const copy = getCanonicalServiceDefinition("eyeglasses");
copy.aliases.push("test-local-copy");
assert.equal(getCanonicalServiceDefinition("eyeglasses").aliases.includes("test-local-copy"), false, "Helperul trebuie să returneze copii defensive");

const consumers = {
  directoryOps: "base44/functions/directoryOps/entry.ts",
  publicProfile: "base44/functions/getPublicProviderProfile/entry.ts",
  browseDirectory: "base44/functions/browseDirectoryProviders/entry.ts",
  matching: "base44/functions/matchProviders/entry.ts",
  providerRead: "base44/functions/getProviderServiceConfiguration/entry.ts",
  adminServiceConfiguration: "base44/functions/adminServiceConfigurationReview/entry.ts",
  matchingBackfill: "base44/functions/backfillLocationServiceMatching/entry.ts",
};
for (const [name, relativePath] of Object.entries(consumers)) {
  const source = await readFile(sourcePath(relativePath), "utf8");
  assert.match(source, /shared\/canonicalServiceRegistry\.js/, `${name} nu importă registrul comun`);
}

const providerOpsSource = await readFile(sourcePath("base44/functions/providerServiceConfigurationOps/entry.ts"), "utf8");
assert.match(providerOpsSource, /serviceConfigurationPayload\.js/, "Fluxul provider trebuie să folosească validatorul comun");
assert.match(providerOpsSource, /Serviciile publice pot fi modificate numai de owner sau manager/, "Stafful trebuie blocat explicit");

const providerReadSource = await readFile(sourcePath("base44/functions/getProviderServiceConfiguration/entry.ts"), "utf8");
assert.match(providerReadSource, /normalized\.status === 'canonical'/, "Citirea providerului trebuie să filtreze explicit doar cheile canonice fără remapare implicită");
assert.match(providerReadSource, /LocationFunctionalUnit/, "Read modelul trebuie să încarce unitățile persistente");

console.log(`Canonical keys: ${canonicalKeys.length}`);
console.log(`Patient-facing keys: ${patientFacingKeys.length}`);
console.log(`B2B-only keys: ${canonicalKeys.length - patientFacingKeys.length}`);
console.log(`Workspace coverage: ${workspaceKeys.length}`);
console.log(`Public presentation coverage: ${presentationKeys.size}`);
console.log(`Functional units: ${FUNCTIONAL_UNIT_KEYS.length}`);
console.log(`Capabilities: ${CAPABILITY_KEYS.length}`);
console.log(`Legacy aliases: ${Object.keys(LEGACY_SERVICE_ALIASES).length}`);
console.log("Expanded service registry parity: PASS");
