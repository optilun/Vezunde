import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  getCanonicalServiceGroupIds,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';

// Admin review for ProviderWorkspaceSubmission.
// Approval applies validated payloads. Rejection / more info only update review status.

const MAX_FIELD_LEN = 2000;
const MAX_ARTICLE_BODY = 20000;

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
    lat: 'lat',
    lng: 'lng',
    place_id: 'place_id',
  },
};

const SERVICE_IDS = {
  ...getCanonicalServiceGroupIds(),
  patient_services: ['eyeglasses', 'frames', 'prescription_lenses', 'contact_lenses', 'optometry_consultation', 'ophthalmology_consultation'],
};

const SECTION_FIELDS = {
  ...Object.fromEntries(Object.entries(SECTION_APPLY).map(([key, value]) => [key, Object.keys(value)])),
  services: ['selected_ids', 'removal_ids', 'raw_removal_keys', 'suggestions', 'custom_requests'],
  team: ['members', 'removal_professional_ids', 'invitations', 'invite_flow', 'invitation_channel'],
  media: ['assets', 'removal_media_ids'],
  article: ['title', 'excerpt', 'body', 'cover_media_id', 'author_professional_id'],
};

const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];
const SPECIALIST_INVITE_ROLES = ['ophthalmologist', 'optometrist', 'optician', 'contact_lens_specialist', 'optical_workshop_specialist', 'other_specialist', 'other_relevant_specialist'];
const ROLE_BY_TYPE = { ophthalmologist: 'medic_oftalmolog', optometrist: 'optometrist', optician: 'optician' };
const LEGACY_MIRRORS = { public_description: ['description'], website_url: ['website'], public_phone: ['phone_public'] };

function bad(body, status = 400) { return { valid: false, status, body }; }
function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function cleanString(value) { return String(value || '').trim(); }
function normalizePersonName(value) { return cleanString(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' '); }

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
    const value = payload[key];
    if (value === null || value === undefined) { clean[key] = ''; continue; }
    if (typeof value !== 'string') return bad({ error: `${key} trebuie sa fie text` });
    if (value.length > MAX_FIELD_LEN) return bad({ error: `${key} depaseste lungimea maxima` });
    clean[key] = value.trim();
  }
  return Object.keys(clean).length ? { valid: true, clean } : bad({ error: 'Payload gol' });
}

function validateLocationDetails(payload) {
  const base = checkUnknown('location_details', payload);
  if (!base.valid) return base;
  const clean = {};
  for (const key of ['address', 'public_display_name', 'public_phone', 'public_email', 'place_id']) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = cleanString(payload[key]);
    if (value.length > MAX_FIELD_LEN) return bad({ error: `${key} depaseste lungimea maxima` });
    clean[key] = value;
  }
  for (const [key, min, max] of [['lat', -90, 90], ['lng', -180, 180]]) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    if (payload[key] === '' || payload[key] === null || payload[key] === undefined) clean[key] = null;
    else {
      const number = Number(String(payload[key]).trim().replace(',', '.'));
      if (!Number.isFinite(number) || number < min || number > max) return bad({ error: `${key} invalid` });
      clean[key] = number;
    }
  }
  const hasLat = clean.lat !== undefined && clean.lat !== null;
  const hasLng = clean.lng !== undefined && clean.lng !== null;
  if (hasLat !== hasLng) return bad({ error: 'Completeaza si latitudinea, si longitudinea pentru pin exact.' });
  return Object.keys(clean).length ? { valid: true, clean } : bad({ error: 'Payload gol' });
}

function validateServiceGroupObject(value, fieldName) {
  if (value === undefined) return { valid: true, clean: {} };
  if (!isPlainObject(value)) return bad({ error: `${fieldName} trebuie sa fie obiect` });
  const unknownGroups = Object.keys(value).filter((group) => !Object.keys(SERVICE_IDS).includes(group));
  if (unknownGroups.length > 0) return bad({ error: 'Grup de servicii nepermis', fields: unknownGroups });
  const clean = {};
  for (const [group, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) return bad({ error: `${fieldName}.${group} trebuie sa fie lista` });
    const unique = [...new Set(ids.map((id) => cleanString(id)).filter(Boolean))];
    const invalid = unique.filter((id) => !SERVICE_IDS[group].includes(id));
    if (invalid.length > 0) return bad({ error: 'ID canonic invalid', fields: invalid });
    if (unique.length > 0) clean[group] = unique;
  }
  return { valid: true, clean };
}

