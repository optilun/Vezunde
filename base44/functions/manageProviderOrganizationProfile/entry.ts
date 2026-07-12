import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  hasPublishedSectionChanges,
  sameSubmissionPayload,
} from '../../../shared/providerWorkspaceSubmissionComparison.js';

// Deployment revision: provider-location-noop-2026-07-12
const ACTIVE_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const EDITABLE_STATUSES = ['draft', 'needs_more_info'];
const FIELDS = ['public_display_name', 'public_description', 'public_phone', 'public_email', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url'];
const MAX_DESCRIPTION = 500;
const MAX_FIELD = 1000;

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value ?? '').trim(); }
function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  return ['organization_owner', 'location_manager', 'location_staff'].includes(value) ? value : '';
}
function safeSubmission(submission) {
  return {
    id: submission.id,
    organization_id: submission.organization_id || null,
    location_id: submission.location_id || null,
    section: submission.section,
    status: submission.status,
    payload_json: submission.payload_json || '{}',
    submitted_at: submission.submitted_at || null,
    reviewed_at: submission.reviewed_at || null,
    admin_note: submission.admin_note || '',
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Payload invalid' };
  const unknown = Object.keys(payload).filter((key) => !FIELDS.includes(key));
  if (unknown.length > 0) return { error: 'Camp nepermis', fields: unknown };
  const values = {};
  for (const key of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = clean(payload[key]);
    const max = key === 'public_description' ? MAX_DESCRIPTION : MAX_FIELD;
    if (value.length > max) return { error: `${key} depaseste lungimea maxima` };
    if (/[<>]/.test(value) || /\b(?:javascript|data|vbscript|file):/i.test(value)) return { error: `${key} contine continut nepermis` };
    if (key === 'public_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: 'Email general invalid' };
    if (key === 'public_phone' && value && !/^[0-9+().\-\s]{6,80}$/.test(value)) return { error: 'Telefon general invalid' };
    if (['website_url', 'facebook_url', 'instagram_url', 'linkedin_url'].includes(key) && value) {
      const normalized = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
      let parsed;
      try { parsed = new URL(normalized); } catch (_error) { return { error: `${key} trebuie sa fie un link valid` }; }
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) return { error: `${key} trebuie sa fie un link web valid` };
      values[key] = parsed.toString();
      continue;
    }
    values[key] = value;
  }
  if (Object.keys(values).length === 0) return { error: 'Payload gol' };
  return { values };
}

function parsePayload(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function sortActive(rows) {
  const priority = { pending_review: 3, needs_more_info: 2, draft: 1 };
  return [...rows].sort((left, right) => {
    const statusDiff = (priority[right.status] || 0) - (priority[left.status] || 0);
    if (statusDiff !== 0) return statusDiff;
    const leftTime = new Date(left.created_date || 0).getTime();
    const rightTime = new Date(right.created_date || 0).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.id).localeCompare(String(right.id));
  });
}

async function resolveOwnerAccess(svc, user, organizationId, anchorLocationId) {
  const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
  if (!organization) return { error: 'Organizatia nu a fost gasita', status: 404 };
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, organization_id: organizationId, status: 'active' }, '-created_date', 500);
  const ownerMemberships = memberships.filter((membership) => normalizeRole(membership.role) === 'organization_owner');
  if (user.role !== 'admin' && ownerMemberships.length === 0) return { error: 'Doar ownerul organizatiei poate modifica profilul general', status: 403 };
  let anchorLocation = anchorLocationId ? await svc.entities.ProviderLocation.get(anchorLocationId).catch(() => null) : null;
  if (!anchorLocation || anchorLocation.organization_id !== organizationId) {
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 10);
    anchorLocation = locations[0] || null;
  }
  if (!anchorLocation) return { error: 'Organizatia nu are nicio locatie asociata', status: 400 };
  return { organization, anchorLocation };
}

async function audit(svc, user, submission, actionType, previous, next, note = 'Profil general organizatie') {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: actionType,
    changed_fields: ['public_profile'],
    previous_values: JSON.stringify(previous || {}),
    new_values: JSON.stringify(next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note,
    performed_at: new Date().toISOString(),
  });
}

