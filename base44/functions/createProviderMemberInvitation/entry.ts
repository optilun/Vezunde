import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  isOrganizationWideProviderRole,
  providerMembershipAccessRole,
} from '../../../shared/providerOrganizationOwnerScope.js';

const ROLES = [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'location_manager', 'location_staff'];
const ROLE_LABELS = {
  organization_owner: 'Owner organizatie',
  organization_admin: 'Administrator organizatie',
  location_manager: 'Manager locatie',
  location_staff: 'Membru locatie',
};

function res(body, status = 200) { return Response.json(body, { status }); }
function role(value) {
  if (value === 'owner') return ORGANIZATION_OWNER_ROLE;
  if (value === 'admin') return ORGANIZATION_ADMIN_ROLE;
  if (value === 'manager') return 'location_manager';
  if (value === 'staff') return 'location_staff';
  return ROLES.includes(value) ? value : '';
}
function email(value) { return String(value || '').trim().toLowerCase(); }
function ids(value) { return [...new Set((Array.isArray(value) ? value : (value ? [value] : [])).map((item) => String(item || '').trim()).filter(Boolean))]; }
function includesAll(set, values) { return values.every((id) => set.has(id)); }
function sameSet(a, b) { const aa = ids(a).sort(); const bb = ids(b).sort(); return aa.length === bb.length && aa.every((item, index) => item === bb[index]); }
function invLocIds(invitation) { return ids(invitation.invited_location_ids); }
function mask(value) { const [user, domain] = String(value || '').split('@'); return user && domain ? `${user.slice(0, 2)}***@${domain}` : ''; }
function clean(value, max = 1000) { return String(value || '').trim().slice(0, max); }
function eligibleLocation(location) {
  return location
    && location.claim_verification_status === 'approved'
    && location.profile_control_status !== 'suspended'
    && location.status !== 'suspendata'
    && location.active_status !== 'inactiva';
}
function safe(invitation) {
  return {
    id: invitation.id,
    organization_id: invitation.organization_id || null,
    invited_location_ids: invLocIds(invitation),
    invited_email_masked: mask(invitation.invited_email_normalized),
    proposed_role: invitation.proposed_role,
    organization_wide_access: invitation.organization_wide_access === true,
    invited_by_user_id: invitation.invited_by_user_id || '',
    status: invitation.status,
    expires_at: invitation.expires_at || null,
    delivery_status: invitation.delivery_status || 'pending',
    delivery_provider: invitation.delivery_provider || '',
    last_delivery_attempt_at: invitation.last_delivery_attempt_at || null,
    created_date: invitation.created_date || null,
    updated_date: invitation.updated_date || null,
  };
}
async function hash(tokenValue) {
  const bytes = new TextEncoder().encode(tokenValue);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function actorScope(svc, userId) {
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const ownerLocationIds = new Set();
  const adminLocationIds = new Set();
  const ownerOrganizationIds = new Set();
  const adminOrganizationIds = new Set();
  for (const membership of memberships) {
    const accessRole = providerMembershipAccessRole(membership);
    let organizationId = clean(membership.organization_id, 200);
    if (!organizationId && membership.location_id) {
      const location = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
      organizationId = clean(location?.organization_id, 200);
    }
    if (accessRole === ORGANIZATION_OWNER_ROLE) {
      if (membership.location_id) ownerLocationIds.add(membership.location_id);
      if (organizationId) ownerOrganizationIds.add(organizationId);
    }
    if (accessRole === ORGANIZATION_ADMIN_ROLE && membership.organization_wide_access === true) {
      if (membership.location_id) adminLocationIds.add(membership.location_id);
      if (organizationId) adminOrganizationIds.add(organizationId);
    }
  }
  for (const organizationId of new Set([...ownerOrganizationIds, ...adminOrganizationIds])) {
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    for (const location of locations) {
      if (ownerOrganizationIds.has(organizationId)) ownerLocationIds.add(location.id);
      if (adminOrganizationIds.has(organizationId)) adminLocationIds.add(location.id);
    }
  }
  return { ownerLocationIds, adminLocationIds, ownerOrganizationIds, adminOrganizationIds };
}

async function loadLocations(svc, locationIds) {
  const locations = [];
  for (const id of locationIds) {
    const location = await svc.entities.ProviderLocation.get(id).catch(() => null);
    if (!location) return { error: 'Locatie invalida', status: 404 };
    if (location.claim_verification_status !== 'approved') return { error: 'Invitatiile sunt disponibile doar dupa aprobarea revendicarii', status: 403 };
    if (location.profile_control_status === 'suspended' || location.status === 'suspendata' || location.active_status === 'inactiva') return { error: 'Locatia nu este activa', status: 403 };
    locations.push(location);
  }
  return { locations };
}

async function loadOrganizationLocations(svc, organizationId) {
  const all = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
  const locations = all.filter(eligibleLocation);
  if (locations.length === 0) return { error: 'Organizatia nu are locatii active eligibile pentru acces', status: 409 };
  return { locations };
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id || '',
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

function invitationCopy({ organizationName, locationNames, proposedRole, invitationLink, expiresAt, organizationWide }) {
  const roleLabel = ROLE_LABELS[proposedRole] || proposedRole;
  const locationsText = organizationWide
    ? `Toate locatiile actuale si viitoare ale organizatiei. Locatii active acum:\n${locationNames.map((name) => `- ${name}`).join('\n')}`
    : (locationNames.length === 1 ? locationNames[0] : locationNames.map((name) => `- ${name}`).join('\n'));
  const expiryText = new Date(expiresAt).toLocaleDateString('ro-RO');
  const subject = `Invitatie VIASEE pentru ${organizationName}`;
  const body = [
    'Buna ziua,',
    '',
    `Ai fost invitat sa colaborezi in contul VIASEE al organizatiei ${organizationName}.`,
    `Rol propus: ${roleLabel}.`,
    '',
    'Acces:',
    locationsText,
    '',
    'Accepta invitatia folosind linkul de mai jos:',
    invitationLink,
    '',
    `Invitatia este valabila pana la ${expiryText}.`,
    'Daca nu te asteptai la acest mesaj, il poti ignora.',
    '',
    'Echipa VIASEE',
  ].join('\n');
  return { subject, body };
}

async function findExistingAppUser(svc, invitedEmail) {
  const rows = await svc.entities.User.filter({ email: invitedEmail }, '-created_date', 5).catch(() => []);
  return rows.find((row) => email(row.email) === invitedEmail) || null;
}

async function notifyExistingUser(base44, { to, subject, body }) {
  try {
    await base44.integrations.Core.SendEmail({ to, subject, body, from_name: 'VIASEE' });
    return { attempted: true, sent: true, provider: 'base44', deliveryKind: 'existing_user_email', messageId: '', error: '' };
  } catch (error) {
    return { attempted: true, sent: false, provider: 'manual', deliveryKind: 'existing_user_email', messageId: '', error: clean(error?.message || 'Notificarea Base44 a esuat', 500) };
  }
}

async function inviteNewAppUser(base44, invitedEmail) {
  try {
    await base44.auth.inviteUser(invitedEmail, 'user');
    return { attempted: true, sent: true, provider: 'base44', deliveryKind: 'app_invitation', messageId: '', error: '' };
  } catch (error) {
    return { attempted: true, sent: false, provider: 'manual', deliveryKind: 'app_invitation', messageId: '', error: clean(error?.message || 'Invitatia Base44 a esuat', 500) };
  }
}

async function deliverInvitation(base44, svc, params) {
  const existingUser = await findExistingAppUser(svc, params.to);
  const delivery = existingUser ? await notifyExistingUser(base44, params) : await inviteNewAppUser(base44, params.to);
  if (delivery.sent) return delivery;
  return { ...delivery, sent: false, provider: 'manual', error: delivery.error || 'Invitatia a fost creata, dar trebuie trimis manual linkul de acces.' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const proposedRole = role(payload.proposed_role);
    const invitedEmail = email(payload.invited_email || payload.email || payload.invited_email_normalized);
    const requestedOrganizationId = clean(payload.organization_id, 200);
    let locationIds = ids(payload.invited_location_ids || payload.location_ids || payload.location_id);
    if (!proposedRole) return res({ error: 'Rol invalid' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return res({ error: 'Email invalid' }, 400);

    const scope = await actorScope(svc, user.id);
    const isPlatformAdmin = user.role === 'admin';
    const organizationWide = isOrganizationWideProviderRole(proposedRole);
    let organizationId = requestedOrganizationId;
    let loaded;

    if (organizationWide) {
      if (!organizationId) return res({ error: 'organization_id este obligatoriu pentru rolurile organizationale' }, 400);
      if (!isPlatformAdmin && !scope.ownerOrganizationIds.has(organizationId)) {
        return res({ error: 'Doar ownerul organizatiei poate acorda rol de owner sau administrator' }, 403);
      }
      loaded = await loadOrganizationLocations(svc, organizationId);
      if (loaded.error) return res({ error: loaded.error }, loaded.status);
      locationIds = loaded.locations.map((location) => location.id);
    } else {
      if (locationIds.length === 0) return res({ error: 'Cel putin o locatie este obligatorie' }, 400);
      loaded = await loadLocations(svc, locationIds);
      if (loaded.error) return res({ error: loaded.error }, loaded.status);
      const organizationIds = [...new Set(loaded.locations.map((location) => location.organization_id || ''))];
      if (organizationIds.length !== 1 || !organizationIds[0]) return res({ error: 'Locatiile trebuie sa apartina aceleiasi organizatii' }, 400);
      organizationId = organizationIds[0];
      if (requestedOrganizationId && requestedOrganizationId !== organizationId) return res({ error: 'Organizatia nu corespunde locatiilor' }, 403);
      const actorLocationIds = new Set([...scope.ownerLocationIds, ...scope.adminLocationIds]);
      const actorOrganizationIds = new Set([...scope.ownerOrganizationIds, ...scope.adminOrganizationIds]);
      if (!isPlatformAdmin && (!actorOrganizationIds.has(organizationId) || !includesAll(actorLocationIds, locationIds))) {
        return res({ error: 'Nu poti invita utilizatori pentru aceste locatii' }, 403);
      }
    }

    const existing = await svc.entities.ProviderMemberInvitation.filter({ invited_email_normalized: invitedEmail, status: 'pending' }, '-created_date', 50);
    if (existing.some((invitation) => invitation.proposed_role === proposedRole && invitation.organization_id === organizationId && sameSet(invLocIds(invitation), locationIds) && new Date(invitation.expires_at).getTime() > Date.now())) {
      return res({ error: 'Exista deja o invitatie activa pentru acest email si acest acces' }, 409);
    }

    const rawToken = token();
    const days = Math.min(Math.max(Number(payload.expires_in_days || 7), 1), 30);
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const invitation = await svc.entities.ProviderMemberInvitation.create({
      organization_id: organizationId,
      invited_location_ids: locationIds,
      invited_email_normalized: invitedEmail,
      proposed_role: proposedRole,
      organization_wide_access: organizationWide,
      invited_by_user_id: user.id,
      status: 'pending',
      secure_token_hash: await hash(rawToken),
      expires_at: expiresAt,
      delivery_status: 'pending',
    });
    const base = String(payload.invitation_base_url || payload.app_base_url || new URL(req.url).origin).replace(/\/$/, '');
    const invitationLink = `${base}/accept-provider-invitation?token=${encodeURIComponent(rawToken)}`;
    const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
    const organizationName = organization?.public_display_name || organization?.name || 'organizatia ta';
    const locationNames = loaded.locations.map((location) => location.public_display_name || location.name || 'Locatie');
    const copy = invitationCopy({ organizationName, locationNames, proposedRole, invitationLink, expiresAt, organizationWide });
    const delivery = await deliverInvitation(base44, svc, { to: invitedEmail, ...copy });
    const attemptedAt = new Date().toISOString();
    const deliveryUpdate = {
      delivery_status: delivery.sent ? 'sent' : 'manual_required',
      delivery_provider: delivery.provider || 'manual',
      delivery_message_id: delivery.messageId || '',
      last_delivery_attempt_at: attemptedAt,
      delivery_error: delivery.sent ? '' : delivery.error,
    };
    await svc.entities.ProviderMemberInvitation.update(invitation.id, deliveryUpdate);
    const updatedInvitation = { ...invitation, ...deliveryUpdate };

    await audit(svc, user, {
      entity_type: 'ProviderMemberInvitation',
      entity_id: invitation.id,
      action_type: 'create_provider_member_invitation',
      changed_fields: ['status', 'expires_at', 'delivery_status', 'delivery_provider', 'organization_wide_access'],
      next: {
        organization_id: organizationId,
        location_ids: locationIds,
        proposed_role: proposedRole,
        organization_wide_access: organizationWide,
        status: 'pending',
        expires_at: expiresAt,
        delivery_status: deliveryUpdate.delivery_status,
        delivery_provider: deliveryUpdate.delivery_provider,
        delivery_kind: delivery.deliveryKind || '',
      },
      note: delivery.sent
        ? `Invitatia a fost trimisa prin infrastructura Base44 (${delivery.deliveryKind || 'invite'}).`
        : 'Invitatia a fost creata, dar necesita transmiterea manuala a linkului.',
    });

    return res({
      invitation: safe(updatedInvitation),
      invitation_token: rawToken,
      invitation_link: invitationLink,
      email_sent: delivery.sent,
      delivery_status: deliveryUpdate.delivery_status,
      delivery_provider: deliveryUpdate.delivery_provider,
      delivery_kind: delivery.deliveryKind || '',
      delivery_message: delivery.sent
        ? (delivery.deliveryKind === 'app_invitation'
          ? 'Invitatia Base44 pentru acces in aplicatie a fost trimisa.'
          : 'Notificarea a fost trimisa utilizatorului existent prin Base44.')
        : 'Invitatia a fost creata. Trimite manual linkul afisat.',
    });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