function validateRawRemovalKeys(value) {
  if (value === undefined) return { valid: true, clean: [] };
  if (!Array.isArray(value)) return bad({ error: 'raw_removal_keys trebuie sa fie lista' });
  const clean = [...new Set(value.map(cleanString).filter(Boolean))];
  if (clean.some((key) => key.length > 160)) return bad({ error: 'Cheie legacy invalida' });
  const canonical = clean.filter((key) => normalizeServiceKey(key).status === 'canonical');
  if (canonical.length > 0) return bad({ error: 'Cheile canonice trebuie eliminate prin removal_ids', fields: canonical });
  return { valid: true, clean };
}

function validateSuggestions(payload) {
  const raw = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.custom_requests)
      ? payload.custom_requests
      : [];
  const suggestions = [];
  for (const suggestion of raw) {
    if (!isPlainObject(suggestion)) return bad({ error: 'Sugestie invalida' });
    const group = cleanString(suggestion.group || 'optical_retail');
    const label = cleanString(suggestion.label);
    const note = cleanString(suggestion.note);
    if (!Object.keys(SERVICE_IDS).includes(group)) return bad({ error: 'Grup de sugestie invalid' });
    if (!label || label.length > 120) return bad({ error: 'Sugestia trebuie sa aiba un nume scurt' });
    if (note.length > 500) return bad({ error: 'Nota sugestiei este prea lunga' });
    suggestions.push({ group, label, note });
  }
  return { valid: true, suggestions };
}

function validateServices(payload) {
  const base = checkUnknown('services', payload);
  if (!base.valid) return base;
  const selected = validateServiceGroupObject(payload.selected_ids, 'selected_ids');
  if (!selected.valid) return selected;
  const removals = validateServiceGroupObject(payload.removal_ids, 'removal_ids');
  if (!removals.valid) return removals;
  const rawRemovals = validateRawRemovalKeys(payload.raw_removal_keys);
  if (!rawRemovals.valid) return rawRemovals;
  const suggestions = validateSuggestions(payload);
  if (!suggestions.valid) return suggestions;
  const hasSelected = Object.values(selected.clean).some((items) => items.length > 0);
  const hasRemoved = Object.values(removals.clean).some((items) => items.length > 0);
  if (!hasSelected && !hasRemoved && rawRemovals.clean.length === 0 && suggestions.suggestions.length === 0) {
    return bad({ error: 'Payload gol' });
  }
  return {
    valid: true,
    clean: {
      selected_ids: selected.clean,
      removal_ids: removals.clean,
      raw_removal_keys: rawRemovals.clean,
      suggestions: suggestions.suggestions,
    },
  };
}

