import { invokeConsolidatedFunction } from './runtime.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  candidateRelation,
  validateLocationResolution,
} from '../../shared/providerLocationIdentityResolution.js';

const SECTION = 'location_create';
const EXISTING_ITEM_KEY = 'existing_location';
const NEW_ITEM_KEY = 'new_location';
const ACTIVE_STATUSES = ['draft', 'pending_review', 'needs_more_info'];

function res(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function clean(value: unknown, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function parseJson(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeRole(value: unknown) {
  const role = clean(value, 80);
  return role === 'owner' ? 'organization_owner' : role;
}

function locationSnapshot(location: any, organizationName = '') {
  return {
    id: location.id,
    name: location.public_display_name || location.name || 'Locatie',
    address: location.address || '',
    city: location.locality_name || location.city || '',
    phone: location.public_phone || location.phone_public || '',
    organization_id: location.organization_id || '',
    organization_name: organizationName,
    profile_control_status: location.profile_control_status || 'directory',
    public_visibility_status: location.public_visibility_status || 'draft',
    active_status: location.active_status || 'activa',
    status: location.status || 'draft',
  };
}

function safeSubmission(submission: any) {
  if (!submission) return null;
  return {
    id: submission.id,
    status: submission.status,
    item_key: submission.item_key,
    admin_note: submission.admin_note || '',
    submitted_at: submission.submitted_at || null,
    payload: parseJson(submission.payload_json),
  };
}

async function ownerContext(svc: any, user: any, anchorLocationId: string) {
  if (!anchorLocationId) return { error: 'Locatia curenta este obligatorie', status: 400 };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: anchorLocationId,
    status: 'active',
  }, '-created_date', 20);
  const ownerMembership = memberships.find((membership: any) => normalizeRole(membership.role) === 'organization_owner');
  if (!ownerMembership) return { error: 'Doar ownerul organizatiei poate asocia o locatie existenta', status: 403 };
  const anchor = await svc.entities.ProviderLocation.get(anchorLocationId).catch(() => null);
  if (!anchor) return { error: 'Locatia curenta nu a fost gasita', status: 404 };
  const organizationId = anchor.organization_id || ownerMembership.organization_id || '';
  if (!organizationId) return { error: 'Organizatia nu a putut fi determinata', status: 409 };
  const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
  return { anchor, organization, organizationId };
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

async function providerGet(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await ownerContext(svc, user, clean(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: context.anchor.id,
    organization_id: context.organizationId,
    access_origin: 'provider_workspace',
    section: SECTION,
    item_key: EXISTING_ITEM_KEY,
    submitted_by_user_id: user.id,
  }, '-created_date', 20);
  const active = rows.find((row: any) => ACTIVE_STATUSES.includes(row.status)) || null;
  return res({ submission: safeSubmission(active) });
}

async function providerRequestExisting(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await ownerContext(svc, user, clean(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const targetLocationId = clean(payload.target_location_id, 120);
  if (!targetLocationId) return res({ error: 'Selecteaza locatia existenta' }, 400);
  const target = await svc.entities.ProviderLocation.get(targetLocationId).catch(() => null);
  if (!target) return res({ error: 'Locatia selectata nu mai exista' }, 404);
  if (target.active_status === 'inactiva' || ['suspendata', 'arhivata'].includes(target.status) || target.profile_control_status === 'suspended') {
    return res({ error: 'Locatia selectata nu poate fi asociata prin acest flux' }, 409);
  }
  if (target.organization_id === context.organizationId) {
    return res({ success: true, open_existing: true, location_id: target.id });
  }

  const currentOrganization = target.organization_id
    ? await svc.entities.ProviderOrganization.get(target.organization_id).catch(() => null)
    : null;
  const candidate = {
    ...locationSnapshot(target, currentOrganization?.public_display_name || currentOrganization?.name || ''),
    relation: candidateRelation(target.organization_id, context.organizationId),
  };
  const payloadValue = {
    kind: 'associate_existing_location',
    target_location_id: target.id,
    candidate,
    candidates: [candidate],
  };

  const allActive = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: context.anchor.id,
    organization_id: context.organizationId,
    access_origin: 'provider_workspace',
    section: SECTION,
    submitted_by_user_id: user.id,
    status: { $in: ACTIVE_STATUSES },
  }, '-created_date', 20);
  const pending = allActive.find((row: any) => row.status === 'pending_review');
  if (pending) return res({ error: 'Exista deja o solicitare de locatie in verificare' }, 409);
  const existing = allActive.find((row: any) => ['draft', 'needs_more_info'].includes(row.status)) || null;
  const data = {
    item_key: EXISTING_ITEM_KEY,
    payload_json: JSON.stringify(payloadValue),
    status: 'draft',
    admin_note: '',
  };
  const submission = existing
    ? await svc.entities.ProviderWorkspaceSubmission.update(existing.id, data)
    : await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: context.organizationId,
        location_id: context.anchor.id,
        access_origin: 'provider_workspace',
        section: SECTION,
        item_key: EXISTING_ITEM_KEY,
        payload_json: JSON.stringify(payloadValue),
        status: 'draft',
        submitted_by_user_id: user.id,
      });
  return res({ success: true, submission: safeSubmission(submission) });
}

