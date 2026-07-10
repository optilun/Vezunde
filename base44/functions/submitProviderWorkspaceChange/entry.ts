import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  CLAIM_PREP_SERVICE_GROUPS as CANONICAL_CLAIM_PREP_SERVICE_GROUPS,
  getCanonicalServiceGroupIds,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistry.js';

// Provider Workspace draft/submit/withdraw.
// Public changes go through ProviderWorkspaceSubmission. Program remains fast-path.

const PROVIDER_WORKSPACE_SECTIONS = ['public_profile', 'location_details', 'services', 'team', 'media', 'article'];
const CLAIM_PREP_SECTIONS = ['public_profile', 'operating_hours', 'services'];
const WRITABLE_SECTIONS = [...new Set([...PROVIDER_WORKSPACE_SECTIONS, ...CLAIM_PREP_SECTIONS])];
const ACTIVE_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const MAX_FIELD_LEN = 2000;
const MAX_ARTICLE_BODY = 20000;
const MAX_HOURS_LEN = 500;

const CLAIM_PREP_PUBLIC_PROFILE_FIELDS = ['public_description', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'public_phone', 'public_email'];
const CLAIM_PREP_SERVICE_GROUPS = [...CANONICAL_CLAIM_PREP_SERVICE_GROUPS, 'patient_services'];
const AVAILABILITY_STATUSES = ['astazi', 'urmatoarele_zile', 'saptamana_aceasta', 'doar_programare', 'necunoscuta'];
const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const PROFESSIONAL_TYPES = ['ophthalmologist', 'optometrist', 'optician'];
const SPECIALIST_INVITE_ROLES = ['ophthalmologist', 'optometrist', 'optician', 'contact_lens_specialist', 'optical_workshop_specialist', 'other_specialist', 'other_relevant_specialist'];

// Create a fresh adapter object. Do not mutate or extend a frozen registry object.
const SERVICE_IDS = {
  ...getCanonicalServiceGroupIds(),
  // Legacy bucket kept only for old drafts / claim-preparation compatibility.
  patient_services: ['eyeglasses', 'frames', 'prescription_lenses', 'contact_lenses', 'optometry_consultation', 'ophthalmology_consultation'],
};

const SECTION_FIELDS = {
  public_profile: ['public_display_name', 'public_description', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'public_phone', 'public_email'],
  location_details: ['address', 'public_display_name', 'public_phone', 'public_email', 'lat', 'lng', 'place_id'],
  operating_hours: ['opening_hours', 'saturday_hours', 'availability_status'],
  services: ['selected_ids', 'removal_ids', 'raw_removal_keys', 'suggestions', 'custom_requests'],
  team: ['members', 'removal_professional_ids', 'invitations', 'invite_flow', 'invitation_channel'],
  media: ['assets', 'removal_media_ids'],
  article: ['title', 'excerpt', 'body', 'cover_media_id', 'author_professional_id'],
};

function bad(body, status = 400) { return { valid: false, status, body }; }
function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function cleanString(value) { return String(value || '').trim(); }
function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

function checkUnknown(section, payload, allowedOverride = null) {
  const allowed = allowedOverride || SECTION_FIELDS[section];
  if (!allowed) return bad({ error: 'Sectiunea nu este disponibila pentru editare' });
  if (!isPlainObject(payload)) return bad({ error: 'Payload invalid' });
  const keys = Object.keys(payload);
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length > 0) return bad({ error: 'Camp nepermis', fields: unknown });
  if (keys.length === 0) return bad({ error: 'Payload gol' });
  return { valid: true, keys };
}

function validateTextPayload(section, payload, allowedOverride = null) {
  const base = checkUnknown(section, payload, allowedOverride);
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
      const value = Number(String(payload[key]).trim().replace(',', '.'));
      if (!Number.isFinite(value) || value < min || value > max) return bad({ error: `${key} invalid` });
      clean[key] = value;
    }
  }
  const hasLat = clean.lat !== undefined && clean.lat !== null;
  const hasLng = clean.lng !== undefined && clean.lng !== null;
  if (hasLat !== hasLng) return bad({ error: 'Completeaza si latitudinea, si longitudinea pentru pin exact.' });
  return Object.keys(clean).length ? { valid: true, clean } : bad({ error: 'Payload gol' });
}