function validateEmail(value) {
  const email = cleanString(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function validateTeam(payload) {
  const base = checkUnknown('team', payload);
  if (!base.valid) return base;
  const clean = { members: [], removal_professional_ids: [], invitations: [] };
  if (Array.isArray(payload.invitations)) {
    for (const invite of payload.invitations) {
      if (!isPlainObject(invite)) return bad({ error: 'Invitatie invalida' });
      const email = validateEmail(invite.email);
      const professionalRole = cleanString(invite.professional_role || invite.professional_type || '');
      if (!email) return bad({ error: 'Email specialist invalid' });
      if (!SPECIALIST_INVITE_ROLES.includes(professionalRole)) return bad({ error: 'Rol profesional invalid' });
      clean.invitations.push({ email, professional_role: professionalRole, invite_status: 'pending_invite' });
    }
  }
  if (payload.members !== undefined) {
    if (!Array.isArray(payload.members)) return bad({ error: 'members trebuie sa fie lista' });
    for (const member of payload.members) {
      if (!isPlainObject(member)) return bad({ error: 'Membru invalid' });
      if (member.invitation_required || member.invite_email) {
        const email = validateEmail(member.invite_email || member.email);
        const professionalRole = cleanString(member.professional_type || member.professional_role || '');
        if (!email) return bad({ error: 'Email specialist invalid' });
        if (!SPECIALIST_INVITE_ROLES.includes(professionalRole)) return bad({ error: 'Rol profesional invalid' });
        clean.invitations.push({ email, professional_role: professionalRole, invite_status: 'pending_invite' });
        continue;
      }
      const unknown = Object.keys(member).filter((key) => !['professional_id', 'full_name', 'professional_type', 'public_title', 'short_bio', 'photo_media_id', 'visible_on_public_profile', 'assigned_location_ids'].includes(key));
      if (unknown.length > 0) return bad({ error: 'Camp nepermis', fields: unknown });
      const fullName = cleanString(member.full_name);
      const professionalType = cleanString(member.professional_type);
      const assignedLocationIds = Array.isArray(member.assigned_location_ids)
        ? [...new Set(member.assigned_location_ids.map((id) => cleanString(id)).filter(Boolean))]
        : [];
      if (!fullName || fullName.length > 160) return bad({ error: 'Numele membrului este obligatoriu si trebuie sa fie scurt' });
      if (!PROFESSIONAL_TYPES.includes(professionalType)) return bad({ error: 'Tip profesional invalid' });
      if (assignedLocationIds.length === 0) return bad({ error: 'assigned_location_ids este obligatoriu' });
      clean.members.push({
        professional_id: member.professional_id ? cleanString(member.professional_id) : '',
        full_name: fullName,
        professional_type: professionalType,
        public_title: cleanString(member.public_title).slice(0, 120),
        short_bio: cleanString(member.short_bio).slice(0, 1000),
        photo_media_id: member.photo_media_id ? cleanString(member.photo_media_id) : '',
        visible_on_public_profile: member.visible_on_public_profile !== false,
        assigned_location_ids: assignedLocationIds,
      });
    }
  }
  if (payload.removal_professional_ids !== undefined) {
    if (!Array.isArray(payload.removal_professional_ids)) return bad({ error: 'removal_professional_ids trebuie sa fie lista' });
    clean.removal_professional_ids = [...new Set(payload.removal_professional_ids.map((id) => cleanString(id)).filter(Boolean))];
  }
  if (clean.members.length === 0 && clean.removal_professional_ids.length === 0 && clean.invitations.length === 0) {
    return bad({ error: 'Payload gol' });
  }
  return { valid: true, clean };
}

function validateMedia(payload) {
  const base = checkUnknown('media', payload);
  if (!base.valid) return base;
  if (payload.assets !== undefined) {
    return bad({ error: 'Incarcarea media este momentan indisponibila in siguranta. Nu se accepta storage_reference brut.' }, 503);
  }
  const clean = { assets: [], removal_media_ids: [] };
  if (payload.removal_media_ids !== undefined) {
    if (!Array.isArray(payload.removal_media_ids)) return bad({ error: 'removal_media_ids trebuie sa fie lista' });
    clean.removal_media_ids = [...new Set(payload.removal_media_ids.map((id) => cleanString(id)).filter(Boolean))];
  }
  if (clean.removal_media_ids.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, clean };
}

function normalizeArticleBody(value) {
  const raw = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!raw || raw.length > MAX_ARTICLE_BODY) return { error: 'Articolul este obligatoriu si trebuie sa respecte limita de lungime' };
  if (/[<>]/.test(raw) || /<\/?[a-z][\s\S]*>/i.test(raw)) return { error: 'Articolul trebuie sa fie text simplu, fara HTML' };
  if (/\[[^\]]+\]\([^\)]+\)/.test(raw)) return { error: 'Articolul trebuie sa fie text simplu, fara markup' };
  if (/\b(?:javascript|data|vbscript|file):/i.test(raw)) return { error: 'Articolul contine un protocol nesigur' };
  return { body: raw.split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

function validateArticle(payload) {
  const base = checkUnknown('article', payload);
  if (!base.valid) return base;
  const title = cleanString(payload.title);
  const excerpt = cleanString(payload.excerpt);
  const normalized = normalizeArticleBody(payload.body);
  if (!title || title.length > 180) return bad({ error: 'Titlul este obligatoriu si trebuie sa fie scurt' });
  if (normalized.error) return bad({ error: normalized.error });
  if (excerpt.length > 500) return bad({ error: 'Rezumatul este prea lung' });
  return {
    valid: true,
    clean: {
      title,
      excerpt,
      body: normalized.body,
      cover_media_id: payload.cover_media_id ? cleanString(payload.cover_media_id) : '',
      author_professional_id: payload.author_professional_id ? cleanString(payload.author_professional_id) : '',
    },
  };
}

function validatePayload(section, payload) {
  if (section === 'public_profile') return validateTextPayload(section, payload);
  if (section === 'location_details') return validateLocationDetails(payload);
  if (section === 'services') return validateServices(payload);
  if (section === 'team') return validateTeam(payload);
  if (section === 'media') return validateMedia(payload);
  if (section === 'article') return validateArticle(payload);
  return bad({ error: 'Sectiune necunoscuta' });
}

function serviceApplyData(serviceKey, existing = {}) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
  const previousConfirmation = cleanString(existing?.confirmation_level);
  const confirmationLevel = previousConfirmation === 'vezunde_verified' ? 'vezunde_verified' : 'provider_confirmed';
  const matchingAllowed = definition.requires_review
    ? confirmationLevel === 'vezunde_verified'
    : definition.matching_allowed_when_provider_confirmed;
  return {
    is_active: true,
    accepts_requests: true,
    service_need_level: definition.service_need_level,
    is_advanced_service: definition.requires_review || definition.service_need_level === 'specialized_medical',
    confirmation_level: confirmationLevel,
    matching_allowed: matchingAllowed,
  };
}