async function providerSubmitExisting(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await ownerContext(svc, user, clean(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(clean(payload.submission_id, 120)).catch(() => null);
  if (
    !submission
    || submission.submitted_by_user_id !== user.id
    || submission.organization_id !== context.organizationId
    || submission.location_id !== context.anchor.id
    || submission.section !== SECTION
    || submission.item_key !== EXISTING_ITEM_KEY
  ) return res({ error: 'Solicitarea nu a fost gasita' }, 404);
  if (!['draft', 'needs_more_info'].includes(submission.status)) return res({ error: 'Solicitarea nu poate fi trimisa' }, 409);
  const parsed = parseJson(submission.payload_json);
  const target = await svc.entities.ProviderLocation.get(clean(parsed.target_location_id, 120)).catch(() => null);
  if (!target) return res({ error: 'Profilul existent nu mai este disponibil' }, 409);
  const now = new Date().toISOString();
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
    status: 'pending_review',
    submitted_at: now,
    admin_note: '',
  });
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'submit_existing_location_association',
    changed_fields: ['status', 'submitted_at'],
    previous: { status: submission.status },
    next: { status: 'pending_review', target_location_id: target.id, organization_id: context.organizationId },
    note: 'Ownerul a solicitat asocierea unui profil existent.',
  });
  return res({ success: true });
}

async function adminList(svc: any, user: any) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
    access_origin: 'provider_workspace',
    section: SECTION,
    item_key: EXISTING_ITEM_KEY,
    status: 'pending_review',
  }, '-submitted_at', 100);
  const submissions = [];
  for (const row of rows) {
    const parsed = parseJson(row.payload_json);
    const target = await svc.entities.ProviderLocation.get(clean(parsed.target_location_id, 120)).catch(() => null);
    const destinationOrganization = row.organization_id
      ? await svc.entities.ProviderOrganization.get(row.organization_id).catch(() => null)
      : null;
    const currentOrganization = target?.organization_id
      ? await svc.entities.ProviderOrganization.get(target.organization_id).catch(() => null)
      : null;
    const anchor = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
    submissions.push({
      id: row.id,
      item_key: row.item_key,
      submitted_at: row.submitted_at || null,
      organization: {
        id: row.organization_id || '',
        name: destinationOrganization?.public_display_name || destinationOrganization?.name || anchor?.organization_name || 'Organizatie',
      },
      anchor_location: anchor ? locationSnapshot(anchor) : null,
      payload: {
        ...parsed,
        candidate: target
          ? {
              ...locationSnapshot(target, currentOrganization?.public_display_name || currentOrganization?.name || ''),
              relation: candidateRelation(target.organization_id, row.organization_id),
            }
          : parsed.candidate || null,
      },
    });
  }
  return res({ submissions });
}

async function destinationOwners(svc: any, organizationId: string) {
  const memberships = await svc.entities.ProviderMembership.filter({ organization_id: organizationId }, '-created_date', 1000);
  return [...new Set(memberships
    .filter((membership: any) => membership.status === 'active' && normalizeRole(membership.role) === 'organization_owner')
    .map((membership: any) => membership.user_id)
    .filter(Boolean))];
}

async function propagateOwners(svc: any, organizationId: string, locationId: string, actorId: string) {
  const owners = await destinationOwners(svc, organizationId);
  const locationMemberships = await svc.entities.ProviderMembership.filter({ location_id: locationId }, '-created_date', 500);
  const touched: string[] = [];
  for (const ownerUserId of owners) {
    const existing = locationMemberships.find((membership: any) => membership.user_id === ownerUserId);
    if (!existing) {
      const created = await svc.entities.ProviderMembership.create({
        user_id: ownerUserId,
        organization_id: organizationId,
        location_id: locationId,
        role: 'organization_owner',
        status: 'active',
      });
      touched.push(created.id);
    } else if (existing.status !== 'active' || normalizeRole(existing.role) !== 'organization_owner' || existing.organization_id !== organizationId) {
      await svc.entities.ProviderMembership.update(existing.id, {
        organization_id: organizationId,
        role: 'organization_owner',
        status: 'active',
        reactivated_by_user_id: actorId,
        reactivated_at: new Date().toISOString(),
      });
      touched.push(existing.id);
    }
  }
  return touched;
}

