import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];
const PROVIDER_ROLES = ['organization_owner', 'location_manager'];
const ROLE_BY_TYPE = {
  ophthalmologist: 'medic_oftalmolog',
  optometrist: 'optometrist',
  optician: 'optician',
};

function response(body, status = 200) {
  return Response.json(body, { status });
}

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function normalizeProviderRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return cleanString(role);
}

function maskEmail(value) {
  const [local, domain] = normalizeEmail(value).split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}***@${domain}`;
}

async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function safeInvitation(invitation) {
  return {
    id: invitation.id,
    organization_id: invitation.organization_id || null,
    location_id: invitation.location_id,
    invited_email_masked: maskEmail(invitation.invited_email_normalized),
    professional_type: invitation.professional_type,
    status: invitation.status,
    expires_at: invitation.expires_at || null,
    accepted_at: invitation.accepted_at || null,
    professional_id: invitation.professional_id || null,
    created_date: invitation.created_date || null,
  };
}

async function getProviderAccess(svc, user, locationId) {
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);

  const membership = memberships.find((item) => PROVIDER_ROLES.includes(normalizeProviderRole(item.role)));
  if (!membership) return { error: 'Doar proprietarul sau managerul locatiei poate gestiona invitatiile specialistilor', status: 403 };

  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita', status: 404 };
  if (location.profile_control_status === 'suspended' || location.status === 'suspendata') {
    return { error: 'Profilul locatiei este suspendat', status: 403 };
  }
  if (location.claim_verification_status !== 'approved') {
    return { error: 'Invitatiile sunt disponibile dupa aprobarea revendicarii locatiei', status: 403 };
  }

  return { membership, location };
}

async function writeAudit(svc, user, record) {
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

async function listInvitations(svc, user, payload) {
  const locationId = cleanString(payload.location_id);
  if (!locationId) return response({ error: 'location_id este obligatoriu' }, 400);

  const access = await getProviderAccess(svc, user, locationId);
  if (access.error) return response({ error: access.error }, access.status);

  const invitations = await svc.entities.ProfessionalInvitation.filter({ location_id: locationId }, '-created_date', 100);
  const now = Date.now();
  for (const invitation of invitations) {
    if (invitation.status === 'pending' && new Date(invitation.expires_at).getTime() <= now) {
      invitation.status = 'expired';
      await svc.entities.ProfessionalInvitation.update(invitation.id, { status: 'expired' });
    }
  }

  return response({ invitations: invitations.map(safeInvitation) });
}

async function createInvitation(svc, user, payload, req) {
  const locationId = cleanString(payload.location_id);
  const invitedEmail = normalizeEmail(payload.invited_email || payload.email);
  const professionalType = cleanString(payload.professional_type);

  if (!locationId) return response({ error: 'location_id este obligatoriu' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return response({ error: 'Email invalid' }, 400);
  if (!PROFESSIONAL_TYPES.includes(professionalType)) return response({ error: 'Tip profesional invalid' }, 400);

  const access = await getProviderAccess(svc, user, locationId);
  if (access.error) return response({ error: access.error }, access.status);

  const activeInvitations = await svc.entities.ProfessionalInvitation.filter({
    location_id: locationId,
    invited_email_normalized: invitedEmail,
    status: 'pending',
  }, '-created_date', 20);

  const duplicate = activeInvitations.find((item) => (
    item.professional_type === professionalType && new Date(item.expires_at).getTime() > Date.now()
  ));
  if (duplicate) return response({ error: 'Exista deja o invitatie activa pentru acest specialist si aceasta locatie' }, 409);

  const rawToken = createToken();
  const expiresInDays = Math.min(Math.max(Number(payload.expires_in_days || 14), 1), 30);
  const invitation = await svc.entities.ProfessionalInvitation.create({
    organization_id: access.location.organization_id || null,
    location_id: locationId,
    invited_email_normalized: invitedEmail,
    professional_type: professionalType,
    invited_by_user_id: user.id,
    status: 'pending',
    secure_token_hash: await hashToken(rawToken),
    expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
  });

  await writeAudit(svc, user, {
    entity_type: 'ProfessionalInvitation',
    entity_id: invitation.id,
    action_type: 'create_professional_invitation',
    changed_fields: ['status', 'location_id', 'professional_type'],
    next: {
      status: 'pending',
      location_id: locationId,
      professional_type: professionalType,
      invited_email_masked: maskEmail(invitedEmail),
    },
    note: 'Invitatie profesionala creata. Nu acorda acces operational la locatie.',
  });

  const baseUrl = cleanString(payload.invitation_base_url || payload.app_base_url || new URL(req.url).origin).replace(/\/$/, '');
  return response({
    invitation: safeInvitation(invitation),
    invitation_link: `${baseUrl}/accept-professional-invitation?token=${encodeURIComponent(rawToken)}`,
    email_sent: false,
  });
}

async function revokeInvitation(svc, user, payload) {
  const invitationId = cleanString(payload.invitation_id);
  if (!invitationId) return response({ error: 'invitation_id este obligatoriu' }, 400);

  const invitation = await svc.entities.ProfessionalInvitation.get(invitationId).catch(() => null);
  if (!invitation) return response({ error: 'Invitatia nu a fost gasita' }, 404);

  const access = await getProviderAccess(svc, user, invitation.location_id);
  if (access.error) return response({ error: access.error }, access.status);
  if (invitation.status !== 'pending') return response({ error: 'Doar invitatiile in asteptare pot fi revocate' }, 400);

  const now = new Date().toISOString();
  await svc.entities.ProfessionalInvitation.update(invitation.id, {
    status: 'revoked',
    revoked_by_user_id: user.id,
    revoked_at: now,
  });

  await writeAudit(svc, user, {
    entity_type: 'ProfessionalInvitation',
    entity_id: invitation.id,
    action_type: 'revoke_professional_invitation',
    changed_fields: ['status'],
    previous: { status: invitation.status },
    next: { status: 'revoked' },
    note: 'Invitatia profesionala a fost revocata de furnizor.',
  });

  return response({ success: true });
}

async function acceptInvitation(svc, user, payload, req) {
  const urlToken = new URL(req.url).searchParams.get('token');
  const rawToken = cleanString(payload.token || payload.invitation_token || urlToken);
  if (!rawToken) return response({ error: 'Tokenul invitatiei este obligatoriu' }, 400);
  if (user.email_verified === false || user.email_verified === 'false') {
    return response({ error: 'Emailul contului trebuie verificat inainte de acceptare' }, 403);
  }

  const matches = await svc.entities.ProfessionalInvitation.filter({
    secure_token_hash: await hashToken(rawToken),
  }, '-created_date', 2);
  const invitation = matches[0] || null;
  if (!invitation) return response({ error: 'Invitatie invalida' }, 404);

  if (invitation.status === 'accepted') {
    if (invitation.accepted_by_user_id !== user.id) return response({ error: 'Invitatia a fost acceptata de alt cont' }, 403);
    return response({ success: true, already_accepted: true, professional_id: invitation.professional_id || null });
  }
  if (invitation.status !== 'pending') return response({ error: 'Invitatia nu mai este activa' }, 400);
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await svc.entities.ProfessionalInvitation.update(invitation.id, { status: 'expired' });
    return response({ error: 'Invitatia a expirat' }, 400);
  }
  if (normalizeEmail(user.email) !== invitation.invited_email_normalized) {
    return response({ error: 'Invitatia este destinata altui email' }, 403);
  }

  const location = await svc.entities.ProviderLocation.get(invitation.location_id).catch(() => null);
  if (!location) return response({ error: 'Locatia asociata invitatiei nu mai exista' }, 404);
  if (location.profile_control_status === 'suspended' || location.status === 'suspendata') {
    return response({ error: 'Locatia asociata este suspendata' }, 403);
  }

  const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
  let profile = profiles[0] || null;
  const displayName = cleanString(user.full_name || user.name) || normalizeEmail(user.email).split('@')[0];

  if (profile && profile.professional_type && profile.professional_type !== invitation.professional_type) {
    return response({
      error: 'Contul are deja un alt tip profesional. Modificarea identitatii profesionale necesita verificare Vezunde.',
    }, 409);
  }

  if (!profile) {
    profile = await svc.entities.ProfessionalProfile.create({
      user_id: user.id,
      full_name: displayName,
      public_display_name: displayName,
      professional_type: invitation.professional_type,
      role: ROLE_BY_TYPE[invitation.professional_type],
      specializations: [],
      professional_bio: '',
      public_email: '',
      accepts_independent_requests: false,
      verification_status: 'unverified',
      public_visibility_status: 'draft',
      profile_completeness: 20,
      profile_updated_at: new Date().toISOString(),
      is_public: false,
    });
  } else if (!profile.user_id) {
    profile = await svc.entities.ProfessionalProfile.update(profile.id, { user_id: user.id });
  }

  const existingAssignments = await svc.entities.ProfessionalLocationAssignment.filter({
    professional_id: profile.id,
    location_id: invitation.location_id,
  }, '-created_date', 10);
  const assignmentData = {
    professional_id: profile.id,
    location_id: invitation.location_id,
    professional_type: profile.professional_type || invitation.professional_type,
    source_invitation_id: invitation.id,
    confirmed_by_professional_at: new Date().toISOString(),
    active_status: 'activ',
    public_status: 'privat',
  };

  let assignment;
  if (existingAssignments[0]) {
    assignment = await svc.entities.ProfessionalLocationAssignment.update(existingAssignments[0].id, assignmentData);
  } else {
    assignment = await svc.entities.ProfessionalLocationAssignment.create(assignmentData);
  }

  const acceptedAt = new Date().toISOString();
  await svc.entities.ProfessionalInvitation.update(invitation.id, {
    status: 'accepted',
    accepted_by_user_id: user.id,
    accepted_at: acceptedAt,
    professional_id: profile.id,
  });

  await writeAudit(svc, user, {
    entity_type: 'ProfessionalInvitation',
    entity_id: invitation.id,
    action_type: 'accept_professional_invitation',
    changed_fields: ['status', 'accepted_by_user_id', 'professional_id'],
    previous: { status: invitation.status },
    next: {
      status: 'accepted',
      professional_id: profile.id,
      location_id: invitation.location_id,
      assignment_public_status: 'privat',
    },
    note: 'Specialistul a confirmat asocierea. Nu s-a creat ProviderMembership si profilul nu a fost publicat.',
  });

  return response({
    success: true,
    professional: {
      id: profile.id,
      full_name: profile.full_name,
      professional_type: profile.professional_type,
      public_visibility_status: profile.public_visibility_status || 'draft',
      verification_status: profile.verification_status || 'unverified',
    },
    assignment: {
      id: assignment.id,
      location_id: assignment.location_id,
      active_status: assignment.active_status,
      public_status: assignment.public_status,
    },
    location: {
      id: location.id,
      name: location.public_display_name || location.name,
      city: location.locality_name || location.city || '',
    },
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return response({ error: 'Autentificare necesara' }, 401);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = cleanString(payload.action);

    if (action === 'list') return await listInvitations(svc, user, payload);
    if (action === 'create') return await createInvitation(svc, user, payload, req);
    if (action === 'revoke') return await revokeInvitation(svc, user, payload);
    if (action === 'accept') return await acceptInvitation(svc, user, payload, req);

    return response({ error: 'Actiune invalida' }, 400);
  } catch (error) {
    return response({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});