function validateOperatingHours(payload) {
  const base = checkUnknown('operating_hours', payload);
  if (!base.valid) return base;
  const clean = {};
  if ('opening_hours' in payload) {
    const value = cleanString(payload.opening_hours);
    if (value.length > MAX_HOURS_LEN) return bad({ error: 'Programul este prea lung' });
    clean.opening_hours = value;
  }
  if ('saturday_hours' in payload) {
    const value = cleanString(payload.saturday_hours);
    if (value.length > MAX_HOURS_LEN) return bad({ error: 'Programul de sambata este prea lung' });
    clean.saturday_hours = value;
  }
  if ('availability_status' in payload) {
    if (!AVAILABILITY_STATUSES.includes(payload.availability_status)) return bad({ error: 'Mod de primire invalid' });
    clean.availability_status = payload.availability_status;
  }
  return Object.keys(clean).length ? { valid: true, clean } : bad({ error: 'Payload gol' });
}

function validateServiceGroupObject(value, fieldName, allowedGroups) {
  if (value === undefined) return { valid: true, clean: {} };
  if (!isPlainObject(value)) return bad({ error: `${fieldName} trebuie sa fie obiect` });
  const allowed = allowedGroups || Object.keys(SERVICE_IDS);
  const unknownGroups = Object.keys(value).filter((group) => !allowed.includes(group));
  if (unknownGroups.length > 0) return bad({ error: 'Grup de servicii nepermis', fields: unknownGroups });
  const clean = {};
  for (const [group, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) return bad({ error: `${fieldName}.${group} trebuie sa fie lista` });
    const unique = [...new Set(ids.map((id) => cleanString(id)).filter(Boolean))];
    const invalid = unique.filter((id) => !SERVICE_IDS[group]?.includes(id));
    if (invalid.length > 0) return bad({ error: 'ID canonic invalid', fields: invalid });
    if (unique.length > 0) clean[group] = unique;
  }
  return { valid: true, clean };
}

function validateRawRemovalKeys(value, allowRawRemovals) {
  if (value === undefined) return { valid: true, clean: [] };
  if (!allowRawRemovals) return bad({ error: 'Eliminarea cheilor legacy nu este permisa in pregatirea revendicarii' });
  if (!Array.isArray(value)) return bad({ error: 'raw_removal_keys trebuie sa fie lista' });
  const clean = [...new Set(value.map(cleanString).filter(Boolean))];
  if (clean.some((key) => key.length > 160)) return bad({ error: 'Cheie legacy invalida' });
  // Canonical keys must use removal_ids. This field is only for legacy/ambiguous/unknown rows.
  const canonical = clean.filter((key) => normalizeServiceKey(key).status === 'canonical');
  if (canonical.length > 0) return bad({ error: 'Cheile canonice trebuie eliminate prin removal_ids', fields: canonical });
  return { valid: true, clean };
}

function normalizeSuggestions(payload, allowSuggestions) {
  const raw = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.custom_requests)
      ? payload.custom_requests
      : [];
  if (raw.length && !allowSuggestions) return bad({ error: 'Sugestiile nu sunt permise in pregatirea revendicarii' });
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

