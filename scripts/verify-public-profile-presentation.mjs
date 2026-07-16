import assert from "node:assert/strict";
import {
  buildClaimLocationState,
  buildDirectoryReportHref,
  getPublicProfilePresentation,
} from "../src/lib/providerPublicPresentation.js";

assert.equal(getPublicProfilePresentation("directory").label, "Profil din director");
assert.equal(getPublicProfilePresentation("claimed").label, "Profil revendicat");
assert.equal(getPublicProfilePresentation("verified").label, "Profil verificat de VIASEE");

const privateLocation = {
  id: "location-1",
  name: "Clinica Exemplu",
  provider_type: "clinica_oftalmologica",
  provider_profile_type: "ophthalmology_clinic",
  city: "Sibiu",
  county: "Sibiu",
  locality_siruta_code: "143450",
  address: "Strada privata 10",
  phone: "0700000000",
  website: "https://example.test",
};

const claimState = buildClaimLocationState(privateLocation);
assert.equal(claimState.selectedLocation.id, privateLocation.id);
assert.equal(claimState.selectedLocation.city, privateLocation.city);
assert.equal(claimState.selectedLocation.address, undefined);
assert.equal(claimState.selectedLocation.phone, undefined);
assert.equal(claimState.selectedLocation.website, undefined);

const reportHref = decodeURIComponent(buildDirectoryReportHref(privateLocation));
assert.match(reportHref, /contact@viasee\.ro/);
assert.match(reportHref, /location-1/);
assert.doesNotMatch(reportHref, /Strada privata/);
assert.doesNotMatch(reportHref, /0700000000/);

console.log("Public profile presentation checks passed.");
