import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

function publicEligibility(profile, location) {
  if (!profile || profile.verification_status !== 'verified' || profile.public_visibility_status !== 'approved' || profile.is_public !== true) {
    return { can_publish: false, publish_block_reason: 'Profilul profesional trebuie sa fie verificat si public in VIASEE.' };
  }
  if (!location || location.status !== 'publicata' || location.active_status === 'inactiva' || location.profile_control_status === 'suspended') {
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
      active_status: assignment.active_status || 'activ',
      public_status: assignment.public_status || 'privat',
      visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
      visibility_requested_at: assignment.visibility_requested_at || null,
      visibility_decided_at: assignment.visibility_decided_at || null,
      verification_status: profile.verification_status || 'unverified',
      profile_review_status: profile.profile_review_status || 'draft',
      is_public: profile.is_public === true,
      ...eligibility,
    });
  }
  return items;
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

export async function handle(req: Request) {
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
    if (action === 'withdraw') return withdrawOwnAssignment(svc, user, locationId);
    if (PROFESSIONAL_VISIBILITY_ACTIONS.includes(action)) return decideOwnVisibility(svc, user, action, locationId);

    const access = await assertProviderAccess(svc, user, locationId);
    if (access.error) return res({ error: access.error }, access.status);

    if (action === 'list') {
      return res({ assignments: await listAssignments(svc, locationId, access.location) });
    }

    if (!['deactivate', 'set_visibility', 'request_visibility'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
    if (!professionalId) return res({ error: 'professional_id este obligatoriu' }, 400);

    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, location_id: locationId }, '-created_date', 10);
    const assignment = assignments[0] || null;
    if (!assignment) return res({ error: 'Asocierea specialistului nu a fost gasita' }, 404);

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
}