function validateServices(payload, options = {}) {
  const base = checkUnknown('services', payload);
  if (!base.valid) return base;
  const selected = validateServiceGroupObject(payload.selected_ids, 'selected_ids', options.allowedGroups || null);
  if (!selected.valid) return selected;
  const removals = validateServiceGroupObject(payload.removal_ids, 'removal_ids', options.allowedGroups || null);
  if (!removals.valid) return removals;
  const rawRemovals = validateRawRemovalKeys(payload.raw_removal_keys, options.allowRawRemovals !== false);
  if (!rawRemovals.valid) return rawRemovals;
  const suggestions = normalizeSuggestions(payload, options.allowSuggestions !== false);
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

function validateTeam(payload, context) {
  const base = checkUnknown('team', payload);
  if (!base.valid) return base;
  const clean = { members: [], removal_professional_ids: [], invitations: [] };
  const rawInvitations = Array.isArray(payload.invitations) ? payload.invitations : [];
  for (const invite of rawInvitations) {
    if (!isPlainObject(invite)) return bad({ error: 'Invitatie invalida' });
    const email = validateEmail(invite.email);
    const professionalRole = cleanString(invite.professional_role || invite.professional_type || '');
    if (!email) return bad({ error: 'Email specialist invalid' });
    if (!SPECIALIST_INVITE_ROLES.includes(professionalRole)) return bad({ error: 'Rol profesional invalid' });
    clean.invitations.push({ email, professional_role: professionalRole, invite_status: 'pending_invite' });
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
      const outsideScope = assignedLocationIds.filter((id) => !context.permittedLocationIds.includes(id));
      if (outsideScope.length > 0) return bad({ error: 'Locatie in afara scopului permis', fields: outsideScope }, 403);
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
  const clean = { assets: [], removal_media_ids: [] };
  if (payload.assets !== undefined) return bad({ error: 'Incarcarea media este momentan indisponibila in siguranta. Nu trimite storage_reference brut.' }, 503);
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

function validatePayload(section, payload, context, access) {
  if (access.mode === 'applicant_preparation') {
    if (!CLAIM_PREP_SECTIONS.includes(section)) return bad({ error: 'Sectiunea nu este disponibila in pregatirea revendicarii' }, 403);
    if (section === 'public_profile') return validateTextPayload(section, payload, CLAIM_PREP_PUBLIC_PROFILE_FIELDS);
    if (section === 'operating_hours') return validateOperatingHours(payload);
    if (section === 'services') {
      return validateServices(payload, {
        allowedGroups: CLAIM_PREP_SERVICE_GROUPS,
        allowSuggestions: false,
        allowRawRemovals: false,
      });
    }
  }
  if (section === 'operating_hours') return bad({ error: 'Programul se actualizeaza prin actiunea rapida dupa aprobarea revendicarii' }, 400);
  if (section === 'public_profile') return validateTextPayload(section, payload);
  if (section === 'location_details') return validateLocationDetails(payload);
  if (section === 'services') return validateServices(payload, { allowRawRemovals: true });
  if (section === 'team') return validateTeam(payload, context);
  if (section === 'media') return validateMedia(payload);
  if (section === 'article') return validateArticle(payload);
  return bad({ error: 'Sectiunea nu este disponibila pentru editare' });
}

function normalizeItemKey(payload) {
  const raw = payload.item_key
    || (payload.target_article_id ? `article:${payload.target_article_id}` : '')
    || (payload.draft_item_id ? `draft:${payload.draft_item_id}` : '')
    || `new:${crypto.randomUUID()}`;
  const key = String(raw).trim();
  if (!/^[a-zA-Z0-9:_-]{1,120}$/.test(key)) return null;
  return key;
}

function sanitizeSubmission(submission) {
  const showNote = ['needs_more_info', 'rejected'].includes(submission.status);
  return {
    id: submission.id,
    organization_id: submission.organization_id || null,
    location_id: submission.location_id,
    claim_request_id: submission.claim_request_id || '',
    access_origin: submission.access_origin || 'provider_workspace',
    section: submission.section,
    item_key: submission.item_key || '',
    status: submission.status,
    payload_json: submission.payload_json || '{}',
    submitted_at: submission.submitted_at || null,
    admin_note: showNote ? (submission.admin_note || '') : '',
    created_date: submission.created_date,
    updated_date: submission.updated_date,
  };
}

function safeConflict(submission) {
  return { conflict: true, section: submission.section, status: submission.status, message: 'Exista deja o modificare in lucru pentru aceasta sectiune.' };
}
function isLockedPreparation(submission) { return !!submission.preparation_locked_at || submission.preparation_lock_reason === 'claim_rejected'; }
function isPromotedPrivateDraft(submission) { return (submission.access_origin || 'provider_workspace') === 'provider_workspace' && !!submission.claim_request_id; }

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

async function assertSubmittedReferences(svc, locationId, section, payload) {
  if (section === 'services') {
    for (const rawKey of payload.raw_removal_keys || []) {
      const rows = await svc.entities.LocationService.filter({ location_id: locationId, service_key: rawKey });
      if (!rows.some((row) => row.is_active !== false)) {
        return bad({ error: 'Serviciul legacy sau necunoscut nu exista activ in aceasta locatie', fields: [rawKey] });
      }
    }
  }
  if (section === 'team') {
    for (const member of payload.members || []) {
      if (!member.photo_media_id) continue;
      const asset = await svc.entities.ProviderMediaAsset.get(member.photo_media_id).catch(() => null);
      if (!asset || asset.location_id !== locationId || asset.status !== 'approved' || asset.media_type !== 'team_photo') {
        return bad({ error: 'photo_media_id trebuie sa fie media aprobata team_photo din aceeasi locatie' });
      }
    }
  }
  if (section === 'media') {
    for (const mediaId of payload.removal_media_ids || []) {
      const asset = await svc.entities.ProviderMediaAsset.get(mediaId).catch(() => null);
      if (!asset || asset.location_id !== locationId) return bad({ error: 'Media nu apartine acestei locatii' });
    }
  }
  if (section === 'article') {
    if (payload.cover_media_id) {
      const asset = await svc.entities.ProviderMediaAsset.get(payload.cover_media_id).catch(() => null);
      if (!asset || asset.location_id !== locationId || asset.status !== 'approved' || !['cover', 'gallery'].includes(asset.media_type)) {
        return bad({ error: 'cover_media_id trebuie sa fie media aprobata din aceeasi locatie' });
      }
    }
    if (payload.author_professional_id) {
      const assignment = await svc.entities.ProfessionalLocationAssignment.filter({
        professional_id: payload.author_professional_id,
        location_id: locationId,
        active_status: 'activ',
      });
      if (assignment.length === 0) return bad({ error: 'Autor profesional nealocat locatiei' });
    }
  }
  return { valid: true };
}

async function resolveAccess(svc, user, payload) {
  const requestedLocationId = cleanString(payload.location_id);
  if (requestedLocationId) {
    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: requestedLocationId,
      status: 'active',
    });
    if (memberships.some((membership) => normalizeMemberRole(membership.role))) {
      const loc = await svc.entities.ProviderLocation.get(requestedLocationId).catch(() => null);
      if (!loc) return bad({ error: 'Locatia nu a fost gasita' }, 404);
      if (loc.profile_control_status === 'suspended') return bad({ error: 'Profilul este suspendat' }, 403);
      const allMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' });
      const permittedLocationIds = [...new Set(allMemberships
        .filter((membership) => normalizeMemberRole(membership.role))
        .map((membership) => membership.location_id)
        .filter(Boolean))];
      return {
        valid: true,
        mode: 'provider_workspace',
        loc,
        location_id: requestedLocationId,
        claim: null,
        context: { permittedLocationIds },
      };
    }
  }

  const claimId = cleanString(payload.claim_request_id);
  let claim = null;
  if (claimId) claim = await svc.entities.ProviderClaimRequest.get(claimId).catch(() => null);
  else if (requestedLocationId) {
    const claims = await svc.entities.ProviderClaimRequest.filter({
      user_id: user.id,
      location_id: requestedLocationId,
      status: { $in: ACTIVE_CLAIM_STATUSES },
    }, '-created_date', 5);
    claim = claims[0] || null;
  }

  if (!claim || claim.user_id !== user.id) return bad({ error: 'Nu ai acces la aceasta locatie sau revendicare' }, 403);
  if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) return bad({ error: 'Revendicarea nu permite pregatire in acest status' }, 403);
  if (!claim.location_id) return bad({ error: 'Revendicarea nu are locatie asociata pentru pregatire' }, 400);
  if (requestedLocationId && requestedLocationId !== claim.location_id) return bad({ error: 'Revendicarea nu apartine acestei locatii' }, 403);

  const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
  if (!loc) return bad({ error: 'Locatia revendicata nu a fost gasita' }, 404);
  if (loc.profile_control_status === 'suspended') return bad({ error: 'Profilul este suspendat' }, 403);
  return {
    valid: true,
    mode: 'applicant_preparation',
    loc,
    location_id: claim.location_id,
    claim,
    context: { permittedLocationIds: [claim.location_id] },
  };
}

