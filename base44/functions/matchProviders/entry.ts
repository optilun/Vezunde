import {
  evaluateServicePrerequisites,
  getCanonicalServiceDefinition,
  isServiceMatchingEligible,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from './sharedDependencies.js';
import { getPublicLocationDisclosure } from './providerPublicTrust.js';
import {
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
} from '../../shared/locationScopedEntityQuery.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Safety rules remain disabled until reviewed by a qualified ophthalmologist.
const SAFETY_RULES = [
  { key: 'urgent_care_notice', enabled: false },
  { key: 'no_diagnosis_notice', enabled: false },
  { key: 'repair_no_guarantee', enabled: false },
  { key: 'child_under_3', enabled: false },
];

const AVAILABILITY_LABELS = {
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
  doar_programare: 'Doar cu programare',
};
const AVAILABILITY_STALE_DAYS = 30;

const FACILITY_REASONS = {
  laborator_optic_propriu: 'Are laborator optic propriu',
  atelier_service_propriu: 'Are atelier de service propriu',
  reparatii_pe_loc: 'Face reparatii pe loc',
  laborator_partener: 'Lucreaza cu laborator partener',
  montaj_lentile_in_locatie: 'Monteaza lentile in locatie',
};

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

const OPTICAL_TYPES = ['optica_medicala', 'laborator_optic', 'cabinet_optometric'];
const REPAIR_FACILITIES = [
  'atelier_service_propriu',
  'reparatii_pe_loc',
  'laborator_optic_propriu',
  'laborator_partener',
  'montaj_lentile_in_locatie',
];
const FACILITY_INTENTS = ['reparatii_ochelari', 'ochelari_lentile', 'lentile_contact'];
const NEED_ORDER = { general: 0, technical: 1, specialized_medical: 2, unknown: 3 };

// --- Structural directory fallback -------------------------------------------------
// Profilurile importate din surse oficiale nu au inregistrari LocationService, pentru ca
// importul NU presupune niciodata servicii. Fara un fallback, ele devin invizibile la orice
// cautare pe nevoie, desi tipul lor este confirmat prin cercetare.
//
// Acest fallback NU scrie nimic in date si NU inventeaza servicii specifice. Foloseste doar
// capacitatea structurala implicita a tipului de locatie, si doar ca ultim nivel de rezultate,
// clar etichetat, sub orice rezultat confirmat.
const STRUCTURAL_CAPABILITY_BY_PROVIDER_TYPE = {
  optica_medicala: 'optical',
  // Inactiv in practica: profilul 'independent_optometrist' nu trece de PATIENT_FACING_PROFILE_TYPES,
  // iar in date nu exista inca nicio locatie de acest tip. Pastrat pentru cand va exista.
  cabinet_optometric: 'optical',
  cabinet_oftalmologic: 'medical',
  clinica_oftalmologica: 'medical',
};

// Se activeaza doar cand rezultatele confirmate sunt insuficiente pentru localitate.
const STRUCTURAL_FALLBACK_MIN_CONFIRMED = 3;
const STRUCTURAL_FALLBACK_MAX_RESULTS = 3;

// Texte distincte: optica este o nevoie generala, oftalmologia este o nevoie medicala si
// primeste un indemn explicit de verificare telefonica prealabila.
const STRUCTURAL_FALLBACK_NOTICES = {
  optical: 'Profil din director \u2014 servicii neconfirmate inca. Sunteti reprezentantul acestei locatii? Revendicati profilul gratuit.',
  medical: 'Profil din director, preluat din surse oficiale. Serviciile nu sunt confirmate de furnizor. Sunati inainte pentru a verifica disponibilitatea si tipul consultatiei.',
};

const STRUCTURAL_FALLBACK_GROUP_LABELS = {
  optical: 'Alte optici din zona',
  medical: 'Alte cabinete si clinici oftalmologice din zona',
};

// Profilurile revendicate/verificate nu intra niciodata pe acest traseu: ele au deja
// posibilitatea de a-si declara serviciile, iar absenta lor este o informatie reala.
function structuralFallbackCandidate(loc, pcs) {
  if (pcs !== 'directory') return null;
  if (loc?.migration_review_required) return null;
  const capability = STRUCTURAL_CAPABILITY_BY_PROVIDER_TYPE[loc?.provider_type];
  if (!capability) return null;
  return capability;
}

// Construieste o intrare de fallback cu scor 0. Scorul nu conteaza pentru ordonarea finala:
// aceste intrari sunt intotdeauna adaugate DUPA rezultatele confirmate, niciodata amestecate.
function collectStructuralCandidate(loc, structuralList) {
  const pcs = getPublicLocationDisclosure(loc).profile_control_status;
  const capability = structuralFallbackCandidate(loc, pcs);
  if (!capability) return;
  structuralList.push({
    loc,
    capability,
    matched: [],
    tier: 'oras',
    score: 0,
    reasons: [STRUCTURAL_FALLBACK_NOTICES[capability]],
    availabilityLabel: null,
    safeLocRows: [],
    safeMatchedRows: [],
    eligibility: { eligible: false, reasons: ['structural_directory_fallback'], pcs, qualifying: [] },
    bucket: 'structural_directory',
    directoryMatchType: null,
    routing_reason: routingReason(),
  });
}

function needLevelOf(rawKey) {
  return getCanonicalServiceDefinition(rawKey)?.service_need_level || 'unknown';
}

function serviceNeedLevelOfRow(service) {
  const normalized = normalizeServiceKey(service?.service_key);
  if (!normalized.definition) return 'unknown';
  if (service.is_advanced_service || service.service_need_level === 'specialized_medical') {
    return 'specialized_medical';
  }
  if (service.service_need_level === 'technical' && normalized.definition.service_need_level === 'general') {
    return 'technical';
  }
  return normalized.definition.service_need_level;
}

function normalizeRequestKeys(rawKeys) {
  const canonicalKeys = [];
  const rawFallbackKeys = [];
  const statuses = [];
  for (const rawKey of rawKeys) {
    const normalized = normalizeServiceKey(rawKey);
    statuses.push(normalized.status);
    if (normalized.canonicalKey) canonicalKeys.push(normalized.canonicalKey);
    else rawFallbackKeys.push(String(rawKey || '').trim());
  }
  return {
    canonicalKeys: [...new Set(canonicalKeys.filter(Boolean))],
    rawFallbackKeys: [...new Set(rawFallbackKeys.filter(Boolean))],
    statuses,
  };
}

function rowMatchesRequest(service, request) {
  const rawKey = String(service?.service_key || '').trim();
  if (request.rawFallbackKeys.includes(rawKey)) return true;
  const normalized = normalizeServiceKey(rawKey);
  return Boolean(normalized.canonicalKey && request.canonicalKeys.includes(normalized.canonicalKey));
}

function isPublicSafeService(service, location, prerequisiteContext) {
  if (service?.migration_review_required) return false;
  if (!isServicePubliclyEligible(service, location)) return false;
  return evaluateServicePrerequisites(service?.service_key, prerequisiteContext).eligible;
}

function isMatchingSafeService(service, location, prerequisiteContext) {
  if (service?.migration_review_required) return false;
  if (!isServiceMatchingEligible(service, location)) return false;
  return evaluateServicePrerequisites(service?.service_key, prerequisiteContext).eligible;
}

function toPublicService(service) {
  const normalized = normalizeServiceKey(service?.service_key);
  if (!normalized.definition || !normalized.canonicalKey) return null;
  return { key: normalized.canonicalKey, label: normalized.definition.label };
}

function requestNeedLevel(rawKeys, intent) {
  let level = intent === 'reparatii_ochelari' ? 'technical' : 'general';
  for (const rawKey of rawKeys) {
    const candidate = needLevelOf(rawKey);
    // Unknown and ambiguous request keys are fail-closed as medical.
    if (candidate === 'unknown') return 'specialized_medical';
    if (NEED_ORDER[candidate] > NEED_ORDER[level]) level = candidate;
  }
  return level;
}

function evaluateEligibility(loc, matchedRows, needLevel, prerequisiteContext) {
  const pcs = getPublicLocationDisclosure(loc).profile_control_status;
  if (pcs === 'suspended') return { eligible: false, reasons: ['profile_suspended'], pcs, qualifying: [] };

  const reasons = [];
  if (loc.migration_review_required) reasons.push('migration_review_required');
  const requiredPcs = ['claimed', 'verified'];
  if (!requiredPcs.includes(pcs)) {
    reasons.push('profile_not_claimed_or_verified');
  }

  if (matchedRows.length === 0) {
    reasons.push('service_not_present');
  } else {
    const qualifying = matchedRows.filter((service) => isMatchingSafeService(service, loc, prerequisiteContext));
    if (qualifying.length === 0) {
      const prerequisiteBlocked = matchedRows.some((service) => (
        !evaluateServicePrerequisites(service.service_key, prerequisiteContext).eligible
      ));
      if (prerequisiteBlocked) reasons.push('service_prerequisites_not_met');
      reasons.push('service_not_provider_confirmed');
    }
    if (reasons.length === 0) return { eligible: true, reasons: [], pcs, qualifying };
  }

  return { eligible: false, reasons, pcs, qualifying: [] };
}

function classifyMatchBucket(eligibility, matchedRows, needLevel, loc, prerequisiteContext) {
  if (eligibility.eligible) return 'eligible';
  if (needLevel === 'specialized_medical' || eligibility.pcs === 'suspended') return 'excluded';
  if (matchedRows.length === 0) return 'excluded';

  const directorySafeRows = matchedRows.filter((service) => {
    const level = serviceNeedLevelOfRow(service);
    return (level === 'general' || level === 'technical')
      && evaluateServicePrerequisites(service.service_key, prerequisiteContext).eligible;
  });
  if (directorySafeRows.length === 0) return 'excluded';

  const directoryQualifies = needLevel === 'general' && directorySafeRows.some((service) => (
    !service.migration_review_required
    && isPublicSafeService(service, loc, prerequisiteContext)
  ));
  if (eligibility.pcs === 'directory' && !directoryQualifies) return 'excluded';
  return 'extended_directory';
}

function serviceReason(rawKey) {
  const normalized = normalizeServiceKey(rawKey);
  return `Ofera ${normalized.definition?.label || rawKey}`;
}

function routingReason() {
  return 'Potrivire dupa localitatea selectata.';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const intent = payload.intent || null;
    const serviceKeys = Array.isArray(payload.service_keys) ? payload.service_keys.map(String) : [];
    const requestKeys = normalizeRequestKeys(serviceKeys);
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const limit = Math.min(payload.limit || 20, 50);
    const needLevel = requestNeedLevel(serviceKeys, intent);

    if (!sirutaCode) {
      return Response.json({
        results: [],
        need_level: needLevel,
        safety_message_keys: SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key),
        routing_mode: 'locality',
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: null,
        service_key_statuses: requestKeys.statuses,
      });
    }

    const localityLocations = await loadPublicLocationsForLocality(svc, sirutaCode);
    const locations = localityLocations.filter((loc) => (
      loc.active_status !== 'inactiva'
      && loc.provider_profile_type
      && PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)
      && (providerTypes.length === 0 || providerTypes.includes(loc.provider_type))
    ));
    const locationIds = locations.map((location) => location.id).filter(Boolean);

    const [services, specializations, assignments, facilities, equipment] = await Promise.all([
      loadRowsForLocationIds(svc.entities.LocationService, locationIds, { perLocationLimit: 500 }),
      loadRowsForLocationIds(svc.entities.LocationSpecialization, locationIds, { perLocationLimit: 200 }),
      loadRowsForLocationIds(svc.entities.ProfessionalLocationAssignment, locationIds, { query: { active_status: 'activ' }, perLocationLimit: 200 }),
      loadRowsForLocationIds(svc.entities.LocationFacility, locationIds, { perLocationLimit: 300 }),
      loadRowsForLocationIds(svc.entities.LocationEquipment, locationIds, { perLocationLimit: 300 }),
    ]);

    const professionalIds = [...new Set(assignments.map((assignment) => assignment.professional_id).filter(Boolean))];
    const professionals = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
    )).filter(Boolean);
    const professionalsById = Object.fromEntries(professionals.map((profile) => [profile.id, profile]));

    const serviceRowsByLocation = {};
    for (const service of services) {
      if (service.is_active === false) continue;
      if (!serviceRowsByLocation[service.location_id]) serviceRowsByLocation[service.location_id] = [];
      serviceRowsByLocation[service.location_id].push(service);
    }

    const specializationsByLocation = {};
    for (const specialization of specializations) {
      if (specialization.is_active === false) continue;
      if (!specializationsByLocation[specialization.location_id]) specializationsByLocation[specialization.location_id] = [];
      specializationsByLocation[specialization.location_id].push(specialization.specialization_key);
    }

    const assignmentsByLocation = {};
    for (const assignment of assignments) {
      if (!assignmentsByLocation[assignment.location_id]) assignmentsByLocation[assignment.location_id] = [];
      assignmentsByLocation[assignment.location_id].push(assignment);
    }

    const facilitiesByLocation = {};
    for (const facility of facilities) {
      if (facility.is_active === false) continue;
      if (!facilitiesByLocation[facility.location_id]) facilitiesByLocation[facility.location_id] = [];
      facilitiesByLocation[facility.location_id].push(facility);
    }

    const equipmentByLocation = {};
    for (const item of equipment) {
      if (item.is_active === false) continue;
      if (!equipmentByLocation[item.location_id]) equipmentByLocation[item.location_id] = [];
      equipmentByLocation[item.location_id].push(item);
    }

    const now = Date.now();
    const scored = [];
    const excludedList = [];
    const structuralList = [];

    for (const loc of locations) {
      const locRows = serviceRowsByLocation[loc.id] || [];
      const locFacilities = facilitiesByLocation[loc.id] || [];
      const locAssignments = assignmentsByLocation[loc.id] || [];
      const locProfessionalIds = new Set(locAssignments.map((assignment) => assignment.professional_id).filter(Boolean));
      const locProfessionals = [...locProfessionalIds].map((id) => professionalsById[id]).filter(Boolean);
      const prerequisiteContext = {
        location: loc,
        assignments: locAssignments,
        professionals: locProfessionals,
        equipment: equipmentByLocation[loc.id] || [],
        facilities: locFacilities,
      };

      const matchedRows = serviceKeys.length > 0
        ? locRows.filter((service) => rowMatchesRequest(service, requestKeys))
        : locRows;
      const matched = [...new Set(matchedRows.map((service) => normalizeServiceKey(service.service_key).canonicalKey).filter(Boolean))];

      if (intent === 'reparatii_ochelari') {
        if (!OPTICAL_TYPES.includes(loc.provider_type)) continue;
        const hasRepairFacility = locFacilities.some((facility) => REPAIR_FACILITIES.includes(facility.facility_key));
        if (matched.length === 0 && !hasRepairFacility) {
          collectStructuralCandidate(loc, structuralList);
          continue;
        }
      } else if (serviceKeys.length > 0 && matchedRows.length === 0) {
        collectStructuralCandidate(loc, structuralList);
        continue;
      }
      const tier = 'oras';

      const locSpecs = specializationsByLocation[loc.id] || [];
      const specMatched = locSpecs.filter((key) => {
        const normalized = normalizeServiceKey(key);
        return normalized.canonicalKey && requestKeys.canonicalKeys.includes(normalized.canonicalKey);
      });
      const relevantFacilities = FACILITY_INTENTS.includes(intent)
        ? locFacilities.map((facility) => facility.facility_key).filter((key) => REPAIR_FACILITIES.includes(key))
        : [];

      let availabilityLabel = null;
      if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
        const ageDays = (now - new Date(loc.availability_updated_at).getTime()) / 86400000;
        if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) {
          availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
        }
      }

      const eligibility = evaluateEligibility(loc, matchedRows, needLevel, prerequisiteContext);
      const bucket = classifyMatchBucket(eligibility, matchedRows, needLevel, loc, prerequisiteContext);
      const directoryMatchType = bucket === 'extended_directory' && serviceKeys.length > 0
        ? 'service_alias_match'
        : null;

      const safeMatchedRows = matchedRows.filter((service) => isPublicSafeService(service, loc, prerequisiteContext));
      const safeLocRows = locRows.filter((service) => isPublicSafeService(service, loc, prerequisiteContext));
      let score = matched.length * 3 + specMatched.length * 2 + Math.min(relevantFacilities.length, 2);
      const reasons = safeMatchedRows.slice(0, 2).map((service) => serviceReason(service.service_key));
      for (const facilityKey of relevantFacilities.slice(0, 1)) {
        if (FACILITY_REASONS[facilityKey]) reasons.push(FACILITY_REASONS[facilityKey]);
      }
      if (eligibility.pcs === 'verified') score += 2;
      else if (eligibility.pcs === 'claimed') score += 1;
      if (availabilityLabel) {
        score += 1;
        reasons.push('Mod de primire publicat de furnizor');
      }
      if (directoryMatchType) reasons.push(directoryMatchType);

      const entry = {
        loc,
        matched,
        tier,
        score,
        reasons,
        availabilityLabel,
        safeLocRows,
        safeMatchedRows,
        eligibility,
        bucket,
        directoryMatchType,
      };
      entry.routing_reason = routingReason();
      if (bucket === 'excluded') excludedList.push(entry);
      else scored.push(entry);
    }

    scored.sort((a, b) => b.score - a.score);

    const eligibleSorted = scored.filter((entry) => entry.bucket === 'eligible');
    const directorySorted = scored.filter((entry) => entry.bucket === 'extended_directory');
    eligibleSorted.forEach((entry, index) => {
      entry.finalBucket = index < 3 ? 'top3' : 'extended_confirmed';
      entry.bucketRank = index < 3 ? index + 1 : index - 2;
    });
    directorySorted.forEach((entry, index) => {
      entry.finalBucket = 'extended_directory';
      entry.bucketRank = index + 1;
    });

    // Fallback structural: se activeaza doar cand rezultatele confirmate sunt insuficiente.
    // Capacitatea ceruta se potriveste cu nivelul nevoii, ca sa nu propunem optici pentru o
    // problema medicala sau cabinete pentru o pereche de ochelari.
    const requiredCapability = needLevel === 'specialized_medical' ? 'medical' : 'optical';
    // Pragul numara si rezultatele extended_directory: acelea au inregistrari reale de serviciu,
    // chiar daca profilul nu e revendicat. Sunt intotdeauna preferabile unui fallback structural.
    const confirmedCount = eligibleSorted.length + directorySorted.length;
    let structuralSorted = [];
    if (confirmedCount < STRUCTURAL_FALLBACK_MIN_CONFIRMED) {
      structuralSorted = structuralList
        .filter((entry) => entry.capability === requiredCapability)
        .sort((a, b) => {
          // Prioritizeaza profilurile cu date de contact publice, ca pacientul sa poata verifica.
          // Variantele de camp trebuie sa le oglindeasca pe cele din getPublicLocationDisclosure.
          const hasContact = (loc) => (
            loc.public_phone || loc.phone_public || loc.website_url || loc.website
          ) ? 1 : 0;
          const contactDelta = hasContact(b.loc) - hasContact(a.loc);
          if (contactDelta !== 0) return contactDelta;
          return String(a.loc.name || '').localeCompare(String(b.loc.name || ''));
        })
        .slice(0, STRUCTURAL_FALLBACK_MAX_RESULTS);
      structuralSorted.forEach((entry, index) => {
        entry.finalBucket = 'structural_directory';
        entry.bucketRank = index + 1;
      });
    }

    const finalVisible = [...eligibleSorted, ...directorySorted, ...structuralSorted].slice(0, limit);
    const results = finalVisible.map((entry) => {
      const publicDisclosure = getPublicLocationDisclosure(entry.loc, entry.eligibility.pcs);
      return {
        id: entry.loc.id,
        name: entry.loc.public_display_name || entry.loc.name,
        provider_type: entry.loc.provider_type,
        provider_profile_type: entry.loc.provider_profile_type,
        city: entry.loc.city,
        county: entry.loc.county || null,
        address: publicDisclosure.address,
        phone: publicDisclosure.phone,
        website: publicDisclosure.website,
        opening_hours: publicDisclosure.opening_hours,
        saturday_hours: publicDisclosure.saturday_hours,
        profile_control_status: entry.eligibility.pcs,
        public_detail_level: publicDisclosure.public_detail_level,
        exact_location_visible: publicDisclosure.exact_location_visible,
        contact_details_visible: publicDisclosure.contact_details_visible,
        public_services: publicDisclosure.expose_full_details
          ? entry.safeLocRows.map(toPublicService).filter(Boolean)
          : [],
        matched_public_services: publicDisclosure.expose_full_details
          ? entry.safeMatchedRows.map(toPublicService).filter(Boolean)
          : [],
        availability_label: publicDisclosure.expose_full_details ? entry.availabilityLabel : null,
        match_reasons: entry.bucket === 'structural_directory'
          ? entry.reasons
          : (publicDisclosure.expose_full_details
            ? entry.reasons
            : ['Profil din director pentru localitatea selectata']),
        structural_fallback: entry.bucket === 'structural_directory',
        structural_capability: entry.capability || null,
        structural_group_label: entry.bucket === 'structural_directory'
          ? STRUCTURAL_FALLBACK_GROUP_LABELS[entry.capability]
          : null,
        has_service_records: entry.bucket !== 'structural_directory',
        directory_match_type: entry.directoryMatchType || null,
        expansion_tier: entry.tier,
        result_bucket: entry.finalBucket,
        bucket_rank: entry.bucketRank,
        is_top3_eligible: entry.bucket === 'eligible',
        routing_reason: entry.routing_reason,
      };
    });

    return Response.json({
      results,
      need_level: needLevel,
      safety_message_keys: SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key),
      routing_mode: 'locality',
      query_scope: 'locality',
      coverage_status: results.length > 0 ? 'results_found' : 'no_local_results',
      selected_locality_siruta_code: sirutaCode,
      local_location_count: locations.length,
      service_key_statuses: requestKeys.statuses,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
