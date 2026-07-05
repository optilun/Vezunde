import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1/1A/2 — Provider Workspace draft/submit/withdraw.
// Provider-scoped submissions only. One active submission per location+section
// across all users. All payloads are strict allowlists and never public until
// admin approval.

const WRITABLE_SECTIONS = ['public_profile', 'location_details', 'services', 'team', 'media', 'article'];
const ACTIVE_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const MAX_FIELD_LEN = 2000;
const MAX_ARTICLE_BODY = 20000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const SECTION_FIELDS = {
  public_profile: ['public_display_name', 'public_description', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'public_phone', 'public_email'],
  location_details: ['address', 'public_display_name', 'public_phone', 'public_email'],
  services: ['selected_ids', 'removal_ids', 'suggestions'],
  team: ['members', 'removal_professional_ids'],
  media: ['assets', 'removal_media_ids'],
  article: ['title', 'excerpt', 'body', 'cover_media_id', 'author_professional_id'],
};

const CANONICAL_SERVICE_IDS = {
  patient_services: ['eyeglasses', 'frames', 'prescription_lenses', 'contact_lenses', 'optometry_consultation', 'ophthalmology_consultation'],
  investigations: ['oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'corneal_topography'],
  specialties: ['retina_consultation', 'glaucoma_consultation', 'cataract_surgery', 'refractive_surgery', 'pediatric_ophthalmology', 'myopia_management', 'emergency_ophthalmology'],
  technical_activities: ['eyeglasses_adjustment', 'eyeglasses_repair', 'lens_fitting'],
};

const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];
const MEDIA_TYPES = ['logo', 'cover', 'gallery', 'team_photo'];
const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BLOCKED_FILE_EXTENSIONS = ['.exe', '.js', '.msi', '.bat', '.cmd', '.sh', '.php', '.html', '.htm', '.svg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'];

function bad(body, status = 400) {
  return { valid: false, status, body };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function checkUnknown(section, payload) {
  const allowed = SECTION_FIELDS[section];
  if (!allowed) return bad({ error: 'Sectiunea nu este disponibila pentru editare' });
  if (!isPlainObject(payload)) return bad({ error: 'Payload invalid' });
  const keys = Object.keys(payload);
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length > 0) return bad({ error: 'Camp nepermis', fields: unknown });
  if (keys.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, keys };
}

function validateTextPayload(section, payload) {
  const base = checkUnknown(section, payload);
  if (!base.valid) return base;
  const clean = {};
  for (const key of base.keys) {
    const val = payload[key];
    if (val === null || val === undefined) { clean[key] = ''; continue; }
    if (typeof val !== 'string') return bad({ error: `${key} trebuie sa fie text` });
    if (val.length > MAX_FIELD_LEN) return bad({ error: `${key} depaseste lungimea maxima` });
    clean[key] = val.trim();
  }
  return Object.keys(clean).length ? { valid: true, clean } : bad({ error: 'Payload gol' });
}

function validateServiceGroupObject(value, fieldName) {
  if (value === undefined) return { valid: true, clean: {} };
  if (!isPlainObject(value)) return bad({ error: `${fieldName} trebuie sa fie obiect` });
  const unknownGroups = Object.keys(value).filter((group) => !Object.keys(CANONICAL_SERVICE_IDS).includes(group));
  if (unknownGroups.length > 0) return bad({ error: 'Grup de servicii nepermis', fields: unknownGroups });
  const clean = {};
  for (const [group, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) return bad({ error: `${fieldName}.${group} trebuie sa fie lista` });
    const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
    const invalid = unique.filter((id) => !CANONICAL_SERVICE_IDS[group].includes(id));
    if (invalid.length > 0) return bad({ error: 'ID canonic invalid', fields: invalid });
    clean[group] = unique;
  }
  return { valid: true, clean };
}

