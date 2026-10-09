// Audit plan Free (2026-10-08): facturarea pentru o organizație fără abonament.
// - F2: după anularea abonamentului vechi pe locație, documentele lui se pot deschide în continuare.
// - F3: textul despre datele precompletate nu mai spune „abonamentul plătit”.
// - F6: fără locații active, pagina spune ce e de făcut ca să poți activa Pro.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadLegacyLocationSubscriptionGroups,
  loadOpenLegacyLocationSubscriptions,
} from '../base44/shared/providerOrganizationBilling.js';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const rowsByLocation = {
  L_open: [{ id: 'a', subscription_scope: 'location', status: 'active', current_period_end: future }],
  L_closed: [
    { id: 'b2', subscription_scope: 'location', status: 'canceled', canceled_at: past, current_period_end: future },
    { id: 'b1', subscription_scope: 'location', status: 'canceled', current_period_end: past },
  ],
  L_org_only: [{ id: 'c', subscription_scope: 'organization', status: 'canceled' }],
  L_none: [],
};
const svc = { entities: { ProviderSubscription: { filter: async (query) => {
  assert.equal(query.billing_mode, 'stripe');
  return rowsByLocation[query.location_id] || [];
} } } };
const locations = Object.keys(rowsByLocation).map((id) => ({ id, name: id }));
const groups = await loadLegacyLocationSubscriptionGroups(svc, locations);
assert.deepEqual(groups.open.map((item) => item.location.id), ['L_open'], 'abonamentul vechi deschis rămâne „deschis”');
assert.deepEqual(groups.closed.map((item) => [item.location.id, item.row.id]), [['L_closed', 'b2']], 'F2: abonamentul vechi încheiat apare, cu rândul cel mai nou');
assert.deepEqual((await loadOpenLegacyLocationSubscriptions(svc, locations)).map((item) => item.location.id), ['L_open'], 'funcția veche întoarce la fel ca înainte');

const ops = await read('base44/functions/getMyProviderWorkspace/providerBillingOps.ts');
assert.match(ops, /loadLegacyLocationSubscriptionGroups\(svc, authorized\.locations\)/);
assert.match(ops, /legacy_documents: legacyDocuments/);
assert.match(ops, /ended_at: row\.canceled_at \|\| row\.deactivated_at \|\| row\.current_period_end \|\| null/);

const panel = await read('src/components/workspace/provider/leads/ProviderBillingPanel.jsx');
assert.match(panel, /Documentele vechiului abonament pe locație/);
assert.match(panel, /onClick=\{\(\) => void run\("portal", undefined, \{ legacy_location_id: item\.location_id \}\)\}>Vezi documentele/);
assert.match(panel, /Am completat datele din vechiul abonament pe locație\./, 'F3');
assert.doesNotMatch(panel, /Am completat datele de pe abonamentul plătit pe locație/);
assert.match(panel, /Ca să activezi Pro, organizația are nevoie de cel puțin o locație activă\./, 'F6');
// Variabilele noi sunt declarate după `activeCount` (altfel pagina s-ar opri la randare).
assert.ok(panel.indexOf('const noActiveLocations') > panel.indexOf('const activeCount'), 'F6: declarat după activeCount');

console.log('Billing Free audit: OK');

// Întoarcerea din Stripe (plată, portal, oferta Enterprise) deschide spațiul organizației. Fără
// `mode=provider`, `s=settings` deschidea setările contului personal, unde panoul de facturare și
// sincronizarea de la întoarcere nu rulează.
for (const file of ['createProviderCheckoutSession.ts', 'createProviderBillingPortalSession.ts', 'providerEnterpriseOfferOps.ts']) {
  const source = await read(`base44/functions/getMyProviderWorkspace/${file}`);
  assert.doesNotMatch(source, /\/contul-meu\?s=settings/, `${file}: întoarcerea fără mode=provider`);
  assert.match(source, /\/contul-meu\?mode=provider&s=settings&tab=billing&/);
}
console.log('Billing return URLs: OK');

// 2026-10-09: restul auditului Free (F1, F4, F5) și cele două detalii de facturare.
const root = await read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx');
assert.match(root, /setEntitlement\(data\.entitlement \? \{ \.\.\.data\.entitlement, location_id: data\.location\?\.id \|\| selectedLocationId \} : null\)/, 'F1: planul ajunge la meniu cu locația');
assert.match(root, /entitlement=\{entitlement\?\.location_id === selectedLocationId \? entitlement : null\}/, 'F1: verificarea din meniu rămâne aceeași');
const sidebar = await read('src/components/provider/shell/ProviderSidebarContent.jsx');
assert.match(sidebar, /<span className="font-heading font-extrabold">de la 49 RON<\/span>/, 'F1: prețul cardului ține cont de pachete');
assert.match(sidebar, /Răspunde cererilor clienților/, 'redesign: cardul spune ce câștigi');
assert.match(sidebar, /to=\{`\/contul-meu\?mode=provider&s=settings&tab=billing/, 'cardul rămâne în spațiul organizației');
assert.doesNotMatch(sidebar, /block truncate[^"]*">de la 49/, 'textul cardului nu mai e tăiat');
const settings = await read('src/components/workspace/provider/ProviderSettings.jsx');
assert.match(settings, /Acces proprietar/, 'F4');
assert.doesNotMatch(settings, /Acces owner/);
const access = await read('src/components/workspace/provider/ProviderRequestAccessSettings.jsx');
assert.match(access, /data\?\.entitlement\?\.plan_code === "free" \?/, 'F5: îndemnul apare doar pe Free');
assert.match(access, /Pachetele pornesc de la 49 RON\/lună pentru o locație\./);
assert.match(access, /onClick=\{onOpenBilling\}>Vezi pachetele Pro</);
assert.match(access, /Deschide facturarea/, 'pe Pro rămâne drumul spre facturare');
assert.match(panel === undefined ? '' : await read('src/components/workspace/provider/leads/ProviderBillingPanel.jsx'), /Ai revenit din Stripe\. Datele de facturare sunt la zi\./);
const portal = await read('base44/functions/getMyProviderWorkspace/createProviderBillingPortalSession.ts');
assert.match(portal, /locale: 'ro',/, 'portalul Stripe în română');
console.log('Free audit rest: OK');
