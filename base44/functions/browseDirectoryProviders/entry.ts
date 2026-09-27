import {
  evaluateServicePrerequisites,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from './sharedDependencies.js';
import { getPublicLocationDisclosure } from './providerPublicTrust.js';
import {
  loadDirectoryDetailOverlay,
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
  paginateRows,
  withDirectoryDetail,
} from '../../shared/locationScopedEntityQuery.js';
import { getNationalMap } from '../../shared/nationalMapCache.js';
import { loadDirectoryDetailOverlayForMap, loadPublishedLocationsForMap, readAllPages } from '../../shared/nationalMapSources.js';
import { isPublicProfessionalProfile } from '../../shared/professionalProfileStatus.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Read-only locality browse. It does not score or match by service.
const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
  'optical_laboratory_b2c',
];

function normalizedName(location) {
  return String(location?.public_display_name || location?.name || '').trim().toLocaleLowerCase('ro-RO');
}

// 2026-09-26. Numarul de locatii pe localitate, pentru lista de orase din /cauta. Include si
// locatiile fara pozitie (harta le omite), deci e acelasi numar ca lista de pe pagina orasului.
// Cheia e numele localitatii + judetul, fara diacritice. Sectoarele Bucurestiului se numara la
// Bucuresti, iar resedinta cu acelasi nume ca UAT-ul are deja acelasi nume - exact regula din
// resolveEquivalentLocalityCodes (base44/shared/locationScopedEntityQuery.js).
function localityCountKey(name, county) {
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const place = normalize(name).replace(/^bucuresti sector(ul)? \d+$/, 'bucuresti');
  return `${place}|${normalize(county)}`;
}

// 2026-09-06, directorul pe harta. O singura ramura care intoarce TOATE locatiile publicate,
// in forma minima necesara desenarii unui punct. Nu este o cautare si nu inlocuieste una:
// nu scoreaza, nu ordoneaza dupa relevanta si nu are Top 3. Este harta directorului, din care
// pacientul intra pe un profil.
//
// Campurile sunt putine intentionat: 900+ locatii inseamna ca fiecare camp in plus se
// inmulteste cu 900. Detaliile se citesc pe profil, nu aici.
//
// 2026-09-24. Datele vin din shared/nationalMapSources.js: aceleasi locatii si aceeasi stare de
// director, citite pe pagini de 500 (~7 citiri) in loc de o interogare pe fiecare judet (~100).
function isVisibleInDirectory(loc) {
  if (loc.public_visibility_status !== 'approved') return false;
  if (loc.active_status === 'inactiva') return false;
  if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) return false;
  return true;
}

// 2026-09-27. Fotografia locatiei si poza de profil (logo-ul organizatiei) pe cardurile din lista,
// doar pentru profilurile cu detaliu complet (revendicate sau verificate): aceeasi regula ca
// pagina de profil, unde `photo_url` si logo-ul apar doar cu `expose_full_details`. Doar adrese
// https - un data URL ar adauga sute de KB pe fiecare punct al hartii. Un logo care nu se poate
// citi lipseste pur si simplu; cardul are o coperta generata.
function publicHttpsImage(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 1000 || !/^https:\/\//i.test(raw)) return null;
  try {
    return new URL(raw).toString();
  } catch (_error) {
    return null;
  }
}

async function loadOrganizationLogos(svc, organizationIds) {
  const ids = [...new Set(organizationIds.filter(Boolean).map(String))].slice(0, 200);
  const entries = await Promise.all(ids.map(async (id) => {
    const organization = await svc.entities.ProviderOrganization.get(id).catch(() => null);
    return [id, publicHttpsImage(organization?.logo_url)];
  }));
  return new Map(entries.filter(([, logo]) => logo));
}

function cardImages(loc, disclosure, logos) {
  if (disclosure.expose_full_details !== true) return {};
  const images = {};
  const logo = logos.get(String(loc.organization_id || '')) || null;
  const photo = publicHttpsImage(loc.photo_url);
  // Profilurile vechi aveau logo-ul copiat in `photo_url`; acela nu e o fotografie a locatiei.
  if (photo && photo !== logo) images.photo_url = photo;
  if (logo) images.logo_url = logo;
  return images;
}

