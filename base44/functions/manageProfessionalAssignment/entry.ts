import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assignmentPublicEligibility } from '../../shared/professionalProfileStatus.js';
import { professionalTypeLabel } from '../../shared/professionalIdentity.js';
import {
  ASSOCIATION_PENDING_REQUEST_LIMIT,
  approvedAssociationPatch,
  associationRequestBlockReason,
  associationRequestRecord,
  declinedAssociationPatch,
  isPendingAssociationRequest,
  selfAssociationRecord,
} from '../../shared/professionalAssociationPolicy.js';

const PROVIDER_ROLES = ['organization_owner', 'location_manager'];
const PROFESSIONAL_VISIBILITY_ACTIONS = ['accept_visibility', 'decline_visibility', 'hide_visibility'];

function res(body, status = 200) {
  return Response.json(body, { status });
}

function text(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  return text(value);
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    action_type: record.action_type,
    changed_fields: record.changed_fields || [],
    previous_values: JSON.stringify(record.previous || {}),
    new_values: JSON.stringify(record.next || {}),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

async function assertProviderAccess(svc, user, locationId) {
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: locationId, status: 'active' }, '-created_date', 20);
  if (!memberships.some((membership) => PROVIDER_ROLES.includes(normalizeRole(membership.role)))) {
    return { error: 'Doar proprietarul sau managerul locatiei poate gestiona asocierea unui specialist', status: 403 };
  }
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita', status: 404 };
  if (location.profile_control_status === 'suspended' || location.status === 'suspendata') return { error: 'Locatia este suspendata', status: 403 };
  return { location };
}

// 2026-09-03: conditiile de publicare sunt evaluate de shared/professionalProfileStatus.js.
// Aceleasi patru conditii erau scrise separat aici, in adminProfessionalProfileReview si in
// getPublicProfessionalProfile; oricare dintre ele modificata singura rupea tacit celelalte doua.
// Aici verificam doar partea de profil si locatie: consimtamantul este exact ce se negociaza in
// actiunile de mai jos, deci nu poate fi o preconditie a lor.
function publicEligibility(profile, location) {
  const { reasons } = assignmentPublicEligibility({
    profile,
    assignment: { active_status: 'activ', visibility_consent_status: 'accepted' },
    location,
  });
  if (reasons.includes('profile_not_public')) {
    return { can_publish: false, publish_block_reason: 'Profilul profesional trebuie sa fie verificat si public in VIASEE.' };
  }
  if (reasons.length > 0) {
    return { can_publish: false, publish_block_reason: 'Locatia trebuie sa fie publicata si activa in VIASEE.' };
  }
  return { can_publish: true, publish_block_reason: '' };
}

async function listAssignments(svc, locationId, location) {
  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId }, '-created_date', 100);
  const items = [];
  for (const assignment of assignments) {
    const profile = await svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null);
    if (!profile) continue;
    const eligibility = publicEligibility(profile, location);
    items.push({
      id: assignment.id,
      professional_id: profile.id,
      full_name: profile.public_display_name || profile.full_name || 'Specialist',
      professional_type: profile.professional_type || assignment.professional_type || '',
      professional_type_label: professionalTypeLabel(profile.professional_type || assignment.professional_type),
      active_status: assignment.active_status || 'activ',
      public_status: assignment.public_status || 'privat',
      visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
      visibility_requested_at: assignment.visibility_requested_at || null,
      visibility_decided_at: assignment.visibility_decided_at || null,
      // 2026-10-03: cererile „Lucrez aici” si afisarea ownerului (structura conturilor, pasul 2).
      association_origin: assignment.association_origin || 'invitation',
      association_request_status: assignment.association_request_status || '',
      association_requested_at: assignment.association_requested_at || null,
      is_association_request: isPendingAssociationRequest(assignment),
      verification_status: profile.verification_status || 'unverified',
      profile_review_status: profile.profile_review_status || 'draft',
      is_public: profile.is_public === true,
      ...eligibility,
    });
  }
  return items;
}

async function ownProfessionalProfile(svc, user) {
  const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
  return profiles[0] || null;
}

function profileSummary(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    full_name: profile.public_display_name || profile.full_name || '',
    professional_type: profile.professional_type || '',
    professional_type_label: professionalTypeLabel(profile.professional_type),
  };
}

