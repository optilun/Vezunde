import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1/1A/2 — Admin review for ProviderWorkspaceSubmission.
// Admin-only. Every approval revalidates stored payloads and applies only
// allowlisted fields. No trust, verification, matching, SIRUTA or visibility
// status is modified by provider-submitted content.

const MAX_FIELD_LEN = 2000;
const MAX_ARTICLE_BODY = 20000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

const SECTION_FIELDS = {
  ...Object.fromEntries(Object.entries(SECTION_APPLY).map(([k, v]) => [k, Object.keys(v)])),
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
const ROLE_BY_TYPE = { ophthalmologist: 'medic_oftalmolog', optometrist: 'optometrist', optician: 'optician' };
const MEDIA_TYPES = ['logo', 'cover', 'gallery', 'team_photo'];
const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BLOCKED_FILE_EXTENSIONS = ['.exe', '.js', '.msi', '.bat', '.cmd', '.sh', '.php', '.html', '.htm', '.svg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'];
const LEGACY_MIRRORS = { public_description: ['description'], website_url: ['website'], public_phone: ['phone_public'] };

function bad(body, status = 400) { return { valid: false, status, body }; }
function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }

function checkUnknown(section, payload) {
  const allowed = SECTION_FIELDS[section];
  if (!allowed) return bad({ error: 'Sectiunea nu poate fi aplicata in acest modul' });
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
    for (const s of payload.suggestions) {
      if (!isPlainObject(s)) return bad({ error: 'Sugestie invalida' });
      const unknown = Object.keys(s).filter((k) => !['group', 'label', 'note'].includes(k));
      if (unknown.length) return bad({ error: 'Camp nepermis in sugestie', fields: unknown });
      const group = String(s.group || '').trim();
      const label = String(s.label || '').trim();
      const note = String(s.note || '').trim();
      if (!Object.keys(CANONICAL_SERVICE_IDS).includes(group)) return bad({ error: 'Grup de sugestie invalid' });
      if (!label || label.length > 120) return bad({ error: 'Sugestia trebuie sa aiba un nume scurt' });
      if (note.length > 500) return bad({ error: 'Nota sugestiei este prea lunga' });
      suggestions.push({ group, label, note });
    }
  }
  const hasSelected = Object.values(selected.clean).some((arr) => arr.length > 0);
  const hasRemoved = Object.values(removals.clean).some((arr) => arr.length > 0);
  if (!hasSelected && !hasRemoved && suggestions.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, clean: { selected_ids: selected.clean, removal_ids: removals.clean, suggestions } };
}

function validateTeam(payload) {
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
      clean.assets.push({ storage_reference: storageReference, media_type: mediaType, caption: String(asset.caption || '').trim().slice(0, 300), alt_text: String(asset.alt_text || '').trim().slice(0, 300), sort_order: Number.isFinite(Number(asset.sort_order)) ? Number(asset.sort_order) : 0 });
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
  return { valid: true, clean: { title, excerpt, body, cover_media_id: payload.cover_media_id ? String(payload.cover_media_id).trim() : '', author_professional_id: payload.author_professional_id ? String(payload.author_professional_id).trim() : '' } };
}

function validatePayload(section, payload) {
  if (section === 'public_profile' || section === 'location_details') return validateTextPayload(section, payload);
  if (section === 'services') return validateServices(payload);
  if (section === 'team') return validateTeam(payload);
  if (section === 'media') return validateMedia(payload);
  if (section === 'article') return validateArticle(payload);
  return bad({ error: 'Sectiune necunoscuta' });
}

function serviceNeedLevel(group) {
  if (group === 'technical_activities') return 'technical';
  if (group === 'investigations' || group === 'specialties') return 'specialized_medical';
  return 'general';
}

function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'articol';
}

async function uniqueSlug(svc, base) {
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const rows = await svc.entities.ProviderArticle.filter({ slug });
    if (rows.length === 0) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
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

async function applyProviderLocationFields(svc, user, sub, validation) {
  const fieldMap = SECTION_APPLY[sub.section];
  if (!fieldMap) return;
  const locUpdates = {};
  for (const [payloadKey, locField] of Object.entries(fieldMap)) {
    if (payloadKey in validation.clean) {
      locUpdates[locField] = validation.clean[payloadKey];
      if (LEGACY_MIRRORS[locField]) {
        for (const legacyField of LEGACY_MIRRORS[locField]) locUpdates[legacyField] = validation.clean[payloadKey];
      }
    }
  }
  if (Object.keys(locUpdates).length === 0) return;
  const loc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  if (!loc) return;
  const prev = {};
  for (const k of Object.keys(locUpdates)) prev[k] = loc[k];
  await svc.entities.ProviderLocation.update(loc.id, locUpdates);
  await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'apply_workspace_submission', changed_fields: Object.keys(locUpdates), previous: prev, next: locUpdates, note: `Aplicat din submission ${sub.id} (${sub.section})` });
}