function fullDetailOrganizationIds(disclosed) {
  return disclosed
    .filter(({ disclosure }) => disclosure.expose_full_details === true)
    .map(({ loc }) => loc.organization_id);
}

async function computeNationalMap(svc) {
  const { locations: allLocations } = await loadPublishedLocationsForMap(svc);
  const visible = allLocations.filter(isVisibleInDirectory);
  const { overlay } = await loadDirectoryDetailOverlayForMap(svc, visible.map((loc) => loc.id));
  const disclosed = visible.map((loc) => ({ loc, disclosure: getPublicLocationDisclosure(withDirectoryDetail(loc, overlay)) }));
  const logos = await loadOrganizationLogos(svc, fullDetailOrganizationIds(disclosed));

  const points = [];
  const localityCounts = {};
  let totalPublished = 0;
  for (const { loc, disclosure } of disclosed) {
    if (disclosure.profile_control_status === 'suspended') continue;
    totalPublished += 1;
    const countKey = localityCountKey(loc.locality_name || loc.city, loc.county_name || loc.county);
    localityCounts[countKey] = (localityCounts[countKey] || 0) + 1;
    if (disclosure.lat === null || disclosure.lng === null) continue;
    points.push({
      id: loc.id,
      name: loc.public_display_name || loc.name,
      provider_type: loc.provider_type,
      city: loc.locality_name || loc.city || null,
      county: loc.county_name || loc.county || null,
      address: disclosure.address,
      lat: disclosure.lat,
      lng: disclosure.lng,
      map_precision: disclosure.map_precision,
      profile_control_status: disclosure.profile_control_status,
      ...cardImages(loc, disclosure, logos),
    });
  }

  return {
    map_scope: 'national',
    results: points,
    total_published: totalPublished,
    without_position: totalPublished - points.length,
    locality_counts: localityCounts,
  };
}

// 2026-09-27. Lista pentru sitemap-ul de locatii (scripts/generate-sitemap-locations.mjs, rulat
// zilnic din GitHub Actions). Acelasi set ca harta - inclusiv locatiile fara pozitie, pe care
// harta nu le deseneaza - dar doar id si data ultimei modificari. Sunt exact profilurile publice
// deja listate pe site, deci nu cere nicio cheie. Nu scoreaza si nu ordoneaza dupa relevanta.
// O copie in memorie SITEMAP_FRESH_MS, ca apeluri repetate sa nu consume din limita de citiri.
const SITEMAP_FRESH_MS = 10 * 60 * 1000;
let sitemapMemory = null; // { value, generatedAt }

function lastmodOf(row) {
  return row?.profile_updated_at || row?.updated_date || row?.created_date || null;
}

