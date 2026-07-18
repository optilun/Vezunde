import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDE_ORDER } from "../src/data/specialistGuides.js";
import { TOPIC_GUIDES } from "../src/data/topicGuides.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const outputPath = resolve(projectRoot, "public", "sitemap.xml");
const siteOrigin = String(
  process.env.VITE_PUBLIC_SITE_URL || "https://viasee.ro",
).replace(/\/+$/, "");

const staticPaths = [
  "/",
  "/ghid",
  "/ghid/optometrist-optician-oftalmolog",
  "/cum-verificam-informatiile",
  "/pentru-specialisti",
  "/parteneri",
  "/confidentialitate",
  "/termeni",
  "/cookies",
  "/plati-si-abonamente",
  "/drepturile-tale",
];

const specialistGuidePaths = GUIDE_ORDER.map((slug) => `/ghid/${slug}`);
const topicGuidePaths = Object.keys(TOPIC_GUIDES).map(
  (key) => `/ghid/${key}`,
);

const paths = [...new Set([
  ...staticPaths,
  ...specialistGuidePaths,
  ...topicGuidePaths,
])].sort((left, right) => left.localeCompare(right, "ro"));

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const urls = paths
  .map((path) => {
    const url = path === "/" ? `${siteOrigin}/` : `${siteOrigin}${path}`;
    return `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`;
  })
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, sitemap, "utf8");
console.log(`Generated sitemap with ${paths.length} public URLs at ${outputPath}`);
