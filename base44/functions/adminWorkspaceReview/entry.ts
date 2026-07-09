import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin review pentru ProviderWorkspaceSubmission.
// Pentru MVP aplicam doar sectiunile provider-facing active:
// organization_profile, location_details, services si team.
// Media/articole raman neactivate pana exista flux end-to-end sigur.

const MAX_FIELD_LEN = 2000;
const MAX_ORG_DESCRIPTION = 500;
const MAX_URL_LEN = 500;
const B2B_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];

const SECTION_APPLY = {
  organization_profile: {
    public_name: 'public_display_name',
    logo_url: 'logo_url',
    description: 'public_description',
    general_phone: 'public_phone',
    general_email: 'public_email',
    website_url: 'website_url',
    facebook_url: 'facebook_url',
    instagram_url: 'instagram_url',
    linkedin_url: 'linkedin_url',
  },
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
    lat: 'lat',
    lng: 'lng',
    place_id: 'place_id',
  },
};

const SECTION_FIELDS = {
  ...Object.fromEntries(Object.entries(SECTION_APPLY).map(([key, value]) => [key, Object.keys(value)])),
  services: ['selected_ids', 'removal_ids', 'suggestions'],
  team: ['members', 'removal_professional_ids', 'invitations'],
};

const CANONICAL_SERVICE_IDS = {
  patient_services: ['eyeglasses', 'frames', 'prescription_lenses', 'contact_lenses', 'optometry_consultation', 'ophthalmology_consultation'],
  investigations: ['oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'corneal_topography'],
  specialties: ['retina_consultation', 'glaucoma_consultation', 'cataract_surgery', 'refractive_surgery', 'pediatric_ophthalmology', 'myopia_management', 'emergency_ophthalmology'],
  technical_activities: ['eyeglasses_adjustment', 'eyeglasses_repair', 'lens_fitting'],
};

const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];
const SPECIALIST_INVITE_ROLES = ['ophthalmologist', 'optometrist', 'optician', 'contact_lens_specialist', 'optical_workshop_specialist', 'other_relevant_specialist'];
const ROLE_BY_TYPE = { ophthalmologist: 'medic_oftalmolog', optometrist: 'optometrist', optician: 'optician' };
const LEGACY_MIRRORS = { public_description: ['description'], website_url: ['website'], public_phone: ['phone_public'] };