async function applyServices(svc, user, sub, payload) {
  for (const [group, ids] of Object.entries(payload.selected_ids || {})) {
    for (const serviceKey of ids) {
      if (group === 'specialties') {
        const existing = await svc.entities.LocationSpecialization.filter({ location_id: sub.location_id, specialization_key: serviceKey });
        if (existing[0]) await svc.entities.LocationSpecialization.update(existing[0].id, { is_active: true });
        else await svc.entities.LocationSpecialization.create({ location_id: sub.location_id, specialization_key: serviceKey, is_active: true });
      } else {
        const existing = await svc.entities.LocationService.filter({ location_id: sub.location_id, service_key: serviceKey });
        const data = { is_active: true, accepts_requests: group !== 'technical_activities', service_need_level: serviceNeedLevel(group), is_advanced_service: group === 'investigations' };
        if (existing[0]) await svc.entities.LocationService.update(existing[0].id, data);
        else await svc.entities.LocationService.create({ location_id: sub.location_id, service_key: serviceKey, confirmation_level: 'provider_confirmed', ...data });
      }
    }
  }
  for (const [group, ids] of Object.entries(payload.removal_ids || {})) {
    for (const serviceKey of ids) {
      if (group === 'specialties') {
        const existing = await svc.entities.LocationSpecialization.filter({ location_id: sub.location_id, specialization_key: serviceKey });
        if (existing[0]) await svc.entities.LocationSpecialization.update(existing[0].id, { is_active: false });
      } else {
        const existing = await svc.entities.LocationService.filter({ location_id: sub.location_id, service_key: serviceKey });
        if (existing[0]) await svc.entities.LocationService.update(existing[0].id, { is_active: false });
      }
    }
  }
  await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'apply_services_submission', changed_fields: ['services'], next: { selected_ids: payload.selected_ids, removal_ids: payload.removal_ids }, note: 'Servicii aplicate dupa aprobare admin; sugestiile raman nepublice.' });
}

async function assertLocationsInScope(svc, rootLoc, locationIds) {
  for (const id of locationIds) {
    const target = await svc.entities.ProviderLocation.get(id).catch(() => null);
    if (!target) throw new Error('Locatie atribuita inexistenta');
    if (rootLoc.organization_id) {
      if (target.organization_id !== rootLoc.organization_id) throw new Error('Membru alocat in afara organizatiei permise');
    } else if (target.id !== rootLoc.id) {
      throw new Error('Membru alocat in afara locatiei independente');
    }
  }
}

async function applyTeam(svc, user, sub, payload) {
  const rootLoc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  if (!rootLoc) throw new Error('Locatia nu a fost gasita');
  for (const member of payload.members || []) {
    await assertLocationsInScope(svc, rootLoc, member.assigned_location_ids);
    let profile = member.professional_id ? await svc.entities.ProfessionalProfile.get(member.professional_id).catch(() => null) : null;
    const profileData = {
      full_name: member.full_name,
      professional_type: member.professional_type,
      role: ROLE_BY_TYPE[member.professional_type],
      public_display_name: member.full_name,
      professional_bio: member.short_bio,
      profile_photo_url: member.photo_media_id,
      is_public: member.visible_on_public_profile,
      public_visibility_status: 'approved',
    };
    if (profile) profile = await svc.entities.ProfessionalProfile.update(profile.id, profileData);
    else profile = await svc.entities.ProfessionalProfile.create(profileData);

    for (const locationId of member.assigned_location_ids) {
      const existing = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: profile.id, location_id: locationId });
      const assignmentData = { professional_id: profile.id, location_id: locationId, professional_type: member.professional_type, active_status: 'activ', public_status: member.visible_on_public_profile ? 'public' : 'privat' };
      if (existing[0]) await svc.entities.ProfessionalLocationAssignment.update(existing[0].id, assignmentData);
      else await svc.entities.ProfessionalLocationAssignment.create(assignmentData);
    }
  }
  for (const professionalId of payload.removal_professional_ids || []) {
    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, location_id: sub.location_id });
    for (const assignment of assignments) await svc.entities.ProfessionalLocationAssignment.update(assignment.id, { active_status: 'inactiv', public_status: 'privat' });
  }
  await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'apply_team_submission', changed_fields: ['team'], note: 'Echipa publica aplicata dupa aprobare admin; nu s-au creat conturi de login.' });
}

