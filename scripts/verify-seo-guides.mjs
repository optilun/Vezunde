import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, layout, metadata, guides, topicGuides, topicPage, guideIndex, index, robots, sitemap] = await Promise.all([
  read("src/App.jsx"),
  read("src/components/Layout.jsx"),
  read("src/components/seo/RouteSeo.jsx"),
  read("src/data/specialistGuides.js"),
  read("src/data/topicGuides.js"),
  read("src/pages/TopicGuide.jsx"),
  read("src/pages/GuideIndex.jsx"),
  read("index.html"),
  read("public/robots.txt"),
  read("public/sitemap.xml"),
]);

for (const route of [
  "/ghid",
  "/ghid/optometrist-optician-oftalmolog",
  "/ghid/:category/:slug",
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
assert.match(metadata, /getTopicGuide/);
assert.match(topicPage, /Actualizat editorial/);
assert.match(topicPage, /Surse consultate/);
assert.match(guideIndex, /TOPIC_GROUPS/);

for (const specialist of ["Optician medical", "Optometrist", "Medic oftalmolog"]) {
  assert.match(guides, new RegExp(specialist));
}

const topicKeys = [...topicGuides.matchAll(/^  "([a-z-]+\/[a-z-]+)": \{/gm)].map(
  (match) => match[1],
);
assert.equal(topicKeys.length, 19, "Biblioteca editorială trebuie să conțină 19 ghiduri tematice.");
assert.equal(topicKeys.length, new Set(topicKeys).size, "Cheile ghidurilor tematice trebuie să fie unice.");
assert.ok(
  (topicGuides.match(/question:/g) || []).length >= topicKeys.length * 3,
  "Fiecare ghid tematic trebuie să aibă cel puțin trei întrebări frecvente.",
);
assert.ok(
  (topicGuides.match(/sources: \[/g) || []).length >= topicKeys.length,
  "Fiecare ghid tematic trebuie să declare sursele consultate.",
);

assert.match(robots, /User-agent: OAI-SearchBot/);
assert.match(robots, /Sitemap: https:\/\/viasee\.ro\/sitemap\.xml/);

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, new Set(sitemapUrls).size, "Sitemap-ul conține URL-uri duplicate.");
assert.ok(sitemapUrls.length >= 27, "Sitemap-ul nu conține întreaga bibliotecă editorială.");
for (const key of topicKeys) {
  assert.ok(
    sitemapUrls.includes(`https://vezunde-core-link.base44.app/ghid/${key}`),
    `Lipsește din sitemap ghidul ${key}.`,
  );
}
assert.equal(
  (sitemap.match(/<lastmod>2026-07-17<\/lastmod>/g) || []).length >= 20,
  true,
  "Paginile noi trebuie să aibă data actualizării în sitemap.",
);

console.log("VIASEE SEO guide checks passed.");