function slugify(value) {
  return cleanString(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'articol';
}
async function uniqueSlug(svc, base, currentId = '') {
  let slug = base;
  for (let index = 2; index < 100; index += 1) {
    const rows = await svc.entities.ProviderArticle.filter({ slug });
    if (rows.length === 0 || (rows.length === 1 && rows[0].id === currentId)) return slug;
    slug = `${base}-${index}`;
  }
  return `${base}-${Date.now()}`;
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

async function assertPublicEligible(base44, locationId) {
  const result = await base44.functions.invoke('getPublicProviderProfile', { location_id: locationId }).catch(() => null);
  if (!result?.data?.profile?.id) throw new Error('Locatia nu este eligibila pentru continut public');
}

async function applyProviderLocationFields(svc, user, submission, validation) {
  const fieldMap = SECTION_APPLY[submission.section];
  if (!fieldMap) return;
  const locUpdates = {};
  for (const [payloadKey, locField] of Object.entries(fieldMap)) {
    if (!(payloadKey in validation.clean)) continue;
    locUpdates[locField] = validation.clean[payloadKey];
    if (LEGACY_MIRRORS[locField]) {
      for (const legacyField of LEGACY_MIRRORS[locField]) locUpdates[legacyField] = validation.clean[payloadKey];
    }
  }
  if (Object.keys(locUpdates).length === 0) return;
  const loc = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
  if (!loc) return;
  const previous = {};
  for (const key of Object.keys(locUpdates)) previous[key] = loc[key];
  await svc.entities.ProviderLocation.update(loc.id, locUpdates);
  await audit(svc, user, {
    entity_type: 'ProviderLocation',
    entity_id: loc.id,
    action_type: 'apply_workspace_submission',
    changed_fields: Object.keys(locUpdates),
    previous,
    next: locUpdates,
    note: `Aplicat din submission ${submission.id} (${submission.section})`,
  });
}

async function applyServices(svc, user, submission, payload) {
  const mirrorSpecialization = async (serviceKey, active) => {
    const existing = await svc.entities.LocationSpecialization.filter({
      location_id: submission.location_id,
      specialization_key: serviceKey,
    });
    if (existing[0]) await svc.entities.LocationSpecialization.update(existing[0].id, { is_active: active });
    else if (active) {
      await svc.entities.LocationSpecialization.create({
        location_id: submission.location_id,
        specialization_key: serviceKey,
        is_active: true,
      });
    }
  };

  for (const [group, ids] of Object.entries(payload.selected_ids || {})) {
    for (const serviceKey of ids) {
      const definition = getCanonicalServiceDefinition(serviceKey);
      if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
      const existing = await svc.entities.LocationService.filter({
        location_id: submission.location_id,
        service_key: serviceKey,
      });
      const data = serviceApplyData(serviceKey, existing[0]);
      if (existing[0]) await svc.entities.LocationService.update(existing[0].id, data);
      else {
        await svc.entities.LocationService.create({
          location_id: submission.location_id,
          service_key: serviceKey,
          ...data,
        });
      }
      if (group === 'specialties' || definition.group === 'specialties') await mirrorSpecialization(serviceKey, true);
    }
  }

  for (const [group, ids] of Object.entries(payload.removal_ids || {})) {
    for (const serviceKey of ids) {
      const existing = await svc.entities.LocationService.filter({
        location_id: submission.location_id,
        service_key: serviceKey,
      });
      for (const row of existing) {
        await svc.entities.LocationService.update(row.id, {
          is_active: false,
          accepts_requests: false,
          matching_allowed: false,
        });
      }
      const definition = getCanonicalServiceDefinition(serviceKey);
      if (group === 'specialties' || definition?.group === 'specialties') await mirrorSpecialization(serviceKey, false);
    }
  }

  for (const rawKey of payload.raw_removal_keys || []) {
    const normalized = normalizeServiceKey(rawKey);
    if (normalized.status === 'canonical') throw new Error('Cheia canonica trebuie eliminata prin removal_ids');
    const existing = await svc.entities.LocationService.filter({
      location_id: submission.location_id,
      service_key: rawKey,
    });
    if (existing.length === 0) throw new Error(`Serviciul legacy sau necunoscut nu exista: ${rawKey}`);
    for (const row of existing) {
      await svc.entities.LocationService.update(row.id, {
        is_active: false,
        accepts_requests: false,
        matching_allowed: false,
      });
    }
  }

  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'apply_services_submission',
    changed_fields: ['services'],
    next: {
      selected_ids: payload.selected_ids,
      removal_ids: payload.removal_ids,
      raw_removal_keys: payload.raw_removal_keys,
      suggestions: payload.suggestions,
    },
    note: 'Servicii aplicate dupa aprobarea admin. Serviciile medicale raman blocate pana la verificare Vezunde.',
  });
}

