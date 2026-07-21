import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROVIDER_ROLES = ['organization_owner', 'location_manager'];
const ACTIVE_DRAFT_STATUSES = ['draft', 'needs_more_info'];
const PHOTO_SECTION = 'media';
const PHOTO_ITEM_KEY = 'location_photo';
const MAX_URL_LENGTH = 4000;

function res(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeRole(value: unknown) {
  const role = text(value, 80);
  if (role === 'owner') return 'organization_owner';
  return role;
}

function safeUrl(value: unknown) {
  const raw = text(value, MAX_URL_LENGTH);
  if (!raw || /\s/.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch (_error) {
    return '';
  }
}

function safeAsset(asset: any) {
  if (!asset) return null;
  return {
    id: asset.id,
    submission_id: asset.submission_id || null,
    status: asset.status,
    cleanup_status: asset.cleanup_status || 'active',
    cleanup_reason: asset.cleanup_reason || '',
    created_date: asset.created_date || null,
    updated_date: asset.updated_date || null,
  };
}

async function providerAccess(svc: any, user: any, locationId: string) {
  if (!locationId) return { error: 'location_id este obligatoriu', status: 400 };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  if (!memberships.some((membership: any) => PROVIDER_ROLES.includes(normalizeRole(membership.role)))) {
    return { error: 'Doar ownerul sau managerul locatiei poate gestiona fotografia', status: 403 };
  }
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita', status: 404 };
  if (location.profile_control_status === 'suspended' || location.status === 'suspendata') {
    return { error: 'Locatia este suspendata', status: 403 };
  }
  return { location };
}

async function audit(svc: any, user: any, record: any) {
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

async function registerUpload(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id, 120);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const storageReference = safeUrl(payload.storage_reference || payload.photo_url);
  if (!storageReference) return res({ error: 'URL-ul fotografiei incarcate este invalid' }, 400);

  const existing = await svc.entities.ProviderMediaAsset.filter({
    location_id: locationId,
    uploaded_by_user_id: user.id,
    media_type: 'location_photo',
    cleanup_status: 'pending_attachment',
  }, '-created_date', 20).catch(() => []);
  const now = new Date().toISOString();
  for (const asset of existing) {
    if (asset.storage_reference === storageReference) return res({ success: true, duplicate: true, asset: safeAsset(asset) });
    await svc.entities.ProviderMediaAsset.update(asset.id, {
      status: 'withdrawn',
      cleanup_status: 'pending_cleanup',
      cleanup_reason: 'upload_replaced_before_attachment',
      cleanup_requested_at: now,
    });
  }

  const asset = await svc.entities.ProviderMediaAsset.create({
    organization_id: access.location.organization_id || null,
    location_id: locationId,
    uploaded_by_user_id: user.id,
    storage_reference: storageReference,
    media_type: 'location_photo',
    status: 'draft',
    cleanup_status: 'pending_attachment',
    caption: '',
    alt_text: `Fotografie locatie ${access.location.public_display_name || access.location.name || ''}`.trim(),
  });
  await audit(svc, user, {
    entity_type: 'ProviderMediaAsset',
    entity_id: asset.id,
    action_type: 'register_location_photo_upload',
    changed_fields: ['storage_reference', 'status', 'cleanup_status'],
    next: { location_id: locationId, status: 'draft', cleanup_status: 'pending_attachment' },
    note: 'Fisier incarcat si inregistrat inainte de atasarea la draft.',
  });
  return res({ success: true, asset: safeAsset(asset) });
}

async function loadOwnedAsset(svc: any, user: any, locationId: string, assetId: string) {
  const asset = await svc.entities.ProviderMediaAsset.get(assetId).catch(() => null);
  if (
    !asset
    || asset.location_id !== locationId
    || asset.uploaded_by_user_id !== user.id
    || asset.media_type !== 'location_photo'
  ) return null;
  return asset;
}

async function attachUpload(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id, 120);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const assetId = text(payload.asset_id, 120);
  const submissionId = text(payload.submission_id, 120);
  if (!assetId || !submissionId) return res({ error: 'asset_id si submission_id sunt obligatorii' }, 400);
  const [asset, submission] = await Promise.all([
    loadOwnedAsset(svc, user, locationId, assetId),
    svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null),
  ]);
  if (!asset) return res({ error: 'Fisierul incarcat nu a fost gasit' }, 404);
  if (
    !submission
    || submission.location_id !== locationId
    || submission.submitted_by_user_id !== user.id
    || submission.section !== PHOTO_SECTION
    || submission.item_key !== PHOTO_ITEM_KEY
    || !ACTIVE_DRAFT_STATUSES.includes(submission.status)
  ) return res({ error: 'Draftul fotografiei nu este eligibil pentru atasare' }, 409);

  const parsed = (() => {
    try { return JSON.parse(submission.payload_json || '{}'); } catch (_error) { return {}; }
  })();
  if (safeUrl(parsed.photo_url || parsed.photo_data_url) !== safeUrl(asset.storage_reference)) {
    return res({ error: 'Fisierul inregistrat nu corespunde fotografiei din draft' }, 409);
  }

  const relatedAssets = await svc.entities.ProviderMediaAsset.filter({
    location_id: locationId,
    media_type: 'location_photo',
    submission_id: submissionId,
  }, '-created_date', 50).catch(() => []);
  const now = new Date().toISOString();
  for (const previousAsset of relatedAssets) {
    if (previousAsset.id === asset.id) continue;
    if (previousAsset.cleanup_status === 'cleaned') continue;
    await svc.entities.ProviderMediaAsset.update(previousAsset.id, {
      status: 'withdrawn',
      cleanup_status: 'pending_cleanup',
      cleanup_reason: 'photo_draft_replaced',
      cleanup_requested_at: now,
    });
  }

  await svc.entities.ProviderMediaAsset.update(asset.id, {
    organization_id: access.location.organization_id || null,
    submission_id: submissionId,
    status: 'draft',
    cleanup_status: 'active',
    cleanup_reason: '',
  });
  await audit(svc, user, {
    entity_type: 'ProviderMediaAsset',
    entity_id: asset.id,
    action_type: 'attach_location_photo_to_draft',
    changed_fields: ['submission_id', 'cleanup_status'],
    previous: { submission_id: asset.submission_id || null, cleanup_status: asset.cleanup_status || 'pending_attachment' },
    next: { submission_id: submissionId, cleanup_status: 'active' },
    note: 'Fotografia a fost atasata unui draft salvat.',
  });
  return res({ success: true, asset: { ...safeAsset(asset), submission_id: submissionId, cleanup_status: 'active' } });
}

