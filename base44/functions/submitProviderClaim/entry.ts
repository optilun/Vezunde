import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROFILE_TYPES = ['independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office', 'independent_ophthalmologist', 'independent_optometrist', 'independent_optician', 'optical_laboratory_b2c'];
const RELATIONSHIPS = ['owner', 'organization_representative', 'location_manager', 'authorized_staff'];
const SUBJECT_TYPES = ['organization', 'independent_professional'];
const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const CONTROLLED_PROFILE_STATUSES = ['claimed', 'verified'];
const DISABLED_B2B_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const ROLE_BY_RELATIONSHIP = {
  owner: 'organization_owner',
  organization_representative: 'organization_owner',
  location_manager: 'location_manager',
  authorized_staff: 'location_staff',
};

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
    const claimantRelationship = String(p.claimant_relationship || '').trim();
    if (!RELATIONSHIPS.includes(claimantRelationship)) {
      return Response.json({ error: 'Selecteaza relatia ta cu aceasta locatie' }, { status: 400 });
    }
    const requestedMembershipRole = ROLE_BY_RELATIONSHIP[claimantRelationship] || 'location_staff';

    let locationId = p.location_id || null;
    let organizationId = null;
    let businessName = '';
    let claimSubjectType = '';
    let identityNote = '';
    let identityBlocking = 'none';
    let identitySnapshot = '';
    let submittedPayload = '';

    if (p.mode === 'claim') {
      if (!locationId) return Response.json({ error: 'Locatia este obligatorie' }, { status: 400 });
      const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
      if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
      if (loc.status !== 'publicata' || loc.active_status === 'inactiva' || (loc.profile_control_status || 'directory') === 'suspended') {
        return Response.json({ error: 'Aceasta locatie nu poate fi revendicata momentan.' }, { status: 400 });
      }
      organizationId = loc.organization_id || null;
      businessName = loc.name;

      const previousUserClaims = await svc.entities.ProviderClaimRequest
        .filter({ location_id: locationId, user_id: user.id }, '-created_date', 20)
        .catch(() => []);
      const activeOwnClaim = previousUserClaims.find((claim) => ACTIVE_CLAIM_STATUSES.includes(claim.status));
      if (activeOwnClaim) {
        return Response.json({ error: 'Ai deja o solicitare pentru aceasta locatie. O poti urmari din contul tau.' }, { status: 400 });
      }
      const approvedOwnClaim = previousUserClaims.find((claim) => claim.status === 'aprobata');
      if (approvedOwnClaim) {
        return Response.json({ error: 'Ai deja o revendicare aprobata pentru aceasta locatie.' }, { status: 400 });
      }

      const activeMemberships = await svc.entities.ProviderMembership
        .filter({ location_id: locationId, status: 'active' }, '-created_date', 50)
        .catch(() => []);
      const ownMembership = activeMemberships.find((membership) => membership.user_id === user.id);
      if (ownMembership) {
        return Response.json({ error: 'Ai deja acces la administrarea acestei locatii.' }, { status: 400 });
      }

      const isControlledBySomeoneElse =
        activeMemberships.length > 0 ||
        CONTROLLED_PROFILE_STATUSES.includes(loc.profile_control_status || '') ||
        loc.claim_verification_status === 'approved';
      const requestType = isControlledBySomeoneElse
        ? 'access_request_existing_claimed_profile'
        : 'claim_existing_directory_profile';

      if (!isControlledBySomeoneElse) {
        await svc.entities.ProviderLocation.update(locationId, { claim_verification_status: 'pending' });
      }
      submittedPayload = JSON.stringify({
        mode: 'claim',
        request_type: requestType,
        location_id: locationId,
        claimant_relationship: claimantRelationship,
        requested_membership_role: requestedMembershipRole,
        existing_active_membership_count: activeMemberships.length,
        contact: { contact_name: c.contact_name, email: c.email, phone: c.phone || '' },
      });
    } else if (p.mode === 'new_location') {
      const l = p.location || {};
      claimSubjectType = String(p.claim_subject_type || '').trim();
      if (claimSubjectType === 'b2b_supplier') {
        return Response.json({ error: 'Onboardingul furnizorilor B2B nu este disponibil momentan. Foloseste pagina Parteneri pentru a trimite interesul.' }, { status: 400 });
      }
      if (!SUBJECT_TYPES.includes(claimSubjectType)) {
        return Response.json({ error: 'Alege daca reprezinti o organizatie sau esti profesionist independent' }, { status: 400 });
      }
      if (!l.name || !l.provider_type) {
        return Response.json({ error: 'Nume locatie si tip furnizor sunt obligatorii' }, { status: 400 });
      }
      if (DISABLED_B2B_PROFILE_TYPES.includes(l.provider_profile_type)) {
        return Response.json({ error: 'Profilurile B2B nu pot fi create prin acest flux' }, { status: 400 });
      }
      if (!PROFILE_TYPES.includes(l.provider_profile_type)) {
        return Response.json({ error: 'Tipul de profil al furnizorului lipseste sau este invalid' }, { status: 400 });
      }
      if (!String(l.address || '').trim()) {
        return Response.json({ error: 'Adresa locatiei este obligatorie' }, { status: 400 });
      }
      const phonePublic = String(l.phone_public || '').trim();
      const publicEmail = String(l.public_email || '').trim();
      if (!phonePublic && !publicEmail) {
        return Response.json({ error: 'Este necesar cel putin un mijloc de contact public: telefon sau email' }, { status: 400 });
      }

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

      const sirutaCode = String(l.locality_siruta_code || '').trim();
      if (!sirutaCode) {
        return Response.json({ error: 'Selectarea localitatii din lista oficiala este obligatorie' }, { status: 400 });
      }
      const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: sirutaCode, is_active: true });
      const geo = geoRows[0];
      if (!geo) {
        return Response.json({ error: 'Localitatea selectata nu este valida' }, { status: 400 });
      }

      const idResRaw = await base44.functions.invoke('findProviderIdentityCandidates', {
        context: 'provider_new_location',
        candidate: {
          organization_name: claimSubjectType === 'independent_professional' ? (prof.full_name || '') : org.name,
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
        candidates: (identity.candidates || []).map((candidate) => ({
          location_id: candidate.location_id,
          name: candidate.name,
          locality_name: candidate.locality_name,
          county_name: candidate.county_name,
          address: candidate.address,
          severity: candidate.severity,
          score: candidate.score,
          matched_fields: candidate.matched_fields,
          recommended_action: candidate.recommended_action,
        })),
      });

      const reviewSnapshot = {
        claim_subject_type: claimSubjectType,
        claimant_relationship: claimantRelationship,
        requested_membership_role: requestedMembershipRole,
        organization_name: claimSubjectType !== 'independent_professional' ? org.name : '',
        professional_identity: claimSubjectType === 'independent_professional'
          ? { full_name: prof.full_name, professional_type: prof.professional_type }
          : null,
        request_type: 'new_patient_facing_location',
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
      if (identityBlocking === 'warning' && identityNote.length < 15) {
        return Response.json({ identity_check: identity });
      }

      if (claimSubjectType === 'organization') {
        const newOrg = await svc.entities.ProviderOrganization.create({
          name: org.name,
          status: 'activa',
          organization_type: l.provider_profile_type,
        });
        organizationId = newOrg.id;
      }

      const locData = {
        name: l.name,
        provider_type: l.provider_type,
        provider_profile_type: l.provider_profile_type,
        locality_siruta_code: geo.siruta_code,
        locality_name: geo.name,
        county_code: geo.county_code || '',
        county_name: geo.county_name || '',
        uat_code: geo.uat_code || '',
        uat_name: geo.uat_name || '',
        city: geo.name,
        county: geo.county_name || '',
        address: l.address,
        phone_public: phonePublic,
        public_email: publicEmail,
        availability_status: 'necunoscuta',
        status: 'in_verificare',
        public_visibility_status: 'draft',
        profile_control_status: 'directory',
        claim_verification_status: 'pending',
        profile_control_status_updated_at: new Date().toISOString(),
        profile_control_status_reason: 'Locatie noua trimisa spre verificare',
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
    if (identitySnapshot) claimData.identity_check_snapshot = identitySnapshot;
    const claim = await svc.entities.ProviderClaimRequest.create(claimData);

    return Response.json({
      claim_request_id: claim.id,
      location_id: locationId,
      requested_membership_role: requestedMembershipRole,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
