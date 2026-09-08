import assert from "node:assert/strict";
import fs from "node:fs";
import { directoryLocationScope } from "../base44/shared/searchLocationScope.js";

assert.equal(directoryLocationScope({}), null);
assert.equal(directoryLocationScope({ directory_filter_location_ids: [] }).size, 0);
const scope = directoryLocationScope({ directory_filter_location_ids: ["b", "b", null, 3] });
assert.deepEqual([...scope], ["b"]);
const all = [{ id: "a", score: 100 }, { id: "b", score: 1 }];
assert.deepEqual(all.filter(row => scope === null || scope.has(row.id)).sort((a,b)=>b.score-a.score).slice(0,1).map(row=>row.id), ["b"]);
for (const endpoint of ["matchProviders", "matchProvidersSemantic"]) {
  const source = fs.readFileSync(`base44/functions/${endpoint}/entry.ts`, "utf8");
  const filter = source.indexOf("directoryScope === null || directoryScope.has(");
  assert.ok(filter > 0 && filter < source.indexOf("const locationIds ="), endpoint + " filters candidates before loading/scoring/truncating");
}
const search = fs.readFileSync("src/pages/Search.jsx", "utf8");
const apply = search.slice(search.indexOf("onApply={(filters)"), search.indexOf("}} />", search.indexOf("onApply={(filters)")));
assert.ok(!apply.includes('setQuery("")') && !apply.includes('setService("")'), "Applying refinements preserves the request");
const suggestion = search.slice(search.indexOf("const chooseSuggestion"), search.indexOf("const searchMapKey"));
assert.ok(!suggestion.includes("setFilterServiceKeys") && !suggestion.includes("setCasOnly"), "A service selection preserves refinements");
assert.match(search, /filter_service_keys: filterServiceKeys.length \? filterServiceKeys : casOnly \? \(service \? \[service\]/, "CAS without a modal service follows the searched service");
assert.match(search, /mapResults\?\.find\(row => row.id === selectedId\)/, "Selecting an unpaginated pin exposes its card");
assert.match(search, /listResults=\{locationList\}/);
assert.match(search, /directory_filter_location_ids: directoryFilterIds/);
assert.match(search, /include_map_results: true/);
assert.match(search, /key=\{searchMapKey\}[\s\S]*?fixedDesktop/);
const layout = fs.readFileSync("src/components/results/LocationsWithMap.jsx", "utf8");
assert.ok(!layout.includes("body.style.overflow"), "Do not interfere with modal body scroll lock");
assert.match(layout, /list\.scrollTop \+=/, "Desktop selection scrolls its own list, not the document");
assert.match(layout, /listScroll:/, "List restoration is separate from map bounds");
assert.match(layout, /fixedDesktop \? "mt-3 lg:fixed/, "No-position results keep a usable desktop list");
const vector = fs.readFileSync("src/components/results/VectorResultsCanvas.jsx", "utf8");
assert.match(vector, /onFailure\("webgl"\)/);
const map = fs.readFileSync("src/components/results/ResultsMap.jsx", "utf8");
assert.match(map, /Hartă 2D · De ce\?/);
assert.match(map, /max-h-\[55%\] overflow-y-auto/);
console.log("Search stabilization: candidate scope, empty filters, pre-ranking narrowing, preserved query, CAS context, unpaginated selection, fixed list, scroll isolation and 2D explanation — OK");
