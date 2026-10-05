import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { locationCoordinates, locationPositionLabel, locationPrecisionError, locationMapApprovalFields } from "../shared/locationMapPosition.js";
import { hasPublishedSectionChanges, sameSubmissionPayload } from "../shared/providerWorkspaceSubmissionComparison.js";
import { buildGoogleMapsDirectionsUrl } from "../src/lib/maps.js";

const current = { address: "Strada Testului nr. 10", lat: 45.74, lng: 21.24, map_precision: "exact" };
for (const location of [{}, { lat: "", lng: "" }, { lat: null, lng: null }, { lat: 0, lng: 0 }, { lat: 91, lng: 21 }, { lat: 45, lng: 181 }, { lat: "abc", lng: 21 }]) {
  assert.equal(locationCoordinates(location), null, "invalid points cannot be confirmed or plotted");
  assert.notEqual(locationPositionLabel(location), "Poziție confirmată");
}
assert.deepEqual(locationCoordinates({ lat: "45,74", lng: "21,24" }), { lat: 45.74, lng: 21.24 });
assert.equal(locationPositionLabel({ lat: 45, lng: 21 }), "Poziție de confirmat");
assert.equal(locationPositionLabel(current), "Poziție confirmată");

assert.equal(locationPrecisionError(current), "");
assert.equal(locationPrecisionError({ address: "Adresă nouă" }), "", "legacy partial edits remain supported");
for (const payload of [
  { ...current, address: "" },
  { ...current, lat: null },
  { ...current, lng: "" },
  { ...current, lat: 0, lng: 0 },
  { ...current, map_precision: "unknown" },
  { map_precision: "exact" },
]) assert.ok(locationPrecisionError(payload), "confirmation requires the address and both valid coordinates");

assert.deepEqual(locationMapApprovalFields({ ...current, lat: 45.741 }, current), { map_precision: "exact" }, "an explicit confirmation approves the new point");
const addressReset = locationMapApprovalFields({ address: "Altă adresă" }, current);
assert.equal(addressReset.map_precision, "approximate");
assert.equal(addressReset.lat, null, "legacy address edits discard the old point");
assert.equal(addressReset.lng, null);
assert.equal(addressReset.place_id, "", "legacy Google identifiers cannot redirect the new address");
assert.equal(addressReset.geocoded_address, "");
assert.equal(addressReset.geocode_attempt_count, 0, "a new address gets a fresh geocoding attempt");
assert.deepEqual(locationMapApprovalFields({ lat: 45.741, lng: 21.24 }, current), { map_precision: "approximate" }, "legacy pin edits invalidate prior confirmation");
assert.deepEqual(locationMapApprovalFields({ address: "  strada TESTULUI nr. 10 " }, current), {}, "format-only edits preserve confirmation");
assert.deepEqual(locationMapApprovalFields({ public_phone: "0722000000" }, current), {}, "contact-only edits preserve confirmation");
assert.deepEqual(locationMapApprovalFields({ lat: null, lng: null }, current), { map_precision: "approximate" });
assert.deepEqual(locationMapApprovalFields({ map_precision: "approximate" }, current), { map_precision: "approximate" });

assert.equal(hasPublishedSectionChanges("location_details", { ...current, map_precision: "exact" }, { ...current, map_precision: "approximate" }), true, "precision-only confirmation is a real reviewable change");
assert.equal(hasPublishedSectionChanges("location_details", current, current), false);
assert.equal(sameSubmissionPayload("location_details", current, { ...current, map_precision: "approximate" }), false, "an unsaved confirmation cannot submit the old draft");
assert.equal(sameSubmissionPayload("location_details", { ...current, lat: "45.740000" }, current), true);

const exactRoute = new URL(buildGoogleMapsDirectionsUrl({ ...current, place_id: "legacy-place" }));
assert.equal(exactRoute.searchParams.get("destination"), "45.74,21.24");
assert.equal(exactRoute.searchParams.has("destination_place_id"), false, "a stale Google identifier cannot override the confirmed pin");
const approximateRoute = new URL(buildGoogleMapsDirectionsUrl({ ...current, map_precision: "approximate", place_id: "legacy-place" }));
assert.match(approximateRoute.searchParams.get("destination"), /Strada Testului/);
assert.equal(approximateRoute.searchParams.get("destination_place_id"), "legacy-place");

for (const file of ["locationMapPosition.js", "providerWorkspaceSubmissionComparison.js"]) {
  assert.equal(await readFile(new URL("../shared/" + file, import.meta.url), "utf8"), await readFile(new URL("../base44/shared/" + file, import.meta.url), "utf8"), file + " frontend/backend policy must match");
}
console.log("location map confirmation: coordinate validation, review invalidation, draft comparison and route consistency passed");