async function syncSubmissionStatus(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id, 120);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const submissionId = text(payload.submission_id, 120);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (
    !submission
    || submission.location_id !== locationId
    || submission.submitted_by_user_id !== user.id
    || submission.section !== PHOTO_SECTION
    || submission.item_key !== PHOTO_ITEM_KEY
  ) return res({ error: 'Draftul fotografiei nu a fost gasit' }, 404);
  const assets = await svc.entities.ProviderMediaAsset.filter({
    location_id: locationId,
    media_type: 'location_photo',
    submission_id: submissionId,
  }, '-created_date', 20).catch(() => []);
  for (const asset of assets) {
    if (asset.cleanup_status === 'pending_cleanup' || asset.cleanup_status === 'cleaned') continue;
    await svc.entities.ProviderMediaAsset.update(asset.id, {
      status: submission.status === 'pending_review' ? 'pending_review' : 'draft',
      cleanup_status: 'active',
    });
  }
  return res({ success: true, assets: assets.map(safeAsset) });
}

async function discardDraft(svc: any, user: any, payload: Record<string, unknown>) {
  const locationId = text(payload.location_id, 120);
  const access = await providerAccess(svc, user, locationId);
  if (access.error) return res({ error: access.error }, access.status);
  const submissionId = text(payload.submission_id, 120);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (
    !submission
    || submission.location_id !== locationId
    || submission.submitted_by_user_id !== user.id
    || submission.section !== PHOTO_SECTION
    || submission.item_key !== PHOTO_ITEM_KEY
  ) return res({ error: 'Draftul fotografiei nu a fost gasit' }, 404);
  if (!ACTIVE_DRAFT_STATUSES.includes(submission.status)) return res({ error: 'Draftul nu mai poate fi retras' }, 409);
  const now = new Date().toISOString();
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
  const assets = await svc.entities.ProviderMediaAsset.filter({
    location_id: locationId,
    media_type: 'location_photo',
    submission_id: submissionId,
  }, '-created_date', 50).catch(() => []);
  for (const asset of assets) {
    await svc.entities.ProviderMediaAsset.update(asset.id, {
      status: 'withdrawn',
      cleanup_status: 'pending_cleanup',
      cleanup_reason: 'photo_draft_withdrawn',
      cleanup_requested_at: now,
    });
  }
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'withdraw_location_photo_draft',
    changed_fields: ['status'],
    previous: { status: submission.status },
    next: { status: 'withdrawn', cleanup_asset_count: assets.length },
    note: 'Draftul fotografiei a fost retras inainte de trimitere sau dupa solicitarea de completari.',
  });
  return res({ success: true, status: 'withdrawn', cleanup_asset_count: assets.length });
}