async function assertLocationsInScope(svc, rootLoc, locationIds) {
  for (const id of locationIds) {
    const target = await svc.entities.ProviderLocation.get(id).catch(() => null);
    if (!target) throw new Error('Locatie atribuita inexistenta');
    if (rootLoc.organization_id) {
      if (target.organization_id !== rootLoc.organization_id) throw new Error('Membru alocat in afara organizatiei permise');
    } else if (target.id !== rootLoc.id) throw new Error('Membru alocat in afara locatiei independente');
  }
}

async function professionalAlreadyInScope(svc, rootLoc, professionalId) {
  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
    professional_id: professionalId,
    active_status: 'activ',
  }, null, 100);
  for (const assignment of assignments) {
    const loc = await svc.entities.ProviderLocation.get(assignment.location_id).catch(() => null);
    if (!loc) continue;
    if (rootLoc.organization_id && loc.organization_id === rootLoc.organization_id) return true;
    if (!rootLoc.organization_id && loc.id === rootLoc.id) return true;
  }
  return false;
}

async function assertTeamPhoto(svc, locationId, mediaId) {
  if (!mediaId) return;
  const asset = await svc.entities.ProviderMediaAsset.get(mediaId).catch(() => null);
  if (!asset || asset.location_id !== locationId || asset.status !== 'approved' || asset.media_type !== 'team_photo') {
    throw new Error('photo_media_id trebuie sa fie media aprobata team_photo din aceeasi locatie');
  }
}

async function assertNoTeamDuplicate(svc, member, profileId) {
  for (const locationId of member.assigned_location_ids) {
    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
      location_id: locationId,
      active_status: 'activ',
    }, null, 100);
    for (const assignment of assignments) {
      if (profileId && assignment.professional_id === profileId) continue;
      if (assignment.professional_type !== member.professional_type) continue;
      const profile = await svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null);
      if (profile && normalizePersonName(profile.full_name) === normalizePersonName(member.full_name)) {
        throw new Error('Exista deja un profesionist similar in aceasta locatie. Verifica manual inainte de aprobare.');
      }
    }
  }
}

