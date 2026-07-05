import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1 Part 3 — Provider Workspace draft/submit/withdraw.
// Creates ProviderWorkspaceSubmission drafts for public_profile and
// location_details only. No public profile changes until admin approval.
// services / team / media / article sections exist as enum values but are
// NOT writable in this module.

const WRITABLE_SECTIONS = ['public_profile', 'location_details'];

const SECTION_FIELDS = {
  public_profile: ['public_display_name', 'public_description', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'public_phone', 'public_email'],
  location_details: ['address', 'public_display_name', 'public_phone', 'public_email'],
};

const MAX_FIELD_LEN = 2000;

// Strict allowlist validation — unknown keys are silently stripped, never trusted.
function validatePayload(section, payload) {
  const allowed = SECTION_FIELDS[section];
  if (!allowed) return { valid: false, error: 'Sectiunea nu este disponibila pentru editare' };
  const clean = {};
  for (const key of Object.keys(payload || {})) {
    if (!allowed.includes(key)) continue;
    const val = payload[key];
    if (val === null || val === undefined) { clean[key] = ''; continue; }
    if (typeof val !== 'string') return { valid: false, error: `${key} trebuie sa fie text` };
    if (val.length > MAX_FIELD_LEN) return { valid: false, error: `${key} depaseste lungimea maxima` };
    clean[key] = val.trim();
  }
  return { valid: true, clean };
}

// Provider-safe submission view — reviewed_by_user_id never leaks.
function sanitizeSubmission(sub) {
  const showNote = ['needs_more_info', 'rejected'].includes(sub.status);
  return {
    id: sub.id,
    organization_id: sub.organization_id || null,
    location_id: sub.location_id,
    section: sub.section,
    status: sub.status,
    payload_json: sub.payload_json || '{}',
    submitted_at: sub.submitted_at || null,
    admin_note: showNote ? (sub.admin_note || '') : '',
    created_date: sub.created_date,
    updated_date: sub.updated_date,
  };
}

async function audit(svc, user, rec) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: rec.entity_type,
    entity_id: rec.entity_id || '',
    action_type: rec.action_type,
    changed_fields: rec.changed_fields || [],
    previous_values: JSON.stringify(rec.previous || {}),
    new_values: JSON.stringify(rec.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: rec.note || '',
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    const action = p.action; // list_mine | create_draft | update_draft | submit | withdraw
    if (!['list_mine', 'create_draft', 'update_draft', 'submit', 'withdraw'].includes(action)) {
      return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    }

    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    // Verify active membership for this location.
    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id, location_id: p.location_id, status: 'active',
    });
    if (memberships.length === 0) {
      return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (loc.profile_control_status === 'suspended') {
      return Response.json({ error: 'Profilul este suspendat' }, { status: 403 });
    }

    // === LIST MINE ===
    if (action === 'list_mine') {
      const subs = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: p.location_id,
      }, '-created_date', 50);
      return Response.json({ submissions: subs.map(sanitizeSubmission) });
    }

    // All remaining actions require a valid writable section.
    if (!p.section || !WRITABLE_SECTIONS.includes(p.section)) {
      return Response.json({ error: 'Aceasta sectiune nu este disponibila inca' }, { status: 400 });
    }

    // === CREATE DRAFT ===
    if (action === 'create_draft') {
      if (!p.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });
      const result = validatePayload(p.section, p.payload);
      if (!result.valid) return Response.json({ error: result.error }, { status: 400 });

      // One active draft per section per location per user.
      const existing = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: p.location_id, section: p.section,
        submitted_by_user_id: user.id, status: 'draft',
      });
      if (existing.length > 0) {
        return Response.json({ error: 'Exista deja o ciorna pentru aceasta sectiune', submission_id: existing[0].id }, { status: 400 });
      }

      const sub = await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: loc.organization_id || null,
        location_id: p.location_id,
        section: p.section,
        payload_json: JSON.stringify(result.clean),
        status: 'draft',
        submitted_by_user_id: user.id,
      });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'create_draft', changed_fields: ['section', 'status', 'payload_json'],
        next: { section: p.section, status: 'draft' },
        note: `Draft creat pentru sectiunea ${p.section}`,
      });

      return Response.json({ submission: sanitizeSubmission(sub) });
    }

    // === UPDATE DRAFT ===
    if (action === 'update_draft') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      if (!p.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });

      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Draftul nu a fost gasit' }, { status: 404 });
      if (sub.location_id !== p.location_id) return Response.json({ error: 'Draftul nu apartine acestei locatii' }, { status: 403 });
      if (sub.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti modifica acest draft' }, { status: 403 });
      if (sub.status !== 'draft' && sub.status !== 'needs_more_info') {
        return Response.json({ error: 'Doar drafturile pot fi modificate' }, { status: 400 });
      }

      const result = validatePayload(p.section, p.payload);
      if (!result.valid) return Response.json({ error: result.error }, { status: 400 });

      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, {
        payload_json: JSON.stringify(result.clean),
        status: 'draft', // needs_more_info → back to draft on edit
      });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'update_draft', changed_fields: ['payload_json', 'status'],
        previous: { status: sub.status },
        note: `Draft actualizat pentru sectiunea ${p.section}`,
      });

      return Response.json({ success: true });
    }

    // === SUBMIT ===
    if (action === 'submit') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });

      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Draftul nu a fost gasit' }, { status: 404 });
      if (sub.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti trimite acest draft' }, { status: 403 });
      if (sub.status !== 'draft' && sub.status !== 'needs_more_info') {
        return Response.json({ error: 'Draftul nu poate fi trimis' }, { status: 400 });
      }

      const now = new Date().toISOString();
      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, {
        status: 'pending_review', submitted_at: now,
      });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'submit_for_review', changed_fields: ['status', 'submitted_at'],
        previous: { status: sub.status }, next: { status: 'pending_review' },
        note: `Submission trimisa pentru sectiunea ${sub.section}`,
      });

      return Response.json({ success: true });
    }

    // === WITHDRAW ===
    if (action === 'withdraw') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });

      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti retrage aceasta submission' }, { status: 403 });
      if (!['draft', 'pending_review', 'needs_more_info'].includes(sub.status)) {
        return Response.json({ error: 'Submission nu poate fi retrasa' }, { status: 400 });
      }

      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { status: 'withdrawn' });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'withdraw_submission', changed_fields: ['status'],
        previous: { status: sub.status }, next: { status: 'withdrawn' },
        note: `Submission retrasa pentru sectiunea ${sub.section}`,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});