// Organizatia afla de cerere si din email (owneri si manageri ai locatiei), nu doar din lista.
// Trimitere „best effort”: cererea ramane valida si daca emailul nu pleaca.
async function notifyLocationManagers(base44, svc, location, profile) {
  try {
    const memberships = await svc.entities.ProviderMembership.filter({ location_id: location.id, status: 'active' }, '-created_date', 50);
    const userIds = [...new Set(memberships.filter((membership) => PROVIDER_ROLES.includes(normalizeRole(membership.role))).map((membership) => membership.user_id).filter(Boolean))].slice(0, 5);
    const locationName = location.public_display_name || location.name || 'locatia ta';
    const personName = profile.public_display_name || profile.full_name || 'Un specialist';
    for (const userId of userIds) {
      const recipient = await svc.entities.User.get(userId).catch(() => null);
      if (!recipient?.email) continue;
      await base44.integrations.Core.SendEmail({
        to: recipient.email,
        from_name: 'VIASEE',
        subject: `Cerere de asociere la ${locationName}`,
        body: [
          'Buna ziua,',
          '',
          `${personName} a cerut sa fie asociat ca ${professionalTypeLabel(profile.professional_type)} la ${locationName}.`,
          'Aproba sau refuza cererea din contul VIASEE: Locatii -> Specialisti.',
          'Aprobarea nu ii da acces la contul organizatiei.',
          '',
          'Echipa VIASEE',
        ].join('\n'),
      }).catch(() => null);
    }
  } catch (_error) {
    // Notificarea nu blocheaza cererea.
  }
}

async function requestAssociation(base44, svc, user, locationId, payload) {
  const profile = await ownProfessionalProfile(svc, user);
  if (!profile) return res({ error: 'Creează mai întâi profilul profesional.' }, 404);
  if (profile.profile_review_status === 'archived' || profile.public_visibility_status === 'archived') {
    return res({ error: 'Profilul profesional este arhivat.' }, 409);
  }
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  const blockReason = associationRequestBlockReason(location);
  if (blockReason) return res({ error: blockReason }, 409);

  const existing = (await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: profile.id, location_id: locationId }, '-created_date', 10))[0] || null;
  if (existing?.active_status === 'activ') return res({ error: 'Ești deja asociat acestei locații.' }, 409);
  if (existing && isPendingAssociationRequest(existing)) return res({ success: true, already_pending: true });

  const pending = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: profile.id, association_request_status: 'pending' }, '-created_date', 50);
  if (pending.filter(isPendingAssociationRequest).length >= ASSOCIATION_PENDING_REQUEST_LIMIT) {
    return res({ error: `Ai deja ${ASSOCIATION_PENDING_REQUEST_LIMIT} cereri în așteptare. Așteaptă un răspuns sau anulează una.` }, 429);
  }

  const now = new Date().toISOString();
  const record = associationRequestRecord({ profile, locationId, showPublicly: payload.show_publicly !== false, userId: user.id, now });
  const assignment = existing
    ? await svc.entities.ProfessionalLocationAssignment.update(existing.id, record)
    : await svc.entities.ProfessionalLocationAssignment.create(record);
  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: assignment.id || existing?.id,
    action_type: 'request_professional_association',
    changed_fields: Object.keys(record),
    previous: existing ? { active_status: existing.active_status, association_request_status: existing.association_request_status || '' } : {},
    next: { location_id: locationId, professional_id: profile.id, association_request_status: 'pending', visibility_consent_status: record.visibility_consent_status },
    note: 'Specialistul a cerut asocierea cu locatia. Asocierea ramane inactiva si privata pana la decizia organizatiei.',
  });
  await notifyLocationManagers(base44, svc, location, profile);
  return res({ success: true, association_request_status: 'pending' });
}

async function cancelAssociationRequest(svc, user, locationId) {
  const profile = await ownProfessionalProfile(svc, user);
  if (!profile) return res({ error: 'Profilul profesional nu a fost găsit.' }, 404);
  const existing = (await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: profile.id, location_id: locationId }, '-created_date', 10))[0] || null;
  if (!existing || !isPendingAssociationRequest(existing)) return res({ success: true, already_closed: true });
  const now = new Date().toISOString();
  const updates = { association_request_status: 'withdrawn', association_decided_at: now, association_decided_by_user_id: user.id, public_status: 'privat' };
  await svc.entities.ProfessionalLocationAssignment.update(existing.id, updates);
  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: existing.id,
    action_type: 'withdraw_professional_association_request',
    changed_fields: Object.keys(updates),
    previous: { association_request_status: 'pending' },
    next: { ...updates, location_id: locationId, professional_id: profile.id },
    note: 'Specialistul si-a anulat cererea de asociere.',
  });
  return res({ success: true, association_request_status: 'withdrawn' });
}

