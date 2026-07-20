import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PATIENT_NO_RESPONSE_INITIAL_REVIEW_HOURS,
  PATIENT_NO_RESPONSE_REVIEW_CONTRACT_VERSION,
  derivePatientNoResponseReview,
  patientNoResponseKeepWaitingPatch,
} from "../shared/patientNoResponseReview.js";

assert.equal(PATIENT_NO_RESPONSE_REVIEW_CONTRACT_VERSION, "patient-no-response-review-v1");
assert.equal(PATIENT_NO_RESPONSE_INITIAL_REVIEW_HOURS, 48);

const request = {
  submitted_at: "2026-07-01T08:00:00.000Z",
  expires_at: "2026-07-31T08:00:00.000Z",
  no_response_review_count: 0,
};
const leads = [{
  delivery_state: "available",
  eligible_at: "2026-07-01T10:00:00.000Z",
}];
const lifecycle = { state: "active", terminal: false };

const waiting = derivePatientNoResponseReview({
  request,
  leads,
  activeResponseCount: 0,
  lifecycle,
  queryScope: "locality",
  now: new Date("2026-07-03T09:59:59.000Z"),
});
assert.equal(waiting.state, "waiting");
assert.equal(waiting.review_available, false);
assert.equal(waiting.hours_remaining, 1);
assert.equal(waiting.review_after, "2026-07-03T10:00:00.000Z");

const reviewAvailable = derivePatientNoResponseReview({
  request,
  leads,
  activeResponseCount: 0,
  lifecycle,
  queryScope: "locality",
  now: new Date("2026-07-03T10:00:00.000Z"),
});
assert.equal(reviewAvailable.state, "review_available");
assert.equal(reviewAvailable.can_keep_waiting, true);
assert.equal(reviewAvailable.can_reformulate, true);
assert.equal(reviewAvailable.can_expand_county, true);
assert.equal(reviewAvailable.automatic_transition, false);

const countyReview = derivePatientNoResponseReview({
  request,
  leads,
  activeResponseCount: 0,
  lifecycle,
  queryScope: "county",
  now: new Date("2026-07-03T10:00:00.000Z"),
});
assert.equal(countyReview.can_expand_county, false);
assert.equal(countyReview.can_reformulate, true);

const responded = derivePatientNoResponseReview({
  request,
  leads,
  activeResponseCount: 1,
  lifecycle,
  queryScope: "locality",
  now: new Date("2026-07-04T10:00:00.000Z"),
});
assert.equal(responded.state, "responded");
assert.equal(responded.review_available, false);

const terminal = derivePatientNoResponseReview({
  request,
  leads,
  activeResponseCount: 0,
  lifecycle: { state: "closed", terminal: true },
  queryScope: "locality",
  now: new Date("2026-07-04T10:00:00.000Z"),
});
assert.equal(terminal.state, "terminal");
assert.equal(terminal.can_keep_waiting, false);

const waitingPatch = patientNoResponseKeepWaitingPatch(request, new Date("2026-07-03T10:00:00.000Z"));
assert.equal(waitingPatch.no_response_review_action, "keep_waiting");
assert.equal(waitingPatch.no_response_review_count, 1);
assert.equal(waitingPatch.no_response_next_review_at, "2026-07-05T10:00:00.000Z");
assert.equal(Object.hasOwn(waitingPatch, "lifecycle_state"), false);
assert.equal(Object.hasOwn(waitingPatch, "status"), false);

const policy = await readFile(new URL("../shared/patientNoResponseReview.js", import.meta.url), "utf8");
const backend = await readFile(new URL("../base44/functions/getPatientRequestStatus/entry.ts", import.meta.url), "utf8");
const entity = await readFile(new URL("../base44/entities/PatientRequest.jsonc", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/components/intake2/PatientNoResponseReviewPanel.jsx", import.meta.url), "utf8");
const resume = await readFile(new URL("../src/pages/PatientRequestResume.jsx", import.meta.url), "utf8");
const flow = await readFile(new URL("../src/pages/RequestFlow.jsx", import.meta.url), "utf8");
const countyFlow = await readFile(new URL("../src/components/intake2/PatientCountyReformulation.jsx", import.meta.url), "utf8");
const client = await readFile(new URL("../src/lib/patientNoResponseReviewClient.js", import.meta.url), "utf8");

assert.match(backend, /no_response_review: noResponseReview/);
assert.match(backend, /action === 'no_response_keep_waiting'/);
assert.match(backend, /ProviderLead\.filter/);
assert.match(backend, /patientNoResponseKeepWaitingPatch/);
assert.match(policy, /automatic_transition: false/);
assert.doesNotMatch(policy, /authorizePatientRequestDistribution|transitionPatientRequestLifecycle|ProviderLead\.create/);

assert.match(entity, /no_response_review_contract_version/);
assert.match(entity, /no_response_next_review_at/);
assert.match(entity, /no_response_review_count/);
assert.match(entity, /"county"/);

assert.match(panel, /Continua asteptarea/);
assert.match(panel, /Extinde in judet/);
assert.match(panel, /Revizuieste criteriile/);
assert.match(panel, /nu o extinde, nu o retrimite si nu o inchide automat/);
assert.match(resume, /<PatientNoResponseReviewPanel/);
assert.match(resume, /review=\{snapshot\.no_response_review\}/);

assert.match(client, /sessionStorage/);
assert.match(client, /no_response_keep_waiting/);
assert.match(client, /request_access_token: token/);
assert.match(client, /patient-request-reformulation-v1/);
const seedBuilderSource = client.split("export function buildPatientRequestReformulationSeed")[1]
  ?.split("export function createPatientRequestReformulationUrl")[0] || "";
assert.doesNotMatch(seedBuilderSource, /contact_email|contact_phone|access_token/);
assert.match(flow, /React\.useState\(\(\) =>[\s\S]{0,100}readPatientRequestReformulation/);
assert.match(flow, /PatientCountyReformulation/);
assert.match(countyFlow, /query_scope: "county"/);
assert.match(countyFlow, /data\.query_scope !== "county"/);
assert.match(countyFlow, /Distribuirea unei cereri noi necesita din nou confirmarea si acordul tau/);
assert.doesNotMatch(countyFlow, /authorizePatientRequestDistribution/);

console.log("Patient no-response review checks passed.");
