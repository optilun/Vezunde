import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Safety rule registry — architecture in place, DISABLED by default.
// Wording and trigger rules must be reviewed by a qualified ophthalmologist before enabling.
const SAFETY_RULES = [
  { key: 'urgent_care_notice', enabled: false },
  { key: 'no_diagnosis_notice', enabled: false },
  { key: 'repair_no_guarantee', enabled: false },
  { key: 'child_under_3', enabled: false },
];

// Availability is shown/ranked ONLY when explicitly published by the provider and not stale.
const AVAILABILITY_LABELS = {
  astazi: 'Disponibil astazi',
  urmatoarele_zile: 'Disponibil in urmatoarele zile',
  saptamana_aceasta: 'Disponibil saptamana aceasta',
  doar_programare: 'Doar cu programare',
};
const AVAILABILITY_STALE_DAYS = 30;

const SERVICE_LABELS = {
  control_vedere_adulti: 'control vedere adulti',
  control_vedere_copii: 'control vedere copii',
  consult_oftalmologic: 'consult oftalmologic',
  managementul_miopiei: 'managementul miopiei',
  ochi_uscat: 'servicii pentru ochi uscat',
  lentile_contact: 'lentile de contact',
  lentile_progresive: 'lentile progresive',
  reparatii_ochelari: 'reparatii ochelari',
  reglaj_rame: 'reglaj rame',
  montaj_lentile: 'montaj lentile',
  glaucom: 'servicii pentru glaucom',
  cataracta: 'servicii pentru cataracta',
  retina: 'servicii pentru retina',
  chirurgie_refractiva: 'chirurgie refractiva',
  oct: 'OCT',
  camp_vizual: 'camp vizual',
  tonometrie: 'tonometrie',
  fund_de_ochi: 'fund de ochi',
  topografie_corneana: 'topografie corneana',
};

const FACILITY_REASONS = {
  laborator_optic_propriu: 'Are laborator optic propriu',
  atelier_service_propriu: 'Are atelier de service propriu',
  reparatii_pe_loc: 'Face reparatii pe loc',
  laborator_partener: 'Lucreaza cu laborator partener',
  montaj_lentile_in_locatie: 'Monteaza lentile in locatie',
};

const OPHTHALMO_TYPES = ['clinica_oftalmologica', 'cabinet_oftalmologic'];
const OPTICAL_TYPES = ['optica_medicala', 'laborator_optic', 'cabinet_optometric'];
const REPAIR_FACILITIES = ['atelier_service_propriu', 'reparatii_pe_loc', 'laborator_optic_propriu', 'laborator_partener', 'montaj_lentile_in_locatie'];
const FACILITY_INTENTS = ['reparatii_ochelari', 'ochelari_lentile', 'lentile_contact'];

