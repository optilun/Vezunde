import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FIELDS = ['public_display_name', 'public_description', 'public_phone', 'public_email', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url'];

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value ?? '').trim(); }
function parsePayload(value) { try { return JSON.parse(value || '{}'); } catch (_error) { return {}; } }

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Payload invalid' };
  const unknown = Object.keys(payload).filter((key) => !FIELDS.includes(key));
  if (unknown.length > 0) return { error: 'Camp nepermis', fields: unknown };
  const values = {};
  for (const key of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = clean(payload[key]);
    if (value.length > (key === 'public_description' ? 500 : 1000)) return { error: `${key} depaseste lungimea maxima` };
    values[key] = value;
  }
  return { values };
}

function computeCompleteness(organization) {
  const items = [
    !!clean(organization.public_display_name),
    !!clean(organization.public_description),
    !!(clean(organization.public_phone) || clean(organization.public_email)),
    !!(
      clean(organization.website_url || organization.website)
      || clean(organization.facebook_url)
      || clean(organization.instagram_url)
      || clean(organization.linkedin_url)
    ),
    !!clean(organization.logo_url),
  ];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
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
    admin_email: user.email,
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

async function loadSubmission(svc, submissionId) {
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
  if (!submission || submission.section !== 'public_profile' || !submission.organization_id) return null;
  return submission;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return res({ error: 'Acces permis doar administratorilor Vezunde' }, 403);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list');

    if (action === 'list') {
      const query: Record<string, unknown> = { section: 'public_profile' };
      if (input.status) query.status = input.status;
      if (input.organization_id) query.organization_id = input.organization_id;
      const rows = await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 200);
      const submissions = rows.filter((submission) => !!submission.organization_id);
      return res({ submissions });
    }

    const submissionId = clean(input.submission_id);
    if (!submissionId) return res({ error: 'submission_id este obligatoriu' }, 400);
    const submission = await loadSubmission(svc, submissionId);
    if (!submission) return res({ error: 'Submissionul organizational nu a fost gasit' }, 404);
    const organization = await svc.entities.ProviderOrganization.get(submission.organization_id).catch(() => null);
    if (!organization) return res({ error: 'Organizatia nu a fost gasita' }, 404);

    if (action === 'get') return res({ submission, organization });
    if (!['approve', 'reject', 'request_more_info'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
    if (submission.status !== 'pending_review') return res({ error: 'Submissionul nu este in asteptare' }, 400);
    const note = clean(input.note);
    if (['reject', 'request_more_info'].includes(action) && !note) return res({ error: 'Nota este obligatorie pentru aceasta decizie' }, 400);
    const now = new Date().toISOString();

    if (action === 'approve') {
      const validation = validatePayload(parsePayload(submission.payload_json));
      if (validation.error) return res(validation, 400);
      const previous = Object.fromEntries(FIELDS.map((key) => [key, organization[key] || '']));
      const preview = { ...organization, ...validation.values };
      const normalizedStatus = organization.status === 'inactiva' ? 'inactiva' : 'activa';
      const updates = {
        ...validation.values,
        profile_completeness: computeCompleteness(preview),
        public_visibility_status: 'approved',
        status: normalizedStatus,
        profile_updated_at: now,
      };
      await svc.entities.ProviderOrganization.update(organization.id, updates);
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'approved',
        reviewed_by_user_id: user.id,
        reviewed_at: now,
        admin_note: note,
      });
      await audit(svc, user, {
        entity_type: 'ProviderOrganization',
        entity_id: organization.id,
        action_type: 'approve_organization_profile',
        changed_fields: [...Object.keys(validation.values), 'profile_completeness', 'public_visibility_status', 'status'],
        previous: { ...previous, profile_completeness: organization.profile_completeness || 0, public_visibility_status: organization.public_visibility_status || '', status: organization.status || '' },
        next: updates,
        note,
      });
      return res({ success: true });
    }

    const status = action === 'reject' ? 'rejected' : 'needs_more_info';
    await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
      status,
      reviewed_by_user_id: user.id,
      reviewed_at: now,
      admin_note: note,
    });
    await audit(svc, user, {
      entity_type: 'ProviderWorkspaceSubmission',
      entity_id: submission.id,
      action_type: action === 'reject' ? 'reject_organization_profile' : 'request_more_info_organization_profile',
      changed_fields: ['status', 'admin_note'],
      previous: { status: submission.status },
      next: { status, admin_note: note },
      note,
    });
    return res({ success: true });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});