function activeSubmissionQuery(access, section, itemKey = '') {
  if (access.mode === 'applicant_preparation') {
    return {
      location_id: access.location_id,
      claim_request_id: access.claim.id,
      access_origin: 'claim_preparation',
      submitted_by_user_id: access.claim.user_id,
      section,
      status: { $in: ACTIVE_STATUSES },
    };
  }
  const query = {
    location_id: access.location_id,
    access_origin: 'provider_workspace',
    section,
    status: { $in: ACTIVE_STATUSES },
  };
  if (section === 'article') query.item_key = itemKey;
  return query;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = payload.action;
    if (!['list_mine', 'create_draft', 'update_draft', 'submit', 'withdraw'].includes(action)) {
      return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    }

    const access = await resolveAccess(svc, user, payload);
    if (!access.valid) return Response.json(access.body, { status: access.status });

    if (action === 'list_mine') {
      if (access.mode === 'applicant_preparation') {
        const ownSubs = await svc.entities.ProviderWorkspaceSubmission.filter({
          location_id: access.location_id,
          claim_request_id: access.claim.id,
          access_origin: 'claim_preparation',
          submitted_by_user_id: user.id,
        }, '-created_date', 50);
        return Response.json({
          mode: access.mode,
          submissions: ownSubs.filter((submission) => !isLockedPreparation(submission)).map(sanitizeSubmission),
          conflicts: [],
        });
      }
      const ownSubs = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: access.location_id,
        submitted_by_user_id: user.id,
        access_origin: 'provider_workspace',
      }, '-created_date', 50);
      const otherActive = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: access.location_id,
        access_origin: 'provider_workspace',
        status: { $in: ACTIVE_STATUSES },
      }, '-created_date', 50);
      return Response.json({
        mode: access.mode,
        submissions: ownSubs.map(sanitizeSubmission),
        conflicts: otherActive
          .filter((submission) => submission.submitted_by_user_id !== user.id && submission.section !== 'article' && !isPromotedPrivateDraft(submission))
          .map(safeConflict),
      });
    }

    if (!payload.section || !WRITABLE_SECTIONS.includes(payload.section)) {
      return Response.json({ error: 'Aceasta sectiune nu este disponibila' }, { status: 400 });
    }

    if (action === 'create_draft') {
      if (!payload.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });
      const result = validatePayload(payload.section, payload.payload, access.context, access);
      if (!result.valid) return Response.json(result.body, { status: result.status });
      const referenceCheck = await assertSubmittedReferences(svc, access.location_id, payload.section, result.clean);
      if (!referenceCheck.valid) return Response.json(referenceCheck.body, { status: referenceCheck.status });
      const itemKey = access.mode === 'provider_workspace' && payload.section === 'article' ? normalizeItemKey(payload) : '';
      if (access.mode === 'provider_workspace' && payload.section === 'article' && !itemKey) {
        return Response.json({ error: 'item_key invalid' }, { status: 400 });
      }
      const existing = await svc.entities.ProviderWorkspaceSubmission.filter(
        activeSubmissionQuery(access, payload.section, itemKey),
        '-created_date',
        10,
      );
      if (existing.length > 0) {
        const own = existing.find((submission) => {
          if (submission.submitted_by_user_id !== user.id || isLockedPreparation(submission)) return false;
          if (access.mode === 'applicant_preparation') {
            return submission.access_origin === 'claim_preparation' && submission.claim_request_id === access.claim.id;
          }
          return (submission.access_origin || 'provider_workspace') === 'provider_workspace';
        });
        if (own) return Response.json({ submission: sanitizeSubmission(own), resumed: true });
        const blocking = existing.find((submission) => (
          (submission.access_origin || 'provider_workspace') === 'provider_workspace'
          && !isPromotedPrivateDraft(submission)
        ));
        if (blocking) return Response.json(safeConflict(blocking), { status: 409 });
      }

      const submission = await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: access.loc.organization_id || null,
        location_id: access.location_id,
        claim_request_id: access.mode === 'applicant_preparation' ? access.claim.id : '',
        access_origin: access.mode === 'applicant_preparation' ? 'claim_preparation' : 'provider_workspace',
        section: payload.section,
        item_key: itemKey,
        payload_json: JSON.stringify(result.clean),
        status: 'draft',
        submitted_by_user_id: user.id,
      });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: access.mode === 'applicant_preparation' ? 'create_claim_preparation_draft' : 'create_draft',
        changed_fields: ['section', 'status', 'payload_json', 'access_origin', 'claim_request_id'],
        next: {
          section: payload.section,
          status: 'draft',
          access_origin: submission.access_origin,
          claim_request_id: submission.claim_request_id || '',
        },
        note: `Draft creat pentru sectiunea ${payload.section}`,
      });
      return Response.json({ submission: sanitizeSubmission(submission) });
    }

    if (action === 'update_draft') {
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      if (!payload.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Draftul nu a fost gasit' }, { status: 404 });
      if (isLockedPreparation(submission)) return Response.json({ error: 'Draftul de pregatire este blocat' }, { status: 403 });
      if (submission.location_id !== access.location_id) return Response.json({ error: 'Draftul nu apartine acestei locatii' }, { status: 403 });
      if (submission.section !== payload.section) return Response.json({ error: 'Sectiunea draftului nu se potriveste' }, { status: 400 });
      if (submission.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti modifica acest draft' }, { status: 403 });
      if (access.mode === 'applicant_preparation' && (submission.access_origin !== 'claim_preparation' || submission.claim_request_id !== access.claim.id)) {
        return Response.json({ error: 'Draftul nu apartine revendicarii tale active' }, { status: 403 });
      }
      if (access.mode === 'provider_workspace' && (submission.access_origin || 'provider_workspace') !== 'provider_workspace') {
        return Response.json({ error: 'Draftul de pregatire nu poate fi modificat din workspace-ul providerului' }, { status: 403 });
      }
      if (!['draft', 'needs_more_info'].includes(submission.status)) {
        return Response.json({ error: 'Doar drafturile pot fi modificate' }, { status: 400 });
      }

      const result = validatePayload(payload.section, payload.payload, access.context, access);
      if (!result.valid) return Response.json(result.body, { status: result.status });
      const referenceCheck = await assertSubmittedReferences(svc, access.location_id, payload.section, result.clean);
      if (!referenceCheck.valid) return Response.json(referenceCheck.body, { status: referenceCheck.status });
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        payload_json: JSON.stringify(result.clean),
        status: 'draft',
      });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: access.mode === 'applicant_preparation' ? 'update_claim_preparation_draft' : 'update_draft',
        changed_fields: ['payload_json', 'status'],
        previous: { status: submission.status },
        note: `Draft actualizat pentru sectiunea ${payload.section}`,
      });
      return Response.json({ success: true });
    }

    if (action === 'submit') {
      if (access.mode !== 'provider_workspace') {
        return Response.json({ error: 'Drafturile de pregatire nu pot fi trimise spre publicare inainte de aprobarea revendicarii' }, { status: 403 });
      }
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Draftul nu a fost gasit' }, { status: 404 });
      if (isLockedPreparation(submission)) return Response.json({ error: 'Draftul de pregatire este blocat' }, { status: 403 });
      if (submission.location_id !== access.location_id) return Response.json({ error: 'Draftul nu apartine acestei locatii' }, { status: 403 });
      if (submission.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti trimite acest draft' }, { status: 403 });
      if ((submission.access_origin || 'provider_workspace') !== 'provider_workspace') {
        return Response.json({ error: 'Draftul de pregatire nu poate fi trimis' }, { status: 403 });
      }
      if (submission.section === 'operating_hours') {
        return Response.json({ error: 'Programul se aplica prin update rapid, nu prin review admin' }, { status: 400 });
      }
      if (!['draft', 'needs_more_info'].includes(submission.status)) {
        return Response.json({ error: 'Draftul nu poate fi trimis' }, { status: 400 });
      }
      const now = new Date().toISOString();
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'pending_review', submitted_at: now });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: 'submit_for_review',
        changed_fields: ['status', 'submitted_at'],
        previous: { status: submission.status },
        next: { status: 'pending_review' },
        note: `Submission trimisa pentru sectiunea ${submission.section}`,
      });
      return Response.json({ success: true });
    }

    if (action === 'withdraw') {
      if (!payload.submission_id) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(payload.submission_id).catch(() => null);
      if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });
      if (isLockedPreparation(submission)) return Response.json({ error: 'Draftul de pregatire este blocat' }, { status: 403 });
      if (submission.location_id !== access.location_id) return Response.json({ error: 'Submission nu apartine acestei locatii' }, { status: 403 });
      if (submission.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poti retrage aceasta submission' }, { status: 403 });
      if (!ACTIVE_STATUSES.includes(submission.status)) return Response.json({ error: 'Submission nu poate fi retrasa' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission',
        entity_id: submission.id,
        action_type: 'withdraw_submission',
        changed_fields: ['status'],
        previous: { status: submission.status },
        next: { status: 'withdrawn' },
        note: `Submission retrasa pentru sectiunea ${submission.section}`,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
