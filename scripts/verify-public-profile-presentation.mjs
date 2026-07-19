import assert from "node:assert/strict";
import {
  buildClaimLocationState,
  getPublicProfilePresentation,
} from "../src/lib/providerPublicPresentation.js";

assert.equal(getPublicProfilePresentation("directory").label, "Profil nerevendicat");
assert.equal(getPublicProfilePresentation("claimed").label, "Profil revendicat");
assert.equal(getPublicProfilePresentation("verified").label, "Profil verificat de VIASEE");
assert.match(getPublicProfilePresentation("directory").description, /nu este administrat inca de furnizor/);

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

console.log("Public profile presentation checks passed.");
