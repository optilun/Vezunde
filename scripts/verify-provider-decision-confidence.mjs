import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PROVIDER_DECISION_CONFIDENCE_CONTRACT_VERSION,
  buildProviderDecisionConfidence,
} from "../shared/providerDecisionConfidence.js";

assert.equal(PROVIDER_DECISION_CONFIDENCE_CONTRACT_VERSION, "provider-decision-confidence-v1");

const high = buildProviderDecisionConfidence({
  matchedServiceKeys: ["optometry_consultation", "refraction"],
  profileControlStatus: "verified",
  availability: { label: "Doar cu programare" },
  expansionTier: "oras",
  professionalCount: 2,
  needLevel: "specialized_medical",
});
assert.equal(high.level, "high");
assert.equal(high.filled_segments, 3);
assert.equal(high.commercial_influence, false);
assert.ok(high.evidence.some((item) => item.code === "verified_profile"));
assert.ok(high.evidence.some((item) => item.code === "professional_present"));
assert.ok(high.evidence.some((item) => item.code === "local_scope"));

const directory = buildProviderDecisionConfidence({
  matchedServiceKeys: ["refraction"],
  profileControlStatus: "directory",
  expansionTier: "oras",
});
assert.equal(directory.level, "limited");
assert.equal(directory.filled_segments, 1);
assert.ok(directory.limitations.some((item) => item.includes("director")));
assert.equal(directory.commercial_influence, false);

const county = buildProviderDecisionConfidence({
  matchedServiceKeys: ["refraction"],
  profileControlStatus: "claimed",
  expansionTier: "judet",
  professionalCount: 1,
});
assert.equal(county.level, "good");
assert.ok(county.evidence.some((item) => item.code === "county_scope"));
assert.ok(county.evidence.some((item) => item.label.includes("același județ")));

const policy = await readFile(new URL("../shared/providerDecisionConfidence.js", import.meta.url), "utf8");
const card = await readFile(new URL("../src/components/results/ResultCard.jsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/components/results/DecisionConfidencePanel.jsx", import.meta.url), "utf8");
const recommendation = await readFile(new URL("../shared/providerRecommendation.js", import.meta.url), "utf8");

assert.match(policy, /commercial_influence: false/);
assert.doesNotMatch(policy, /subscription|plan|paid|payment|price/);
assert.match(card, /buildProviderDecisionConfidence/);
assert.match(card, /<DecisionConfidencePanel confidence=\{confidence\}/);
assert.doesNotMatch(card, /recommendation_score/);
assert.match(panel, /Plata nu influenteaza acest indicator sau ordinea rezultatelor/);
assert.match(panel, /Ce nu este confirmat/);
assert.match(panel, /grid grid-cols-3/);
assert.doesNotMatch(panel, /%|procent|scor/);
assert.match(recommendation, /compareRecommendationEntries/);

console.log("Provider decision confidence checks passed.");
