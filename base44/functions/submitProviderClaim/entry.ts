import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  NEW_LOCATION_CLAIM_MODES,
  NEW_LOCATION_LIMIT_MESSAGE,
  newLocationClaimLimitReached,
} from '../../shared/newLocationClaimPolicy.js';
import {
  newLocationRecord,
  newOrganizationRecord,
  proposedLocationSnapshot,
} from '../../shared/newLocationProposal.js';

import { locationPrecisionError, locationCoordinates } from '../../shared/locationMapPosition.js';

const PROFILE_TYPES = ['independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office', 'independent_ophthalmologist', 'independent_optometrist', 'independent_optician', 'optical_laboratory_b2c'];
const RELATIONSHIPS = ['owner', 'organization_representative', 'location_manager', 'authorized_staff'];
// 2026-10-01. O locatie noua se propune doar in numele unei organizatii (asa trimite si
// NewLocationWizard). Ramura `independent_professional` nu era accesibila din interfata si crea o
// locatie fara organizatie, deci membership cu organization_id null la aprobare. Specialistii
// independenti isi fac profilul personal din /profil-profesional/nou.
const SUBJECT_TYPES = ['organization'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const CONTROLLED_PROFILE_STATUSES = ['claimed', 'verified'];
const DISABLED_B2B_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const ROLE_BY_RELATIONSHIP = {
  owner: 'organization_owner',
  organization_representative: 'organization_owner',
  location_manager: 'location_manager',
  authorized_staff: 'location_staff',
};
const LOCATION_ROLE_BY_RELATIONSHIP = {
  owner: 'location_manager',
  organization_representative: 'location_manager',
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
    let requestedMembershipRole = ROLE_BY_RELATIONSHIP[claimantRelationship] || 'location_staff';

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
      requestedMembershipRole = LOCATION_ROLE_BY_RELATIONSHIP[claimantRelationship] || 'location_staff';

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
        claim_scope: 'location',
        request_type: requestType,
        location_id: locationId,
        organization_id: organizationId,
        claimant_relationship: claimantRelationship,
        requested_membership_role: requestedMembershipRole,
        existing_active_membership_count: activeMemberships.length,
        contact: { contact_name: c.contact_name, email: c.email, phone: c.phone || '' },
      });
    } else if (p.mode === 'new_location') {
      // 2026-10-01. Fiecare trimitere creeaza o organizatie si o locatie inainte de revizuire, deci
      // numarul de propuneri in asteptare per cont e limitat (vezi newLocationClaimPolicy.js).
      const ownNewLocationClaims = await svc.entities.ProviderClaimRequest
        .filter({ user_id: user.id, mode: { $in: [...NEW_LOCATION_CLAIM_MODES] }, status: { $in: [...ACTIVE_CLAIM_STATUSES] } }, '-created_date', 20)
        .catch(() => null);
      if (!Array.isArray(ownNewLocationClaims)) {
        return Response.json({ error: 'Nu am putut verifica solicitarile tale existente. Incearca din nou.' }, { status: 503 });
      }
      if (newLocationClaimLimitReached(ownNewLocationClaims)) {
        return Response.json({ error: NEW_LOCATION_LIMIT_MESSAGE, code: 'new_location_pending_limit' }, { status: 429 });
      }
      const l = p.location || {};
      claimSubjectType = String(p.claim_subject_type || '').trim();
      if (claimSubjectType === 'b2b_supplier') {
        return Response.json({ error: 'Onboardingul furnizorilor B2B nu este disponibil momentan. Foloseste pagina Parteneri pentru a trimite interesul.' }, { status: 400 });
      }
      if (!SUBJECT_TYPES.includes(claimSubjectType)) {
        return Response.json({
          error: 'O locatie noua se propune in numele unei organizatii. Daca esti specialist independent, creeaza-ti profilul profesional din contul tau.',
        }, { status: 400 });
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
      if (!String(org.name || '').trim()) {
        return Response.json({ error: 'Numele organizatiei este obligatoriu' }, { status: 400 });
      }

      const precisionError = locationPrecisionError(l);
      if (precisionError) return Response.json({ error: precisionError }, { status: 400 });
      if ((l.lat != null || l.lng != null) && !locationCoordinates(l)) return Response.json({ error: 'Coordonatele locației sunt invalide' }, { status: 400 });
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
          organization_name: org.name,
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
      // 2026-10-02. Furnizorul primeste candidatii nepublici fara nume si adresa
      // (providerSafeIdentityCandidate), dar snapshot-ul de mai jos il citeste doar adminul.
      // Numele si adresa se completeaza aici din ProviderLocation, cu service role, ca adminul
      // sa vada cu ce locatie seamana cererea.
      const identityCandidates = identity.candidates || [];
      const candidateIds = [...new Set(identityCandidates.map((candidate) => candidate.location_id).filter(Boolean))];
      const candidateLocations = candidateIds.length > 0
        ? await svc.entities.ProviderLocation.filter({ id: { $in: candidateIds } }, '-created_date', candidateIds.length).catch(() => [])
        : [];
      const candidateLocationById = new Map(candidateLocations.map((location) => [location.id, location]));
      identitySnapshot = JSON.stringify({
        blocking_level: identityBlocking,
        source_flow: 'provider_new_location_wizard',
        identity_difference_note: identityNote,
        candidates: identityCandidates.map((candidate) => {
          const location = candidateLocationById.get(candidate.location_id) || {};
          return {
            location_id: candidate.location_id,
            name: candidate.name || location.public_display_name || location.name || '',
            locality_name: candidate.locality_name || location.locality_name || location.city || '',
            county_name: candidate.county_name || location.county_name || location.county || '',
            address: candidate.address || location.address || '',
            severity: candidate.severity,
            score: candidate.score,
            matched_fields: candidate.matched_fields,
            recommended_action: candidate.recommended_action,
          };
        }),
      });

      const reviewSnapshot = {
        claim_subject_type: claimSubjectType,
        claimant_relationship: claimantRelationship,
        requested_membership_role: requestedMembershipRole,
        organization_name: org.name,
        request_type: 'new_patient_facing_location',
        // 2026-10-02. Aceeasi forma ca la crearea locatiei (shared/newLocationProposal.js), ca o
        // cerere marcata duplicat sa poata deveni locatie daca adminul decide ca e distincta.
        proposed_location: proposedLocationSnapshot({ ...l, phone_public: phonePublic, public_email: publicEmail }, geo),
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
        const newOrg = await svc.entities.ProviderOrganization.create(
          newOrganizationRecord({ name: org.name, providerProfileType: l.provider_profile_type }),
        );
        organizationId = newOrg.id;
      }

      const loc = await svc.entities.ProviderLocation.create(newLocationRecord({
        proposed: { ...l, phone_public: phonePublic, public_email: publicEmail },
        geo,
        organizationId,
      }));
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
