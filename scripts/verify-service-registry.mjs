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
import { CLIENT_NEED_SECTIONS } from "../src/lib/servicePresentation.js";
import { PROVIDER_SERVICE_SECTIONS } from "../src/lib/providerServiceWorkspaceSections.js";
import {
  FUNCTIONAL_UNIT_KEYS,
  FUNCTIONAL_UNIT_PROFILE_LAYOUTS,
  LOCATION_FUNCTIONAL_UNITS,
} from "../src/lib/providerLocationFunctionalUnits.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedCount = 94;

function sorted(values) {
  return [...values].sort();
}

function sourcePath(relativePath) {
  return path.join(root, relativePath);
}

const canonicalKeys = CANONICAL_SERVICE_KEYS;
const canonicalSet = new Set(canonicalKeys);
assert.equal(canonicalKeys.length, expectedCount, `Catalogul trebuie sa aiba exact ${expectedCount} chei`);
assert.equal(canonicalSet.size, expectedCount, "Cheile canonice trebuie sa fie unice");
assert.equal(Object.isFrozen(CANONICAL_SERVICE_REGISTRY), false, "Registrul nu trebuie inghetat inainte ca adaptoarele sa derive copii locale");

const groupIds = getCanonicalServiceGroupIds();
const groupedKeys = Object.values(groupIds).flat();
assert.equal(groupedKeys.length, expectedCount, "Suma cheilor din grupuri trebuie sa fie 94");
assert.equal(new Set(groupedKeys).size, expectedCount, "O cheie nu poate exista in doua grupuri canonice");
assert.deepEqual(sorted(groupedKeys), sorted(canonicalKeys), "Registrul si grupurile trebuie sa aiba aceleasi chei");

for (const key of canonicalKeys) {
  const definition = getCanonicalServiceDefinition(key);
  assert.ok(definition, `Lipseste definitia pentru ${key}`);
  assert.equal(definition.key, key);
  assert.ok(SERVICE_GROUPS[definition.group], `Grup invalid pentru ${key}`);
  assert.equal(SERVICE_GROUPS[definition.group].ids[key], definition.label, `Label nealiniat pentru ${key}`);
  assert.ok(["product", "service", "investigation", "specialty", "procedure", "surgery", "technical_activity"].includes(definition.kind), `Kind invalid pentru ${key}`);
  assert.ok(["general", "technical", "specialized_medical"].includes(definition.service_need_level), `Nivel invalid pentru ${key}`);
  assert.ok(["provider_confirmed", "vezunde_verified"].includes(definition.default_confirmation_level), `Confirmation default invalid pentru ${key}`);
}

const presentationKeys = new Set(
  CLIENT_NEED_SECTIONS.flatMap((section) => section.items.map((item) => item.id)),
);
assert.equal(presentationKeys.size, expectedCount, "Presentation trebuie sa acopere toate cele 94 de chei");
assert.deepEqual(sorted(presentationKeys), sorted(canonicalKeys), "Presentation si registrul trebuie sa fie in paritate");
assert.ok(presentationKeys.has("sports_glasses"), "sports_glasses lipseste din presentation");
assert.ok(presentationKeys.has("safety_glasses"), "safety_glasses lipseste din presentation");

const workspaceKeys = PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((item) => item.id));
assert.equal(workspaceKeys.length, expectedCount, "Workspace-ul structurat trebuie sa contina exact 94 de intrari");
assert.equal(new Set(workspaceKeys).size, expectedCount, "O cheie canonica nu poate aparea in doua sectiuni de workspace");
assert.deepEqual(sorted(workspaceKeys), sorted(canonicalKeys), "Workspace-ul structurat trebuie sa acopere toate cheile canonice");

const functionalUnitKeySet = new Set(FUNCTIONAL_UNIT_KEYS);
assert.equal(functionalUnitKeySet.size, FUNCTIONAL_UNIT_KEYS.length, "Cheile unitatilor functionale trebuie sa fie unice");
for (const unitKey of FUNCTIONAL_UNIT_KEYS) {
  assert.ok(LOCATION_FUNCTIONAL_UNITS[unitKey], `Lipseste definitia unitatii functionale ${unitKey}`);
}
for (const section of PROVIDER_SERVICE_SECTIONS) {
  assert.ok(functionalUnitKeySet.has(section.unitKey), `Unitate functionala invalida pentru sectiunea ${section.key}`);
  if (section.unitKeyForLaboratory) {
    assert.ok(functionalUnitKeySet.has(section.unitKeyForLaboratory), `Unitate de laborator invalida pentru sectiunea ${section.key}`);
  }
  assert.ok(section.kind, `Lipseste kind pentru sectiunea ${section.key}`);
  assert.ok(section.publicLabel, `Lipseste publicLabel pentru sectiunea ${section.key}`);
}
for (const [profileType, layout] of Object.entries(FUNCTIONAL_UNIT_PROFILE_LAYOUTS)) {
  const allUnits = [...(layout.primary || []), ...(layout.optional || [])];
  assert.equal(new Set(allUnits).size, allUnits.length, `Unitati duplicate in layoutul ${profileType}`);
  for (const unitKey of allUnits) {
    assert.ok(functionalUnitKeySet.has(unitKey), `Unitate invalida ${unitKey} in layoutul ${profileType}`);
  }
}

