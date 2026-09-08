import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the real merge helper without mounting the authenticated workspace.
const source = readFileSync(new URL("../src/components/intake2/RequestWorkspace.jsx", import.meta.url), "utf8");
const helper = source.slice(source.indexOf("function mergeLocations("), source.indexOf("function RequestSummary("));
const merge = runInNewContext(helper + "; mergeLocations", {
  locationId: item => item?.id || item?.location_id || "",
});
const original = [
  { id: "ranked", result_bucket: "top3", bucket_rank: 2 },
  { id: "directory", result_bucket: "extended_directory" },
];
const merged = merge(original, [
  { location_id: "directory" },
  { location_id: "new-response", location_name: "Response" },
  { location_id: "new-response" },
  {},
]);
assert.equal(merged.length, 3);
assert.equal(merged[0], original[0]);
assert.equal(merged[1], original[1]);
assert.equal(merged.filter(row => row.result_bucket === "top3").length, 1);
assert.equal(merged[2].result_bucket, "response_only");
assert.equal(merge(null, [{ location_id: "only-response" }])[0].result_bucket, "response_only");
console.log("Request workspace ranking: original ranks preserved; responders deduplicated and never promoted.");
