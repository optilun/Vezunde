// Verifica daca harta nationala vine din copia salvata (fisier de lucru, nu face parte din aplicatie).
async function once(label) {
  const started = Date.now();
  const response = await fetch('https://viasee.ro/api/functions/browseDirectoryProviders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ map_scope: 'national' }),
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch (_error) { data = { raw: text.slice(0, 120) }; }
  console.log(label, response.status, `${Date.now() - started}ms`, 'points', (data.results || []).length,
    'generated_at', data.generated_at || '-', 'stale', data.stale, data.error ? `error=${data.error}` : '');
}

async function main() {
  const gap = Number(process.argv[2] || 0);
  await once('first ');
  if (gap > 0) {
    await new Promise((resolve) => setTimeout(resolve, gap));
    await once('second');
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