async function applyTeam(svc, user, submission, payload) {
  const rootLoc = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
  if (!rootLoc) throw new Error('Locatia nu a fost gasita');
  for (const member of payload.members || []) {
    await assertLocationsInScope(svc, rootLoc, member.assigned_location_ids);
    await assertTeamPhoto(svc, submission.location_id, member.photo_media_id);
    let profile = member.professional_id
      ? await svc.entities.ProfessionalProfile.get(member.professional_id).catch(() => null)
      : null;
    if (member.professional_id && (!profile || !(await professionalAlreadyInScope(svc, rootLoc, member.professional_id)))) {
      throw new Error('ProfessionalProfile nu apartine scopului permis');
    }
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
      const existing = await svc.entities.ProfessionalLocationAssignment.filter({
        professional_id: profile.id,
        location_id: locationId,
      });
      const assignmentData = {
        professional_id: profile.id,
        location_id: locationId,
        professional_type: member.professional_type,
        active_status: 'activ',
        public_status: member.visible_on_public_profile ? 'public' : 'privat',
      };
      if (existing[0]) await svc.entities.ProfessionalLocationAssignment.update(existing[0].id, assignmentData);
      else await svc.entities.ProfessionalLocationAssignment.create(assignmentData);
    }
  }
  for (const professionalId of payload.removal_professional_ids || []) {
    if (!(await professionalAlreadyInScope(svc, rootLoc, professionalId))) {
      throw new Error('ProfessionalProfile de eliminat nu apartine scopului permis');
    }
    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
      professional_id: professionalId,
      location_id: submission.location_id,
    });
    for (const assignment of assignments) {
      await svc.entities.ProfessionalLocationAssignment.update(assignment.id, {
        active_status: 'inactiv',
        public_status: 'privat',
      });
    }
  }
  const invitationCount = (payload.invitations || []).length;
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: invitationCount ? 'approve_specialist_invitations_pending_email' : 'apply_team_submission',
    changed_fields: ['team'],
    next: invitationCount
      ? { invitations: payload.invitations }
      : { members: payload.members, removal_professional_ids: payload.removal_professional_ids },
    note: invitationCount
      ? 'Invitatiile au fost aprobate ca intentie. Nu s-au creat profiluri publice si nu s-au trimis emailuri pana nu exista lifecycle dedicat.'
      : 'Echipa publica aplicata dupa aprobare admin; nu s-au creat conturi de login.',
  });
}

async function applyMedia(svc, user, submission, payload) {
  for (const mediaId of payload.removal_media_ids || []) {
    const asset = await svc.entities.ProviderMediaAsset.get(mediaId).catch(() => null);
    if (!asset || asset.location_id !== submission.location_id) throw new Error('Media nu apartine acestei locatii');
    await svc.entities.ProviderMediaAsset.update(asset.id, {
      status: 'withdrawn',
      reviewed_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
    });
  }
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'apply_media_submission',
    changed_fields: ['media'],
    note: 'Media revalidata; uploadul brut este dezactivat pana exista metadate server-side sigure.',
  });
}

async function assertArticleReferences(svc, submission, payload) {
  if (payload.cover_media_id) {
    const cover = await svc.entities.ProviderMediaAsset.get(payload.cover_media_id).catch(() => null);
    if (!cover || cover.location_id !== submission.location_id || cover.status !== 'approved' || !['cover', 'gallery'].includes(cover.media_type)) {
      throw new Error('Cover media invalid sau neaprobat');
    }
  }
  if (payload.author_professional_id) {
    const assignment = await svc.entities.ProfessionalLocationAssignment.filter({
      professional_id: payload.author_professional_id,
      location_id: submission.location_id,
      active_status: 'activ',
    });
    if (assignment.length === 0) throw new Error('Autor profesional nealocat locatiei');
  }
}

