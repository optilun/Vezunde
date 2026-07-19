import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REVIEW_STATUSES = ['pending_review', 'needs_more_info', 'approved', 'rejected'];
const ALLOWED_FIELDS = [
  'public_display_name',
  'professional_bio',
  'specializations',
  'profile_photo_url',
  'public_website_url',
  'linkedin_url',
  'facebook_url',
  'instagram_url',
  'public_phone',
  'public_email',
  'accepts_independent_requests',
];

const SPECIALIZATIONS_BY_TYPE = {
  ophthalmologist: [
    'general_ophthalmology', 'pediatric_ophthalmology', 'glaucoma', 'retina', 'cornea',
    'cataract', 'refractive_surgery', 'dry_eye', 'myopia_management',
  ],
  optometrist: [
    'refraction', 'contact_lenses', 'pediatric_optometry', 'binocular_vision',
    'myopia_management', 'low_vision', 'occupational_vision',
  ],
  optician: [
    'frame_consulting', 'ophthalmic_lenses', 'progressive_lenses', 'lens_fitting',
    'adjustments_repairs', 'children_eyewear', 'protective_eyewear',
  ],
};

function res(body, status = 200) {
  return Response.json(body, { status });
}

function text(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function parseDraft(profile) {
  try {
    const parsed = JSON.parse(String(profile.pending_profile_json || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function publicUrl(value, field) {
  const raw = text(value);
  if (!raw) return { value: '' };
  if (raw.length > 500) return { error: `${field} este prea lung` };
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !parsed.hostname.includes('.')) {
      return { error: `${field} trebuie sa fie un link web valid` };
    }
    return { value: parsed.toString() };
  } catch (_error) {
    return { error: `${field} trebuie sa fie un link web valid` };
  }
}

function validateDraft(rawDraft, professionalType) {
  const draft = rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft) ? rawDraft : {};
  const unknown = Object.keys(draft).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unknown.length) return { error: 'Draftul contine campuri nepermise', fields: unknown };

  const name = text(draft.public_display_name);
  if (name.length < 3 || name.length > 120 || /[<>]/.test(name)) return { error: 'Numele public este invalid' };

  const bio = text(draft.professional_bio);
  if (bio.length < 80 || bio.length > 1200 || /[<>]/.test(bio)) return { error: 'Descrierea profesionala trebuie sa aiba intre 80 si 1200 de caractere' };

  const allowedSpecializations = new Set(SPECIALIZATIONS_BY_TYPE[professionalType] || []);
  const specializations = [...new Set((Array.isArray(draft.specializations) ? draft.specializations : []).map(text).filter(Boolean))];
  if (specializations.length === 0 || specializations.length > 12) return { error: 'Profilul trebuie sa aiba intre 1 si 12 specializari' };
  if (specializations.some((item) => !allowedSpecializations.has(item))) return { error: 'Draftul contine specializari incompatibile cu tipul profesional' };

  const photo = text(draft.profile_photo_url);
  if (photo.length > 800000) return { error: 'Fotografia este prea mare' };
  if (photo && !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(photo)) {
    const checkedPhoto = publicUrl(photo, 'Fotografia');
    if (checkedPhoto.error) return checkedPhoto;
  }

  const website = publicUrl(draft.public_website_url, 'Website-ul profesional');
  if (website.error) return website;
  const linkedin = publicUrl(draft.linkedin_url, 'LinkedIn');
  if (linkedin.error) return linkedin;
  const facebook = publicUrl(draft.facebook_url, 'Facebook');
  if (facebook.error) return facebook;
  const instagram = publicUrl(draft.instagram_url, 'Instagram');
  if (instagram.error) return instagram;

  const email = text(draft.public_email).toLowerCase();
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Email public invalid' };

  const phone = text(draft.public_phone);
  if (phone && (phone.length > 80 || !/^[0-9+().\-\s]{6,80}$/.test(phone))) return { error: 'Telefon public invalid' };

  const acceptsIndependentRequests = draft.accepts_independent_requests === true;
  if (acceptsIndependentRequests && !email && !phone) return { error: 'Pentru cereri independente este necesar un telefon sau email public' };

  return {
    value: {
      public_display_name: name,
      professional_bio: bio,
      specializations,
      profile_photo_url: photo,
      public_website_url: website.value,
      linkedin_url: linkedin.value,
      facebook_url: facebook.value,
      instagram_url: instagram.value,
      public_phone: phone,
      public_email: email,
      accepts_independent_requests: acceptsIndependentRequests,
    },
  };
}

function safeDraft(profile) {
  const parsed = parseDraft(profile);
  return Object.fromEntries(ALLOWED_FIELDS.filter((key) => key in parsed).map((key) => [key, parsed[key]]));
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id,
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

async function assignmentRows(svc, professionalId) {
  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId }, '-created_date', 100);
  const rows = [];
  for (const assignment of assignments) {
    const location = await svc.entities.ProviderLocation.get(assignment.location_id).catch(() => null);
    rows.push({
      id: assignment.id,
      location_id: assignment.location_id,
      active_status: assignment.active_status || 'activ',
      public_status: assignment.public_status || 'privat',
      visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
      visibility_requested_at: assignment.visibility_requested_at || null,
      visibility_decided_at: assignment.visibility_decided_at || null,
      location: location ? {
        id: location.id,
        name: location.public_display_name || location.name || 'Locatie',
        city: location.locality_name || location.city || '',
        address: location.address || '',
        status: location.status || 'draft',
        active_status: location.active_status || 'activa',
        profile_control_status: location.profile_control_status || 'directory',
      } : null,
    });
  }
  return rows;
}