async function applyMedia(svc, user, sub, payload) {
  const loc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  for (const asset of payload.assets || []) {
    await svc.entities.ProviderMediaAsset.create({ organization_id: loc?.organization_id || null, location_id: sub.location_id, uploaded_by_user_id: sub.submitted_by_user_id, storage_reference: asset.storage_reference, media_type: asset.media_type, caption: asset.caption, alt_text: asset.alt_text, sort_order: asset.sort_order, status: 'approved', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString() });
  }
  for (const mediaId of payload.removal_media_ids || []) {
    const asset = await svc.entities.ProviderMediaAsset.get(mediaId).catch(() => null);
    if (asset && asset.location_id === sub.location_id) await svc.entities.ProviderMediaAsset.update(asset.id, { status: 'withdrawn', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString() });
  }
  await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'apply_media_submission', changed_fields: ['media'], note: 'Media aprobata; doar asseturile approved devin publice.' });
}

async function applyArticle(svc, user, sub, payload) {
  if (payload.cover_media_id) {
    const cover = await svc.entities.ProviderMediaAsset.get(payload.cover_media_id).catch(() => null);
    if (!cover || cover.location_id !== sub.location_id || cover.status !== 'approved') throw new Error('Cover media invalid sau neaprobat');
  }
  if (payload.author_professional_id) {
    const assignment = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: payload.author_professional_id, location_id: sub.location_id, active_status: 'activ' });
    if (assignment.length === 0) throw new Error('Autor profesional nealocat locatiei');
  }
  const loc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  const slug = await uniqueSlug(svc, slugify(payload.title));
  await svc.entities.ProviderArticle.create({ organization_id: loc?.organization_id || null, location_id: sub.location_id, author_professional_id: payload.author_professional_id || null, submitted_by_user_id: sub.submitted_by_user_id, title: payload.title, slug, excerpt: payload.excerpt, body: payload.body, cover_media_id: payload.cover_media_id || null, status: 'approved', published_at: new Date().toISOString(), reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString() });
  await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'apply_article_submission', changed_fields: ['article'], next: { slug }, note: 'Articol publicat doar dupa aprobare admin.' });
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

    if (action === 'list') {
      const query = {};
      if (p.status) query.status = p.status;
      if (p.section) query.section = p.section;
      if (p.location_id) query.location_id = p.location_id;
      if (p.organization_id) query.organization_id = p.organization_id;
      const subs = await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 100);
      return Response.json({ submissions: subs });
    }

    if (action === 'get') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      return Response.json({ submission: sub });
    }

    if (action === 'approve') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      let payload = null;
      try { payload = JSON.parse(sub.payload_json || '{}'); } catch (_e) { payload = null; }
      const validation = validatePayload(sub.section, payload);
      if (!validation.valid) return Response.json(validation.body, { status: validation.status });

      const note = String(p.note || '').trim();
      const now = new Date().toISOString();
      if (sub.section === 'public_profile' || sub.section === 'location_details') await applyProviderLocationFields(svc, user, sub, validation);
      else if (sub.section === 'services') await applyServices(svc, user, sub, validation.clean);
      else if (sub.section === 'team') await applyTeam(svc, user, sub, validation.clean);
      else if (sub.section === 'media') await applyMedia(svc, user, sub, validation.clean);
      else if (sub.section === 'article') await applyArticle(svc, user, sub, validation.clean);
      else return Response.json({ error: 'Sectiune necunoscuta' }, { status: 400 });

      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { status: 'approved', reviewed_by_user_id: user.id, reviewed_at: now, admin_note: note });
      await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'approve_submission', changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'], previous: { status: sub.status }, next: { status: 'approved' }, note });
      return Response.json({ success: true });
    }

    if (action === 'reject') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      const note = String(p.note || '').trim();
      if (!note) return Response.json({ error: 'Respingerea necesita o nota' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { status: 'rejected', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), admin_note: note });
      await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'reject_submission', changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'], previous: { status: sub.status }, next: { status: 'rejected' }, note });
      return Response.json({ success: true });
    }

    if (action === 'request_more_info') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const sub = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!sub) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (sub.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      const note = String(p.note || '').trim();
      if (!note) return Response.json({ error: 'Solicitarea de informatii necesita o nota' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(sub.id, { status: 'needs_more_info', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), admin_note: note });
      await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'request_more_info', changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'], previous: { status: sub.status }, next: { status: 'needs_more_info' }, note });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});