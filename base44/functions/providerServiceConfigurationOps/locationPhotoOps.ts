import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROVIDER_ROLES = ['organization_owner', 'location_manager'];
const ACTIVE_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const PHOTO_ITEM_KEY = 'location_photo';
const MAX_URL_LENGTH = 4000;
const MAX_LEGACY_DATA_URL_LENGTH = 900000;

function res(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown) {
  return String(value || '').trim();
}

function normalizeRole(value: unknown) {
  if (value === 'owner') return 'organization_owner';
  return text(value);
}

function safePhoto(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  if (raw.length <= MAX_LEGACY_DATA_URL_LENGTH && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  if (raw.length > MAX_URL_LENGTH || /\s/.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (!parsed.hostname || parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch (_error) {
    return '';
  }
}

function looksLikeLogo(value: unknown) {
  const raw = safePhoto(value);
  if (!raw || raw.startsWith('data:')) return false;
  try {
    return /logo|sigla|brandmark/i.test(decodeURIComponent(new URL(raw).pathname));
  } catch (_error) {
    return /logo|sigla|brandmark/i.test(raw);
  }
}

function validatePayload(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Payload invalid' };
  const payload = raw as Record<string, unknown>;
  const allowed = ['kind', 'photo_url', 'photo_data_url', 'remove_photo'];
  const unknown = Object.keys(payload).filter((key) => !allowed.includes(key));
  if (unknown.length) return { error: 'Campuri nepermise', fields: unknown };
  if (payload.kind && payload.kind !== PHOTO_ITEM_KEY) return { error: 'Tip media invalid' };

  const removePhoto = payload.remove_photo === true;
  const rawPhoto = text(payload.photo_url || payload.photo_data_url);
  const photoUrl = safePhoto(rawPhoto);
  if (removePhoto && rawPhoto) return { error: 'Alege fie inlocuirea, fie eliminarea fotografiei' };
  if (!removePhoto && !photoUrl) return { error: 'Fotografia este obligatorie si trebuie incarcata prin UploadFile' };

  return {
    value: {
      kind: PHOTO_ITEM_KEY,
      photo_url: removePhoto ? '' : photoUrl,
      remove_photo: removePhoto,
    },
  };
}

function parsePayload(submission: Record<string, unknown> | null) {
  if (!submission) return null;
  try {
    const parsed = JSON.parse(String(submission.payload_json || '{}'));
    const checked = validatePayload(parsed);
    return checked.value || null;
  } catch (_error) {
    return null;
  }
}

function safeSubmission(submission: Record<string, unknown> | null) {
  if (!submission) return null;
  const payload = parsePayload(submission);
  return {
    id: submission.id,
    status: submission.status,
    submitted_at: submission.submitted_at || null,
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
    admin_note: ['needs_more_info', 'rejected'].includes(String(submission.status)) ? (submission.admin_note || '') : '',
    payload,
  };
}

async function audit(svc: any, user: any, record: Record<string, any>) {
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

async function providerAccess(svc: any, user: any, locationId: string) {
  if (!locationId) return { error: 'location_id este obligatoriu', status: 400 };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  if (!memberships.some((membership: any) => PROVIDER_ROLES.includes(normalizeRole(membership.role)))) {
    return { error: 'Doar proprietarul sau managerul locatiei poate gestiona fotografia', status: 403 };
  }
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita', status: 404 };
  if (location.profile_control_status === 'suspended' || location.status === 'suspendata') {
    return { error: 'Locatia este suspendata', status: 403 };
  }
  return { location, memberships };
}

async function photoSubmissions(svc: any, locationId: string, statuses?: string[]) {
  const query: Record<string, unknown> = {
    location_id: locationId,
    access_origin: 'provider_workspace',
    section: 'media',
    item_key: PHOTO_ITEM_KEY,
  };
  if (statuses?.length) query.status = { $in: statuses };
  return await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 20);
}

async function providerGet(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);

  const [rows, organization] = await Promise.all([
    photoSubmissions(svc, locationId),
    access.location.organization_id
      ? svc.entities.ProviderOrganization.get(access.location.organization_id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const active = rows.find((row: any) => ACTIVE_STATUSES.includes(row.status)) || null;
  const latestReviewed = rows.find((row: any) => ['rejected', 'approved'].includes(row.status)) || null;
  const currentPhoto = safePhoto(access.location.photo_url);
  const organizationLogo = safePhoto(organization?.logo_url);
  const legacyLogoCandidate = !!currentPhoto && (
    currentPhoto === organizationLogo
    || (!organizationLogo && looksLikeLogo(currentPhoto))
  );

  return res({
    location: {
      id: access.location.id,
      name: access.location.public_display_name || access.location.name || 'Locatie',
      current_photo_url: currentPhoto,
    },
    organization: organization ? {
      id: organization.id,
      name: organization.public_display_name || organization.name || 'Organizatie',
      logo_url: organizationLogo,
    } : null,
    legacy_logo_candidate: legacyLogoCandidate,
    submission: safeSubmission(active || latestReviewed),
  });
}

async function moveCurrentPhotoToOrganizationLogo(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  if (!access.memberships.some((membership: any) => normalizeRole(membership.role) === 'organization_owner')) {
    return res({ error: 'Doar ownerul organizatiei poate muta imaginea in logo' }, 403);
  }

  const organizationId = text(access.location.organization_id);
  if (!organizationId) return res({ error: 'Locatia nu este asociata unei organizatii' }, 409);
  const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
  if (!organization) return res({ error: 'Organizatia nu a fost gasita' }, 404);

  const activeRows = await photoSubmissions(svc, locationId, ACTIVE_STATUSES);
  if (activeRows.length > 0) return res({ error: 'Finalizeaza mai intai cererea activa pentru fotografia locatiei' }, 409);

  const currentPhoto = safePhoto(access.location.photo_url);
  if (!currentPhoto) return res({ error: 'Locatia nu are o fotografie care poate fi mutata' }, 409);
  const currentLogo = safePhoto(organization.logo_url);
  if (currentLogo && currentLogo !== currentPhoto) {
    return res({ error: 'Organizatia are deja un logo diferit. Schimba logo-ul din Profil public.' }, 409);
  }

  const now = new Date().toISOString();
  const locationUpdate: Record<string, unknown> = { photo_url: '' };
  if (safePhoto(access.location.profile_photo_url) === currentPhoto) locationUpdate.profile_photo_url = '';

  await svc.entities.ProviderOrganization.update(organization.id, {
    logo_url: currentPhoto,
    profile_updated_at: now,
  });
  await svc.entities.ProviderLocation.update(access.location.id, locationUpdate);

  await audit(svc, user, {
    entity_type: 'ProviderOrganization',
    entity_id: organization.id,
    action_type: 'migrate_location_photo_to_organization_logo',
    changed_fields: ['logo_url'],
    previous: { logo_present: !!currentLogo },
    next: { logo_present: true, source_location_id: access.location.id },
    note: 'Imagine mutata explicit de owner din fotografia locatiei in logo-ul organizatiei.',
  });
  await audit(svc, user, {
    entity_type: 'ProviderLocation',
    entity_id: access.location.id,
    action_type: 'clear_legacy_logo_from_location_photo',
    changed_fields: Object.keys(locationUpdate),
    previous: { photo_present: true },
    next: { photo_present: false },
    note: 'Logo-ul a fost separat de fotografia locatiei. Locatia asteapta o fotografie reala din exterior sau interior.',
  });

  return res({
    success: true,
    organization: {
      id: organization.id,
      name: organization.public_display_name || organization.name || 'Organizatie',
      logo_url: currentPhoto,
    },
    location: {
      id: access.location.id,
      current_photo_url: '',
    },
  });
}

async function providerSave(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const checked = validatePayload(payload.photo || payload.payload);
  if (checked.error) return res({ error: checked.error, fields: checked.fields || [] }, 400);

  const rows = await photoSubmissions(svc, locationId, ACTIVE_STATUSES);
  const active = rows[0] || null;
  if (active?.status === 'pending_review') return res({ error: 'Fotografia este deja in verificare' }, 409);

  const data = {
    payload_json: JSON.stringify(checked.value),
    status: 'draft',
    admin_note: '',
  };
  let submission;
  if (active) {
    if (active.submitted_by_user_id !== user.id) return res({ error: 'Exista deja un draft gestionat de alt utilizator al locatiei' }, 409);
    submission = await svc.entities.ProviderWorkspaceSubmission.update(active.id, data);
  } else {
    submission = await svc.entities.ProviderWorkspaceSubmission.create({
      organization_id: access.location.organization_id || null,
      location_id: locationId,
      access_origin: 'provider_workspace',
      section: 'media',
      item_key: PHOTO_ITEM_KEY,
      payload_json: JSON.stringify(checked.value),
      status: 'draft',
      submitted_by_user_id: user.id,
    });
  }

  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: active ? 'update_location_photo_draft' : 'create_location_photo_draft',
    changed_fields: ['payload_json', 'status'],
    next: { status: 'draft', location_id: locationId, remove_photo: checked.value.remove_photo, storage: 'upload_file_url' },
    note: 'Draft pentru fotografia principala a locatiei. Payloadul pastreaza doar URL-ul fisierului incarcat, nu continutul imaginii.',
  });
  return res({ success: true, submission: safeSubmission(submission) });
}

async function providerSubmit(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);

  const submissionId = text(payload.submission_id);
  const submission = submissionId
    ? await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null)
    : (await photoSubmissions(svc, locationId, ['draft', 'needs_more_info']))[0] || null;
  if (!submission || submission.location_id !== locationId || submission.section !== 'media' || submission.item_key !== PHOTO_ITEM_KEY) {
    return res({ error: 'Draftul fotografiei nu a fost gasit' }, 404);
  }
  if (submission.submitted_by_user_id !== user.id) return res({ error: 'Nu poti trimite acest draft' }, 403);
  if (!['draft', 'needs_more_info'].includes(submission.status)) return res({ error: 'Draftul nu poate fi trimis' }, 409);
  const checked = validatePayload(JSON.parse(submission.payload_json || '{}'));
  if (checked.error) return res({ error: checked.error }, 400);

  const now = new Date().toISOString();
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'pending_review', submitted_at: now, admin_note: '' });
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'submit_location_photo_review',
    changed_fields: ['status', 'submitted_at'],
    previous: { status: submission.status },
    next: { status: 'pending_review', submitted_at: now },
    note: 'Fotografia principala a locatiei a fost trimisa spre verificare.',
  });
  return res({ success: true });
}

