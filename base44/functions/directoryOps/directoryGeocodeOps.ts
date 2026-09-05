import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  fallbackQueryForLocation,
  geocodePlanForLocation,
  geocodeUpdatePayload,
  pickGeocodeResult,
} from '../../shared/addressGeocoding.js';

// Completeaza pozitia locatiilor publicate, din adresa lor publica.
//
// 2026-09-05. De ce exista asta, cand pe profilul unei locatii harta merge deja doar cu adresa:
// pe profil este UN singur loc, iar iframe-ul Google isi face singur cautarea dupa textul
// adresei. Pe ecranul de rezultate sunt 9 optiuni pe aceeasi harta - si nu poti pune noua
// iframe-uri unul peste altul. Orice harta cu mai multe puncte (Leaflet sau Google Maps JS)
// are nevoie de numere: latitudine si longitudine pentru fiecare marcator.
//
// Deci intrebarea nu este "adresa sau coordonate", ci CAND se face conversia:
//   - la fiecare afisare a rezultatelor? Ar insemna 9 cautari la fiecare cautare a fiecarui
//     pacient. Lent, si in afara politicii de utilizare a serviciilor de geocodare;
//   - o data, si se pastreaza? Asta face functia de aici.
//
// Ruleaza in Base44, nu in CI, tocmai ca sa nu depinda de niciun secret adaugat manual: apelul
// catre Nominatim nu are nevoie de cheie, iar scrierea in date se face cu rolul de serviciu al
// aplicatiei. Un admin apasa un buton si loturile se proceseaza pana cand nu mai ramane nimic.
//
// Reguli care nu se negociaza (aceleasi ca in shared/addressGeocoding.js):
//   - un rezultat in afara Romaniei sau in alt judet decat cel din datele noastre se RESPINGE;
//   - nu exista cadere pe centrul tarii sau al judetului. Fara pozitie, locatia ramane fara pin
//     si e numarata sub harta - un pin pus "undeva" ar fi crezut real;
//   - o pozitie confirmata de furnizor nu se suprascrie niciodata.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'VIASEE/1.0 (https://viasee.ro; director national de sanatate vizuala)';
// Politica Nominatim: cel mult o cerere pe secunda. Marja de 100 ms este intentionata.
const REQUEST_INTERVAL_MS = 1100;
const DEFAULT_BATCH = 15;
const MAX_BATCH = 30;
const SCAN_PAGE_SIZE = 200;
const MAX_SCAN_PAGES = 20;

function sleep(ms: number) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function loadPublishedLocations(svc) {
  const all = [];
  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const rows = await svc.entities.ProviderLocation.filter(
      { status: 'publicata', public_visibility_status: 'approved' },
      'id',
      SCAN_PAGE_SIZE,
      page * SCAN_PAGE_SIZE,
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < SCAN_PAGE_SIZE) break;
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
  if (response.status === 429 || response.status === 503) throw new Error('rate_limited');
  if (!response.ok) throw new Error(`http_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Doar administratorii pot rula geocodarea.' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'preview').trim();

    const locations = await loadPublishedLocations(svc);
    const plans = locations.map((location) => ({ location, plan: geocodePlanForLocation(location) }));
    const pending = plans.filter((entry) => entry.plan.action === 'geocode');

    const skipped = {};
    for (const entry of plans) {
      if (entry.plan.action !== 'skip') continue;
      skipped[entry.plan.reason] = (skipped[entry.plan.reason] || 0) + 1;
    }

    const summary = {
      published_total: locations.length,
      pending_total: pending.length,
      already_positioned: skipped.already_geocoded || 0,
      owner_confirmed: skipped.owner_confirmed_position || 0,
      without_address: skipped.missing_address || 0,
    };

    if (action !== 'run') {
      return Response.json({ success: true, action: 'preview', ...summary });
    }

    // Un lot mic si un apel repetat sunt intentionate: functia are timp limitat de executie, iar
    // politica Nominatim cere o cerere pe secunda. Adminul apasa din nou pana la zero, sau
    // interfata reapeleaza automat cat timp mai exista locatii in asteptare.
    const requested = Number(payload.batch_size) || DEFAULT_BATCH;
    const batchSize = Math.max(1, Math.min(requested, MAX_BATCH));
    const batch = pending.slice(0, batchSize);

    const result = { geocoded: 0, fallback_used: 0, rejected: {}, failed: 0 };

    for (const entry of batch) {
      const { location, plan } = entry;
      try {
        let results = await geocode(plan.query);
        await sleep(REQUEST_INTERVAL_MS);

        let verdict = pickGeocodeResult(results, location);
        let usedFallback = false;
        if (!verdict.accepted) {
          // Adresa exacta nu s-a rezolvat. O singura treapta mai sus - localitatea - si atat.
          const fallback = fallbackQueryForLocation(location);
          if (fallback) {
            usedFallback = true;
            results = await geocode(fallback);
            await sleep(REQUEST_INTERVAL_MS);
            verdict = pickGeocodeResult(results, location);
          }
        }

        if (!verdict.accepted) {
          result.rejected[verdict.reason] = (result.rejected[verdict.reason] || 0) + 1;
          continue;
        }

        const updates = geocodeUpdatePayload({
          lat: verdict.lat,
          lng: verdict.lng,
          address: location.address,
        });
        await svc.entities.ProviderLocation.update(location.id, updates);
        result.geocoded += 1;
        if (usedFallback) result.fallback_used += 1;

        await svc.entities.DirectoryAuditRecord.create({
          entity_type: 'ProviderLocation',
          entity_id: location.id,
          action_type: 'directory_geocode_from_address',
          changed_fields: Object.keys(updates),
          previous_values: JSON.stringify({ lat: location.lat ?? null, lng: location.lng ?? null }),
          new_values: JSON.stringify(updates),
          admin_user_id: user.id,
          admin_email: user.email,
          note: usedFallback
            ? 'Pozitie aproximativa, la nivel de localitate (adresa exacta nu s-a rezolvat)'
            : 'Pozitie aproximativa, derivata din adresa publica',
          performed_at: new Date().toISOString(),
        });
      } catch (error) {
        result.failed += 1;
        if (String(error?.message || '') === 'rate_limited') {
          // Serviciul cere sa incetinim. Oprim lotul aici; urmatorul apel reia de unde a ramas.
          break;
        }
      }
    }

    return Response.json({
      success: true,
      action: 'run',
      ...summary,
      ...result,
      remaining: Math.max(0, pending.length - result.geocoded),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
