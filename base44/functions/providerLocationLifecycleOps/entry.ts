import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SECTION = 'location_lifecycle';
const ITEM_KEY = 'location_lifecycle';
const REQUEST_ACTIONS = ['hide', 'republish', 'close'];
const PROVIDER_ACTIVE_STATUSES = ['pending_review', 'needs_more_info'];

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeRole(value) {
  const role = clean(value, 80);
  if (role === 'owner') return 'organization_owner';
  return role;
}

function parsePayload(submission) {
  try {
    const parsed = JSON.parse(String(submission?.payload_json || '{}'));
    const action = clean(parsed?.action, 40);
    return REQUEST_ACTIONS.includes(action) ? { action } : null;
  } catch (_error) {
    return null;
  }
}

function safeSubmission(submission) {
  if (!submission) return null;
  const payload = parsePayload(submission);
  return {
    id: submission.id,
    status: submission.status,
    action: payload?.action || '',
    submitted_at: submission.submitted_at || null,
    reviewed_at: submission.reviewed_at || null,
    admin_note: ['needs_more_info', 'rejected'].includes(submission.status) ? (submission.admin_note || '') : '',
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
  };
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

async function ownerAccess(svc, user, locationId) {
  if (!locationId) return { error: 'location_id este obligatoriu', status: 400 };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  if (!memberships.some((membership) => normalizeRole(membership.role) === 'organization_owner')) {
    return { error: 'Doar ownerul organizatiei poate solicita schimbarea starii locatiei', status: 403 };
  }
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita', status: 404 };
  return { location };
}

async function lifecycleRows(svc, locationId, statuses = null) {
  const query = {
    location_id: locationId,
    access_origin: 'provider_workspace',
    section: SECTION,
    item_key: ITEM_KEY,
  };
  if (statuses?.length) query.status = { $in: statuses };
  return await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 30);
}

function validateRequestAgainstLocation(action, location) {
  const hidden = location.status === 'ascunsa' || location.public_visibility_status === 'archived';
  const closed = location.status === 'arhivata' || location.active_status === 'inactiva';

  if (action === 'hide') {
    if (closed) return { error: 'Locatia este inchisa si nu poate fi doar ascunsa' };
    if (hidden) return { error: 'Locatia este deja ascunsa' };
  }
  if (action === 'republish') {
    if (closed) return { error: 'Locatia inchisa nu poate fi republicata prin acest flux' };
    if (!hidden) return { error: 'Locatia este deja publica sau nu este eligibila pentru republicare' };
    if (location.claim_verification_status !== 'approved') return { error: 'Locatia trebuie sa aiba revendicarea aprobata pentru republicare' };
    if (location.profile_control_status === 'suspended') return { error: 'Locatia suspendata nu poate fi republicata' };
  }
  if (action === 'close' && closed) return { error: 'Locatia este deja inchisa' };
  return null;
}

async function providerGet(svc, user, payload) {
  const locationId = clean(payload.location_id, 120);
  const access = await ownerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const rows = await lifecycleRows(svc, locationId);
  const active = rows.find((row) => PROVIDER_ACTIVE_STATUSES.includes(row.status)) || null;
  const latestReviewed = rows.find((row) => ['approved', 'rejected', 'withdrawn'].includes(row.status)) || null;
  return res({
    location: {
      id: access.location.id,
      status: access.location.status,
      active_status: access.location.active_status,
      public_visibility_status: access.location.public_visibility_status,
    },
    submission: safeSubmission(active || latestReviewed),
  });
}