async function decideAssociationRequest(svc, user, action, assignment, location) {
  if (!isPendingAssociationRequest(assignment)) return res({ error: 'Cererea nu mai este în așteptare.' }, 409);
  const now = new Date().toISOString();
  let updates;
  if (action === 'approve_association') {
    const profile = await svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null);
    if (!profile) return res({ error: 'Profilul profesional nu a fost găsit.' }, 404);
    updates = approvedAssociationPatch({ assignment, profile, location, actorUserId: user.id, now });
  } else {
    updates = declinedAssociationPatch({ actorUserId: user.id, now });
  }
  await svc.entities.ProfessionalLocationAssignment.update(assignment.id, updates);
  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: assignment.id,
    action_type: action === 'approve_association' ? 'approve_professional_association' : 'decline_professional_association',
    changed_fields: Object.keys(updates),
    previous: { active_status: assignment.active_status, association_request_status: 'pending', public_status: assignment.public_status || 'privat' },
    next: { ...updates, location_id: location.id, professional_id: assignment.professional_id },
    note: action === 'approve_association'
      ? 'Organizatia a aprobat cererea specialistului. Nu s-a acordat acces la contul organizatiei.'
      : 'Organizatia a refuzat cererea specialistului.',
  });
  return res({ success: true, ...updates });
}

async function addSelfAsSpecialist(svc, user, location) {
  const profile = await ownProfessionalProfile(svc, user);
  if (!profile) return res({ error: 'Creează mai întâi profilul profesional din cont.', code: 'professional_profile_missing' }, 404);
  if (profile.profile_review_status === 'archived' || profile.public_visibility_status === 'archived') {
    return res({ error: 'Profilul profesional este arhivat.' }, 409);
  }
  const existing = (await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: profile.id, location_id: location.id }, '-created_date', 10))[0] || null;
  if (existing?.active_status === 'activ') return res({ success: true, already_associated: true, public_status: existing.public_status || 'privat' });
  const now = new Date().toISOString();
  const record = selfAssociationRecord({ profile, location, userId: user.id, now });
  const assignment = existing
    ? await svc.entities.ProfessionalLocationAssignment.update(existing.id, { ...record, association_request_status: '' })
    : await svc.entities.ProfessionalLocationAssignment.create(record);
  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: assignment.id || existing?.id,
    action_type: 'add_self_as_location_specialist',
    changed_fields: Object.keys(record),
    previous: existing ? { active_status: existing.active_status, public_status: existing.public_status || 'privat' } : {},
    next: { location_id: location.id, professional_id: profile.id, public_status: record.public_status },
    note: record.public_status === 'public'
      ? 'Administratorul locatiei s-a afisat ca specialist (acelasi cont, acord dat).'
      : 'Administratorul locatiei s-a asociat ca specialist; ramane privat pana cand profilul e verificat si locatia publica.',
  });
  return res({ success: true, public_status: record.public_status });
}

async function getOwnAssignment(svc, user, locationId) {
  const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
  const profile = profiles[0] || null;
  if (!profile) return { error: 'Profilul profesional nu a fost gasit', status: 404 };

  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
    professional_id: profile.id,
    location_id: locationId,
  }, '-created_date', 10);
  const assignment = assignments[0] || null;
  if (!assignment) return { error: 'Asocierea profesionala nu a fost gasita', status: 404 };

  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita', status: 404 };
  return { profile, assignment, location };
}

