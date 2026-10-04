import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("../src/lib/app-params.js", import.meta.url), "utf8"))
  .replace(/import\.meta\.env\.VITE_[A-Z_]+/g, "undefined")
  .replace("export const appParams", "globalThis.testAppParams");

function run(search) {
  const state = { usr: { results: [{ id: "example-location" }], meta: { city: "Cluj-Napoca" } }, key: "results-view", idx: 3 };
  const values = new Map();
  const calls = [];
  const window = {
    location: { pathname: "/rezultate", search, hash: "#lista", href: "https://example.test/rezultate" + search + "#lista" },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    history: { state, replaceState: (...args) => calls.push(args) },
  };
  const context = vm.createContext({ window, document: { title: "VIASEE" }, URLSearchParams, Map });
  vm.runInContext(source, context);
  return { state, calls, params: context.testAppParams };
}

const absent = run("?categorie=control_vedere");
assert.equal(absent.calls.length, 0, "Fără token în URL, starea navigării nu trebuie rescrisă.");
const present = run("?access_token=demo-token&categorie=control_vedere");
assert.equal(present.calls.length, 1);
assert.equal(present.calls[0][0], present.state, "Curățarea tokenului trebuie să păstreze rezultatele și cheia rutei.");
assert.equal(present.calls[0][2], "/rezultate?categorie=control_vedere#lista");
assert.equal(present.params.token, "demo-token");
console.log("App parameter navigation checks passed.");
