import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const updateSource = await readFile(
  path.join(root, "base44/functions/updateProviderLocation/entry.ts"),
  "utf8",
);
const reviewSource = await readFile(
  path.join(root, "base44/functions/directoryOps/reviewProfileChanges.ts"),
  "utf8",
);

assert.match(updateSource, /shared\/canonicalServiceRegistryExtended\.js/, "Fluxul legacy de update trebuie sa importe registrul semantic V2");
assert.match(reviewSource, /shared\/canonicalServiceRegistryExtended\.js/, "Fluxul legacy de review trebuie sa importe registrul semantic V2");
assert.match(updateSource, /invalidNewKeys/, "Fluxul legacy de update trebuie sa blocheze cheile necanonice noi");
assert.match(reviewSource, /invalidNewKeys/, "Fluxul legacy de review trebuie sa revalideze cheile necanonice noi");
assert.match(reviewSource, /isServiceMatchingEligible/, "Reactivarea legacy trebuie sa ramana fail-closed pentru matching");
assert.match(
  reviewSource,
  /is_active:\s*false,\s*accepts_requests:\s*false,\s*matching_allowed:\s*false/,
  "Eliminarea legacy trebuie sa ramana soft-delete",
);
assert.doesNotMatch(reviewSource, /KNOWN_LEVELS/, "Fluxul legacy nu trebuie sa pastreze un registru duplicat de servicii");
assert.doesNotMatch(updateSource, /Object\.freeze\s*\(/, "Adaptorul legacy nu trebuie sa extinda obiecte inghetate");

console.log("Legacy service flow compatibility: PASS");

