import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3H.1B.3.A — Short Claim Contract.
// Initial claims are intentionally minimal: relation + identity + basic location
// data only. ALL post-approval profile data (services, team, schedule, photos,
// public description, website/social, equipment, brands, availability) is
// IGNORED here and must be added after approval through the Provider Workspace.
// No LocationService / LocationSpecialization / LocationFacility /
// ProfessionalProfile / ProfessionalLocationAssignment / LocationEquipment /
// ProductBrandOffering records are ever created during initial claim submission.

const PROFILE_TYPES = ['independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office', 'independent_ophthalmologist', 'independent_optometrist', 'independent_optician', 'optical_laboratory_b2c', 'optical_laboratory_b2b', 'future_b2b_distributor'];
const RELATIONSHIPS = ['owner', 'organization_representative', 'location_manager', 'authorized_staff'];
const SUBJECT_TYPES = ['organization', 'independent_professional'];
const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];

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
    // Short-claim contract: structured claimant relationship is mandatory in both modes.
    const claimantRelationship = String(p.claimant_relationship || '').trim();
    if (!RELATIONSHIPS.includes(claimantRelationship)) {
      return Response.json({ error: 'Selecteaza relatia ta cu aceasta locatie' }, { status: 400 });
    }

    let locationId = p.location_id || null;
    let organizationId = null;
    let businessName = '';
    let claimSubjectType = '';
    // Module 3H.1B.1/2: identity-gate context (admin-only review payloads).
    let identityNote = '';
    let identityBlocking = 'none';
    let identitySnapshot = '';
    let submittedPayload = '';

    if (p.mode === 'claim') {
      if (!locationId) return Response.json({ error: 'Locatia este obligatorie' }, { status: 400 });
      const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
      if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
      // Module 3E.1: only active, published, non-suspended locations can be claimed.
      if (loc.status !== 'publicata' || loc.active_status === 'inactiva' || (loc.profile_control_status || 'directory') === 'suspended') {
        return Response.json({ error: 'Aceasta locatie nu poate fi revendicata momentan.' }, { status: 400 });
      }
      organizationId = loc.organization_id || null;
      businessName = loc.name;
      const existing = await svc.entities.ProviderClaimRequest.filter({
        location_id: locationId, user_id: user.id, status: 'in_asteptare',
      });
      if (existing.length > 0) {
        return Response.json({ error: 'Ai deja o cerere in asteptare pentru aceasta locatie' }, { status: 400 });
      }
      await svc.entities.ProviderLocation.update(locationId, { claim_verification_status: 'pending' });
      // Existing-profile claim payload: relation + private contact ONLY.
      submittedPayload = JSON.stringify({
        mode: 'claim',
        location_id: locationId,
        claimant_relationship: claimantRelationship,
        contact: { contact_name: c.contact_name, email: c.email, phone: c.phone || '' },
      });
    } else if (p.mode === 'new_location') {
      const l = p.location || {};
      // Short-claim contract: claim subject type is mandatory.
      claimSubjectType = String(p.claim_subject_type || '').trim();
      if (!SUBJECT_TYPES.includes(claimSubjectType)) {
        return Response.json({ error: 'Alege daca reprezinti o organizatie sau esti profesionist independent' }, { status: 400 });
      }
      if (!l.name || !l.provider_type) {
        return Response.json({ error: 'Nume locatie si tip furnizor sunt obligatorii' }, { status: 400 });
      }
      // Module 3H.1A.1: provider_profile_type is mandatory and enum-only.
      if (!PROFILE_TYPES.includes(l.provider_profile_type)) {
        return Response.json({ error: 'Tipul de profil al furnizorului lipseste sau este invalid' }, { status: 400 });
      }
      // Short-claim contract: address and at least one public contact method required.
      if (!String(l.address || '').trim()) {
        return Response.json({ error: 'Adresa locatiei este obligatorie' }, { status: 400 });
      }
      const phonePublic = String(l.phone_public || '').trim();
      const publicEmail = String(l.public_email || '').trim();
      if (!phonePublic && !publicEmail) {
        return Response.json({ error: 'Este necesar cel putin un mijloc de contact public: telefon sau email' }, { status: 400 });
      }
      // Subject-specific identity requirements.
      const org = p.organization || {};
      const prof = p.professional || {};
      if (claimSubjectType === 'organization' && !String(org.name || '').trim()) {
        return Response.json({ error: 'Numele organizatiei este obligatoriu' }, { status: 400 });
      }
      if (claimSubjectType === 'independent_professional') {
        if (!String(prof.full_name || '').trim()) {
          return Response.json({ error: 'Numele complet al profesionistului este obligatoriu' }, { status: 400 });
        }
        if (!PROFESSIONAL_TYPES.includes(prof.professional_type)) {
          return Response.json({ error: 'Tipul de profesionist lipseste sau este invalid' }, { status: 400 });
        }
      }
      // Module 3F.2.1: canonical GeographicLocality selection is REQUIRED.
      const sirutaCode = String(l.locality_siruta_code || '').trim();
      if (!sirutaCode) {
        return Response.json({ error: 'Selectarea localitatii din lista oficiala este obligatorie' }, { status: 400 });
      }
      const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: sirutaCode, is_active: true });
      const geo = geoRows[0];
      if (!geo) {
        return Response.json({ error: 'Localitatea selectata nu este valida' }, { status: 400 });
      }
      // Module 3H.1B.1: deterministic, read-only identity gate BEFORE any creation.
      const idResRaw = await base44.functions.invoke('findProviderIdentityCandidates', {
        context: 'provider_new_location',
        candidate: {
          organization_name: claimSubjectType === 'organization' ? org.name : (prof.full_name || ''),
          location_name: l.name,
          provider_profile_type: l.provider_profile_type,
          locality_siruta_code: geo.siruta_code,
          address: l.address || '',
          phone_public: phonePublic,
          public_email: publicEmail,
          website: '',
        },
        limit: 10,
      });
      const identity = (idResRaw && idResRaw.data) ? idResRaw.data : (idResRaw || {});
      if (identity.error) return Response.json({ error: 'Verificarea duplicatelor a esuat' }, { status: 500 });
      identityNote = String(p.identity_difference_note || '').trim();
      identityBlocking = identity.blocking_level || 'none';
      identitySnapshot = JSON.stringify({
        blocking_level: identityBlocking,
        source_flow: 'provider_new_location_wizard',
        identity_difference_note: identityNote,
        candidates: (identity.candidates || []).map((cd) => ({
          location_id: cd.location_id,
          name: cd.name,
          locality_name: cd.locality_name,
          county_name: cd.county_name,
          address: cd.address,
          severity: cd.severity,
          score: cd.score,
          matched_fields: cd.matched_fields,
          recommended_action: cd.recommended_action,
        })),
      });
      // Minimum review-safe snapshot (PART 5) — no services, team, schedule,
      // photos or public-profile enrichment data is ever persisted here.
      const reviewSnapshot = {
        claim_subject_type: claimSubjectType,
        claimant_relationship: claimantRelationship,
        organization_name: claimSubjectType === 'organization' ? org.name : '',
        professional_identity: claimSubjectType === 'independent_professional'
          ? { full_name: prof.full_name, professional_type: prof.professional_type }
          : null,
        proposed_location: {
          name: l.name,
          provider_type: l.provider_type,
          provider_profile_type: l.provider_profile_type,
          locality_siruta_code: geo.siruta_code,
          locality_name: geo.name,
          county_name: geo.county_name || '',
          address: l.address,
          phone_public: phonePublic,
          public_email: publicEmail,
        },
        contact: { contact_name: c.contact_name, email: c.email, phone: c.phone || '' },
        ...(identityNote ? { identity_difference_note: identityNote, identity_blocking_level: identityBlocking } : {}),
      };
      // Module 3H.1B.2: a strong duplicate NEVER creates any record besides the
      // admin-only duplicate-review request. declared_distinct cannot bypass.
      if (identityBlocking === 'strong_duplicate_review_required') {
        if (p.escalate_duplicate_review === true) {
          if (identityNote.length < 15) {
            return Response.json({ error: 'Explica pe scurt de ce este o locatie diferita (minim 15 caractere)' }, { status: 400 });
          }
          const reviewClaim = await svc.entities.ProviderClaimRequest.create({
            user_id: user.id,
            mode: 'new_location_duplicate_review',
            claim_subject_type: claimSubjectType,
            claimant_relationship: claimantRelationship,
            business_name: l.name,
            contact_name: c.contact_name,
            role: c.role || '',
            email: c.email,
            phone: c.phone || '',
            representation_confirmed: true,
            submitted_payload: JSON.stringify({ mode: 'new_location_duplicate_review', ...reviewSnapshot }),
            identity_check_snapshot: identitySnapshot,
            status: 'in_asteptare',
          });
          return Response.json({ claim_request_id: reviewClaim.id, duplicate_review: true });
        }
        return Response.json({
          identity_check: {
            ...identity,
            message: 'Am gasit un profil foarte asemanator. Verifica daca este deja locatia ta.',
          },
        });
      }
      // Possible duplicate: continue only with a short explanation (min 15 chars).
      if (identityBlocking === 'warning' && identityNote.length < 15) {
        return Response.json({ identity_check: identity });
      }
      // Organization is created ONLY for organization claims, after all gates pass.
      if (claimSubjectType === 'organization') {
        const newOrg = await svc.entities.ProviderOrganization.create({
          name: org.name, status: 'activa',
          organization_type: l.provider_profile_type,
        });
        organizationId = newOrg.id;
      }
      // Independent professional: NO ProfessionalProfile is created before approval —
      // the proposed identity lives only in the admin review payload above.
      const locData = {
        name: l.name,
        provider_type: l.provider_type,
        provider_profile_type: l.provider_profile_type,
        // Canonical geography (from GeographicLocality only):
        locality_siruta_code: geo.siruta_code,
        locality_name: geo.name,
        county_code: geo.county_code || '',
        county_name: geo.county_name || '',
        uat_code: geo.uat_code || '',
        uat_name: geo.uat_name || '',
        // Compatibility mirrors ONLY — never geographic truth:
        city: geo.name,
        county: geo.county_name || '',
        address: l.address,
        phone_public: phonePublic,
        public_email: publicEmail,
        // Post-approval fields are intentionally NOT accepted at claim time:
        // description, website, social links, opening hours, availability, photos.
        availability_status: 'necunoscuta',
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
      const loc = await svc.entities.ProviderLocation.create(locData);
      locationId = loc.id;
      businessName = l.name;
      submittedPayload = JSON.stringify({ mode: 'new_location', location_id: locationId, ...reviewSnapshot });
    } else {
      return Response.json({ error: 'Mod invalid' }, { status: 400 });
    }

    // Module 3E: claims are created only here, via service role, after validation.
    const claimData = {
      location_id: locationId,
      user_id: user.id,
      mode: p.mode,
      claimant_relationship: claimantRelationship,
      business_name: businessName,
      contact_name: c.contact_name,
      role: c.role || '',
      email: c.email,
      phone: c.phone || '',
      representation_confirmed: true,
      submitted_payload: submittedPayload,
      status: 'in_asteptare',
    };
    if (claimSubjectType) claimData.claim_subject_type = claimSubjectType;
    if (organizationId) claimData.organization_id = organizationId;
    // Module 3H.1B.2: admin-only Identity Gate context for review.
    if (identitySnapshot) claimData.identity_check_snapshot = identitySnapshot;
    const claim = await svc.entities.ProviderClaimRequest.create(claimData);

    return Response.json({ claim_request_id: claim.id, location_id: locationId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});