async function deactivatePreviousMemberships(svc: any, locationId: string, destinationOrganizationId: string, actorId: string) {
  const memberships = await svc.entities.ProviderMembership.filter({ location_id: locationId, status: 'active' }, '-created_date', 500);
  const now = new Date().toISOString();
  const deactivated: string[] = [];
  for (const membership of memberships) {
    if (membership.organization_id === destinationOrganizationId) continue;
    await svc.entities.ProviderMembership.update(membership.id, {
      status: 'inactive',
      deactivated_by_user_id: actorId,
      deactivated_at: now,
    });
    deactivated.push(membership.id);
  }
  return deactivated;
}

async function archiveEmptyOrganization(svc: any, organizationId: string, now: string) {
  if (!organizationId) return null;
  const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
  if (!organization) return null;
  const remaining = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
  const hasActive = remaining.some((location: any) => location.active_status !== 'inactiva' && !['arhivata', 'suspendata'].includes(location.status));
  if (hasActive) return null;
  await svc.entities.ProviderOrganization.update(organizationId, {
    status: 'inactiva',
    public_visibility_status: 'archived',
    profile_updated_at: now,
  });
  return { organization_id: organizationId, status: 'inactiva', public_visibility_status: 'archived' };
}

function candidateList(parsed: any) {
  if (Array.isArray(parsed.duplicate_candidates)) return parsed.duplicate_candidates;
  if (Array.isArray(parsed.candidates)) return parsed.candidates;
  if (parsed.candidate) return [parsed.candidate];
  return [];
}

async function approveExistingResolution(svc: any, user: any, submission: any, parsed: any, payload: Record<string, unknown>) {
  const destinationOrganizationId = clean(submission.organization_id, 120);
  if (!destinationOrganizationId) return res({ error: 'Organizatia destinatie lipseste' }, 409);
  const targetLocationId = clean(payload.target_location_id || parsed.target_location_id, 120);
  const target = await svc.entities.ProviderLocation.get(targetLocationId).catch(() => null);
  if (!target) return res({ error: 'Profilul existent nu mai este disponibil' }, 404);
  if (target.active_status === 'inactiva' || ['suspendata', 'arhivata'].includes(target.status) || target.profile_control_status === 'suspended') {
    return res({ error: 'Profilul existent nu este eligibil pentru asociere' }, 409);
  }

  const note = clean(payload.note, 1000);
  const validation = validateLocationResolution({
    kind: parsed.kind,
    resolutionMode: payload.resolution_mode,
    targetLocationId,
    candidates: candidateList(parsed),
    targetOrganizationId: target.organization_id,
    submissionOrganizationId: destinationOrganizationId,
    confirmCrossOrganizationTransfer: payload.confirm_cross_organization_transfer === true,
    confirmSeparateLocation: payload.confirm_separate_location === true,
    note,
  });
  if (!validation.ok) return res({ error: validation.error }, 400);
  if (validation.mode === 'create_new') return res({ error: 'Rezolutia selectata nu foloseste un profil existent' }, 400);

  const previousOrganizationId = target.organization_id || '';
  const relation = candidateRelation(previousOrganizationId, destinationOrganizationId);
  const previous = {
    organization_id: previousOrganizationId,
    status: target.status,
    active_status: target.active_status,
    public_visibility_status: target.public_visibility_status,
    profile_control_status: target.profile_control_status,
    claim_verification_status: target.claim_verification_status,
  };
  const now = new Date().toISOString();
  const deactivatedMembershipIds = relation === 'other_organization'
    ? await deactivatePreviousMemberships(svc, target.id, destinationOrganizationId, user.id)
    : [];
  const updates = {
    organization_id: destinationOrganizationId,
    status: 'publicata',
    active_status: 'activa',
    public_visibility_status: 'approved',
    profile_control_status: 'verified',
    claim_verification_status: 'approved',
    verification_state: 'verified',
    is_verified: true,
    data_source: target.data_source === 'public_source' ? 'claim' : target.data_source || 'claim',
    profile_control_status_updated_at: now,
    profile_control_status_reason: relation === 'other_organization'
      ? 'Transfer intre organizatii aprobat administrativ'
      : 'Profil existent asociat organizatiei',
    last_confirmed_at: now,
    last_verified_at: now,
  };
  await svc.entities.ProviderLocation.update(target.id, updates);
  const ownerMembershipIds = await propagateOwners(svc, destinationOrganizationId, target.id, user.id);
  const previousOrganizationUpdate = relation === 'other_organization'
    ? await archiveEmptyOrganization(svc, previousOrganizationId, now)
    : null;
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
    status: 'approved',
    reviewed_by_user_id: user.id,
    reviewed_at: now,
    admin_note: note,
    applied_entity_id: target.id,
  });
  await audit(svc, user, {
    entity_type: 'ProviderLocation',
    entity_id: target.id,
    action_type: relation === 'other_organization' ? 'transfer_existing_location_to_organization' : 'associate_existing_location_to_organization',
    changed_fields: ['organization_id', 'status', 'public_visibility_status', 'profile_control_status', 'memberships'],
    previous,
    next: {
      ...updates,
      relation,
      owner_membership_ids: ownerMembershipIds,
      deactivated_membership_ids: deactivatedMembershipIds,
      previous_organization_update: previousOrganizationUpdate,
    },
    note,
  });
  return res({
    success: true,
    location_id: target.id,
    resolution_mode: validation.mode,
    relation,
    owner_memberships: ownerMembershipIds.length,
    deactivated_memberships: deactivatedMembershipIds.length,
  });
}