function validateServices(payload) {
  const base = checkUnknown('services', payload);
  if (!base.valid) return base;
  const selected = validateServiceGroupObject(payload.selected_ids, 'selected_ids');
  if (!selected.valid) return selected;
  const removals = validateServiceGroupObject(payload.removal_ids, 'removal_ids');
  if (!removals.valid) return removals;
  let suggestions = [];
  if (payload.suggestions !== undefined) {
    if (!Array.isArray(payload.suggestions)) return bad({ error: 'suggestions trebuie sa fie lista' });
    suggestions = payload.suggestions.map((s) => {
      if (!isPlainObject(s)) throw new Error('Sugestie invalida');
      const unknown = Object.keys(s).filter((k) => !['group', 'label', 'note'].includes(k));
      if (unknown.length) throw new Error(`Camp nepermis in sugestie: ${unknown.join(', ')}`);
      const group = String(s.group || '').trim();
      const label = String(s.label || '').trim();
      const note = String(s.note || '').trim();
      if (!Object.keys(CANONICAL_SERVICE_IDS).includes(group)) throw new Error('Grup de sugestie invalid');
      if (!label || label.length > 120) throw new Error('Sugestia trebuie sa aiba un nume scurt');
      if (note.length > 500) throw new Error('Nota sugestiei este prea lunga');
      return { group, label, note };
    });
  }
  const hasSelected = Object.values(selected.clean).some((arr) => arr.length > 0);
  const hasRemoved = Object.values(removals.clean).some((arr) => arr.length > 0);
  if (!hasSelected && !hasRemoved && suggestions.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, clean: { selected_ids: selected.clean, removal_ids: removals.clean, suggestions } };
}

function validateTeam(payload, context) {
  const base = checkUnknown('team', payload);
  if (!base.valid) return base;
  const clean = { members: [], removal_professional_ids: [] };
  if (payload.members !== undefined) {
    if (!Array.isArray(payload.members)) return bad({ error: 'members trebuie sa fie lista' });
    for (const member of payload.members) {
      if (!isPlainObject(member)) return bad({ error: 'Membru invalid' });
      const unknown = Object.keys(member).filter((k) => !['professional_id', 'full_name', 'professional_type', 'public_title', 'short_bio', 'photo_media_id', 'visible_on_public_profile', 'assigned_location_ids'].includes(k));
      if (unknown.length > 0) return bad({ error: 'Camp nepermis', fields: unknown });
      const fullName = String(member.full_name || '').trim();
      const professionalType = String(member.professional_type || '').trim();
      const assignedLocationIds = Array.isArray(member.assigned_location_ids) ? [...new Set(member.assigned_location_ids.map((id) => String(id || '').trim()).filter(Boolean))] : [];
      if (!fullName || fullName.length > 160) return bad({ error: 'Numele membrului este obligatoriu si trebuie sa fie scurt' });
      if (!PROFESSIONAL_TYPES.includes(professionalType)) return bad({ error: 'Tip profesional invalid' });
      if (assignedLocationIds.length === 0) return bad({ error: 'assigned_location_ids este obligatoriu' });
      const outsideScope = assignedLocationIds.filter((id) => !context.permittedLocationIds.includes(id));
      if (outsideScope.length > 0) return bad({ error: 'Locatie in afara scopului permis', fields: outsideScope }, 403);
      clean.members.push({
        professional_id: member.professional_id ? String(member.professional_id).trim() : '',
        full_name: fullName,
        professional_type: professionalType,
        public_title: String(member.public_title || '').trim().slice(0, 120),
        short_bio: String(member.short_bio || '').trim().slice(0, 1000),
        photo_media_id: member.photo_media_id ? String(member.photo_media_id).trim() : '',
        visible_on_public_profile: member.visible_on_public_profile !== false,
        assigned_location_ids: assignedLocationIds,
      });
    }
  }
  if (payload.removal_professional_ids !== undefined) {
    if (!Array.isArray(payload.removal_professional_ids)) return bad({ error: 'removal_professional_ids trebuie sa fie lista' });
    clean.removal_professional_ids = [...new Set(payload.removal_professional_ids.map((id) => String(id || '').trim()).filter(Boolean))];
  }
  if (clean.members.length === 0 && clean.removal_professional_ids.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, clean };
}

