import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  addressCompletenessForLocation,
  fallbackQueryForLocation,
  geocodeAttemptPayload,
  geocodePlanForLocation,
  geocodeUpdatePayload,
  GEOCODE_REVIEW_STATUS,
  MAX_GEOCODE_ATTEMPTS,
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

// Fallback Google: PREGATIT, NU ACTIV (2026-09-07).
//
// Billing-ul Google nu este activat, deci comutatorul sta pe false si nicio cerere nu pleaca spre
// Google, chiar daca GOOGLE_PLACES_API_KEY exista deja in secretele aplicatiei. Cand billing-ul
// va fi activ, singura schimbare necesara aici este comutatorul: locatiile care ies din coada cu
// `needs_geocoding_fallback` sunt exact lotul pe care il va prelua.
const GOOGLE_FALLBACK_ENABLED = false;

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

    // Grupurile de locatii care impart exact aceeasi coordonata. Doua locatii distincte nu pot
    // sta fizic in acelasi punct: cand se intampla, pozitia vine din caderea la nivel de
    // localitate (centrul orasului), nu din adresa lor. Le identificam aici pentru ca randurile
    // scrise inainte de 2026-09-06 nu poarta marcajul de granularitate in `geocode_source`.
    const positionGroups = new Map<string, Array<Record<string, unknown>>>();
    for (const location of locations) {
      const latitude = Number(location.lat);
      const longitude = Number(location.lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      if (String(location.map_precision || '') === 'exact') continue;
      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      if (!positionGroups.has(key)) positionGroups.set(key, []);
      positionGroups.get(key)!.push(location);
    }
    const sharedPosition = [...positionGroups.values()].filter((group) => group.length > 1);
    const sharedPositionLocations = sharedPosition.flat();

    const summary = {
      published_total: locations.length,
      pending_total: pending.length,
      already_positioned: skipped.already_geocoded || 0,
      owner_confirmed: skipped.owner_confirmed_position || 0,
      without_address: skipped.missing_address || 0,
      shared_position_groups: sharedPosition.length,
      shared_position_locations: sharedPositionLocations.length,
    };

    // Marcheaza pozitiile suprapuse ca fiind la nivel de localitate. Nu sterge nicio coordonata:
    // profilurile rămân pe harta exact unde sunt, dar rularea urmatoare le va incerca adresa
    // exacta si le va muta pe cele care se rezolva. Pasul e separat de geocodare pentru ca este
    // instant si nu atinge nicio reţea.
    if (action === 'mark_shared_positions') {
      // Scriere in loturi, nu rand cu rand: 274 de actualizari individuale depasesc limita de
      // apeluri a rulajului si cad la jumatate, lasand datele pe jumatate marcate.
      const pendingMarks = sharedPositionLocations
        .filter((location) => !String(location.geocode_source || '').endsWith('_locality'))
        .map((location) => ({
          id: location.id as string,
          geocode_source: `${String(location.geocode_source || 'openstreetmap_nominatim')}_locality`,
        }));

      for (let offset = 0; offset < pendingMarks.length; offset += 100) {
        await svc.entities.ProviderLocation.bulkUpdate(pendingMarks.slice(offset, offset + 100));
      }

      return Response.json({ success: true, action, ...summary, marked: pendingMarks.length });
    }

    // Raport pe starea reala a datelor, fara nicio cerere in reţea. Separa cele patru cazuri care
    // conteaza cand decizi daca merita un al doilea geocoder sau munca de om.
    if (action === 'audit') {
      const buckets = {
        street_and_number: 0,
        street_without_number: 0,
        locality_only: 0,
        missing: 0,
      };
      const failedWithCompleteAddress = [];
      let needsFallback = 0;
      let needsManual = 0;
      let attemptsExhausted = 0;

      for (const location of locations) {
        const completeness = addressCompletenessForLocation(location);
        const localityOnly = String(location.geocode_source || '').endsWith('_locality');
        const attempts = Number(location.geocode_attempt_count) || 0;
        const review = String(location.geocode_review_status || GEOCODE_REVIEW_STATUS.NONE);

        // Numaram doar locatiile care ne intereseaza: cele fara pozitie la nivel de strada.
        if (!localityOnly && Number.isFinite(Number(location.lat)) && review === GEOCODE_REVIEW_STATUS.NONE) continue;

        buckets[completeness] = (buckets[completeness] || 0) + 1;
        if (attempts >= MAX_GEOCODE_ATTEMPTS) attemptsExhausted += 1;
        if (review === GEOCODE_REVIEW_STATUS.NEEDS_FALLBACK) needsFallback += 1;
        if (review === GEOCODE_REVIEW_STATUS.NEEDS_MANUAL) needsManual += 1;
        if (localityOnly && completeness === 'street_and_number') failedWithCompleteAddress.push(location.id);
      }

      return Response.json({
        success: true,
        action: 'audit',
        ...summary,
        address_complete_street_and_number: buckets.street_and_number,
        address_incomplete: buckets.street_without_number + buckets.locality_only + buckets.missing,
        address_incomplete_breakdown: {
          street_without_number: buckets.street_without_number,
          locality_only: buckets.locality_only,
          missing: buckets.missing,
        },
        nominatim_failed_with_complete_address: failedWithCompleteAddress.length,
        needs_geocoding_fallback: needsFallback,
        needs_manual_review: needsManual,
        attempts_exhausted: attemptsExhausted,
        google_fallback_enabled: GOOGLE_FALLBACK_ENABLED,
      });
    }

    if (action !== 'run') {
      return Response.json({ success: true, action: 'preview', ...summary });
    }

    // Un lot mic si un apel repetat sunt intentionate: functia are timp limitat de executie, iar
    // politica Nominatim cere o cerere pe secunda. Adminul apasa din nou pana la zero, sau
    // interfata reapeleaza automat cat timp mai exista locatii in asteptare.
    const requested = Number(payload.batch_size) || DEFAULT_BATCH;
    const batchSize = Math.max(1, Math.min(requested, MAX_BATCH));
    const batch = pending.slice(0, batchSize);

    const result = {
      geocoded: 0,
      fallback_used: 0,
      rejected: {},
      failed: 0,
      attempted_count: 0,
      completed_count: 0,
      marked_needs_fallback: 0,
      marked_needs_manual: 0,
      rate_limited: false,
    };

    for (const entry of batch) {
      const { location, plan } = entry;
      result.attempted_count += 1;
      try {
        let results = await geocode(plan.query);
        await sleep(REQUEST_INTERVAL_MS);

        let verdict = pickGeocodeResult(results, location);
        let usedFallback = false;
        const hasPosition = Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
        if (!verdict.accepted && !hasPosition) {
          // Caderea la nivel de localitate se face O SINGURA data, cand locatia nu are inca nicio
          // pozitie. Cand are deja centrul localitatii, o a doua cerere ar reintoarce exact acelasi
          // punct - cerere irosita, la un serviciu limitat la o cerere pe secunda.
          const fallback = fallbackQueryForLocation(location);
          if (fallback) {
            usedFallback = true;
            results = await geocode(fallback);
            await sleep(REQUEST_INTERVAL_MS);
            verdict = pickGeocodeResult(results, location);
          }
        }

        // Orice rezultat care nu este o adresa la nivel de strada consuma o incercare. Adresa si
        // coordonatele existente rămân neatinse; se scriu doar contorul, semnatura interogarii si,
        // la epuizare, marcajul de verificare.
        if (!verdict.accepted || usedFallback) {
          const attemptFields = geocodeAttemptPayload(location, plan.query);
          await svc.entities.ProviderLocation.update(location.id, attemptFields);
          if (attemptFields.geocode_review_status === GEOCODE_REVIEW_STATUS.NEEDS_FALLBACK) {
            result.marked_needs_fallback += 1;
            result.completed_count += 1;
          }
          if (attemptFields.geocode_review_status === GEOCODE_REVIEW_STATUS.NEEDS_MANUAL) {
            result.marked_needs_manual += 1;
            result.completed_count += 1;
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
          granularity: usedFallback ? 'locality' : 'street',
        });
        // Adresa s-a rezolvat la nivel de strada: locatia iese curat din coada, cu contorul si
        // marcajul de verificare resetate.
        if (!usedFallback) {
          updates.geocode_attempt_count = 0;
          updates.geocode_attempt_signature = '';
          updates.geocode_review_status = GEOCODE_REVIEW_STATUS.NONE;
        }
        await svc.entities.ProviderLocation.update(location.id, updates);
        result.geocoded += 1;
        if (usedFallback) result.fallback_used += 1;
        else result.completed_count += 1;

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
          result.rate_limited = true;
          break;
        }
      }
    }

    return Response.json({
      success: true,
      action: 'run',
      ...summary,
      ...result,
      // O pozitie obtinuta doar la nivel de localitate ramane in coada pentru o varianta
      // mai precisa. Ies din coada doar adresele rezolvate la nivel de strada si cazurile
      // care au epuizat variantele si au fost marcate pentru fallback/manual.
      remaining: Math.max(0, pending.length - result.completed_count),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}