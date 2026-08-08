import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PATIENT_COUNTY_EXPANSION_VERSION,
  countyExpansionDraft,
  patientSearchTextFromDraft,
} from "../shared/patientSearchExpansion.js";

assert.equal(PATIENT_COUNTY_EXPANSION_VERSION, "patient-county-expansion-v1");
assert.equal(
  patientSearchTextFromDraft({
    original_message: "Caut un control",
    answers: [
      { question_key: "descriere", answer_value: "Vedere neclara la distanta" },
      { question_key: "timing", answer_value: "nu_e_urgent" },
    ],
  }),
  "Caut un control. Vedere neclara la distanta",
);
assert.deepEqual(
  countyExpansionDraft(
    { location_scope: "locality", county: "", county_code: "" },
    { selected_county_name: "Timis", selected_county_code: "TM" },
  ),
  { location_scope: "county", county: "Timis", county_code: "TM" },
);

const matcher = await readFile(new URL("../base44/functions/matchProvidersSemantic/entry.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../src/lib/patientSearchExpansion.js", import.meta.url), "utf8");
const results = await readFile(new URL("../src/components/intake2/MatchResults.jsx", import.meta.url), "utf8");
const emptyFlow = await readFile(new URL("../src/components/intake2/NoResultsFlow.jsx", import.meta.url), "utf8");
const locationQuestion = await readFile(new URL("../src/components/intake2/QuestionLocation.jsx", import.meta.url), "utf8");
const draftBuilder = await readFile(new URL("../src/lib/patientRequestDraft.js", import.meta.url), "utf8");
const persistence = await readFile(new URL("../shared/patientRequestPersistence.js", import.meta.url), "utf8");
const conversationalCard = await readFile(new URL("../src/components/intake2/ConversationalCard.jsx", import.meta.url), "utf8");

assert.match(matcher, /function patientSearchScope\(value\)/);
// patientSearchScope accepta acum si 'national' (2026-08-06), pe langa 'county' si
// 'locality'. Verificam ca toate cele trei scopuri sunt tratate explicit si ca orice
// valoare necunoscuta cade in continuare pe 'locality' (comportamentul sigur).
assert.match(matcher, /if \(value === 'county'\) return 'county';/);
assert.match(matcher, /if \(value === 'national'\) return 'national';/);
assert.match(matcher, /return 'locality';/);
assert.match(matcher, /svc\.entities\.GeographicLocality\.filter/);
assert.match(matcher, /county_code: countyCode/);
assert.match(matcher, /queryScope === 'county'/);
assert.match(matcher, /expansion_tier: tier/);
assert.match(matcher, /tier === 'oras'/);
assert.match(matcher, /selected_county_name: countyName/);
assert.match(matcher, /scope_provider_count/);
assert.match(matcher, /county_eligible_provider_count/);
assert.doesNotMatch(matcher, /queryScope = 'county'/);
assert.doesNotMatch(matcher, /distance_km/);

assert.match(client, /base44\.functions\.invoke\("matchProvidersSemantic"/);
assert.match(client, /query_scope: "county"/);
// Validarea scopului a fost generalizata (2026-08-06) ca sa acopere si extinderea
// nationala: responseData primeste scopul asteptat ca parametru, in loc sa verifice
// hardcodat "county". Protectia ramane aceeasi - un raspuns cu alt scop e respins.
assert.match(client, /data\.query_scope !== expectedScope/);
assert.match(client, /matchProvidersNationally/);
assert.doesNotMatch(client, /matchProviders"/);
// Interdictia veche pe query_scope national a fost RIDICATA deliberat (2026-08-06), la
// cererea explicita a owner-ului: pacientul poate extinde cautarea la nivel national
// pentru investigatii rare, disponibile doar in cateva orase. Restrictia de siguranta
// care ramane: la nivel national se returneaza DOAR profiluri revendicate/verificate,
// niciodata din director (vezi loadPublicLocationsForScope in matchProvidersSemantic).
assert.match(client, /query_scope: "national"/);

assert.match(emptyFlow, /onClick=\{onExpandCounty\}/);
assert.match(results, /matchProvidersInSelectedCounty\(draft\)/);
assert.match(results, /storePatientRequestDraft\(nextDraft\)/);
assert.match(results, /queryScope === "county"/);
assert.match(results, /În restul județului/);
assert.match(results, /patient_search_county_expansion_started/);
assert.match(results, /PatientRequestSubmission results=\{list\} meta=\{activeMeta\}/);
assert.doesNotMatch(conversationalCard, /query_scope:\s*["']county["']/);

assert.match(emptyFlow, /Extinde în județul/);
assert.match(emptyFlow, /!countyExpanded/);
assert.match(emptyFlow, /Cererea nu a fost extinsă în afara județului/);
assert.match(locationQuestion, /extinde aria doar dacă soliciți explicit/);
assert.match(draftBuilder, /county: clean\(safeState\.locality\?\.county_name/);
assert.match(draftBuilder, /county_code: clean\(safeState\.locality\?\.county_code/);
assert.match(persistence, /expansion_tier/);

console.log("Patient county expansion checks passed.");