async function listProfiles(svc, payload) {
  const status = REVIEW_STATUSES.includes(text(payload.status)) ? text(payload.status) : 'pending_review';
  const profiles = await svc.entities.ProfessionalProfile.filter({ profile_review_status: status }, '-submitted_at', 100);
  const items = [];
  for (const profile of profiles) {
    items.push({
      id: profile.id,
      full_name: profile.full_name || '',
      professional_type: profile.professional_type || '',
      profile_review_status: profile.profile_review_status || 'draft',
      verification_status: profile.verification_status || 'unverified',
      public_visibility_status: profile.public_visibility_status || 'draft',
      is_public: profile.is_public === true,
      profile_completeness: Number(profile.profile_completeness || 0),
      submitted_at: profile.submitted_at || null,
      reviewed_at: profile.reviewed_at || null,
      review_note: profile.review_note || '',
      draft: safeDraft(profile),
      assignments: await assignmentRows(svc, profile.id),
    });
  }
  return res({ profiles: items, status });
}

function eligibleLocation(location) {
  if (!location) return false;
  if (location.status !== 'publicata') return false;
  if (location.active_status === 'inactiva') return false;
  if (location.profile_control_status === 'suspended') return false;
  return true;
}

async function reconcileAssignmentsAfterApproval(svc, user, profile) {
  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: profile.id }, '-created_date', 100);
  const published = [];
  const privateIds = [];
  const awaitingConsent = [];
  for (const assignment of assignments) {
    const consentStatus = assignment.visibility_consent_status || 'not_requested';
    const location = assignment.active_status === 'activ'
      ? await svc.entities.ProviderLocation.get(assignment.location_id).catch(() => null)
      : null;
    const nextStatus = assignment.active_status === 'activ'
      && consentStatus === 'accepted'
      && eligibleLocation(location)
      ? 'public'
      : 'privat';

    if (assignment.public_status !== nextStatus) {
      await svc.entities.ProfessionalLocationAssignment.update(assignment.id, { public_status: nextStatus });
      await audit(svc, user, {
        entity_type: 'ProfessionalLocationAssignment',
        entity_id: assignment.id,
        action_type: nextStatus === 'public' ? 'preserve_consented_professional_assignment' : 'keep_professional_assignment_private',
        changed_fields: ['public_status'],
        previous: { public_status: assignment.public_status || 'privat' },
        next: { public_status: nextStatus, visibility_consent_status: consentStatus },
        note: nextStatus === 'public'
          ? 'Asocierea a ramas publica deoarece specialistul isi exprimase deja acordul.'
          : 'Aprobarea profilului nu publica automat asocierea. Este necesar acordul separat al specialistului pentru aceasta locatie.',
      });
    }

    if (nextStatus === 'public') published.push(assignment.id);
    else {
      privateIds.push(assignment.id);
      if (assignment.active_status === 'activ' && consentStatus !== 'declined' && consentStatus !== 'revoked') awaitingConsent.push(assignment.id);
    }
  }
  return { published, private: privateIds, awaiting_consent: awaitingConsent };
}