function latestDate(values) {
  let best = null;
  for (const value of values) {
    const time = Date.parse(value);
    if (Number.isFinite(time) && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

const byId = (a, b) => String(a.id).localeCompare(String(b.id));

// 2026-09-27. Organizatiile intra in sitemap doar daca site-ul insusi trimite catre pagina lor:
// profilul unei locatii arata linkul „Vezi toate locatiile organizatiei” numai cand locatia are
// detaliu complet (revendicata sau verificata - vezi `organization_id` in
// getPublicProviderProfile). Pentru profilurile din director legatura cu organizatia nu e
// expusa, deci nici sitemap-ul nu o promoveaza. In plus, cel putin 2 locatii publice: o
// organizatie cu o singura locatie ar dubla pagina locatiei.
const SITEMAP_ORGANIZATION_MIN_LOCATIONS = 2;

async function sitemapOrganizations(svc, orgStats) {
  const candidates = [...orgStats.entries()]
    .filter(([, stats]) => stats.linked && stats.count >= SITEMAP_ORGANIZATION_MIN_LOCATIONS);
  const rows = await Promise.all(candidates.map(async ([organizationId, stats]) => {
    const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
    if (!organization || organization.status === 'inactiva') return null;
    return { id: organizationId, lastmod: latestDate([...stats.lastmods, lastmodOf(organization)]) };
  }));
  return rows.filter(Boolean).sort(byId);
}

// Aceeasi poarta ca getPublicProfessionalProfile: profil public, verificat, aprobat si cu nume.
async function sitemapProfessionals(svc) {
  const { rows } = await readAllPages(svc.entities.ProfessionalProfile, { is_public: true });
  return rows
    .filter((profile) => isPublicProfessionalProfile(profile))
    .filter((profile) => String(profile.public_display_name || profile.full_name || '').trim())
    .map((profile) => ({ id: profile.id, lastmod: lastmodOf(profile) }))
    .sort(byId);
}

async function computeSitemapLocations(svc) {
  const { locations: allLocations } = await loadPublishedLocationsForMap(svc);
  const visible = allLocations.filter(isVisibleInDirectory);
  const { overlay } = await loadDirectoryDetailOverlayForMap(svc, visible.map((loc) => loc.id));
  const locations = [];
  const orgStats = new Map(); // organization_id -> { count, linked, lastmods }
  for (const loc of visible) {
    const disclosure = getPublicLocationDisclosure(withDirectoryDetail(loc, overlay));
    if (disclosure.profile_control_status === 'suspended') continue;
    locations.push({ id: loc.id, lastmod: lastmodOf(loc) });
    if (loc.organization_id) {
      const key = String(loc.organization_id);
      const stats = orgStats.get(key) || { count: 0, linked: false, lastmods: [] };
      stats.count += 1;
      stats.linked = stats.linked || disclosure.expose_full_details === true;
      stats.lastmods.push(lastmodOf(loc));
      orgStats.set(key, stats);
    }
  }
  locations.sort(byId);

  // Profilurile de organizatie si de specialist sunt un fisier separat. O eroare aici nu are voie
  // sa strice lista de locatii: generatorul vede `profiles_error` si pastreaza fisierul existent.
  let organizations = [];
  let professionals = [];
  let profilesError = false;
  try {
    [organizations, professionals] = await Promise.all([
      sitemapOrganizations(svc, orgStats),
      sitemapProfessionals(svc),
    ]);
  } catch (_error) {
    profilesError = true;
  }

  return {
    map_scope: 'sitemap',
    locations,
    total: locations.length,
    organizations,
    professionals,
    profiles_error: profilesError,
  };
}

async function getSitemapLocations(svc) {
  if (sitemapMemory && Date.now() - sitemapMemory.generatedAt < SITEMAP_FRESH_MS) return sitemapMemory;
  sitemapMemory = { value: await computeSitemapLocations(svc), generatedAt: Date.now() };
  return sitemapMemory;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const rawServices = Array.isArray(payload.filter_service_keys) ? payload.filter_service_keys.map(String) : [];
    if (rawServices.some(key => !normalizeServiceKey(key).definition)) return Response.json({ error: 'Un serviciu selectat nu este disponibil pentru filtrare.' }, { status: 400 });
    const selectedServices = [...new Set(rawServices.map(key => normalizeServiceKey(key).canonicalKey))];
    const casOnly = payload.cas_only === true;
    const advanced = selectedServices.length > 0 || casOnly;
    const pageSize = Math.max(1, Math.min(Number(payload.page_size || payload.limit) || 20, 50));
    const offset = Math.max(0, Math.floor(Number(payload.offset) || 0));
    const includeMapResults = payload.include_map_results === true;

    if (String(payload.map_scope || '').trim() === 'sitemap') {
      try {
        const sitemap = await getSitemapLocations(svc);
        return Response.json({ ...sitemap.value, generated_at: new Date(sitemap.generatedAt).toISOString() });
      } catch (_error) {
        return Response.json({
          error: 'Lista pentru sitemap nu poate fi incarcata acum. Incearca din nou peste cateva minute.',
          code: 'sitemap_unavailable',
        }, { status: 503 });
      }
    }

    // Harta nationala (vezi computeNationalMap). 2026-09-23: vine dintr-o copie tinuta cateva
    // minute (shared/nationalMapCache.js). Recalcularea la fiecare vizita facea ~100 de citiri,
    // iar a doua vizita la cateva secunde dupa prima primea „Rate limit exceeded”.
    if (String(payload.map_scope || '').trim() === 'national') {
      try {
        const map = await getNationalMap({ svc, compute: () => computeNationalMap(svc) });
        return Response.json({
          ...map.value,
          generated_at: new Date(map.generatedAt).toISOString(),
          stale: map.stale,
        });
      } catch (_error) {
        // Nicio copie si calcularea a esuat (de regula limita de trafic, trecatoare). Pagina
        // reincearca singura (src/lib/nationalDirectoryMapLoader.js) si arata un mesaj clar.
        return Response.json({
          error: 'Harta directorului nu poate fi incarcata acum. Incearca din nou peste cateva secunde.',
          code: 'map_unavailable',
        }, { status: 503 });
      }
    }

    if (!sirutaCode) {
      return Response.json({
        results: [],
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: null,
        pagination: {
          offset,
          page_size: pageSize,
          returned: 0,
          total: 0,
          has_more: false,
          next_offset: null,
        },
      });
    }

    const localityLocations = await loadPublicLocationsForLocality(svc, sirutaCode);
    const eligibleLocations = localityLocations
      .filter((loc) => {
        const publicDisclosure = getPublicLocationDisclosure(loc);
        if (loc.public_visibility_status !== 'approved') return false;
        if (publicDisclosure.profile_control_status === 'suspended') return false;
        if (loc.active_status === 'inactiva') return false;
        if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) return false;
        if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) return false;
        return true;
      })
      .sort((a, b) => normalizedName(a).localeCompare(normalizedName(b), 'ro') || String(a.id || '').localeCompare(String(b.id || '')));

    const initialPage = paginateRows(eligibleLocations, { pageSize, offset });
    const locations = advanced ? eligibleLocations : initialPage.page;
    let pagination = initialPage.pagination;
    const locationIds = locations.map((location) => location.id).filter(Boolean);

    const [services, assignments, equipment, facilities] = await Promise.all([
      loadRowsForLocationIds(svc.entities.LocationService, locationIds, { perLocationLimit: 500, throwOnError: advanced }),
      loadRowsForLocationIds(svc.entities.ProfessionalLocationAssignment, locationIds, { query: { active_status: 'activ' }, perLocationLimit: 200, throwOnError: advanced }),
      loadRowsForLocationIds(svc.entities.LocationEquipment, locationIds, { perLocationLimit: 300, throwOnError: advanced }),
      loadRowsForLocationIds(svc.entities.LocationFacility, locationIds, { perLocationLimit: 300, throwOnError: advanced }),
    ]);

    const professionalIds = [...new Set(assignments.map((assignment) => assignment.professional_id).filter(Boolean))];
    const professionals = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch((error) => {
        if (advanced) throw error;
        return null;
      })),
    )).filter(Boolean);
    const professionalsById = Object.fromEntries(professionals.map((profile) => [profile.id, profile]));

    const servicesByLocation = {};
    for (const service of services) {
      if (service.is_active === false) continue;
      if (!normalizeServiceKey(service.service_key).definition) continue;
      if (!servicesByLocation[service.location_id]) servicesByLocation[service.location_id] = [];
      servicesByLocation[service.location_id].push(service);
    }

    const assignmentsByLocation = {};
    for (const assignment of assignments) {
      if (!assignmentsByLocation[assignment.location_id]) assignmentsByLocation[assignment.location_id] = [];
      assignmentsByLocation[assignment.location_id].push(assignment);
    }

    const equipmentByLocation = {};
    for (const item of equipment) {
      if (item.is_active === false) continue;
      if (!equipmentByLocation[item.location_id]) equipmentByLocation[item.location_id] = [];
      equipmentByLocation[item.location_id].push(item);
    }

    const facilitiesByLocation = {};
    for (const facility of facilities) {
      if (facility.is_active === false) continue;
      if (!facilitiesByLocation[facility.location_id]) facilitiesByLocation[facility.location_id] = [];
      facilitiesByLocation[facility.location_id].push(facility);
    }

    // Nivelul de detaliu public sta pe starea de director, nu pe locatie. Fara el, un profil
    // aprobat editorial aparea aici ca 'summary' si isi ascundea adresa - desi pagina lui de
    // profil o arata. Vezi loadDirectoryDetailOverlay.
    const detailOverlay = await loadDirectoryDetailOverlay(svc, (includeMapResults ? eligibleLocations : locations).map((loc) => loc.id), { throwOnError: advanced });

    const results = [];
    let locationsWithPublishedServices = 0;
    for (const loc of locations) {
      const publicDisclosure = getPublicLocationDisclosure(withDirectoryDetail(loc, detailOverlay));
      const locAssignments = assignmentsByLocation[loc.id] || [];
      const locProfessionals = [...new Set(locAssignments.map((assignment) => assignment.professional_id).filter(Boolean))]
        .map((id) => professionalsById[id])
        .filter(Boolean);
      const prerequisiteContext = {
        location: loc,
        assignments: locAssignments,
        professionals: locProfessionals,
        equipment: equipmentByLocation[loc.id] || [],
        facilities: facilitiesByLocation[loc.id] || [],
      };

      const publicServices = publicDisclosure.expose_full_details ? (servicesByLocation[loc.id] || []).filter((service) => (
        !service.migration_review_required
        && isServicePubliclyEligible(service, loc)
        && evaluateServicePrerequisites(service.service_key, prerequisiteContext).eligible
      )) : [];
      const hasPublicService = publicServices.length > 0;
      if (hasPublicService) locationsWithPublishedServices += 1;
      if (advanced && !publicServices.some(service => (!selectedServices.length || selectedServices.includes(normalizeServiceKey(service.service_key).canonicalKey)) && (!casOnly || service.cas_reimbursed === true))) continue;

      results.push({
        id: loc.id,
        name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        location_type_code: publicDisclosure.location_type_code,
        city: loc.city,
        county: loc.county || null,
        address: publicDisclosure.address,
        lat: publicDisclosure.lat,
        lng: publicDisclosure.lng,
        map_precision: publicDisclosure.map_precision,
        phone: publicDisclosure.phone,
        website: publicDisclosure.website,
        opening_hours: publicDisclosure.opening_hours,
        saturday_hours: publicDisclosure.saturday_hours,
        profile_control_status: publicDisclosure.profile_control_status,
        public_detail_level: publicDisclosure.public_detail_level,
        exact_location_visible: publicDisclosure.exact_location_visible,
        contact_details_visible: publicDisclosure.contact_details_visible,
        result_type: 'directory',
        is_match_eligible: false,
        service_coverage_status: publicDisclosure.expose_full_details
          ? (hasPublicService ? 'listed' : 'not_listed')
          : 'not_disclosed',
      });
    }

    const finalPage = advanced ? paginateRows(results, { pageSize, offset }) : { page: results, pagination };
    pagination = finalPage.pagination;
    // Map scope is independent of card pagination, but never of public visibility or filters.
    // Keep unpositioned rows here: they remain eligible for the list and advanced matching.
    const mapResults = includeMapResults ? (advanced ? results : eligibleLocations.map(loc => {
      const disclosure = getPublicLocationDisclosure(withDirectoryDetail(loc, detailOverlay));
      return {
        id: loc.id, name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type, city: loc.locality_name || loc.city,
        county: loc.county_name || loc.county || null, address: disclosure.address,
        lat: disclosure.lat, lng: disclosure.lng, map_precision: disclosure.map_precision,
        profile_control_status: disclosure.profile_control_status,
        result_type: 'directory', is_match_eligible: false,
      };
    })).map(({ id, name, provider_type, city, county, address, lat, lng, map_precision, profile_control_status }) => (
      { id, name, provider_type, city, county, address, lat, lng, map_precision, profile_control_status, result_type: 'directory', is_match_eligible: false }
    )) : undefined;
    return Response.json({
      results: finalPage.page,
      ...(includeMapResults ? { map_results: mapResults } : {}),
      coverage_status: results.length > 0 ? 'results_found' : 'no_local_results',
      ...(advanced ? { filter_context: {
        unfiltered_total: eligibleLocations.length,
        locations_with_published_services: locationsWithPublishedServices,
      } } : {}),
      routing_mode: 'locality',
      query_scope: 'locality',
      selected_locality_siruta_code: sirutaCode,
      pagination,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