async function decideOwnVisibility(svc, user, action, locationId) {
  const own = await getOwnAssignment(svc, user, locationId);
  if (own.error) return res({ error: own.error }, own.status);
  const { profile, assignment, location } = own;
  if (assignment.active_status !== 'activ') return res({ error: 'Asocierea nu mai este activa' }, 409);

  const now = new Date().toISOString();
  let updates;
  let actionType;
  let note;

  if (action === 'accept_visibility') {
    const eligibility = publicEligibility(profile, location);
    if (!eligibility.can_publish) return res({ error: eligibility.publish_block_reason }, 409);
    updates = {
      visibility_consent_status: 'accepted',
      visibility_decided_at: now,
      visibility_decided_by_user_id: user.id,
      public_status: 'public',
    };
    actionType = 'accept_professional_assignment_visibility';
    note = 'Specialistul a acceptat afisarea profilului sau la aceasta locatie.';
  } else if (action === 'decline_visibility') {
    updates = {
      visibility_consent_status: 'declined',
      visibility_decided_at: now,
      visibility_decided_by_user_id: user.id,
      public_status: 'privat',
    };
    actionType = 'decline_professional_assignment_visibility';
    note = 'Specialistul a refuzat afisarea profilului sau la aceasta locatie.';
  } else {
    updates = {
      visibility_consent_status: 'revoked',
      visibility_decided_at: now,
      visibility_decided_by_user_id: user.id,
      visibility_revoked_at: now,
      public_status: 'privat',
    };
    actionType = 'revoke_professional_assignment_visibility';
    note = 'Specialistul a retras acordul pentru afisarea profilului sau la aceasta locatie.';
  }

  await svc.entities.ProfessionalLocationAssignment.update(assignment.id, updates);
  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: assignment.id,
    action_type: actionType,
    changed_fields: Object.keys(updates),
    previous: {
      public_status: assignment.public_status || 'privat',
      visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
    },
    next: { ...updates, location_id: locationId, professional_id: profile.id },
    note,
  });

  return res({
    success: true,
    public_status: updates.public_status,
    visibility_consent_status: updates.visibility_consent_status,
  });
}