async function adminDecide(base44: any, svc: any, user: any, payload: Record<string, unknown>) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const action = clean(payload.action, 40);
  const note = clean(payload.note, 1000);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(clean(payload.submission_id, 120)).catch(() => null);
  if (!submission || submission.section !== SECTION || ![NEW_ITEM_KEY, EXISTING_ITEM_KEY].includes(submission.item_key)) {
    return res({ error: 'Solicitarea nu a fost gasita' }, 404);
  }
  if (submission.status !== 'pending_review') return res({ error: 'Solicitarea nu mai este in verificare' }, 409);
  if (!['approve', 'request_more_info', 'reject'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
  if (action !== 'approve' && !note) return res({ error: 'Nota este obligatorie' }, 400);

  if (action !== 'approve') {
    const status = action === 'request_more_info' ? 'needs_more_info' : 'rejected';
    const now = new Date().toISOString();
    await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
      status,
      reviewed_by_user_id: user.id,
      reviewed_at: now,
      admin_note: note,
    });
    await audit(svc, user, {
      entity_type: 'ProviderWorkspaceSubmission',
      entity_id: submission.id,
      action_type: action === 'request_more_info' ? 'request_location_identity_information' : 'reject_location_identity_request',
      changed_fields: ['status', 'admin_note'],
      previous: { status: submission.status },
      next: { status },
      note,
    });
    return res({ success: true, status });
  }

  const parsed = parseJson(submission.payload_json);
  const candidates = candidateList(parsed);
  const resolutionMode = clean(payload.resolution_mode, 60)
    || (parsed.kind === 'associate_existing_location' ? 'use_existing' : 'create_new');

  if (resolutionMode === 'create_new') {
    const validation = validateLocationResolution({
      kind: parsed.kind,
      resolutionMode,
      candidates,
      confirmSeparateLocation: payload.confirm_separate_location === true,
      note,
    });
    if (!validation.ok) return res({ error: validation.error }, 400);
    const delegated = await invokeConsolidatedFunction(base44, 'providerLocationExpansionOps', {
      action: 'approve',
      submission_id: submission.id,
      note,
    });
    const data = delegated?.data || delegated || {};
    return data.error ? res({ error: data.error }, 400) : res(data);
  }

  return approveExistingResolution(svc, user, submission, parsed, {
    ...payload,
    resolution_mode: resolutionMode,
  });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = clean(payload.action, 60);
    if (action === 'get') return providerGet(svc, user, payload);
    if (action === 'request_existing') return providerRequestExisting(svc, user, payload);
    if (action === 'submit_existing') return providerSubmitExisting(svc, user, payload);
    if (action === 'admin_list') return adminList(svc, user);
    if (['approve', 'request_more_info', 'reject'].includes(action)) return adminDecide(base44, svc, user, payload);
    return res({ error: 'Actiune necunoscuta' }, 400);
  } catch (error) {
    return res({ error: error instanceof Error ? error.message : 'Eroare neasteptata' }, 500);
  }
}
