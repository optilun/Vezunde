import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1 Part 4 — Admin review actions for ProviderWorkspaceSubmission.
// Admin-only: list, get, approve, reject, request_more_info.
// Approval applies ONLY allowlisted fields for public_profile and location_details.
// services / team / media / article submissions can exist but are NOT applied
// in this module — they will be handled in the next module.

// Payload field → ProviderLocation field mapping per section.
const SECTION_APPLY = {
  public_profile: {
    public_display_name: 'public_display_name',
    public_description: 'public_description',
    website_url: 'website_url',
    facebook_url: 'facebook_url',
    instagram_url: 'instagram_url',
    linkedin_url: 'linkedin_url',
    public_phone: 'public_phone',
    public_email: 'public_email',
  },
  location_details: {
    address: 'address',
    public_display_name: 'public_display_name',
    public_phone: 'public_phone',
    public_email: 'public_email',
  },
};

// Legacy field mirrors kept in sync on apply for backward compatibility.
const LEGACY_MIRRORS = {
  public_description: ['description'],
  website_url: ['website'],
  public_phone: ['phone_public'],
};

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
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const action = p.action;

    // === LIST ===
    if (action === 'list') {
      const query = {};
      if (p.status) query.status = p.status;
      if (p.section) query.section = p.section;
      if (p.location_id) query.location_id = p.location_id;
      if (p.organization_id) query.organization_id = p.organization_id;
      const subs = await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 100);
      return Response.json({ submissions: subs });
    }

    // === GET ===
    if (action === 'get') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      return Response.json({ submission: sub });
    }

    // === APPROVE ===
    if (action === 'approve') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });

      const note = String(p.note || '').trim();
      const now = new Date().toISOString();

      // Apply approved fields to ProviderLocation (only for writable sections).
      const fieldMap = SECTION_APPLY[sub.section];
      if (fieldMap) {
        let payload = {};
        try { payload = JSON.parse(sub.payload_json || '{}'); } catch (_e) { payload = {}; }

        const locUpdates = {};
        for (const [payloadKey, locField] of Object.entries(fieldMap)) {
          if (payloadKey in payload) {
            locUpdates[locField] = payload[payloadKey];
            // Sync legacy mirrors for backward compatibility.
            if (LEGACY_MIRRORS[locField]) {
              for (const legacyField of LEGACY_MIRRORS[locField]) {
                locUpdates[legacyField] = payload[payloadKey];
              }
            }
          }
        }

        if (Object.keys(locUpdates).length > 0) {
          const loc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
          if (loc) {
            const prev = {};
            for (const k of Object.keys(locUpdates)) prev[k] = loc[k];
            await svc.entities.ProviderLocation.update(loc.id, locUpdates);
            await audit(svc, user, {
              entity_type: 'ProviderLocation', entity_id: loc.id,
              action_type: 'apply_workspace_submission',
              changed_fields: Object.keys(locUpdates),
              previous: prev, next: locUpdates,
              note: `Aplicat din submission ${sub.id} (${sub.section})`,
            });
          }
        }
      }
      // services / team / media / article: no application in this module.

      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, {
        status: 'approved', reviewed_by_user_id: user.id, reviewed_at: now, admin_note: note,
      });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'approve_submission',
        changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'],
        previous: { status: sub.status }, next: { status: 'approved' }, note,
      });

      return Response.json({ success: true });
    }

    // === REJECT ===
    if (action === 'reject') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });

      const note = String(p.note || '').trim();
      if (!note) return Response.json({ error: 'Respingerea necesita o nota' }, { status: 400 });

      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, {
        status: 'rejected', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), admin_note: note,
      });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'reject_submission',
        changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'],
        previous: { status: sub.status }, next: { status: 'rejected' }, note,
      });

      return Response.json({ success: true });
    }

    // === REQUEST MORE INFO ===
    if (action === 'request_more_info') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });

      const note = String(p.note || '').trim();
      if (!note) return Response.json({ error: 'Solicitarea de informatii necesita o nota' }, { status: 400 });

      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, {
        status: 'needs_more_info', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), admin_note: note,
      });

      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'request_more_info',
        changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'],
        previous: { status: sub.status }, next: { status: 'needs_more_info' }, note,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});