import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { completeDirectoryRows, directoryRowsInView } from "../shared/mobileDirectoryList.js";
import { nearestDirectory } from "../shared/nearbyDirectory.js";
import { buildAddressQuery, buildCoordinateQuery, buildGoogleMapsDirectionsUrl, hasMapLocation } from "../src/lib/maps.js";
import { readMobileViewChoice, rememberMobileViewChoice, writeSearchSession } from "../src/lib/searchSession.js";

const data = new Map();
globalThis.sessionStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
assert.equal(readMobileViewChoice("list"), "list");
writeSearchSession({ mobileViewChoice: "map", mobileView: "map" });
assert.equal(readMobileViewChoice("list"), "list", "Old map-first sessions must not override the new default");
rememberMobileViewChoice("map");
assert.equal(readMobileViewChoice("list"), "map", "An explicit choice survives profile navigation");
rememberMobileViewChoice("list");
assert.equal(readMobileViewChoice("list"), "list");

const mapped = { id: "mapped", lat: 46, lng: 23 };
const unmapped = { id: "unmapped", lat: null, lng: null };
const rows = completeDirectoryRows({ results: [mapped], unmapped_results: [unmapped, mapped] });
assert.deepEqual(rows, [mapped, unmapped]);
assert.deepEqual(directoryRowsInView(rows, { followViewport: false, visibleIds: [] }), rows, "A hidden map must not filter the mobile list");
assert.deepEqual(directoryRowsInView(rows, { followViewport: true, visibleIds: ["mapped"] }), [mapped]);
assert.deepEqual(nearestDirectory(rows, { lat: 46, lng: 23 }).map(row => row.id), ["mapped", "unmapped"]);
assert.equal(hasMapLocation({}), false, "Missing address must not show a map of Romania");
assert.equal(buildCoordinateQuery({ lat: null, lng: null }), "");
assert.equal(buildAddressQuery({}), "");
assert.equal(buildGoogleMapsDirectionsUrl({}), "");
assert.match(buildGoogleMapsDirectionsUrl({ address: "Str. Exemplu 2", city: "Aiud", map_precision: "approximate", lat: 46, lng: 23 }), /destination=Str/);
assert.match(buildGoogleMapsDirectionsUrl({ address: "Str. Exemplu 2", city: "Aiud", map_precision: "exact", lat: 46, lng: 23 }), /destination=46%2C23/);

// Execute the actual public projection with mocked reads, including withheld/private values.
// This checks that adding missing pins retains the same visibility/disclosure gate.
const source = await readFile(new URL("../base44/functions/browseDirectoryProviders/entry.ts", import.meta.url), "utf8");
const publicProjection = source.slice(source.indexOf("const PATIENT_FACING_PROFILE_TYPES"), source.indexOf("// 2026-09-27. Lista pentru sitemap"));
const fixtures = [
  { id: "missing-pin", public_display_name: "Public directory", public_visibility_status: "approved", provider_profile_type: "independent_optical_store", provider_type: "optica_medicala", county: "Alba", city: "Aiud", phone: "PRIVATE", public_email: "PRIVATE", organization_id: "private-org", photo_url: "https://example.com/private.jpg" },
  { id: "positioned", public_visibility_status: "approved", provider_profile_type: "independent_optical_store", provider_type: "optica_medicala", lat: 46, lng: 23 },
  { id: "suspended", public_visibility_status: "approved", provider_profile_type: "independent_optical_store", suspended: true },
  { id: "unapproved", public_visibility_status: "pending", provider_profile_type: "independent_optical_store" },
  { id: "inactive", public_visibility_status: "approved", provider_profile_type: "independent_optical_store", active_status: "inactiva" },
];
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const project = new AsyncFunction("svc", "loadPublishedLocationsForMap", "loadDirectoryDetailOverlayForMap", "getPublicLocationDisclosure", "withDirectoryDetail", publicProjection + "\nreturn computeNationalMap(svc);");
const projection = await project(
  { entities: { ProviderOrganization: { get: () => { throw Error("Directory-only organization must not be read"); } } } },
  async () => ({ locations: fixtures }),
  async () => ({ overlay: new Map() }),
  row => ({ profile_control_status: row.suspended ? "suspended" : "directory", expose_full_details: false, lat: row.lat ?? null, lng: row.lng ?? null, address: "Public address", map_precision: row.lat ? "approximate" : null }),
  row => row,
);
assert.deepEqual(projection.results.map(row => row.id), ["positioned"]);
assert.deepEqual(projection.unmapped_results.map(row => row.id), ["missing-pin"]);
assert.equal(projection.total_published, 2);
assert.equal(projection.without_position, 1);
assert.equal(projection.unmapped_results[0].phone, undefined);
assert.equal(projection.unmapped_results[0].public_email, undefined);
assert.equal(projection.unmapped_results[0].photo_url, undefined);
assert.equal(projection.unmapped_results[0].organization_id, undefined);
console.log("verify-mobile-directory: complete list, viewport independence, navigation preference, safe directions and public disclosure OK");
