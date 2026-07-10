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

const verifiedLocation = {
  active_status: "activa",
  profile_control_status: "verified",
};
const claimedLocation = {
  active_status: "activa",
  profile_control_status: "claimed",
};
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
const medicalVerified = {
  ...medicalProviderConfirmed,
  confirmation_level: "vezunde_verified",
};
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
  matching: "base44/functions/matchProviders/entry.ts",
  providerRead: "base44/functions/getProviderLocationServices/entry.ts",
};
for (const [name, relativePath] of Object.entries(consumers)) {
  const source = await readFile(sourcePath(relativePath), "utf8");
  assert.match(source, /shared\/canonicalServiceRegistry\.js/, `${name} nu importa registrul comun`);
}

const directoryCatalogSource = await readFile(sourcePath("src/lib/directoryOpsCatalog.js"), "utf8");
assert.match(directoryCatalogSource, /CANONICAL_SERVICE_KEYS/, "Catalogul admin trebuie generat din toate cheile canonice");

console.log(`Canonical keys: ${canonicalKeys.length}`);
console.log(`directoryOps recognized: ${canonicalKeys.length}`);
console.log(`admin review recognized: ${canonicalKeys.length}`);
console.log(`presentation recognized: ${presentationKeys.size}`);
console.log(`public profile classified: ${canonicalKeys.length}`);
console.log(`matching classified: ${canonicalKeys.length}`);
console.log(`legacy aliases: ${Object.keys(LEGACY_SERVICE_ALIASES).length}`);
console.log(`ambiguous legacy aliases (fail-closed): ${AMBIGUOUS_LEGACY_SERVICE_KEYS.length}`);
console.log("Service registry parity: PASS");
