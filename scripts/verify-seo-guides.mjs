import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, layout, metadata, guides, index, robots, sitemap] = await Promise.all([
  read("src/App.jsx"),
  read("src/components/Layout.jsx"),
  read("src/components/seo/RouteSeo.jsx"),
  read("src/data/specialistGuides.js"),
  read("index.html"),
  read("public/robots.txt"),
  read("public/sitemap.xml"),
]);

for (const route of [
  "/ghid",
  "/ghid/optometrist-optician-oftalmolog",
  "/ghid/:slug",
  "/cum-verificam-informatiile",
]) {
  assert.match(app, new RegExp(route.replace(/[/:]/g, "\\$&")), `Lipsește ruta ${route}`);
}

assert.match(layout, /to="\/ghid"/);
assert.match(index, /name="description"/);
assert.match(index, /property="og:title"/);
assert.match(metadata, /application\/ld\+json/);
assert.match(metadata, /BreadcrumbList/);
assert.match(metadata, /FAQPage/);

for (const specialist of ["Optician medical", "Optometrist", "Medic oftalmolog"]) {
  assert.match(guides, new RegExp(specialist));
}

assert.match(robots, /User-agent: OAI-SearchBot/);
assert.match(robots, /Sitemap: https:\/\/vezunde-core-link\.base44\.app\/sitemap\.xml/);

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, new Set(sitemapUrls).size, "Sitemap-ul conține URL-uri duplicate.");
assert.ok(sitemapUrls.length >= 8, "Sitemap-ul nu conține toate paginile inițiale.");

console.log("VIASEE SEO guide checks passed.");

