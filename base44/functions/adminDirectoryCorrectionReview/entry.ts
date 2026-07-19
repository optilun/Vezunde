import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const LIST_STATUSES = ['submitted', 'in_review', 'needs_more_info', 'approved', 'rejected', 'resolved', 'withdrawn'];
const RESOLUTION_ACTIONS = [
  'manual_update',
  'hide_profile',
  'close_location',
  'merge_duplicate',
  'reassign_organization',
  'no_change',
];

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown, maxLength = 2000) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function parseJson(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function safeRequest(item: any, location: any, organization: any) {
  return {
    id: item.id,
    public_reference: item.public_reference,
    request_type: item.request_type,
    relationship: item.relationship,
    contact_name: item.contact_name,
    contact_email: item.contact_email_normalized,
    explanation: item.explanation,
    proposed_changes: parseJson(item.proposed_changes_json),
    evidence_urls: Array.isArray(item.evidence_urls) ? item.evidence_urls : [],
    source_snapshot: parseJson(item.source_snapshot_json),
    priority: item.priority || 'normal',
    status: item.status,
    resolution_action: item.resolution_action || 'none',
    submitted_at: item.submitted_at || item.created_date || null,
    reviewed_at: item.reviewed_at || null,
    admin_note: item.admin_note || '',
    resolved_at: item.resolved_at || null,
    location: location ? {
      id: location.id,
      name: location.public_display_name || location.name || 'Locatie',
      city: location.locality_name || location.city || '',
      county: location.county_name || location.county || '',
      address: location.address || '',
      status: location.status || '',
      active_status: location.active_status || '',
      public_visibility_status: location.public_visibility_status || '',
      profile_control_status: location.profile_control_status || 'directory',
    } : null,
    organization: organization ? {
      id: organization.id,
      name: organization.public_display_name || organization.name || 'Organizatie',
      status: organization.status || '',
    } : null,
  };
}

async function writeAudit(svc: any, user: any, record: any) {
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

async function sendStatusEmail(base44: any, item: any, subject: string, bodyLines: string[]) {
  try {
    await base44.integrations.Core.SendEmail({
      to: item.contact_email_normalized,
      from_name: 'VIASEE',
      subject,
      body: [
        'Buna ziua,',
        '',
        ...bodyLines,
        '',
        `Referinta: ${item.public_reference}`,
        '',
        'Echipa VIASEE',
      ].join('\n'),
    });
    return true;
  } catch (_error) {
    return false;
  }
}

async function updateOrganizationAfterClose(svc: any, location: any, now: string) {
  if (!location.organization_id) return null;
  const organization = await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null);
  if (!organization) return null;
  const locations = await svc.entities.ProviderLocation.filter({ organization_id: location.organization_id }, '-created_date', 1000);
  const otherActive = locations.some((item: any) => item.id !== location.id && item.active_status !== 'inactiva');
  if (otherActive) return null;

  const updates = {
    status: 'inactiva',
    public_visibility_status: 'archived',
    profile_updated_at: now,
  };
  await svc.entities.ProviderOrganization.update(organization.id, updates);
  return { organization_id: organization.id, ...updates };
}

async function listRequests(svc: any, payload: any) {
  const status = LIST_STATUSES.includes(text(payload.status, 40)) ? text(payload.status, 40) : 'submitted';
  const limit = Math.max(1, Math.min(Number(payload.limit) || 100, 300));
  const rows = await svc.entities.DirectoryCorrectionRequest.filter({ status }, '-submitted_at', limit);
  const requests = [];
  for (const item of rows) {
    const location = await svc.entities.ProviderLocation.get(item.location_id).catch(() => null);
    const organization = item.organization_id
      ? await svc.entities.ProviderOrganization.get(item.organization_id).catch(() => null)
      : null;
    requests.push(safeRequest(item, location, organization));
  }
  return response({ requests, status, returned: requests.length, limit });
}

async function loadRequest(svc: any, requestId: string) {
  const item = await svc.entities.DirectoryCorrectionRequest.get(requestId).catch(() => null);
  if (!item) return { error: 'Sesizarea nu a fost gasita', status: 404 };
  const location = await svc.entities.ProviderLocation.get(item.location_id).catch(() => null);
  if (!location) return { error: 'Locatia asociata nu a fost gasita', status: 404 };
  return { item, location };
}

async function startReview(svc: any, user: any, payload: any) {
  const requestId = text(payload.request_id, 160);
  const loaded = await loadRequest(svc, requestId);
  if (loaded.error) return response({ error: loaded.error }, loaded.status);
  const { item } = loaded;
  if (!['submitted', 'needs_more_info'].includes(item.status)) {
    return response({ error: 'Sesizarea nu poate fi preluata in starea curenta' }, 409);
  }
  const now = new Date().toISOString();
  const updates = {
    status: 'in_review',
    reviewed_at: now,
    reviewed_by_user_id: user.id,
    admin_note: '',
  };
  await svc.entities.DirectoryCorrectionRequest.update(item.id, updates);
  await writeAudit(svc, user, {
    entity_type: 'DirectoryCorrectionRequest',
    entity_id: item.id,
    action_type: 'start_directory_correction_review',
    changed_fields: Object.keys(updates),
    previous: { status: item.status },
    next: { status: 'in_review', public_reference: item.public_reference },
    note: 'Sesizarea a fost preluata in verificare administrativa.',
  });
  return response({ success: true, status: 'in_review' });
}

async function requestMoreInfo(base44: any, svc: any, user: any, payload: any) {
  const requestId = text(payload.request_id, 160);
  const note = text(payload.note, 1200);
  if (!note) return response({ error: 'Mesajul pentru solicitant este obligatoriu' }, 400);
  const loaded = await loadRequest(svc, requestId);
  if (loaded.error) return response({ error: loaded.error }, loaded.status);
  const { item } = loaded;
  if (!['submitted', 'in_review'].includes(item.status)) return response({ error: 'Sesizarea nu mai poate solicita completari' }, 409);

  const now = new Date().toISOString();
  const updates = {
    status: 'needs_more_info',
    reviewed_at: now,
    reviewed_by_user_id: user.id,
    admin_note: note,
  };
  await svc.entities.DirectoryCorrectionRequest.update(item.id, updates);
  const emailSent = await sendStatusEmail(base44, item, `Sunt necesare completari pentru ${item.public_reference}`, [note]);
  await writeAudit(svc, user, {
    entity_type: 'DirectoryCorrectionRequest',
    entity_id: item.id,
    action_type: 'request_more_info_directory_correction',
    changed_fields: Object.keys(updates),
    previous: { status: item.status },
    next: { status: 'needs_more_info', public_reference: item.public_reference, notification_sent: emailSent },
    note: 'Au fost solicitate informatii suplimentare. Nota completa ramane in cererea dedicata.',
  });
  return response({ success: true, status: 'needs_more_info', notification_sent: emailSent });
}

async function rejectRequest(base44: any, svc: any, user: any, payload: any) {
  const requestId = text(payload.request_id, 160);
  const note = text(payload.note, 1200);
  if (!note) return response({ error: 'Motivul respingerii este obligatoriu' }, 400);
  const loaded = await loadRequest(svc, requestId);
  if (loaded.error) return response({ error: loaded.error }, loaded.status);
  const { item } = loaded;
  if (!['submitted', 'in_review', 'needs_more_info'].includes(item.status)) return response({ error: 'Sesizarea nu mai poate fi respinsa' }, 409);

  const now = new Date().toISOString();
  const updates = {
    status: 'rejected',
    resolution_action: 'no_change',
    reviewed_at: now,
    reviewed_by_user_id: user.id,
    resolved_at: now,
    admin_note: note,
  };
  await svc.entities.DirectoryCorrectionRequest.update(item.id, updates);
  const emailSent = await sendStatusEmail(base44, item, `Sesizarea ${item.public_reference} a fost analizata`, [note]);
  await writeAudit(svc, user, {
    entity_type: 'DirectoryCorrectionRequest',
    entity_id: item.id,
    action_type: 'reject_directory_correction',
    changed_fields: Object.keys(updates),
    previous: { status: item.status },
    next: { status: 'rejected', resolution_action: 'no_change', public_reference: item.public_reference, notification_sent: emailSent },
    note: 'Sesizarea a fost respinsa dupa verificare. Motivul complet ramane in cererea dedicata.',
  });
  return response({ success: true, status: 'rejected', notification_sent: emailSent });
}

async function resolveRequest(base44: any, svc: any, user: any, payload: any) {
  const requestId = text(payload.request_id, 160);
  const resolutionAction = text(payload.resolution_action, 80);
  const note = text(payload.note, 1200);
  if (!RESOLUTION_ACTIONS.includes(resolutionAction)) return response({ error: 'Actiunea de rezolvare este invalida' }, 400);
  if (!note) return response({ error: 'Nota de rezolvare este obligatorie' }, 400);

  const loaded = await loadRequest(svc, requestId);
  if (loaded.error) return response({ error: loaded.error }, loaded.status);
  const { item, location } = loaded;
  if (!['submitted', 'in_review', 'needs_more_info', 'approved'].includes(item.status)) {
    return response({ error: 'Sesizarea nu mai poate fi rezolvata' }, 409);
  }

  const now = new Date().toISOString();
  let locationUpdates: Record<string, unknown> | null = null;
  let organizationUpdate = null;
  if (resolutionAction === 'hide_profile') {
    if (location.active_status === 'inactiva') return response({ error: 'Locatia inchisa nu poate fi doar ascunsa' }, 409);
    locationUpdates = {
      status: 'in_verificare',
      public_visibility_status: 'archived',
      profile_updated_at: now,
    };
  }
  if (resolutionAction === 'close_location') {
    if (location.active_status === 'inactiva') return response({ error: 'Locatia este deja inchisa' }, 409);
    locationUpdates = {
      status: 'suspendata',
      active_status: 'inactiva',
      public_visibility_status: 'archived',
      request_intake_status: 'inactive',
      profile_updated_at: now,
    };
  }

  if (locationUpdates) {
    const previousLocation = {
      status: location.status,
      active_status: location.active_status,
      public_visibility_status: location.public_visibility_status,
      request_intake_status: location.request_intake_status,
    };
    await svc.entities.ProviderLocation.update(location.id, locationUpdates);
    if (resolutionAction === 'close_location') {
      organizationUpdate = await updateOrganizationAfterClose(svc, location, now);
    }
    await writeAudit(svc, user, {
      entity_type: 'ProviderLocation',
      entity_id: location.id,
      action_type: resolutionAction === 'hide_profile' ? 'hide_location_from_directory_correction' : 'close_location_from_directory_correction',
      changed_fields: Object.keys(locationUpdates),
      previous: previousLocation,
      next: { ...locationUpdates, correction_reference: item.public_reference, organization_update: organizationUpdate },
      note: `Profil actualizat automat dupa verificarea sesizarii ${item.public_reference}.`,
    });
  }

  const requestUpdates = {
    status: 'resolved',
    resolution_action: resolutionAction,
    reviewed_at: now,
    reviewed_by_user_id: user.id,
    resolved_at: now,
    admin_note: note,
    applied_entity_id: location.id,
  };
  await svc.entities.DirectoryCorrectionRequest.update(item.id, requestUpdates);
  const emailSent = await sendStatusEmail(base44, item, `Sesizarea ${item.public_reference} a fost rezolvata`, [note]);
  await writeAudit(svc, user, {
    entity_type: 'DirectoryCorrectionRequest',
    entity_id: item.id,
    action_type: 'resolve_directory_correction',
    changed_fields: Object.keys(requestUpdates),
    previous: { status: item.status, resolution_action: item.resolution_action || 'none' },
    next: { status: 'resolved', resolution_action: resolutionAction, public_reference: item.public_reference, notification_sent: emailSent },
    note: 'Sesizarea a fost rezolvata. Nota completa ramane in cererea dedicata.',
  });

  return response({
    success: true,
    status: 'resolved',
    resolution_action: resolutionAction,
    location_updated: Boolean(locationUpdates),
    organization_update: organizationUpdate,
    notification_sent: emailSent,
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return response({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return response({ error: 'Acces permis doar administratorilor VIASEE' }, 403);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action || 'list', 80);

    if (action === 'list') return listRequests(svc, payload);
    if (action === 'start_review') return startReview(svc, user, payload);
    if (action === 'request_more_info') return requestMoreInfo(base44, svc, user, payload);
    if (action === 'reject') return rejectRequest(base44, svc, user, payload);
    if (action === 'resolve') return resolveRequest(base44, svc, user, payload);
    return response({ error: 'Actiune invalida' }, 400);
  } catch (error) {
    console.error('adminDirectoryCorrectionReview failed', error);
    return response({ error: 'Coada de corectii nu a putut fi procesata' }, 500);
  }
});