function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function serviceReason(key) {
  if (key === 'control_vedere_copii') return 'Potrivit pentru control vedere copii';
  if (key === 'consult_oftalmologic') return 'Are consult oftalmologic';
  return `Ofera ${SERVICE_LABELS[key] || key}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const intent = payload.intent || null;
    const serviceKeys = Array.isArray(payload.service_keys) ? payload.service_keys : [];
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const requiredRoles = Array.isArray(payload.required_professional_types) ? payload.required_professional_types : [];
    const city = (payload.city || '').trim();
    const scope = payload.scope || (city ? 'city' : 'national');
    const userLat = typeof payload.lat === 'number' ? payload.lat : null;
    const userLng = typeof payload.lng === 'number' ? payload.lng : null;
    const limit = Math.min(payload.limit || 20, 50);

    const [locations, services, specs, assigns, facilities] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
      svc.entities.LocationSpecialization.list(null, 2000),
      svc.entities.ProfessionalLocationAssignment.filter({ active_status: 'activ' }, null, 2000),
      svc.entities.LocationFacility.list(null, 2000),
    ]);

    const svcMap = {};
    for (const s of services) {
      if (s.is_active === false) continue;
      if (!svcMap[s.location_id]) svcMap[s.location_id] = [];
      svcMap[s.location_id].push(s.service_key);
    }
    const specMap = {};
    for (const s of specs) {
      if (s.is_active === false) continue;
      if (!specMap[s.location_id]) specMap[s.location_id] = [];
      specMap[s.location_id].push(s.specialization_key);
    }
    const roleMap = {};
    for (const a of assigns) {
      if (!roleMap[a.location_id]) roleMap[a.location_id] = [];
      roleMap[a.location_id].push(a.professional_type);
    }
    const facMap = {};
    for (const f of facilities) {
      if (f.is_active === false) continue;
      if (!facMap[f.location_id]) facMap[f.location_id] = [];
      facMap[f.location_id].push(f.facility_key);
    }

    const cityLoc = city ? locations.find((l) => l.city === city) : null;
    const cityCounty = cityLoc ? cityLoc.county || '' : '';
    const refLat = userLat ?? (cityLoc && typeof cityLoc.lat === 'number' ? cityLoc.lat : null);
    const refLng = userLng ?? (cityLoc && typeof cityLoc.lng === 'number' ? cityLoc.lng : null);
    const now = Date.now();

    // Ranking uses ONLY: service/specialization/facility match, provider type,
    // professional roles, geographic tier, verification, and provider-published
    // fresh availability. Never: company size, price, paid ranking, demo bonuses.
    const scored = [];
    for (const loc of locations) {
      if (loc.active_status === 'inactiva') continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      const locServices = svcMap[loc.id] || [];
      const roles = roleMap[loc.id] || [];
      const locFacilities = facMap[loc.id] || [];
      const matched = locServices.filter((k) => serviceKeys.includes(k));

      // Intent-based hard constraints
      if (intent === 'simptome_oftalmologice' || intent === 'investigatii') {
        if (!OPHTHALMO_TYPES.includes(loc.provider_type) && !roles.includes('medic_oftalmolog')) continue;
      }
      if (intent === 'reparatii_ochelari') {
        if (!OPTICAL_TYPES.includes(loc.provider_type)) continue;
        const hasRepairFacility = locFacilities.some((k) => REPAIR_FACILITIES.includes(k));
        if (matched.length === 0 && !hasRepairFacility) continue;
      } else if (serviceKeys.length > 0 && matched.length === 0) {
        continue;
      }

      if (requiredRoles.length > 0 && !requiredRoles.some((r) => roles.includes(r))) continue;

      // Geographic expansion tier
      let tier = 'national';
      if (city) {
        if (loc.city === city) tier = 'oras';
        else if (refLat !== null && refLng !== null && typeof loc.lat === 'number' && typeof loc.lng === 'number'
          && haversineKm(refLat, refLng, loc.lat, loc.lng) <= 40) tier = 'apropiere';
        else if (cityCounty && loc.county === cityCounty) tier = 'judet';
      }

      const locSpecs = specMap[loc.id] || [];
      const specMatched = locSpecs.filter((k) => serviceKeys.includes(k));
      const relevantFacilities = FACILITY_INTENTS.includes(intent)
        ? locFacilities.filter((k) => REPAIR_FACILITIES.includes(k))
        : [];

      let availabilityLabel = null;
      if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
        const ageDays = (now - new Date(loc.availability_updated_at).getTime()) / 86400000;
        if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) {
          availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
        }
      }

      let score = matched.length * 3 + specMatched.length * 2 + Math.min(relevantFacilities.length, 2);
      const reasons = matched.slice(0, 2).map(serviceReason);
      if (relevantFacilities.length > 0) reasons.push(FACILITY_REASONS[relevantFacilities[0]]);
      if (specMatched.length > 0) reasons.push('Specializare potrivita');
      if (loc.is_verified) score += 2;
      if (availabilityLabel) { score += 1; reasons.push('Disponibilitate publicata de furnizor'); }

      scored.push({ loc, matched, tier, score, reasons, availabilityLabel, locServices, locSpecs, roles, locFacilities, relevantFacilities });
    }

    const tierOrder = { oras: 0, apropiere: 1, judet: 2, national: 3 };
    scored.sort((a, b) => (tierOrder[a.tier] - tierOrder[b.tier]) || (b.score - a.score));

    // Expansion ladder: city -> nearby -> county; nationwide only when the user
    // chose national scope or too few local results exist (never mixed silently —
    // every result carries its expansion_tier for honest grouping).
    let visible = scored;
    if (city && scope !== 'national') {
      const local = scored.filter((r) => r.tier !== 'national');
      visible = local.length >= 3 ? local : scored;
    }
    visible = visible.slice(0, limit);

    // Public field whitelist only — never internal/verification/patient data.
    const results = visible.map((r) => ({
      id: r.loc.id,
      name: r.loc.name,
      provider_type: r.loc.provider_type,
      city: r.loc.city,
      county: r.loc.county || null,
      address: r.loc.address || null,
      phone: r.loc.phone_public || null,
      website: r.loc.website || null,
      opening_hours: r.loc.opening_hours || null,
      saturday_hours: r.loc.saturday_hours || null,
      is_verified: !!r.loc.is_verified,
      services: r.locServices,
      specializations: r.locSpecs,
      professional_types: r.roles,
      facilities: r.locFacilities,
      matched_services: r.matched,
      matched_facilities: r.relevantFacilities,
      availability_label: r.availabilityLabel,
      match_reasons: r.reasons,
      expansion_tier: r.tier,
    }));

    const safetyKeys = SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key);

    // Persist RequestMatch records when a real PatientRequest exists.
    if (payload.request_id) {
      const rows = results.slice(0, 10).map((r, i) => ({
        request_id: payload.request_id,
        location_id: r.id,
        rank: i + 1,
        match_reasons: r.match_reasons,
        expansion_tier: r.expansion_tier,
        status: 'matched',
      }));
      if (rows.length > 0) await svc.entities.RequestMatch.bulkCreate(rows);
      if (safetyKeys.length > 0) {
        await svc.entities.SafetyFlag.bulkCreate(
          safetyKeys.map((k) => ({ request_id: payload.request_id, flag_key: k, rule_version: 'v0-disabled', shown_at: new Date().toISOString() }))
        );
      }
    }

    return Response.json({ results, safety_message_keys: safetyKeys });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});