async function adminSync(svc: any, user: any, payload: Record<string, unknown>) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const submissionId = text(payload.submission_id, 120);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (!submission || submission.section !== PHOTO_SECTION || submission.item_key !== PHOTO_ITEM_KEY) {
    return res({ error: 'Submission invalida' }, 404);
  }
  const assets = await svc.entities.ProviderMediaAsset.filter({
    location_id: submission.location_id,
    media_type: 'location_photo',
    submission_id: submissionId,
  }, '-created_date', 50).catch(() => []);
  const now = new Date().toISOString();
  const approvedAsset = assets.find((asset: any) => asset.cleanup_status === 'active') || assets[0] || null;
  for (const asset of assets) {
    const isApproved = submission.status === 'approved' && approvedAsset?.id === asset.id;
    const pendingCleanup = ['rejected', 'withdrawn'].includes(submission.status) || (submission.status === 'approved' && !isApproved);
    await svc.entities.ProviderMediaAsset.update(asset.id, {
      status: isApproved ? 'approved' : submission.status === 'pending_review' ? 'pending_review' : submission.status,
      cleanup_status: pendingCleanup ? 'pending_cleanup' : 'active',
      cleanup_reason: pendingCleanup ? `submission_${submission.status}` : '',
      ...(pendingCleanup ? { cleanup_requested_at: now } : {}),
      reviewed_by_user_id: submission.reviewed_by_user_id || user.id,
      reviewed_at: submission.reviewed_at || now,
      admin_note: submission.admin_note || '',
    });
  }
  return res({ success: true, status: submission.status, asset_count: assets.length });
}

async function adminCleanupList(svc: any, user: any) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const assets = await svc.entities.ProviderMediaAsset.filter({
    media_type: 'location_photo',
    cleanup_status: 'pending_cleanup',
  }, '-cleanup_requested_at', 200).catch(() => []);
  return res({
    assets: assets.map((asset: any) => ({
      ...safeAsset(asset),
      location_id: asset.location_id,
      storage_reference: asset.storage_reference,
      cleanup_requested_at: asset.cleanup_requested_at || null,
    })),
  });
}

async function markCleanupComplete(svc: any, user: any, payload: Record<string, unknown>) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const assetId = text(payload.asset_id, 120);
  const asset = await svc.entities.ProviderMediaAsset.get(assetId).catch(() => null);
  if (!asset || asset.media_type !== 'location_photo') return res({ error: 'Fisierul nu a fost gasit' }, 404);
  if (asset.cleanup_status !== 'pending_cleanup') return res({ error: 'Fisierul nu este in coada de curatare' }, 409);
  const now = new Date().toISOString();
  await svc.entities.ProviderMediaAsset.update(asset.id, {
    cleanup_status: 'cleaned',
    cleanup_completed_at: now,
    reviewed_by_user_id: user.id,
    reviewed_at: now,
  });
  await audit(svc, user, {
    entity_type: 'ProviderMediaAsset',
    entity_id: asset.id,
    action_type: 'complete_location_photo_cleanup',
    changed_fields: ['cleanup_status', 'cleanup_completed_at'],
    previous: { cleanup_status: asset.cleanup_status },
    next: { cleanup_status: 'cleaned', cleanup_completed_at: now },
    note: text(payload.note, 1000) || 'Curatarea fisierului a fost confirmata de administrator.',
  });
  return res({ success: true, cleanup_status: 'cleaned' });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action, 60);
    if (action === 'register_upload') return registerUpload(svc, user, payload);
    if (action === 'attach_upload') return attachUpload(svc, user, payload);
    if (action === 'sync_submission_status') return syncSubmissionStatus(svc, user, payload);
    if (action === 'discard_draft') return discardDraft(svc, user, payload);
    if (action === 'admin_sync') return adminSync(svc, user, payload);
    if (action === 'admin_cleanup_list') return adminCleanupList(svc, user);
    if (action === 'mark_cleanup_complete') return markCleanupComplete(svc, user, payload);
    return res({ error: 'Actiune invalida' }, 400);
  } catch (error) {
    return res({ error: error instanceof Error ? error.message : 'Eroare neasteptata' }, 500);
  }
}