async function applyArticle(svc, user, submission, payload) {
  await assertArticleReferences(svc, submission, payload);
  const loc = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
  const now = new Date().toISOString();
  const targetArticleId = String(submission.item_key || '').startsWith('article:')
    ? String(submission.item_key).slice('article:'.length)
    : '';
  const existing = targetArticleId
    ? await svc.entities.ProviderArticle.get(targetArticleId).catch(() => null)
    : null;
  if (targetArticleId && (!existing || existing.location_id !== submission.location_id)) {
    throw new Error('Articol tinta invalid sau in afara locatiei');
  }
  const slug = existing?.slug || await uniqueSlug(svc, slugify(payload.title), existing?.id || '');
  const articleData = {
    organization_id: loc?.organization_id || null,
    location_id: submission.location_id,
    author_professional_id: payload.author_professional_id || null,
    submitted_by_user_id: submission.submitted_by_user_id,
    title: payload.title,
    slug,
    excerpt: payload.excerpt,
    body: payload.body,
    cover_media_id: payload.cover_media_id || null,
    status: 'approved',
    published_at: existing?.published_at || now,
    reviewed_by_user_id: user.id,
    reviewed_at: now,
  };
  if (existing) await svc.entities.ProviderArticle.update(existing.id, articleData);
  else await svc.entities.ProviderArticle.create(articleData);
  await audit(svc, user, {
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'apply_article_submission',
    changed_fields: ['article'],
    next: { slug },
    note: 'Articol publicat doar dupa aprobare admin ca text simplu.',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori' }, { status: 403 });
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = payload.action;

    if (action === 'list') {
      const query = {};
      if (payload.status) query.status = payload.status;
      if (payload.section) query.section = payload.section;
      if (payload.location_id) query.location_id = payload.location_id;
      if (payload.organization_id) query.organization_id = payload.organization_id;
      const submissions = await svc.entities.ProviderWorkspaceSubmission.filter(query, '-created_date', 100);
      return Response.json({ submissions });
    }

    if (action === 'get') {
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      let service_metadata = null;
      if (submission.section === 'services') {
        let servicePayload = {};
        try { servicePayload = JSON.parse(submission.payload_json || '{}'); } catch (_error) { servicePayload = {}; }
        service_metadata = Object.values(servicePayload.selected_ids || {})
          .flat()
          .map((key) => getCanonicalServiceDefinition(key))
          .filter(Boolean);
      }
      return Response.json({ submission, service_metadata });
    }

    if (action === 'approve') {
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (submission.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      let parsedPayload = null;
      try { parsedPayload = JSON.parse(submission.payload_json || '{}'); } catch (_error) { parsedPayload = null; }
      const validation = validatePayload(submission.section, parsedPayload);
      if (!validation.valid) return Response.json(validation.body, { status: validation.status });
      const note = cleanString(payload.note);
      const now = new Date().toISOString();

      if (submission.section === 'public_profile' || submission.section === 'location_details') {
        await applyProviderLocationFields(svc, user, submission, validation);
      } else if (submission.section === 'services') {
        await applyServices(svc, user, submission, validation.clean);
      } else if (submission.section === 'team') {
        await assertPublicEligible(base44, submission.location_id);
        await applyTeam(svc, user, submission, validation.clean);
      } else if (submission.section === 'media') {
        await assertPublicEligible(base44, submission.location_id);
        await applyMedia(svc, user, submission, validation.clean);
      } else if (submission.section === 'article') {
        await assertPublicEligible(base44, submission.location_id);
        await applyArticle(svc, user, submission, validation.clean);
      } else {
        return Response.json({ error: 'Sectiune necunoscuta' }, { status: 400 });
      }

      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'approved',
        reviewed_by_user_id: user.id,
        reviewed_at: now,
        admin_note: note,
      });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: 'approve_submission',
        changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'],
        previous: { status: submission.status },
        next: { status: 'approved' },
        note,
      });
      return Response.json({ success: true });
    }

    if (action === 'reject') {
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (submission.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      const note = cleanString(payload.note);
      if (!note) return Response.json({ error: 'Respingerea necesita o nota' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'rejected',
        reviewed_by_user_id: user.id,
        reviewed_at: new Date().toISOString(),
        admin_note: note,
      });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: 'reject_submission',
        changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'],
        previous: { status: submission.status },
        next: { status: 'rejected' },
        note,
      });
      return Response.json({ success: true });
    }

    if (action === 'request_more_info') {
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (submission.status !== 'pending_review') return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      const note = cleanString(payload.note);
      if (!note) return Response.json({ error: 'Solicitarea de informatii necesita o nota' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'needs_more_info',
        reviewed_by_user_id: user.id,
        reviewed_at: new Date().toISOString(),
        admin_note: note,
      });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: 'request_more_info',
        changed_fields: ['status', 'reviewed_by_user_id', 'reviewed_at'],
        previous: { status: submission.status },
        next: { status: 'needs_more_info' },
        note,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