function validateMedia(payload) {
  const base = checkUnknown('media', payload);
  if (!base.valid) return base;
  const clean = { assets: [], removal_media_ids: [] };
  if (payload.assets !== undefined) {
    if (!Array.isArray(payload.assets)) return bad({ error: 'assets trebuie sa fie lista' });
    for (const asset of payload.assets) {
      if (!isPlainObject(asset)) return bad({ error: 'Asset media invalid' });
      const unknown = Object.keys(asset).filter((k) => !['storage_reference', 'media_type', 'caption', 'alt_text', 'sort_order', 'file_name', 'content_type', 'size_bytes'].includes(k));
      if (unknown.length > 0) return bad({ error: 'Camp nepermis', fields: unknown });
      const storageReference = String(asset.storage_reference || '').trim();
      const mediaType = String(asset.media_type || '').trim();
      const fileName = String(asset.file_name || '').trim().toLowerCase();
      const contentType = String(asset.content_type || '').trim().toLowerCase();
      const sizeBytes = Number(asset.size_bytes || 0);
      if (!storageReference || storageReference.length > 1000) return bad({ error: 'storage_reference invalid' });
      if (!MEDIA_TYPES.includes(mediaType)) return bad({ error: 'media_type invalid' });
      if (!IMAGE_CONTENT_TYPES.includes(contentType)) return bad({ error: 'Fisierul trebuie sa fie imagine' });
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) return bad({ error: 'Dimensiune fisier invalida' });
      if (BLOCKED_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext))) return bad({ error: 'Format fisier nepermis' });
      clean.assets.push({
        storage_reference: storageReference,
        media_type: mediaType,
        caption: String(asset.caption || '').trim().slice(0, 300),
        alt_text: String(asset.alt_text || '').trim().slice(0, 300),
        sort_order: Number.isFinite(Number(asset.sort_order)) ? Number(asset.sort_order) : 0,
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
      });
    }
  }
  if (payload.removal_media_ids !== undefined) {
    if (!Array.isArray(payload.removal_media_ids)) return bad({ error: 'removal_media_ids trebuie sa fie lista' });
    clean.removal_media_ids = [...new Set(payload.removal_media_ids.map((id) => String(id || '').trim()).filter(Boolean))];
  }
  if (clean.assets.length === 0 && clean.removal_media_ids.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, clean };
}

function validateArticle(payload) {
  const base = checkUnknown('article', payload);
  if (!base.valid) return base;
  const title = String(payload.title || '').trim();
  const excerpt = String(payload.excerpt || '').trim();
  const body = String(payload.body || '').trim();
  if (!title || title.length > 180) return bad({ error: 'Titlul este obligatoriu si trebuie sa fie scurt' });
  if (!body || body.length > MAX_ARTICLE_BODY) return bad({ error: 'Articolul este obligatoriu si trebuie sa respecte limita de lungime' });
  if (excerpt.length > 500) return bad({ error: 'Rezumatul este prea lung' });
  return { valid: true, clean: {
    title,
    excerpt,
    body,
    cover_media_id: payload.cover_media_id ? String(payload.cover_media_id).trim() : '',
    author_professional_id: payload.author_professional_id ? String(payload.author_professional_id).trim() : '',
  } };
}

function validatePayload(section, payload, context) {
  if (section === 'public_profile' || section === 'location_details') return validateTextPayload(section, payload);
  if (section === 'services') {
    try { return validateServices(payload); } catch (error) { return bad({ error: error.message }); }
  }
  if (section === 'team') return validateTeam(payload, context);
  if (section === 'media') return validateMedia(payload);
  if (section === 'article') return validateArticle(payload);
  return bad({ error: 'Sectiunea nu este disponibila pentru editare' });
}

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

