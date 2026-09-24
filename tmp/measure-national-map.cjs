// Masoara marimea hartii nationale (o singura cerere). Fisier de lucru, nu face parte din aplicatie.
const zlib = require('zlib');
const fs = require('fs');

async function main() {
  const url = 'https://viasee.ro/api/functions/browseDirectoryProviders';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ map_scope: 'national' }),
  });
  const text = await response.text();
  console.log('status', response.status, 'chars', text.length);
  if (response.status !== 200) return;
  const data = JSON.parse(text);
  const gz = zlib.gzipSync(Buffer.from(text));
  console.log('points', data.results.length, 'gzip', gz.length, 'gzip-b64', gz.toString('base64').length);
  console.log('keys', Object.keys(data.results[0]).join(','));
  fs.writeFileSync('/tmp/national-sample.json', text);
}

main().catch((error) => { console.error(error); process.exit(1); });