const seenAliases = new Set();
for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_SERVICE_ALIASES)) {
  assert.ok(!seenAliases.has(legacyKey), `Alias duplicat: ${legacyKey}`);
  seenAliases.add(legacyKey);
  assert.ok(canonicalSet.has(canonicalKey), `Aliasul ${legacyKey} indica o cheie inexistenta`);
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
const productService = {
  service_key: "eyeglasses",
  is_active: true,
  confirmation_level: "provider_confirmed",
  matching_allowed: true,
};
const medicalProviderConfirmed = {
  service_key: "ophthalmology_consultation",
  is_active: true,
  confirmation_level: "provider_confirmed",
  matching_allowed: true,
};
const medicalVerified = { ...medicalProviderConfirmed, confirmation_level: "vezunde_verified" };
const unknownService = {
  service_key: "serviciu_complet_necunoscut",
  is_active: true,
  confirmation_level: "vezunde_verified",
  matching_allowed: true,
};

assert.equal(isServicePubliclyEligible(productService, claimedLocation), true, "Produsul provider-confirmed trebuie sa poata fi public");
assert.equal(isServiceMatchingEligible(productService, claimedLocation), true, "Produsul provider-confirmed trebuie sa poata intra in matching");
assert.equal(isServicePubliclyEligible(medicalProviderConfirmed, verifiedLocation), false, "Medicalul provider-confirmed trebuie sa ramana privat");
assert.equal(isServiceMatchingEligible(medicalProviderConfirmed, verifiedLocation), false, "Medicalul provider-confirmed nu poate intra in matching");
assert.equal(isServicePubliclyEligible(medicalVerified, verifiedLocation), true, "Medicalul verificat trebuie sa poata fi public");
assert.equal(isServiceMatchingEligible(medicalVerified, verifiedLocation), true, "Medicalul verificat trebuie sa poata intra in matching");
assert.equal(isServicePubliclyEligible(unknownService, verifiedLocation), false, "Cheia necunoscuta trebuie sa ramana fail-closed");
assert.equal(isServiceMatchingEligible(unknownService, verifiedLocation), false, "Cheia necunoscuta nu poate intra in matching");
assert.equal(isServicePubliclyEligible({ ...productService, is_active: false }, claimedLocation), false, "Serviciul inactiv nu poate fi public");

const copy = getCanonicalServiceDefinition("eyeglasses");
copy.aliases.push("test-local-copy");
assert.equal(getCanonicalServiceDefinition("eyeglasses").aliases.includes("test-local-copy"), false, "Helperul trebuie sa returneze copii defensive");

const consumers = {
  directoryOps: "base44/functions/directoryOps/entry.ts",
  adminReview: "base44/functions/adminWorkspaceReview/entry.ts",
  submit: "base44/functions/submitProviderWorkspaceChange/entry.ts",
  publicProfile: "base44/functions/getPublicProviderProfile/entry.ts",
  browseDirectory: "base44/functions/browseDirectoryProviders/entry.ts",
  matching: "base44/functions/matchProviders/entry.ts",
  providerRead: "base44/functions/getProviderLocationServices/entry.ts",
  adminServiceManagement: "base44/functions/getAdminServiceManagementData/entry.ts",
  matchingBackfill: "base44/functions/backfillLocationServiceMatching/entry.ts",
  profileFoundation: "base44/functions/profileFoundationOps/entry.ts",
};
for (const [name, relativePath] of Object.entries(consumers)) {
  const source = await readFile(sourcePath(relativePath), "utf8");
  assert.match(source, /shared\/canonicalServiceRegistry\.js/, `${name} nu importa registrul comun`);
}

const submitSource = await readFile(sourcePath(consumers.submit), "utf8");
assert.match(submitSource, /\.\.\.getCanonicalServiceGroupIds\(\)/, "Adaptorul submit trebuie sa derive un obiect nou din registru");
assert.doesNotMatch(submitSource, /Object\.freeze\s*\(/, "Adaptorul submit nu trebuie sa extinda un obiect inghetat");

const providerReadSource = await readFile(sourcePath(consumers.providerRead), "utf8");
assert.match(providerReadSource, /catalog_status === 'canonical'/, "Citirea providerului nu trebuie sa remapeze implicit cheile legacy");

const directoryCatalogSource = await readFile(sourcePath("src/lib/directoryOpsCatalog.js"), "utf8");
assert.match(directoryCatalogSource, /CANONICAL_SERVICE_KEYS/, "Catalogul admin trebuie generat din toate cheile canonice");

console.log(`Canonical keys: ${canonicalKeys.length}`);
console.log(`directoryOps recognized: ${canonicalKeys.length}`);
console.log(`admin review recognized: ${canonicalKeys.length}`);
console.log(`presentation recognized: ${presentationKeys.size}`);
console.log(`workspace functional-unit coverage: ${workspaceKeys.length}`);
console.log(`functional units: ${FUNCTIONAL_UNIT_KEYS.length}`);
console.log(`public profile classified: ${canonicalKeys.length}`);
console.log(`matching classified: ${canonicalKeys.length}`);
console.log(`legacy aliases: ${Object.keys(LEGACY_SERVICE_ALIASES).length}`);
console.log(`ambiguous legacy aliases (fail-closed): ${AMBIGUOUS_LEGACY_SERVICE_KEYS.length}`);
console.log("Service registry parity: PASS");