async function decide(svc, user, payload) {
  const profileId = text(payload.professional_id || payload.profile_id);
  const action = text(payload.action);
  const note = text(payload.note);
  if (!profileId) return res({ error: 'professional_id este obligatoriu' }, 400);
  if (!['approve', 'request_more_info', 'reject'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
  if (action !== 'approve' && !note) return res({ error: 'Nota este obligatorie' }, 400);

  const profile = await svc.entities.ProfessionalProfile.get(profileId).catch(() => null);
  if (!profile) return res({ error: 'Profilul profesional nu a fost gasit' }, 404);
  if (profile.profile_review_status !== 'pending_review') return res({ error: 'Profilul nu mai este in verificare' }, 409);

  const now = new Date().toISOString();
  const wasPublic = profile.is_public === true && profile.public_visibility_status === 'approved';

  if (action === 'approve') {
    const checked = validateDraft(parseDraft(profile), profile.professional_type || '');
    if (checked.error) return res({ error: checked.error, fields: checked.fields || [] }, 400);

    const previous = Object.fromEntries(ALLOWED_FIELDS.map((key) => [key, profile[key]]));
    const updates = {
      ...checked.value,
      bio: checked.value.professional_bio,
      profile_review_status: 'approved',
      verification_status: 'verified',
      public_visibility_status: 'approved',
      is_public: true,
      pending_profile_json: '',
      reviewed_at: now,
      reviewed_by_user_id: user.id,
      verified_at: now,
      verified_by_user_id: user.id,
      review_note: note,
      profile_updated_at: now,
    };
    await svc.entities.ProfessionalProfile.update(profile.id, updates);
    const assignments = await reconcileAssignmentsAfterApproval(svc, user, profile);
    await audit(svc, user, {
      entity_type: 'ProfessionalProfile',
      entity_id: profile.id,
      action_type: 'approve_professional_profile',
      changed_fields: [...ALLOWED_FIELDS, 'profile_review_status', 'verification_status', 'public_visibility_status', 'is_public'],
      previous: { ...previous, profile_review_status: profile.profile_review_status, verification_status: profile.verification_status, public_visibility_status: profile.public_visibility_status, is_public: profile.is_public },
      next: { ...checked.value, profile_review_status: 'approved', verification_status: 'verified', public_visibility_status: 'approved', is_public: true, published_assignment_ids: assignments.published, private_assignment_ids: assignments.private, awaiting_consent_assignment_ids: assignments.awaiting_consent },
      note: note || 'Profil profesional aprobat de administratorul VIASEE. Asocierile necesita acord separat pentru publicare.',
    });
    return res({ success: true, status: 'approved', assignments });
  }

  if (action === 'request_more_info') {
    const updates = {
      profile_review_status: 'needs_more_info',
      verification_status: wasPublic ? 'verified' : 'unverified',
      public_visibility_status: wasPublic ? 'approved' : 'draft',
      is_public: wasPublic,
      reviewed_at: now,
      reviewed_by_user_id: user.id,
      review_note: note,
      profile_updated_at: now,
    };
    await svc.entities.ProfessionalProfile.update(profile.id, updates);
    await audit(svc, user, {
      entity_type: 'ProfessionalProfile',
      entity_id: profile.id,
      action_type: 'request_more_info_professional_profile',
      changed_fields: Object.keys(updates),
      previous: { profile_review_status: profile.profile_review_status, verification_status: profile.verification_status, public_visibility_status: profile.public_visibility_status, is_public: profile.is_public },
      next: updates,
      note,
    });
    return res({ success: true, status: 'needs_more_info' });
  }

  const updates = {
    profile_review_status: 'rejected',
    verification_status: wasPublic ? 'verified' : 'rejected',
    public_visibility_status: wasPublic ? 'approved' : 'rejected',
    is_public: wasPublic,
    reviewed_at: now,
    reviewed_by_user_id: user.id,
    review_note: note,
    profile_updated_at: now,
  };
  await svc.entities.ProfessionalProfile.update(profile.id, updates);
  await audit(svc, user, {
    entity_type: 'ProfessionalProfile',
    entity_id: profile.id,
    action_type: 'reject_professional_profile',
    changed_fields: Object.keys(updates),
    previous: { profile_review_status: profile.profile_review_status, verification_status: profile.verification_status, public_visibility_status: profile.public_visibility_status, is_public: profile.is_public },
    next: updates,
    note,
  });
  return res({ success: true, status: 'rejected' });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return res({ error: 'Acces permis doar administratorilor VIASEE' }, 403);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action || 'list');
    if (action === 'list') return listProfiles(svc, payload);
    return decide(svc, user, payload);
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});