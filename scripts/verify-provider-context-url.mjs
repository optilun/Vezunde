import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildProviderContextSearch } from "../src/lib/providerContextSearch.js";

const first = new URLSearchParams(buildProviderContextSearch("s=locations&foo=bar", {
  organizationId: "organization-a",
  locationId: "location-a",
}));
assert.equal(first.get("mode"), "provider");
assert.equal(first.get("organization"), "organization-a");
assert.equal(first.get("location"), "location-a");
assert.equal(first.get("s"), "locations");
assert.equal(first.get("foo"), "bar");

const switched = new URLSearchParams(buildProviderContextSearch(first.toString(), {
  organizationId: "organization-b",
  locationId: "location-b",
}));
assert.equal(switched.get("organization"), "organization-b");
assert.equal(switched.get("location"), "location-b");
assert.equal(switched.get("s"), "locations");

const cleared = new URLSearchParams(buildProviderContextSearch(switched.toString()));
assert.equal(cleared.get("mode"), "provider");
assert.equal(cleared.has("organization"), false);
assert.equal(cleared.has("location"), false);
assert.equal(cleared.get("s"), "locations");

const switcher = await readFile(new URL("../src/components/workspace/provider/LocationSwitcher.jsx", import.meta.url), "utf8");
assert.match(switcher, /buildProviderContextSearch/);
assert.match(switcher, /setParams\(nextSearch, \{ replace: true \}\)/);
assert.match(switcher, /selectedOrganizationId/);
assert.match(switcher, /selectedLocationId/);

console.log("Provider context URL persistence checks passed.");