function safeConflict(sub) {
  return {
    conflict: true,
    section: sub.section,
    status: sub.status,
    message: 'Exista deja o modificare in lucru pentru aceasta sectiune.',
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

    const action = p.action;
    if (!['list_mine', 'create_draft', 'update_draft', 'submit', 'withdraw'].includes(action)) {
      return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    }
    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const currentMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: p.location_id, status: 'active' });
    if (currentMemberships.length === 0) return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });

    const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (loc.profile_control_status === 'suspended') return Response.json({ error: 'Profilul este suspendat' }, { status: 403 });

    const allMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' });
    const permittedLocationIds = [...new Set(allMemberships.map((m) => m.location_id).filter(Boolean))];
    const context = { permittedLocationIds };

    if (action === 'list_mine') {
      const ownSubs = await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: p.location_id, submitted_by_user_id: user.id }, '-created_date', 50);
      const otherActive = await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: p.location_id, status: { $in: ACTIVE_STATUSES } }, '-created_date', 50);
      return Response.json({
        submissions: ownSubs.map(sanitizeSubmission),
        conflicts: otherActive.filter((s) => s.submitted_by_user_id !== user.id).map(safeConflict),
      });
    }

    if (!p.section || !WRITABLE_SECTIONS.includes(p.section)) return Response.json({ error: 'Aceasta sectiune nu este disponibila' }, { status: 400 });

    if (action === 'create_draft') {
      if (!p.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });
      const result = validatePayload(p.section, p.payload, context);
      if (!result.valid) return Response.json(result.body, { status: result.status });

      const existing = await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: p.location_id, section: p.section, status: { $in: ACTIVE_STATUSES } }, '-created_date', 10);
      if (existing.length > 0) {
        const active = existing[0];
        if (active.submitted_by_user_id === user.id) return Response.json({ submission: sanitizeSubmission(active), resumed: true });
        return Response.json(safeConflict(active), { status: 409 });
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

    if (action === 'update_draft') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      if (!p.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Draftul nu a fost gasit' }, { status: 404 });
      if (sub.location_id !== p.location_id) return Response.json({ error: 'Draftul nu apartine acestei locatii' }, { status: 403 });
      if (sub.section !== p.section) return Response.json({ error: 'Sectiunea draftului nu se potriveste' }, { status: 400 });
      if (sub.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti modifica acest draft' }, { status: 403 });
      if (!['draft', 'needs_more_info'].includes(sub.status)) return Response.json({ error: 'Doar drafturile pot fi modificate' }, { status: 400 });

      const result = validatePayload(p.section, p.payload, context);
      if (!result.valid) return Response.json(result.body, { status: result.status });
      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { payload_json: JSON.stringify(result.clean), status: 'draft' });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'update_draft', changed_fields: ['payload_json', 'status'],
        previous: { status: sub.status }, note: `Draft actualizat pentru sectiunea ${p.section}`,
      });
      return Response.json({ success: true });
    }

    if (action === 'submit') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Draftul nu a fost gasit' }, { status: 404 });
      if (sub.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti trimite acest draft' }, { status: 403 });
      if (!['draft', 'needs_more_info'].includes(sub.status)) return Response.json({ error: 'Draftul nu poate fi trimis' }, { status: 400 });
      const now = new Date().toISOString();
      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { status: 'pending_review', submitted_at: now });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'submit_for_review', changed_fields: ['status', 'submitted_at'],
        previous: { status: sub.status }, next: { status: 'pending_review' }, note: `Submission trimisa pentru sectiunea ${sub.section}`,
      });
      return Response.json({ success: true });
    }

    if (action === 'withdraw') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti retrage aceasta submission' }, { status: 403 });
      if (!ACTIVE_STATUSES.includes(sub.status)) return Response.json({ error: 'Submission nu poate fi retrasa' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { status: 'withdrawn' });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id,
        action_type: 'withdraw_submission', changed_fields: ['status'],
        previous: { status: sub.status }, next: { status: 'withdrawn' }, note: `Submission retrasa pentru sectiunea ${sub.section}`,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});