async function withdrawOwnAssignment(svc, user, locationId) {
  const own = await getOwnAssignment(svc, user, locationId);
  if (own.error) return res({ error: own.error }, own.status);
  const { profile, assignment } = own;
  if (assignment.active_status === 'inactiv') {
    return res({ success: true, already_inactive: true, location_id: locationId });
  }

  const now = new Date().toISOString();
  await svc.entities.ProfessionalLocationAssignment.update(assignment.id, {
    active_status: 'inactiv',
    public_status: 'privat',
    visibility_consent_status: 'revoked',
    visibility_decided_at: now,
    visibility_decided_by_user_id: user.id,
    visibility_revoked_at: now,
  });

  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: assignment.id,
    action_type: 'deactivate_professional_assignment_by_professional',
    changed_fields: ['active_status', 'public_status', 'visibility_consent_status', 'visibility_decided_at', 'visibility_decided_by_user_id', 'visibility_revoked_at'],
    previous: {
      active_status: assignment.active_status || 'activ',
      public_status: assignment.public_status || 'privat',
      visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
    },
    next: {
      active_status: 'inactiv',
      public_status: 'privat',
      visibility_consent_status: 'revoked',
      location_id: locationId,
      professional_id: profile.id,
    },
    note: 'Specialistul si-a retras asocierea cu locatia. Profilul profesional si accesul organizatiei nu au fost modificate.',
  });

  return res({ success: true, location_id: locationId });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action || 'list');
    const locationId = text(payload.location_id);
    const professionalId = text(payload.professional_id);

    if (!locationId) return res({ error: 'location_id este obligatoriu' }, 400);
    if (action === 'request_association') return requestAssociation(base44, svc, user, locationId, payload);
    if (action === 'cancel_association_request') return cancelAssociationRequest(svc, user, locationId);
    if (action === 'withdraw') return withdrawOwnAssignment(svc, user, locationId);
    if (PROFESSIONAL_VISIBILITY_ACTIONS.includes(action)) return decideOwnVisibility(svc, user, action, locationId);

    const access = await assertProviderAccess(svc, user, locationId);
    if (access.error) return res({ error: access.error }, access.status);

    if (action === 'list') {
      return res({
        assignments: await listAssignments(svc, locationId, access.location),
        current_user_professional: profileSummary(await ownProfessionalProfile(svc, user)),
      });
    }

    if (action === 'add_self') return addSelfAsSpecialist(svc, user, access.location);

    if (!['deactivate', 'set_visibility', 'request_visibility', 'approve_association', 'decline_association'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
    if (!professionalId) return res({ error: 'professional_id este obligatoriu' }, 400);

    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, location_id: locationId }, '-created_date', 10);
    const assignment = assignments[0] || null;
    if (!assignment) return res({ error: 'Asocierea specialistului nu a fost gasita' }, 404);

    if (action === 'approve_association' || action === 'decline_association') {
      return decideAssociationRequest(svc, user, action, assignment, access.location);
    }

    if (action === 'request_visibility' || (action === 'set_visibility' && text(payload.public_status) === 'public')) {
      if (assignment.active_status !== 'activ') return res({ error: 'Doar o asociere activa poate fi propusa pentru publicare' }, 409);
      const profile = await svc.entities.ProfessionalProfile.get(professionalId).catch(() => null);
      if (!profile) return res({ error: 'Profilul profesional nu a fost gasit' }, 404);
      const eligibility = publicEligibility(profile, access.location);
      if (!eligibility.can_publish) return res({ error: eligibility.publish_block_reason }, 409);
      if ((assignment.visibility_consent_status || 'not_requested') === 'pending') {
        return res({ success: true, already_pending: true, public_status: 'privat', visibility_consent_status: 'pending' });
      }

      const now = new Date().toISOString();
      const updates = {
        public_status: 'privat',
        visibility_consent_status: 'pending',
        visibility_requested_at: now,
        visibility_requested_by_user_id: user.id,
      };
      await svc.entities.ProfessionalLocationAssignment.update(assignment.id, updates);
      await audit(svc, user, {
        entity_type: 'ProfessionalLocationAssignment',
        entity_id: assignment.id,
        action_type: 'request_professional_assignment_visibility',
        changed_fields: Object.keys(updates),
        previous: {
          public_status: assignment.public_status || 'privat',
          visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
        },
        next: { ...updates, location_id: locationId, professional_id: professionalId },
        note: 'Furnizorul a solicitat acordul specialistului pentru afisarea publica la aceasta locatie.',
      });
      return res({
        success: true,
        requires_professional_consent: true,
        public_status: 'privat',
        visibility_consent_status: 'pending',
      });
    }

    if (action === 'set_visibility') {
      const publicStatus = text(payload.public_status);
      if (publicStatus !== 'privat') return res({ error: 'Publicarea necesita acordul specialistului' }, 409);
      const updates = {
        public_status: 'privat',
        visibility_consent_status: 'not_requested',
      };
      if ((assignment.public_status || 'privat') === 'privat' && (assignment.visibility_consent_status || 'not_requested') === 'not_requested') {
        return res({ success: true, already_set: true, ...updates });
      }
      await svc.entities.ProfessionalLocationAssignment.update(assignment.id, updates);
      await audit(svc, user, {
        entity_type: 'ProfessionalLocationAssignment',
        entity_id: assignment.id,
        action_type: 'hide_professional_assignment_by_provider',
        changed_fields: Object.keys(updates),
        previous: {
          public_status: assignment.public_status || 'privat',
          visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
        },
        next: { ...updates, location_id: locationId, professional_id: professionalId },
        note: 'Furnizorul a ascuns asocierea. O republicare va necesita un nou acord al specialistului.',
      });
      return res({ success: true, ...updates });
    }

    if (assignment.active_status === 'inactiv') return res({ success: true, already_inactive: true });

    const now = new Date().toISOString();
    await svc.entities.ProfessionalLocationAssignment.update(assignment.id, {
      active_status: 'inactiv',
      public_status: 'privat',
      visibility_consent_status: 'revoked',
      visibility_decided_at: now,
      visibility_revoked_at: now,
    });

    await audit(svc, user, {
      entity_type: 'ProfessionalLocationAssignment',
      entity_id: assignment.id,
      action_type: 'deactivate_professional_assignment_by_provider',
      changed_fields: ['active_status', 'public_status', 'visibility_consent_status', 'visibility_decided_at', 'visibility_revoked_at'],
      previous: {
        active_status: assignment.active_status || 'activ',
        public_status: assignment.public_status || 'privat',
        visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
      },
      next: {
        active_status: 'inactiv',
        public_status: 'privat',
        visibility_consent_status: 'revoked',
        location_id: locationId,
        professional_id: professionalId,
      },
      note: 'Furnizorul a eliminat asocierea specialistului cu aceasta locatie. Profilul profesional nu a fost modificat.',
    });

    return res({ success: true });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});