// Fisier de lucru: salveaza o copie a hartii nationale pentru masuratori locale (o singura cerere).
const fs = require('fs');

async function main() {
  const response = await fetch('https://viasee.ro/api/functions/browseDirectoryProviders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ map_scope: 'national' }),
  });
  const text = await response.text();
  console.log('status', response.status, 'chars', text.length);
  if (response.status === 200) fs.writeFileSync('/tmp/national-sample.json', text);
}

main().catch((error) => { console.error(error); process.exit(1); });
