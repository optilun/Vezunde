import fs from "node:fs";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const HOST = "viasee.ro";
const KEY = "7cde7bda0c3949b28bea2abaf2d32b42";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
  match[1].trim(),
);

if (urlList.length === 0) {
  throw new Error("No URLs found in public/sitemap.xml");
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