function bad(body, status = 400) { return { valid: false, status, body }; }
function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function normalizePersonName(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function cleanPlainText(value, field, maxLen) {
  const val = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (val.length > maxLen) return { error: field + ' depaseste lungimea maxima' };
  if (/[<>]/.test(val) || /<\/?[a-z][\s\S]*>/i.test(val)) return { error: field + ' trebuie sa fie text simplu, fara HTML' };
  return { value: val };
}
function cleanUrl(value, field) {
  const raw = String(value || '').trim();
  if (!raw) return { value: '' };
  if (raw.length > MAX_URL_LEN) return { error: field + ' depaseste lungimea maxima' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw;
  let parsed;
  try { parsed = new URL(withScheme); } catch (_e) { return { error: field + ' trebuie sa fie URL valid' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { error: field + ' trebuie sa foloseasca http sau https' };
  return { value: parsed.toString() };
}
function cleanEmail(value, field = 'email') {
  const val = String(value || '').trim();
  if (!val) return { value: '' };
  if (val.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return { error: field + ' invalid' };
  return { value: val };
}
function cleanPhone(value, field = 'telefon') {
  const val = String(value || '').trim();
  if (!val) return { value: '' };
  if (!/^[0-9+().\-\s]{6,80}$/.test(val)) return { error: field + ' invalid' };
  return { value: val };
}
function cleanNumber(value, field, min, max) {
  if (value === '' || value === null || value === undefined) return { value: null };
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num) || num < min || num > max) return { error: field + ' este invalid' };
  return { value: num };
}

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

function validateOrganizationProfile(payload) {
  const base = checkUnknown('organization_profile', payload);
  if (!base.valid) return base;
  const clean = {};
  if ('public_name' in payload) { const v = cleanPlainText(payload.public_name, 'public_name', 160); if (v.error) return bad({ error: v.error }); clean.public_name = v.value; }
  if ('logo_url' in payload) { const v = cleanUrl(payload.logo_url, 'logo_url'); if (v.error) return bad({ error: v.error }); clean.logo_url = v.value; }
  if ('description' in payload) { const v = cleanPlainText(payload.description, 'description', MAX_ORG_DESCRIPTION); if (v.error) return bad({ error: v.error }); clean.description = v.value; }
  if ('general_phone' in payload) { const v = cleanPhone(payload.general_phone, 'general_phone'); if (v.error) return bad({ error: v.error }); clean.general_phone = v.value; }
  if ('general_email' in payload) { const v = cleanEmail(payload.general_email, 'general_email'); if (v.error) return bad({ error: v.error }); clean.general_email = v.value; }
  for (const key of ['website_url', 'facebook_url', 'instagram_url', 'linkedin_url']) {
    if (key in payload) { const v = cleanUrl(payload[key], key); if (v.error) return bad({ error: v.error }); clean[key] = v.value; }
  }
  return Object.keys(clean).length ? { valid: true, clean } : bad({ error: 'Payload gol' });
}

function validateLocationDetails(payload) {
  const base = checkUnknown('location_details', payload);
  if (!base.valid) return base;
  const clean = {};
  for (const key of ['address', 'public_display_name', 'place_id']) {
    if (key in payload) { const v = cleanPlainText(payload[key], key, key === 'place_id' ? 300 : MAX_FIELD_LEN); if (v.error) return bad({ error: v.error }); clean[key] = v.value; }
  }
  if ('public_phone' in payload) { const v = cleanPhone(payload.public_phone, 'public_phone'); if (v.error) return bad({ error: v.error }); clean.public_phone = v.value; }
  if ('public_email' in payload) { const v = cleanEmail(payload.public_email, 'public_email'); if (v.error) return bad({ error: v.error }); clean.public_email = v.value; }
  if ('lat' in payload) { const v = cleanNumber(payload.lat, 'lat', -90, 90); if (v.error) return bad({ error: v.error }); clean.lat = v.value; }
  if ('lng' in payload) { const v = cleanNumber(payload.lng, 'lng', -180, 180); if (v.error) return bad({ error: v.error }); clean.lng = v.value; }
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
  const hasSelected = Object.values(selected.clean).some((arr) => arr.length > 0);
  const hasRemoved = Object.values(removals.clean).some((arr) => arr.length > 0);
  if (!hasSelected && !hasRemoved && !(payload.suggestions || []).length) return bad({ error: 'Payload gol' });
  return { valid: true, clean: { selected_ids: selected.clean, removal_ids: removals.clean, suggestions: [] } };
}

function validateTeam(payload) {
  const base = checkUnknown('team', payload);
  if (!base.valid) return base;
  const clean = { members: [], removal_professional_ids: [], invitations: [] };
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
  if (payload.invitations !== undefined) {
    if (!Array.isArray(payload.invitations)) return bad({ error: 'invitations trebuie sa fie lista' });
    for (const invite of payload.invitations) {
      if (!isPlainObject(invite)) return bad({ error: 'Invitatie invalida' });
      const unknown = Object.keys(invite).filter((k) => !['email', 'professional_role'].includes(k));
      if (unknown.length > 0) return bad({ error: 'Camp nepermis in invitatie', fields: unknown });
      const email = cleanEmail(invite.email, 'email');
      if (email.error || !email.value) return bad({ error: email.error || 'Emailul specialistului este obligatoriu' });
      const role = String(invite.professional_role || '').trim();
      if (!SPECIALIST_INVITE_ROLES.includes(role)) return bad({ error: 'Rol profesional invalid' });
      clean.invitations.push({ email: email.value, professional_role: role });
    }
  }
  if (clean.members.length === 0 && clean.removal_professional_ids.length === 0 && clean.invitations.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, clean };
}

function validatePayload(section, payload) {
  if (section === 'organization_profile') return validateOrganizationProfile(payload);
  if (section === 'location_details') return validateLocationDetails(payload);
  if (section === 'public_profile') return validateTextPayload(section, payload);
  if (section === 'services') return validateServices(payload);
  if (section === 'team') return validateTeam(payload);
  return bad({ error: 'Sectiune necunoscuta sau neactivata in MVP' });
}

function serviceNeedLevel(group) {
  if (group === 'technical_activities') return 'technical';
  if (group === 'investigations' || group === 'specialties') return 'specialized_medical';
  return 'general';
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

async function applyOrganizationFields(svc, user, sub, validation) {
  const orgId = sub.organization_id || '';
  if (!orgId) throw new Error('Submission-ul nu are organizatie asociata');
  const org = await svc.entities.ProviderOrganization.get(orgId).catch(() => null);
  if (!org) throw new Error('Organizatia nu a fost gasita');
  const updates = {};
  for (const [payloadKey, orgField] of Object.entries(SECTION_APPLY.organization_profile)) {
    if (payloadKey in validation.clean) updates[orgField] = validation.clean[payloadKey];
  }
  if (Object.keys(updates).length === 0) return;
  updates.profile_updated_at = new Date().toISOString();
  const prev = {};
  for (const key of Object.keys(updates)) prev[key] = org[key];
  await svc.entities.ProviderOrganization.update(org.id, updates);
  await audit(svc, user, { entity_type: 'ProviderOrganization', entity_id: org.id, action_type: 'apply_workspace_organization_profile', changed_fields: Object.keys(updates), previous: prev, next: updates, note: 'Aplicat din submission ' + sub.id });
}

async function applyProviderLocationFields(svc, user, sub, validation) {
  const fieldMap = SECTION_APPLY[sub.section];
  if (!fieldMap) return;
  const loc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  if (!loc) throw new Error('Locatia nu a fost gasita');
  const updates = {};
  for (const [payloadKey, locField] of Object.entries(fieldMap)) {
    if (payloadKey in validation.clean) {
      updates[locField] = validation.clean[payloadKey];
      if (LEGACY_MIRRORS[locField]) for (const legacyField of LEGACY_MIRRORS[locField]) updates[legacyField] = validation.clean[payloadKey];
    }
  }
  if (Object.keys(updates).length === 0) return;
  const prev = {};
  for (const key of Object.keys(updates)) prev[key] = loc[key];
  await svc.entities.ProviderLocation.update(loc.id, updates);
  await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'apply_workspace_location_fields', changed_fields: Object.keys(updates), previous: prev, next: updates, note: 'Aplicat din submission ' + sub.id });
}

async function applyServices(svc, user, sub, payload) {
  const loc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  if (!loc) throw new Error('Locatia nu a fost gasita');
  if (B2B_PROFILE_TYPES.includes(loc.provider_profile_type)) throw new Error('Profilurile B2B nu pot avea servicii patient-facing');
  for (const [group, ids] of Object.entries(payload.selected_ids || {})) {
    for (const serviceKey of ids) {
      if (group === 'specialties') {
        const existing = await svc.entities.LocationSpecialization.filter({ location_id: sub.location_id, specialization_key: serviceKey });
        if (existing[0]) await svc.entities.LocationSpecialization.update(existing[0].id, { is_active: true });
        else await svc.entities.LocationSpecialization.create({ location_id: sub.location_id, specialization_key: serviceKey, is_active: true });
      } else {
        const existing = await svc.entities.LocationService.filter({ location_id: sub.location_id, service_key: serviceKey });
        const data = { is_active: true, accepts_requests: true, service_need_level: serviceNeedLevel(group), is_advanced_service: group === 'investigations' };
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
  await audit(svc, user, { entity_type: 'ProviderWorkspaceSubmission', entity_id: sub.id, action_type: 'apply_services_submission', changed_fields: ['services'], next: { selected_ids: payload.selected_ids, removal_ids: payload.removal_ids }, note: 'Servicii aplicate dupa aprobare admin.' });
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

async function professionalAlreadyInScope(svc, rootLoc, professionalId) {
  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, active_status: 'activ' }, null, 100);
  for (const assignment of assignments) {
    const loc = await svc.entities.ProviderLocation.get(assignment.location_id).catch(() => null);
    if (!loc) continue;
    if (rootLoc.organization_id && loc.organization_id === rootLoc.organization_id) return true;
    if (!rootLoc.organization_id && loc.id === rootLoc.id) return true;
  }
  return false;
}

async function assertNoTeamDuplicate(svc, member, profileId) {
  for (const locationId of member.assigned_location_ids) {
    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ' }, null, 100);
    for (const assignment of assignments) {
      if (profileId && assignment.professional_id === profileId) continue;
      if (assignment.professional_type !== member.professional_type) continue;
      const profile = await svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null);
      if (profile && normalizePersonName(profile.full_name) === normalizePersonName(member.full_name)) throw new Error('Exista deja un profesionist similar in aceasta locatie.');
    }
  }
}

async function applyTeam(svc, user, sub, payload) {
  const rootLoc = await svc.entities.ProviderLocation.get(sub.location_id).catch(() => null);
  if (!rootLoc) throw new Error('Locatia nu a fost gasita');

  for (const member of payload.members || []) {
    await assertLocationsInScope(svc, rootLoc, member.assigned_location_ids);
    let profile = member.professional_id ? await svc.entities.ProfessionalProfile.get(member.professional_id).catch(() => null) : null;
    if (member.professional_id && (!profile || !(await professionalAlreadyInScope(svc, rootLoc, member.professional_id)))) throw new Error('ProfessionalProfile nu apartine scopului permis');
    await assertNoTeamDuplicate(svc, member, profile?.id || '');
    const profileData = {
      full_name: member.full_name,
      professional_type: member.professional_type,
      role: ROLE_BY_TYPE[member.professional_type],
      public_display_name: member.full_name,
      professional_bio: member.short_bio,
      profile_photo_url: member.photo_media_id || '',
      is_public: member.visible_on_public_profile,
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
    if (!(await professionalAlreadyInScope(svc, rootLoc, professionalId))) throw new Error('ProfessionalProfile de eliminat nu apartine scopului permis');
    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, location_id: sub.location_id });
    for (const assignment of assignments) await svc.entities.ProfessionalLocationAssignment.update(assignment.id, { active_status: 'inactiv', public_status: 'privat' });
  }

  const invitationCount = (payload.invitations || []).length;
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: sub.id,
    action_type: invitationCount ? 'approve_specialist_invitations_pending_email' : 'apply_team_submission',
    changed_fields: ['team'],
    next: invitationCount ? { invitations: payload.invitations } : { members: payload.members, removal_professional_ids: payload.removal_professional_ids },
    note: invitationCount
      ? 'Invitatiile au fost aprobate ca intentie de afiliere. Nu s-au creat profiluri publice si nu s-au trimis emailuri; lipseste lifecycle-ul dedicat de invitatie.'
      : 'Echipa publica aplicata dupa aprobare admin; nu s-au creat conturi de login.',
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

    if (action === 'list') {
      const query = {};
      if (p.status) query.status = p.status;
      if (p.section) query.section = p.section;
      if (p.location_id) query.location_id = p.location_id;
      if (p.organization_id) query.organization_id = p.organization_id;
      const submissions = await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 100);
      return Response.json({ submissions });
    }

    if (action === 'get') {
      if (!p.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(p.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      return Response.json({ submission });
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
      if (sub.section === 'organization_profile') await applyOrganizationFields(svc, user, sub, validation);
      else if (sub.section === 'public_profile' || sub.section === 'location_details') await applyProviderLocationFields(svc, user, sub, validation);
      else if (sub.section === 'services') await applyServices(svc, user, sub, validation.clean);
      else if (sub.section === 'team') await applyTeam(svc, user, sub, validation.clean);
      else return Response.json({ error: 'Sectiune necunoscuta sau neactivata in MVP' }, { status: 400 });

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
