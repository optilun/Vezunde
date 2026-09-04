import fs from "node:fs";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const HOST = "viasee.ro";
const KEY = "7cde7bda0c3949b28bea2abaf2d32b42";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// 2026-09-03, audit SEO: IndexNow citea doar sitemap-ul static de 29 de URL-uri, deci
// publicarea unei locatii noi nu notifica niciodata nimic. Acum citeste si sitemap-ul de
// locatii, generat din datele publicate (scripts/generate-sitemap-locations.mjs).
const SITEMAP_FILES = ["public/sitemap.xml", "public/sitemap-locatii.xml"];

const urlList = [
  ...new Set(
    SITEMAP_FILES.filter((file) => fs.existsSync(file))
      .flatMap((file) =>
        [...fs.readFileSync(file, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
          (match) => match[1].trim(),
        ),
      )
      .filter(Boolean),
  ),
];

if (urlList.length === 0) {
  throw new Error(`No URLs found in ${SITEMAP_FILES.join(", ")}`);
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }),
});

const responseBody = await response.text();
console.log(`Submitted ${urlList.length} URLs. HTTP ${response.status}`);
if (responseBody) console.log(responseBody);

if (![200, 202].includes(response.status)) {
  throw new Error(`IndexNow rejected the submission with HTTP ${response.status}`);
}
