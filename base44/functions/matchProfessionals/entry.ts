// Recomandarea de specialisti pentru o cerere de pacient.
//
// 2026-09-03. Functia asta este perechea lui matchProvidersSemantic, pentru a doua unitate de
// recomandare: persoana. Pacientul care stie ca vrea "un oftalmolog" nu mai trebuie sa deduca
// asta dintr-o lista de clinici.
//
// Decizii deliberate:
//
// 1. NU reinterpreteaza cererea. Cheile de serviciu vin deja rezolvate din pasul de locatii
//    (`resolved_service_keys`), la fel si `need_level`. Asa cele doua taburi vad exact aceeasi
//    nevoie, iar rezolvarea semantica ramane intr-un singur loc. Un al doilea interpretor ar fi
//    insemnat doua adevaruri despre aceeasi intrebare.
//
// 2. NU atinge matchProvidersSemantic. Scorul locatiilor este inghetat prin garzi de stabilitate
//    pe octeti si regula proiectului spune ca matching-ul si Top 3 nu se schimba fara cerere
//    explicita. Aici e cod nou, langa, nu peste.
//
// 3. Nu are incredere in ce trimite clientul. `location_ids` este cel mult un indiciu de
//    performanta; publicarea, tipul de profil si serviciile se recitesc din baza de fiecare data.
//
// 4. Nu inventeaza specialisti. Apar doar profiluri verificate si aprobate, asociate activ la o
//    locatie publica, cu consimtamant explicit de afisare. Daca una dintre conditii cade,
//    persoana nu apare - nici macar in coada listei.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
} from '../../shared/locationScopedEntityQuery.js';
import {
  PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
  assignProfessionalBuckets,
  buildProfessionalRecommendationEntry,
} from '../../shared/professionalRecommendation.js';
import { isPublicProfessionalProfile } from '../../shared/professionalProfileStatus.js';

const PATIENT_FACING_PROFILE_TYPES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
]);

const NEED_LEVELS = new Set(['general', 'technical', 'specialized_medical', 'unknown']);
const QUERY_SCOPES = new Set(['locality', 'county', 'national']);
const MAX_RESULTS = 30;
const MAX_LOCATIONS_PER_SCOPE = 400;

