import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    if (!p.representation_confirmed) {
      return Response.json({ error: 'Confirmarea reprezentarii este obligatorie' }, { status: 400 });
    }
    const c = p.contact || {};
    if (!c.contact_name || !c.email) {
      return Response.json({ error: 'Numele complet si emailul sunt obligatorii' }, { status: 400 });
    }

    let locationId = p.location_id || null;
    let organizationId = null;
    let businessName = '';

    if (p.mode === 'claim') {
      if (!locationId) return Response.json({ error: 'Locatia este obligatorie' }, { status: 400 });
      const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
      if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
      // Module 3E.1: only active, published, non-suspended locations can be claimed.
      // Generic error — no internal state disclosure.
      if (loc.status !== 'publicata' || loc.active_status === 'inactiva' || (loc.profile_control_status || 'directory') === 'suspended') {
        return Response.json({ error: 'Aceasta locatie nu poate fi revendicata momentan.' }, { status: 400 });
      }
      organizationId = loc.organization_id || null;
      businessName = loc.name;
      // Prevent duplicate pending claims by the same user for the same location
      const existing = await svc.entities.ProviderClaimRequest.filter({
        location_id: locationId, user_id: user.id, status: 'in_asteptare',
      });
      if (existing.length > 0) {
        return Response.json({ error: 'Ai deja o cerere in asteptare pentru aceasta locatie' }, { status: 400 });
      }
      await svc.entities.ProviderLocation.update(locationId, { claim_verification_status: 'pending' });
    } else if (p.mode === 'new_location') {
      const l = p.location || {};
      if (!l.name || !l.provider_type || !l.city) {
        return Response.json({ error: 'Nume locatie, tip furnizor si oras sunt obligatorii' }, { status: 400 });
      }
      if (p.organization && p.organization.name) {
        const org = await svc.entities.ProviderOrganization.create({
          name: p.organization.name, status: 'activa',
        });
        organizationId = org.id;
      }
      const sched = p.schedule || {};
      const availabilityConfirmed = !!sched.availability_confirmed && !!sched.availability_status;
      const locData = {
        name: l.name,
        provider_type: l.provider_type,
        city: l.city,
        county: l.county || '',
        address: l.address || '',
        phone_public: l.phone_public || '',
        public_email: l.public_email || '',
        website: l.website || '',
        description: l.description || '',
        opening_hours: sched.opening_hours || '',
        saturday_hours: sched.saturday_hours || '',
        availability_status: availabilityConfirmed ? sched.availability_status : 'necunoscuta',
        status: 'in_verificare',
        profile_control_status: 'directory',
        claim_verification_status: 'pending',
        profile_control_status_updated_at: new Date().toISOString(),
        profile_control_status_reason: 'Locatie noua trimisa spre verificare',
        // Legacy fields kept in sync temporarily for backward compatibility only.
        verification_state: 'in_verification',
        active_status: 'activa',
        is_verified: false,
        data_source: l.place_id ? 'google_place_reference' : 'manual',
        last_confirmed_at: new Date().toISOString(),
      };
      if (l.place_id) locData.place_id = String(l.place_id);
      if (typeof l.lat === 'number') locData.lat = l.lat;
      if (typeof l.lng === 'number') locData.lng = l.lng;
      if (organizationId) locData.organization_id = organizationId;
      if (availabilityConfirmed) locData.availability_updated_at = new Date().toISOString();
      const loc = await svc.entities.ProviderLocation.create(locData);
      locationId = loc.id;
      businessName = l.name;

      // Module 3A service trust catalog (same values as matchProviders — functions cannot share local imports).
      const NEED_LEVELS = {
        control_vedere_adulti: 'general', control_vedere_copii: 'general', consult_oftalmologic: 'general',
        lentile_contact: 'general', lentile_progresive: 'general',
        reparatii_ochelari: 'technical', reglaj_rame: 'technical', montaj_lentile: 'technical',
        oct: 'specialized_medical', retina: 'specialized_medical', glaucom: 'specialized_medical',
        cataracta: 'specialized_medical', chirurgie_refractiva: 'specialized_medical', managementul_miopiei: 'specialized_medical',
      };
      const services = Array.isArray(p.services) ? p.services : [];
      if (services.length > 0) {
        await svc.entities.LocationService.bulkCreate(
          services.map((k) => {
            const known = Object.prototype.hasOwnProperty.call(NEED_LEVELS, k);
            // Module 3E.2: unknown keys are stored as 'unknown', never 'general'.
            const level = known ? NEED_LEVELS[k] : 'unknown';
            return {
              location_id: locationId, service_key: k, is_active: true, accepts_requests: true,
              service_need_level: level,
              is_advanced_service: level === 'specialized_medical',
              confirmation_level: 'not_confirmed',
              matching_allowed: false,
              migration_review_required: !known,
            };
          })
        );
      }
      const specializations = Array.isArray(p.specializations) ? p.specializations : [];
      if (specializations.length > 0) {
        await svc.entities.LocationSpecialization.bulkCreate(
          specializations.map((k) => ({ location_id: locationId, specialization_key: k, is_active: true }))
        );
      }
      const facilities = Array.isArray(p.facilities) ? p.facilities : [];
      if (facilities.length > 0) {
        await svc.entities.LocationFacility.bulkCreate(
          facilities.map((k) => ({ location_id: locationId, facility_key: k, is_active: true }))
        );
      }
      const team = Array.isArray(p.team) ? p.team : [];
      for (const member of team) {
        if (!member || !member.role) continue;
        let professionalId = member.professional_id || null;
        if (professionalId) {
          const prof = await svc.entities.ProfessionalProfile.get(professionalId).catch(() => null);
          if (!prof) continue;
        } else {
          if (!member.full_name) continue;
          const prof = await svc.entities.ProfessionalProfile.create({
            full_name: member.full_name,
            role: member.role,
            is_public: member.is_public !== false,
          });
          professionalId = prof.id;
        }
        await svc.entities.ProfessionalLocationAssignment.create({
          professional_id: professionalId,
          location_id: locationId,
          professional_type: member.role,
          active_status: 'activ',
          public_status: member.is_public !== false ? 'public' : 'privat',
        });
      }
    } else {
      return Response.json({ error: 'Mod invalid' }, { status: 400 });
    }

    // Module 3E: direct entity creation is blocked by RLS — claims are created only
    // here, via service role, after authentication and validation above. user_id
    // keeps read access scoped to the applicant.
    const claimData = {
      location_id: locationId,
      user_id: user.id,
      mode: p.mode,
      business_name: businessName,
      contact_name: c.contact_name,
      role: c.role || '',
      email: c.email,
      phone: c.phone || '',
      representation_confirmed: true,
      submitted_payload: JSON.stringify({ mode: p.mode, location_id: locationId, contact: c }),
      status: 'in_asteptare',
    };
    if (organizationId) claimData.organization_id = organizationId;
    const claim = await svc.entities.ProviderClaimRequest.create(claimData);

    return Response.json({ claim_request_id: claim.id, location_id: locationId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});