async function providerSubmit(svc, user, payload) {
  const locationId = clean(payload.location_id, 120);
  const action = clean(payload.request_action || payload.lifecycle_action || payload.request_type, 40);
  if (!REQUEST_ACTIONS.includes(action)) return res({ error: 'Tip de solicitare invalid' }, 400);
  const access = await ownerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const stateError = validateRequestAgainstLocation(action, access.location);
  if (stateError) return res(stateError, 409);

  const rows = await lifecycleRows(svc, locationId, PROVIDER_ACTIVE_STATUSES);
  const existing = rows[0] || null;
  const existingPayload = parsePayload(existing);
  if (existing?.status === 'pending_review') {
    if (existing.submitted_by_user_id === user.id && existingPayload?.action === action) {
      return res({ success: true, duplicate: true, submission: safeSubmission(existing), message: 'Solicitarea este deja in verificare.' });
    }
    return res({ error: 'Exista deja o alta solicitare activa pentru aceasta locatie' }, 409);
  }
  if (existing && existing.submitted_by_user_id !== user.id) {
    return res({ error: 'Exista deja o solicitare gestionata de alt owner al organizatiei' }, 409);
  }

  const now = new Date().toISOString();
  const data = {
    organization_id: access.location.organization_id || null,
    location_id: locationId,
    access_origin: 'provider_workspace',
    section: SECTION,
    item_key: ITEM_KEY,
    payload_json: JSON.stringify({ action }),
    status: 'pending_review',
    submitted_by_user_id: user.id,
    submitted_at: now,
    admin_note: '',
  };
  const submission = existing
    ? await svc.entities.ProviderWorkspaceSubmission.update(existing.id, data)
    : await svc.entities.ProviderWorkspaceSubmission.create(data);

  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: existing ? 'resubmit_location_lifecycle_request' : 'submit_location_lifecycle_request',
    changed_fields: ['status', 'payload_json', 'submitted_at'],
    previous: existing ? { status: existing.status, action: existingPayload?.action || '' } : {},
    next: { status: 'pending_review', action, location_id: locationId },
    note: `Solicitare ${action} trimisa spre verificare administrativa.`,
  });
  return res({ success: true, submission: safeSubmission(submission) });
}

async function providerWithdraw(svc, user, payload) {
  const locationId = clean(payload.location_id, 120);
  const submissionId = clean(payload.submission_id, 120);
  const access = await ownerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (!submission || submission.location_id !== locationId || submission.section !== SECTION || submission.item_key !== ITEM_KEY) {
    return res({ error: 'Solicitarea nu a fost gasita' }, 404);
  }
  if (submission.submitted_by_user_id !== user.id) return res({ error: 'Nu poti retrage aceasta solicitare' }, 403);
  if (!PROVIDER_ACTIVE_STATUSES.includes(submission.status)) return res({ error: 'Solicitarea nu mai poate fi retrasa' }, 409);
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'withdraw_location_lifecycle_request',
    changed_fields: ['status'],
    previous: { status: submission.status },
    next: { status: 'withdrawn' },
    note: 'Solicitarea de schimbare a starii locatiei a fost retrasa de owner.',
  });
  return res({ success: true, status: 'withdrawn' });
}

async function adminList(svc, user) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
    access_origin: 'provider_workspace',
    section: SECTION,
    item_key: ITEM_KEY,
    status: 'pending_review',
  }, '-submitted_at', 100);
  return res({ submissions: rows });
}

async function updateOrganizationAfterLifecycle(svc, location, action, now) {
  if (!location.organization_id) return null;
  const organization = await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null);
  if (!organization) return null;
  const locations = await svc.entities.ProviderLocation.filter({ organization_id: location.organization_id }, '-created_date', 500);

  if (action === 'close') {
    const otherActive = locations.some((item) => item.id !== location.id && item.active_status !== 'inactiva' && item.status !== 'arhivata');
    if (!otherActive) {
      await svc.entities.ProviderOrganization.update(organization.id, {
        status: 'inactiva',
        public_visibility_status: 'archived',
        profile_updated_at: now,
      });
      return { organization_id: organization.id, status: 'inactiva', public_visibility_status: 'archived' };
    }
  }

  if (action === 'republish' && (organization.status === 'inactiva' || organization.public_visibility_status === 'archived')) {
    await svc.entities.ProviderOrganization.update(organization.id, {
      status: 'activa',
      public_visibility_status: 'approved',
      profile_updated_at: now,
    });
    return { organization_id: organization.id, status: 'activa', public_visibility_status: 'approved' };
  }
  return null;
}

