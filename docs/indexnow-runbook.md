# IndexNow runbook

- Verification key: served from the site root.
- URL source: `public/sitemap.xml`.
- Automatic trigger: changes to the sitemap, submit script, or workflow on `main`.
- Manual trigger: GitHub Actions → Submit sitemap to IndexNow → Run workflow.
- Accepted API responses: HTTP 200 or 202.