async function listActive(svc, organizationId) {
  const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
    organization_id: organizationId,
    section: 'public_profile',
    access_origin: 'provider_workspace',
    status: { $in: ACTIVE_STATUSES },
  }, '-created_date', 50);
  return sortActive(rows);
}

async function withdrawDuplicateDrafts(svc, user, rows, keeperId) {
  for (const row of rows) {
    if (row.id === keeperId || !ACTIVE_STATUSES.includes(row.status)) continue;
    await svc.entities.ProviderWorkspaceSubmission.update(row.id, { status: 'withdrawn' });
    await audit(
      svc,
      user,
      row,
      'withdraw_duplicate_organization_profile_draft',
      { status: row.status },
      { status: 'withdrawn' },
      'Draft organizational duplicat inchis automat',
    );
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action);
    const organizationId = clean(input.organization_id);
    if (!organizationId) return res({ error: 'organization_id este obligatoriu' }, 400);
    if (!['list_mine', 'create_draft', 'update_draft', 'submit', 'withdraw'].includes(action)) return res({ error: 'Actiune invalida' }, 400);

    const access = await resolveOwnerAccess(svc, user, organizationId, clean(input.location_id || input.anchor_location_id));
    if (access.error) return res({ error: access.error }, access.status);

    if (action === 'list_mine') {
      const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
        organization_id: organizationId,
        section: 'public_profile',
        access_origin: 'provider_workspace',
        submitted_by_user_id: user.id,
      }, '-created_date', 100);
      return res({ submissions: rows.map(safeSubmission) });
    }

    if (action === 'create_draft') {
      const validation = validatePayload(input.payload);
      if (validation.error) return res(validation, 400);
      if (!hasPublishedSectionChanges('public_profile', validation.values, access.organization)) {
        return res({ success: true, no_changes: true, message: 'Nu exista modificari noi de salvat.' });
      }

      const active = await listActive(svc, organizationId);
      const ownRows = active.filter((submission) => submission.submitted_by_user_id === user.id);
      const own = ownRows[0] || null;
      if (own) {
        await withdrawDuplicateDrafts(svc, user, ownRows.slice(1), own.id);
        const identical = sameSubmissionPayload('public_profile', parsePayload(own.payload_json), validation.values);
        if (own.status === 'pending_review') {
          if (identical) return res({ submission: safeSubmission(own), resumed: true, duplicate: true, message: 'Aceasta modificare este deja in verificare.' });
          return res({ error: 'Exista deja o modificare trimisa spre verificare pentru profilul organizatiei.' }, 409);
        }
        if (identical) return res({ submission: safeSubmission(own), resumed: true, unchanged: true, message: 'Draftul existent a fost incarcat.' });
        const updated = await svc.entities.ProviderWorkspaceSubmission.update(own.id, {
          payload_json: JSON.stringify(validation.values),
          status: 'draft',
          admin_note: '',
        });
        await audit(svc, user, updated, 'update_organization_profile_draft', parsePayload(own.payload_json), validation.values);
        return res({ submission: safeSubmission(updated), resumed: true, updated: true });
      }
      if (active.length > 0) return res({ error: 'Exista deja o modificare activa pentru profilul organizatiei' }, 409);

      const submission = await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: organizationId,
        location_id: access.anchorLocation.id,
        access_origin: 'provider_workspace',
        section: 'public_profile',
        item_key: `organization:${organizationId}`,
        payload_json: JSON.stringify(validation.values),
        status: 'draft',
        submitted_by_user_id: user.id,
      });

      // Re-read after create so two near-simultaneous requests converge on one active row.
      const activeAfterCreate = await listActive(svc, organizationId);
      const keeper = activeAfterCreate[0] || submission;
      if (keeper.id !== submission.id) {
        await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
        if (keeper.submitted_by_user_id === user.id && sameSubmissionPayload('public_profile', parsePayload(keeper.payload_json), validation.values)) {
          return res({ submission: safeSubmission(keeper), resumed: true, duplicate: true, message: keeper.status === 'pending_review' ? 'Aceasta modificare este deja in verificare.' : 'Draftul existent a fost incarcat.' });
        }
        return res({ error: 'Exista deja o alta modificare activa pentru profilul organizatiei.' }, 409);
      }

      await audit(svc, user, submission, 'create_organization_profile_draft', {}, validation.values);
      return res({ submission: safeSubmission(submission) });
    }

    const submissionId = clean(input.submission_id);
    if (!submissionId) return res({ error: 'submission_id este obligatoriu' }, 400);
    const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
    if (!submission || submission.organization_id !== organizationId || submission.section !== 'public_profile') return res({ error: 'Draftul nu apartine acestei organizatii' }, 403);
    if (submission.submitted_by_user_id !== user.id && user.role !== 'admin') return res({ error: 'Nu poti modifica acest draft' }, 403);

    if (action === 'update_draft') {
      if (!EDITABLE_STATUSES.includes(submission.status)) return res({ error: 'Doar drafturile editabile pot fi modificate' }, 400);
      const validation = validatePayload(input.payload);
      if (validation.error) return res(validation, 400);
      const previous = parsePayload(submission.payload_json);
      if (!hasPublishedSectionChanges('public_profile', validation.values, access.organization)) {
        const updated = await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
        await audit(svc, user, updated, 'discard_noop_organization_profile_draft', { status: submission.status, payload: previous }, { status: 'withdrawn' }, 'Draft organizational inchis deoarece nu continea modificari fata de profilul publicat');
        return res({ success: true, no_changes: true, message: 'Nu exista modificari noi de salvat. Draftul a fost inchis.' });
      }
      if (submission.status === 'draft' && sameSubmissionPayload('public_profile', previous, validation.values)) {
        return res({ submission: safeSubmission(submission), unchanged: true, message: 'Draftul existent a fost incarcat.' });
      }

      const active = (await listActive(svc, organizationId)).filter((row) => row.id !== submission.id);
      const blocking = active.find((row) => row.status === 'pending_review' || row.submitted_by_user_id !== user.id);
      if (blocking) return res({ error: 'Exista deja o alta modificare activa pentru profilul organizatiei.' }, 409);
      await withdrawDuplicateDrafts(svc, user, active, submission.id);

      const updated = await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        payload_json: JSON.stringify(validation.values),
        status: 'draft',
        admin_note: '',
      });
      await audit(svc, user, updated, 'update_organization_profile_draft', previous, validation.values);
      return res({ submission: safeSubmission(updated) });
    }

    if (action === 'submit') {
      if (submission.status === 'pending_review') {
        return res({ submission: safeSubmission(submission), duplicate: true, message: 'Aceasta modificare este deja in verificare.' });
      }
      if (!EDITABLE_STATUSES.includes(submission.status)) return res({ error: 'Draftul nu poate fi trimis in acest status' }, 400);
      const values = parsePayload(submission.payload_json);
      if (!hasPublishedChanges(access.organization, values)) {
        const updated = await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
        await audit(svc, user, updated, 'discard_noop_organization_profile_submission', { status: submission.status }, { status: 'withdrawn' }, 'Trimitere organizationala inchisa deoarece datele sunt deja publicate');
        return res({ success: true, no_changes: true, message: 'Datele sunt deja publicate. Nu a fost creata o cerere noua.' });
      }

      const active = (await listActive(svc, organizationId)).filter((row) => row.id !== submission.id);
      const blocking = active.find((row) => row.status === 'pending_review' || row.submitted_by_user_id !== user.id);
      if (blocking) return res({ error: 'Exista deja o alta modificare in verificare pentru profilul organizatiei.' }, 409);
      await withdrawDuplicateDrafts(svc, user, active, submission.id);

      const updated = await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
        admin_note: '',
      });
      await audit(svc, user, updated, 'submit_organization_profile_review', { status: submission.status }, { status: 'pending_review' });
      return res({ submission: safeSubmission(updated) });
    }

    if (!EDITABLE_STATUSES.includes(submission.status)) return res({ error: 'Doar un draft poate fi retras' }, 400);
    const updated = await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
    await audit(svc, user, updated, 'withdraw_organization_profile_draft', { status: submission.status }, { status: 'withdrawn' });
    return res({ submission: safeSubmission(updated) });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});