async function adminDecide(svc, user, payload) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const decision = clean(payload.action, 40);
  const submissionId = clean(payload.submission_id, 120);
  const note = clean(payload.note, 1000);
  if (!submissionId) return res({ error: 'submission_id este obligatoriu' }, 400);
  if (!['approve', 'request_more_info', 'reject'].includes(decision)) return res({ error: 'Actiune invalida' }, 400);
  if (decision !== 'approve' && !note) return res({ error: 'Nota este obligatorie' }, 400);

  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (!submission || submission.section !== SECTION || submission.item_key !== ITEM_KEY) return res({ error: 'Solicitarea nu a fost gasita' }, 404);
  if (submission.status !== 'pending_review') return res({ error: 'Solicitarea nu mai este in verificare' }, 409);
  const request = parsePayload(submission);
  if (!request) return res({ error: 'Payload invalid' }, 400);
  const location = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
  if (!location) return res({ error: 'Locatia nu a fost gasita' }, 404);

  const now = new Date().toISOString();
  if (decision === 'approve') {
    const stateError = validateRequestAgainstLocation(request.action, location);
    if (stateError) return res(stateError, 409);
    const previous = {
      status: location.status,
      active_status: location.active_status,
      public_visibility_status: location.public_visibility_status,
      request_intake_status: location.request_intake_status,
    };
    const updates = request.action === 'hide'
      ? { status: 'ascunsa', public_visibility_status: 'archived', profile_updated_at: now }
      : request.action === 'republish'
        ? { status: 'publicata', active_status: 'activa', public_visibility_status: 'approved', profile_updated_at: now }
        : { status: 'arhivata', active_status: 'inactiva', public_visibility_status: 'archived', request_intake_status: 'inactive', profile_updated_at: now };

    await svc.entities.ProviderLocation.update(location.id, updates);
    const organizationUpdate = await updateOrganizationAfterLifecycle(svc, location, request.action, now);
    await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
      status: 'approved',
      reviewed_by_user_id: user.id,
      reviewed_at: now,
      admin_note: note,
      applied_entity_id: location.id,
    });
    await audit(svc, user, {
      entity_type: 'ProviderLocation',
      entity_id: location.id,
      action_type: request.action === 'hide' ? 'approve_hide_location' : request.action === 'republish' ? 'approve_republish_location' : 'approve_close_location',
      changed_fields: Object.keys(updates),
      previous,
      next: { ...updates, organization_update: organizationUpdate },
      note: note || `Solicitarea ${request.action} a fost aprobata.`,
    });
    return res({ success: true, status: 'approved', location_updates: updates, organization_update: organizationUpdate });
  }

  const nextStatus = decision === 'request_more_info' ? 'needs_more_info' : 'rejected';
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
    status: nextStatus,
    reviewed_by_user_id: user.id,
    reviewed_at: now,
    admin_note: note,
  });
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: decision === 'request_more_info' ? 'request_more_info_location_lifecycle' : 'reject_location_lifecycle',
    changed_fields: ['status', 'admin_note'],
    previous: { status: submission.status },
    next: { status: nextStatus, action: request.action },
    note,
  });
  return res({ success: true, status: nextStatus });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = clean(payload.action, 60);

    if (action === 'get') return providerGet(svc, user, payload);
    if (action === 'submit') return providerSubmit(svc, user, payload);
    if (action === 'withdraw') return providerWithdraw(svc, user, payload);
    if (action === 'admin_list') return adminList(svc, user);
    if (['approve', 'request_more_info', 'reject'].includes(action)) return adminDecide(svc, user, payload);
    return res({ error: 'Actiune necunoscuta' }, 400);
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
