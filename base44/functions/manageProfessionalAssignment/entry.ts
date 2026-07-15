import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROVIDER_ROLES = ['organization_owner', 'location_manager'];

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
      verification_status: profile.verification_status || 'unverified',
      profile_review_status: profile.profile_review_status || 'draft',
      is_public: profile.is_public === true,
      ...eligibility,
    });
  }
  return items;
}

async function withdrawOwnAssignment(svc, user, locationId) {
  const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
  const profile = profiles[0] || null;
  if (!profile) return res({ error: 'Profilul profesional nu a fost gasit' }, 404);

  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
    professional_id: profile.id,
    location_id: locationId,
  }, '-created_date', 10);
  const assignment = assignments[0] || null;
  if (!assignment) return res({ error: 'Asocierea profesionala nu a fost gasita' }, 404);
  if (assignment.active_status === 'inactiv') {
    return res({ success: true, already_inactive: true, location_id: locationId });
  }

  await svc.entities.ProfessionalLocationAssignment.update(assignment.id, {
    active_status: 'inactiv',
    public_status: 'privat',
  });

  await audit(svc, user, {
    entity_type: 'ProfessionalLocationAssignment',
    entity_id: assignment.id,
    action_type: 'deactivate_professional_assignment_by_professional',
    changed_fields: ['active_status', 'public_status'],
    previous: {
      active_status: assignment.active_status || 'activ',
      public_status: assignment.public_status || 'privat',
    },
    next: {
      active_status: 'inactiv',
      public_status: 'privat',
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
    if (action === 'withdraw') return withdrawOwnAssignment(svc, user, locationId);

    const access = await assertProviderAccess(svc, user, locationId);
    if (access.error) return res({ error: access.error }, access.status);

    if (action === 'list') {
      return res({ assignments: await listAssignments(svc, locationId, access.location) });
    }

    if (!['deactivate', 'set_visibility'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
    if (!professionalId) return res({ error: 'professional_id este obligatoriu' }, 400);

    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, location_id: locationId }, '-created_date', 10);
    const assignment = assignments[0] || null;
    if (!assignment) return res({ error: 'Asocierea specialistului nu a fost gasita' }, 404);

    if (action === 'set_visibility') {
      const publicStatus = text(payload.public_status);
      if (!['public', 'privat'].includes(publicStatus)) return res({ error: 'public_status este invalid' }, 400);
      if (assignment.active_status !== 'activ') return res({ error: 'Doar o asociere activa poate fi publicata' }, 409);

      const profile = await svc.entities.ProfessionalProfile.get(professionalId).catch(() => null);
      if (!profile) return res({ error: 'Profilul profesional nu a fost gasit' }, 404);
      if (publicStatus === 'public') {
        const eligibility = publicEligibility(profile, access.location);
        if (!eligibility.can_publish) return res({ error: eligibility.publish_block_reason }, 409);
      }
      if ((assignment.public_status || 'privat') === publicStatus) {
        return res({ success: true, already_set: true, public_status: publicStatus });
      }

      await svc.entities.ProfessionalLocationAssignment.update(assignment.id, { public_status: publicStatus });
      await audit(svc, user, {
        entity_type: 'ProfessionalLocationAssignment',
        entity_id: assignment.id,
        action_type: publicStatus === 'public' ? 'publish_professional_assignment_by_provider' : 'hide_professional_assignment_by_provider',
        changed_fields: ['public_status'],
        previous: { public_status: assignment.public_status || 'privat' },
        next: { public_status: publicStatus, location_id: locationId, professional_id: professionalId },
        note: publicStatus === 'public'
          ? 'Furnizorul a publicat asocierea specialistului la aceasta locatie.'
          : 'Furnizorul a ascuns asocierea specialistului de pe profilul public al locatiei.',
      });

      return res({ success: true, public_status: publicStatus });
    }

    if (assignment.active_status === 'inactiv') return res({ success: true, already_inactive: true });

    await svc.entities.ProfessionalLocationAssignment.update(assignment.id, {
      active_status: 'inactiv',
      public_status: 'privat',
    });

    await audit(svc, user, {
      entity_type: 'ProfessionalLocationAssignment',
      entity_id: assignment.id,
      action_type: 'deactivate_professional_assignment_by_provider',
      changed_fields: ['active_status', 'public_status'],
      previous: { active_status: assignment.active_status || 'activ', public_status: assignment.public_status || 'privat' },
      next: { active_status: 'inactiv', public_status: 'privat', location_id: locationId, professional_id: professionalId },
      note: 'Furnizorul a eliminat asocierea specialistului cu aceasta locatie. Profilul profesional nu a fost modificat.',
    });

    return res({ success: true });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
