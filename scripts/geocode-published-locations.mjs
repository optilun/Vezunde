// Completeaza pozitia locatiilor publicate, din adresa lor publica, prin OpenStreetMap.
//
// 2026-09-05. Cele 500+ locatii publicate au adresa, judetul si codul SIRUTA, dar nu si
// coordonate: importul national nu geocodeaza. Fara ele harta rezultatelor nu are ce desena.
//
// Rulare:
//   BASE44_APP_ID=... BASE44_API_KEY=... node scripts/geocode-published-locations.mjs
//   BASE44_APP_ID=... BASE44_API_KEY=... node scripts/geocode-published-locations.mjs --apply
//
// Fara `--apply` scriptul NU scrie nimic: interogheaza, evalueaza si raporteaza ce ar face.
// Rulati intai fara, cititi rata de acceptare si abia apoi cu.
//
// Politica de utilizare Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
// maximum o cerere pe secunda, un User-Agent care identifica aplicatia, si atributie in
// interfata. Le respectam pe toate trei: intervalul de mai jos este de 1100 ms, User-Agent-ul
// numeste VIASEE si domeniul, iar harta afiseaza atributia OpenStreetMap.
//
// Scriptul este reluabil: o locatie deja geocodata pentru aceeasi adresa este sarita, deci
// o rulare intrerupta se poate relua fara sa refaca munca si fara sa suprascrie nimic.
// O pozitie confirmata de furnizor ('exact') nu se atinge niciodata.
import process from 'node:process';
import { createClient } from '@base44/sdk';
import {
  fallbackQueryForLocation,
  geocodePlanForLocation,
  geocodeUpdatePayload,
  pickGeocodeResult,
} from '../shared/addressGeocoding.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'VIASEE/1.0 (https://viasee.ro; director national de sanatate vizuala)';
const REQUEST_INTERVAL_MS = 1100;
const PAGE_SIZE = 500;
const MAX_PAGES = 200;

const apply = process.argv.includes('--apply');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const maxLocations = limitArgument ? Number(limitArgument.split('=')[1]) : Infinity;

const appId = process.env.BASE44_APP_ID;
const apiKey = process.env.BASE44_API_KEY;

if (!appId || !apiKey) {
  console.error('Lipsesc BASE44_APP_ID si/sau BASE44_API_KEY.');
  process.exit(1);
}

const client = createClient({ appId, apiKey });
const entities = client.asServiceRole?.entities || client.entities;

function sleep(milliseconds) {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); });
}

async function loadPublishedLocations() {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await entities.ProviderLocation.filter(
      { status: 'publicata', public_visibility_status: 'approved' },
      'id',
      PAGE_SIZE,
      page * PAGE_SIZE,
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

async function geocode(query) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ro',
    city: query.city,
    country: query.country,
  });
  if (query.street) params.set('street', query.street);
  if (query.county) params.set('county', query.county);

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ro,en' },
  });
  if (response.status === 429 || response.status === 503) {
    // Serviciul cere sa incetinim. Asteptam vizibil si semnalam, nu insistam in bucla.
    throw new Error(`rate_limited_${response.status}`);
  }
  if (!response.ok) throw new Error(`http_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

const locations = await loadPublishedLocations();
console.log(`${locations.length} locatii publicate incarcate. Mod: ${apply ? 'APLICARE' : 'simulare'}.`);

const stats = {
  skipped: new Map(),
  geocoded: 0,
  fallback_used: 0,
  rejected: new Map(),
  failed: 0,
  written: 0,
};

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

let processed = 0;

for (const location of locations) {
  if (processed >= maxLocations) break;

  const plan = geocodePlanForLocation(location);
  if (plan.action === 'skip') {
    bump(stats.skipped, plan.reason);
    continue;
  }

  processed += 1;

  let results = [];
  let usedFallback = false;
  try {
    results = await geocode(plan.query);
    await sleep(REQUEST_INTERVAL_MS);

    let verdict = pickGeocodeResult(results, location);
    if (!verdict.accepted) {
      // Adresa exacta nu s-a rezolvat. Incercam o treapta mai sus - localitatea - si atat.
      const fallback = fallbackQueryForLocation(location);
      if (fallback) {
        usedFallback = true;
        results = await geocode(fallback);
        await sleep(REQUEST_INTERVAL_MS);
        verdict = pickGeocodeResult(results, location);
      }
    }

    if (!verdict.accepted) {
      bump(stats.rejected, verdict.reason);
      console.log(`  RESPINS ${location.city} — ${location.name}: ${verdict.reason}`);
      continue;
    }

    stats.geocoded += 1;
    if (usedFallback) stats.fallback_used += 1;

    if (apply) {
      await entities.ProviderLocation.update(
        location.id,
        geocodeUpdatePayload({
          lat: verdict.lat,
          lng: verdict.lng,
          address: location.address,
        }),
      );
      stats.written += 1;
    }
  } catch (error) {
    stats.failed += 1;
    console.error(`  EROARE ${location.city} — ${location.name}: ${error?.message || error}`);
    if (String(error?.message || '').startsWith('rate_limited')) {
      console.error('  Serviciul cere sa incetinim. Astept 30 de secunde.');
      await sleep(30000);
    }
  }
}

console.log('');
console.log(`Procesate: ${processed}`);
console.log(`Geocodate cu succes: ${stats.geocoded} (din care ${stats.fallback_used} doar la nivel de localitate)`);
console.log(`Scrise in baza de date: ${stats.written}`);
console.log(`Esuate tehnic: ${stats.failed}`);
console.log(`Sarite: ${[...stats.skipped].map(([reason, count]) => `${reason}=${count}`).join(', ') || 'niciuna'}`);
console.log(`Respinse: ${[...stats.rejected].map(([reason, count]) => `${reason}=${count}`).join(', ') || 'niciuna'}`);

if (!apply) {
  console.log('');
  console.log('Simulare. Nimic nu a fost scris. Reluati cu --apply cand rata de acceptare arata bine.');
}