function clean(value: unknown) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function uniqueStrings(values: unknown, limit = 200) {
  const seen = new Set<string>();
  for (const value of Array.isArray(values) ? values : []) {
    const item = clean(value);
    if (item && item.length <= 120) seen.add(item);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

function locationSirutaCode(location: any) {
  return clean(location?.locality_siruta_code || location?.siruta_code);
}

function expansionTier(location: any, selectedSirutaCode: string, scope: string) {
  if (locationSirutaCode(location) === selectedSirutaCode) return 'oras';
  if (scope === 'national') return 'tara';
  return 'judet';
}

// Exact aceleasi conditii ca in motorul de locatii (matchProvidersSemantic/entry.ts). Daca aici
// ar fi mai stricte sau mai laxe, cele doua taburi ale aceleiasi cautari ar arata universuri
// diferite pentru aceeasi intrebare.
function isPublicLocation(location: any) {
  const activeStatus = clean(location?.active_status).toLowerCase();
  return Boolean(
    location
    && location.status === 'publicata'
    && location.is_active !== false
    && !['inactiv', 'inactiva', 'inactive'].includes(activeStatus)
    && location.profile_control_status !== 'suspended'
    && PATIENT_FACING_PROFILE_TYPES.has(location.provider_profile_type),
  );
}

async function resolveSelectedLocality(svc: any, sirutaCode: string) {
  if (!sirutaCode) return null;
  const rows = await svc.entities.GeographicLocality.filter({
    siruta_code: sirutaCode,
    is_active: true,
  }, null, 2).catch(() => []);
  return rows?.[0] || null;
}

// Aceleasi reguli de acoperire ca la locatii: la nivel national nu se ridica din director,
// pentru ca nu trimitem un pacient sute de kilometri pe baza unui profil neconfirmat.
async function loadLocationsForScope(svc: any, scope: string, selectedLocality: any, sirutaCode: string) {
  if (scope === 'national') {
    return svc.entities.ProviderLocation.filter({
      status: 'publicata',
      profile_control_status: { $in: ['claimed', 'verified'] },
    }, 'name', MAX_LOCATIONS_PER_SCOPE).catch(() => []);
  }
  if (scope === 'county') {
    const countyCode = clean(selectedLocality?.county_code);
    if (!countyCode) return [];
    return svc.entities.ProviderLocation.filter({
      status: 'publicata',
      county_code: countyCode,
    }, 'name', MAX_LOCATIONS_PER_SCOPE).catch(() => []);
  }
  if (!sirutaCode) return [];
  return loadPublicLocationsForLocality(svc, sirutaCode).catch(() => []);
}

function indexServiceKeysByLocation(rows: any[]) {
  const map: Record<string, string[]> = {};
  for (const row of rows || []) {
    const locationId = clean(row?.location_id);
    const serviceKey = clean(row?.service_key);
    if (!locationId || !serviceKey) continue;
    // Aceleasi conditii de activitate ca in motorul de locatii: un serviciu dezactivat nu
    // conteaza ca dovada ca specialistul il acopera acolo.
    if (row.is_active === false) continue;
    const status = clean(row.active_status).toLowerCase();
    if (['inactiv', 'inactiva', 'inactive'].includes(status)) continue;
    map[locationId] = map[locationId] || [];
    if (!map[locationId].includes(serviceKey)) map[locationId].push(serviceKey);
  }
  return map;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = clean(payload.locality_siruta_code);
    const rawScope = clean(payload.query_scope) || 'locality';
    const queryScope = QUERY_SCOPES.has(rawScope) ? rawScope : 'locality';
    const rawNeedLevel = clean(payload.need_level) || 'general';
    const needLevel = NEED_LEVELS.has(rawNeedLevel) ? rawNeedLevel : 'general';
    const requestedServiceKeys = uniqueStrings(payload.service_keys ?? payload.resolved_service_keys);
    const limit = Math.min(MAX_RESULTS, Math.max(1, Number(payload.limit) || 20));

    if (queryScope !== 'national' && !sirutaCode) {
      return Response.json({
        recommendation_contract_version: PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
        results: [],
        need_level: needLevel,
        query_scope: queryScope,
        coverage_status: 'locality_required',
        coverage_counts: {},
      });
    }

    const selectedLocality = await resolveSelectedLocality(svc, sirutaCode);
    const scopeLocations = (await loadLocationsForScope(svc, queryScope, selectedLocality, sirutaCode))
      .filter(isPublicLocation);

    if (scopeLocations.length === 0) {
      return Response.json({
        recommendation_contract_version: PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
        results: [],
        need_level: needLevel,
        query_scope: queryScope,
        selected_locality_siruta_code: sirutaCode,
        selected_locality_name: clean(selectedLocality?.uat_name || selectedLocality?.county_name),
        selected_county_name: clean(selectedLocality?.county_name),
        coverage_status: 'no_locations_in_scope',
        coverage_counts: { scope_location_count: 0, professional_count: 0, result_count: 0 },
      });
    }

    const locationById = new Map(scopeLocations.map((location: any) => [clean(location.id), location]));
    const locationIds = [...locationById.keys()];

    const [assignmentRows, serviceRows] = await Promise.all([
      loadRowsForLocationIds(svc.entities.ProfessionalLocationAssignment, locationIds, {
        query: { active_status: 'activ', public_status: 'public' },
        perLocationLimit: 200,
      }).catch(() => []),
      loadRowsForLocationIds(svc.entities.LocationService, locationIds, {
        perLocationLimit: 500,
      }).catch(() => []),
    ]);

    const serviceKeysByLocation = indexServiceKeysByLocation(serviceRows);

    // Consimtamantul se recontroleaza aici, nu se presupune din `public_status`. Cele doua ar
    // trebui sa fie mereu de acord, dar daca vreodata nu sunt, decide consimtamantul.
    const eligibleAssignments = (assignmentRows || []).filter((row: any) => (
      clean(row?.professional_id)
      && locationById.has(clean(row?.location_id))
      && row.visibility_consent_status === 'accepted'
    ));

    const locationIdsByProfessional = new Map<string, string[]>();
    for (const assignment of eligibleAssignments) {
      const professionalId = clean(assignment.professional_id);
      const locationId = clean(assignment.location_id);
      const list = locationIdsByProfessional.get(professionalId) || [];
      if (!list.includes(locationId)) list.push(locationId);
      locationIdsByProfessional.set(professionalId, list);
    }

    const professionalIds = [...locationIdsByProfessional.keys()].slice(0, 300);
    const profiles = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
    )).filter((profile: any) => isPublicProfessionalProfile(profile));

    const organizationIds = [...new Set(scopeLocations
      .map((location: any) => clean(location.organization_id))
      .filter(Boolean))].slice(0, 300);
    const organizationById = new Map<string, any>();
    await Promise.all(organizationIds.map(async (id) => {
      const organization = await svc.entities.ProviderOrganization.get(id).catch(() => null);
      if (organization) organizationById.set(id, organization);
    }));

    const entries = profiles.map((profile: any) => {
      const locations = (locationIdsByProfessional.get(clean(profile.id)) || [])
        .map((locationId) => {
          const location = locationById.get(locationId);
          if (!location) return null;
          const organization = organizationById.get(clean(location.organization_id));
          return {
            id: clean(location.id),
            name: clean(location.public_display_name || location.name),
            city: clean(location.locality_name || location.city),
            county: clean(location.county_name || location.county),
            organization_id: clean(location.organization_id) || null,
            organization_name: clean(organization?.public_display_name || organization?.name) || null,
            profile_control_status: clean(location.profile_control_status) || 'directory',
            expansion_tier: expansionTier(location, sirutaCode, queryScope),
            service_keys: serviceKeysByLocation[clean(location.id)] || [],
          };
        })
        .filter(Boolean);

      return buildProfessionalRecommendationEntry({
        profile,
        locations,
        requestedServiceKeys,
        needLevel,
      });
    }).filter(Boolean);

    const results = assignProfessionalBuckets(entries, limit);
    const confirmedCount = results.filter((entry: any) => entry.recommendation_group === 'confirmed').length;

    return Response.json({
      recommendation_contract_version: PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
      results,
      need_level: needLevel,
      query_scope: queryScope,
      resolved_service_keys: requestedServiceKeys,
      selected_locality_siruta_code: sirutaCode,
      selected_locality_name: clean(selectedLocality?.uat_name),
      selected_county_code: clean(selectedLocality?.county_code),
      selected_county_name: clean(selectedLocality?.county_name),
      coverage_status: results.length === 0
        ? 'no_professionals_in_scope'
        : (confirmedCount === 0 ? 'directory_only' : 'ok'),
      coverage_counts: {
        scope_location_count: scopeLocations.length,
        professional_count: profiles.length,
        confirmed_count: confirmedCount,
        result_count: results.length,
      },
    });
  } catch (error) {
    console.error('matchProfessionals failed', error);
    return Response.json({ error: 'Recomandările de specialiști nu au putut fi încărcate' }, { status: 500 });
  }
});