async function adminList(svc: any, user: any) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const submissions = await svc.entities.ProviderWorkspaceSubmission.filter({
    access_origin: 'provider_workspace',
    section: 'media',
    item_key: PHOTO_ITEM_KEY,
    status: 'pending_review',
  }, '-submitted_at', 100);

  const items = [];
  for (const submission of submissions) {
    const location = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
    const parsed = parsePayload(submission);
    if (!location || !parsed) continue;
    items.push({
      id: submission.id,
      submitted_at: submission.submitted_at || null,
      location: {
        id: location.id,
        name: location.public_display_name || location.name || 'Locatie',
        city: location.locality_name || location.city || '',
        current_photo_url: safePhoto(location.photo_url),
      },
      proposed_photo_url: parsed.photo_url,
      remove_photo: parsed.remove_photo,
    });
  }
  return res({ submissions: items });
}

async function adminDecide(svc: any, user: any, payload: Record<string, unknown>) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const action = text(payload.action);
  const submissionId = text(payload.submission_id);
  const note = text(payload.note);
  if (!submissionId) return res({ error: 'submission_id este obligatoriu' }, 400);
  if (!['approve', 'request_more_info', 'reject'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
  if (action !== 'approve' && !note) return res({ error: 'Nota este obligatorie' }, 400);

  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (!submission || submission.section !== 'media' || submission.item_key !== PHOTO_ITEM_KEY) return res({ error: 'Submission invalida' }, 404);
  if (submission.status !== 'pending_review') return res({ error: 'Fotografia nu mai este in verificare' }, 409);
  const location = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
  if (!location) return res({ error: 'Locatia nu a fost gasita' }, 404);
  const checked = validatePayload(JSON.parse(submission.payload_json || '{}'));
  if (checked.error) return res({ error: checked.error }, 400);
  const now = new Date().toISOString();

  if (action === 'approve') {
    const nextPhoto = checked.value.remove_photo ? '' : checked.value.photo_url;
    const previousPhotoPresent = !!safePhoto(location.photo_url);
    await svc.entities.ProviderLocation.update(location.id, { photo_url: nextPhoto });
    await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
      status: 'approved',
      reviewed_by_user_id: user.id,
      reviewed_at: now,
      admin_note: note,
    });
    await audit(svc, user, {
      entity_type: 'ProviderLocation',
      entity_id: location.id,
      action_type: checked.value.remove_photo ? 'remove_location_photo' : 'approve_location_photo',
      changed_fields: ['photo_url'],
      previous: { photo_present: previousPhotoPresent },
      next: { photo_present: !!nextPhoto },
      note: note || 'Fotografia principala a locatiei a fost aprobata.',
    });
    return res({ success: true, status: 'approved' });
  }

  const nextStatus = action === 'request_more_info' ? 'needs_more_info' : 'rejected';
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
    status: nextStatus,
    reviewed_by_user_id: user.id,
    reviewed_at: now,
    admin_note: note,
  });
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: action === 'request_more_info' ? 'request_more_info_location_photo' : 'reject_location_photo',
    changed_fields: ['status', 'admin_note'],
    previous: { status: submission.status },
    next: { status: nextStatus },
    note,
  });
  return res({ success: true, status: nextStatus });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action);

    if (action === 'get') return await providerGet(svc, user, payload);
    if (action === 'move_current_photo_to_organization_logo') return await moveCurrentPhotoToOrganizationLogo(svc, user, payload);
    if (action === 'save_draft') return await providerSave(svc, user, payload);
    if (action === 'submit_review') return await providerSubmit(svc, user, payload);
    if (action === 'admin_list') return await adminList(svc, user);
    if (['approve', 'request_more_info', 'reject'].includes(action)) return await adminDecide(svc, user, payload);
    return res({ error: 'Actiune invalida' }, 400);
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
}
