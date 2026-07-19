import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const ROLE_LABELS = {
  organization_owner: 'Owner organizatie',
  location_manager: 'Manager locatie',
  location_staff: 'Membru echipa',
};

function res(body, status = 200) { return Response.json(body, { status }); }
function role(value) { if (value === 'owner') return 'organization_owner'; if (value === 'staff') return 'location_staff'; return ROLES.includes(value) ? value : ''; }
function email(value) { return String(value || '').trim().toLowerCase(); }
function ids(value) { return [...new Set((Array.isArray(value) ? value : (value ? [value] : [])).map((item) => String(item || '').trim()).filter(Boolean))]; }
function includesAll(set, values) { return values.every((id) => set.has(id)); }
function sameSet(a, b) { const aa = ids(a).sort(); const bb = ids(b).sort(); return aa.length === bb.length && aa.every((item, index) => item === bb[index]); }
function invLocIds(invitation) { return ids(invitation.invited_location_ids); }
function mask(value) { const [user, domain] = String(value || '').split('@'); return user && domain ? `${user.slice(0, 2)}***@${domain}` : ''; }
function clean(value, max = 1000) { return String(value || '').trim().slice(0, max); }
function safe(invitation) { return { id: invitation.id, organization_id: invitation.organization_id || null, invited_location_ids: invLocIds(invitation), invited_email_masked: mask(invitation.invited_email_normalized), proposed_role: invitation.proposed_role, invited_by_user_id: invitation.invited_by_user_id || '', status: invitation.status, expires_at: invitation.expires_at || null, delivery_status: invitation.delivery_status || 'pending', delivery_provider: invitation.delivery_provider || '', last_delivery_attempt_at: invitation.last_delivery_attempt_at || null, created_date: invitation.created_date || null, updated_date: invitation.updated_date || null }; }
async function hash(tokenValue) { const bytes = new TextEncoder().encode(tokenValue); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function token() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function ownerScope(svc, userId) {
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const ownerLocationIds = new Set();
  const ownerOrganizationIds = new Set();
  for (const membership of memberships) {
    if (role(membership.role) !== 'organization_owner') continue;
    if (membership.location_id) ownerLocationIds.add(membership.location_id);
    if (membership.organization_id) ownerOrganizationIds.add(membership.organization_id);
  }
  for (const organizationId of ownerOrganizationIds) {
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    for (const location of locations) ownerLocationIds.add(location.id);
  }
  return { ownerLocationIds, ownerOrganizationIds };
}

async function loadLocations(svc, locationIds) {
  const locations = [];
  for (const id of locationIds) {
    const location = await svc.entities.ProviderLocation.get(id).catch(() => null);
    if (!location) return { error: 'Locatie invalida', status: 404 };
    if (location.claim_verification_status !== 'approved') return { error: 'Invitatiile sunt disponibile doar dupa aprobarea revendicarii', status: 403 };
    if ((location.profile_control_status || '') === 'suspended' || location.status === 'suspendata') return { error: 'Locatia este suspendata', status: 403 };
    locations.push(location);
  }
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

function invitationCopy({ organizationName, locationNames, proposedRole, invitationLink, expiresAt }) {
  const roleLabel = ROLE_LABELS[proposedRole] || proposedRole;
  const locationsText = locationNames.length === 1 ? locationNames[0] : locationNames.map((name) => `- ${name}`).join('\n');
  const expiryText = new Date(expiresAt).toLocaleDateString('ro-RO');
  const subject = `Invitatie VIASEE pentru ${organizationName}`;
  const body = [
    'Buna ziua,',
    '',
    `Ai fost invitat sa colaborezi in contul VIASEE al organizatiei ${organizationName}.`,
    `Rol propus: ${roleLabel}.`,
    '',
    'Locatii:',
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
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171717;line-height:1.55">
      <p>Buna ziua,</p>
      <p>Ai fost invitat sa colaborezi in contul VIASEE al organizatiei <strong>${organizationName}</strong>.</p>
      <p><strong>Rol propus:</strong> ${roleLabel}</p>
      <p><strong>Locatii:</strong><br>${locationNames.map((name) => clean(name, 200)).join('<br>')}</p>
      <p style="margin:28px 0"><a href="${invitationLink}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Accepta invitatia</a></p>
      <p style="font-size:13px;color:#666">Invitatia este valabila pana la ${expiryText}. Daca nu te asteptai la acest mesaj, il poti ignora.</p>
      <p>Echipa VIASEE</p>
    </div>`;
  return { subject, body, html };
}

async function sendWithResend({ to, subject, body, html, invitationId }) {
  const apiKey = clean(Deno.env.get('RESEND_API_KEY'), 500);
  const from = clean(Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('VIASEE_EMAIL_FROM'), 300);
  if (!apiKey || !from) return { attempted: false, sent: false, error: '' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `provider-invitation-${invitationId}`,
      'User-Agent': 'VIASEE/1.0',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text: body,
      tags: [{ name: 'category', value: 'provider_invitation' }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    return { attempted: true, sent: false, error: clean(data.message || data.error || `Resend HTTP ${response.status}`, 500) };
  }
  return { attempted: true, sent: true, provider: 'resend', messageId: String(data.id), error: '' };
}

async function sendWithBase44(base44, { to, subject, body }) {
  try {
    await base44.integrations.Core.SendEmail({
      to,
      subject,
      body,
      from_name: 'VIASEE',
    });
    return { attempted: true, sent: true, provider: 'base44', messageId: '', error: '' };
  } catch (error) {
    return { attempted: true, sent: false, error: clean(error?.message || 'Trimiterea Base44 a esuat', 500) };
  }
}

async function deliverInvitation(base44, params) {
  const errors = [];
  const resendResult = await sendWithResend(params).catch((error) => ({ attempted: true, sent: false, error: clean(error?.message || 'Trimiterea Resend a esuat', 500) }));
  if (resendResult.sent) return resendResult;
  if (resendResult.attempted && resendResult.error) errors.push(resendResult.error);

  const base44Result = await sendWithBase44(base44, params);
  if (base44Result.sent) return base44Result;
  if (base44Result.error) errors.push(base44Result.error);

  return {
    attempted: resendResult.attempted || base44Result.attempted,
    sent: false,
    provider: 'manual',
    messageId: '',
    error: clean(errors.join(' | ') || 'Nu exista un canal automat configurat pentru acest destinatar', 700),
  };
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
    const locationIds = ids(payload.invited_location_ids || payload.location_ids || payload.location_id);
    if (!proposedRole) return res({ error: 'Rol invalid' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return res({ error: 'Email invalid' }, 400);
    if (locationIds.length === 0) return res({ error: 'Cel putin o locatie este obligatorie' }, 400);

    const scope = await ownerScope(svc, user.id);
    if (user.role !== 'admin' && !includesAll(scope.ownerLocationIds, locationIds)) {
      return res({ error: 'Doar ownerul organizatiei poate invita utilizatori' }, 403);
    }

    const loaded = await loadLocations(svc, locationIds);
    if (loaded.error) return res({ error: loaded.error }, loaded.status);
    const organizationIds = [...new Set(loaded.locations.map((location) => location.organization_id || ''))];
    if (organizationIds.length !== 1 || !organizationIds[0]) return res({ error: 'Locatiile trebuie sa apartina aceleiasi organizatii' }, 400);
    if (payload.organization_id && payload.organization_id !== organizationIds[0]) return res({ error: 'Organizatia nu corespunde locatiilor' }, 403);
    if (user.role !== 'admin' && !scope.ownerOrganizationIds.has(organizationIds[0])) return res({ error: 'Nu administrezi aceasta organizatie' }, 403);

    const existing = await svc.entities.ProviderMemberInvitation.filter({ invited_email_normalized: invitedEmail, status: 'pending' }, '-created_date', 50);
    if (existing.some((invitation) => invitation.proposed_role === proposedRole && sameSet(invLocIds(invitation), locationIds) && new Date(invitation.expires_at).getTime() > Date.now())) {
      return res({ error: 'Exista deja o invitatie activa pentru acest email si aceste locatii' }, 409);
    }

    const rawToken = token();
    const days = Math.min(Math.max(Number(payload.expires_in_days || 7), 1), 30);
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const invitation = await svc.entities.ProviderMemberInvitation.create({
      organization_id: organizationIds[0],
      invited_location_ids: locationIds,
      invited_email_normalized: invitedEmail,
      proposed_role: proposedRole,
      invited_by_user_id: user.id,
      status: 'pending',
      secure_token_hash: await hash(rawToken),
      expires_at: expiresAt,
      delivery_status: 'pending',
    });
    const base = String(payload.invitation_base_url || payload.app_base_url || new URL(req.url).origin).replace(/\/$/, '');
    const invitationLink = `${base}/accept-provider-invitation?token=${encodeURIComponent(rawToken)}`;
    const organization = await svc.entities.ProviderOrganization.get(organizationIds[0]).catch(() => null);
    const organizationName = organization?.public_display_name || organization?.name || 'organizatia ta';
    const locationNames = loaded.locations.map((location) => location.public_display_name || location.name || 'Locatie');
    const copy = invitationCopy({ organizationName, locationNames, proposedRole, invitationLink, expiresAt });
    const delivery = await deliverInvitation(base44, {
      to: invitedEmail,
      ...copy,
      invitationId: invitation.id,
    });
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
      changed_fields: ['status', 'expires_at', 'delivery_status', 'delivery_provider'],
      next: {
        organization_id: organizationIds[0],
        location_ids: locationIds,
        proposed_role: proposedRole,
        status: 'pending',
        expires_at: expiresAt,
        delivery_status: deliveryUpdate.delivery_status,
        delivery_provider: deliveryUpdate.delivery_provider,
      },
      note: delivery.sent
        ? `Invitatia a fost trimisa automat prin ${deliveryUpdate.delivery_provider}.`
        : 'Invitatia a fost creata, dar necesita transmiterea manuala a linkului.',
    });

    return res({
      invitation: safe(updatedInvitation),
      invitation_token: rawToken,
      invitation_link: invitationLink,
      email_sent: delivery.sent,
      delivery_status: deliveryUpdate.delivery_status,
      delivery_provider: deliveryUpdate.delivery_provider,
      delivery_message: delivery.sent
        ? 'Invitatia a fost trimisa automat.'
        : 'Invitatia a fost creata. Trimite manual linkul afisat.',
    });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});
