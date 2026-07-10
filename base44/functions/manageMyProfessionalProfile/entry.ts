import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

const SPECIALIZATIONS_BY_TYPE: Record<string, string[]> = {
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

function res(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function plain(value: unknown, field: string, maxLength: number, required = false) {
  const valueText = text(value);
  if (required && !valueText) return { error: `${field} este obligatoriu` };
  if (valueText.length > maxLength) return { error: `${field} depaseste limita de ${maxLength} caractere` };
  if (/[<>]/.test(valueText) || /<\/?[a-z][\s\S]*>/i.test(valueText)) return { error: `${field} trebuie sa fie text simplu` };
  return { value: valueText };
}

function url(value: unknown, field: string) {
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

function email(value: unknown) {
  const raw = text(value).toLowerCase();
  if (!raw) return { value: '' };
  if (raw.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { error: 'Email public invalid' };
  return { value: raw };
}

function phone(value: unknown) {
  const raw = text(value);
  if (!raw) return { value: '' };
  if (raw.length > 80 || !/^[0-9+().\-\s]{6,80}$/.test(raw)) return { error: 'Telefon public invalid' };
  return { value: raw };
}

function photo(value: unknown) {
  const raw = text(value);
  if (!raw) return { value: '' };
  if (raw.length > 800000) return { error: 'Fotografia este prea mare dupa optimizare' };
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return { value: raw };
  const checked = url(raw, 'Fotografia');
  if (checked.error) return checked;
  return checked;
}

function parsePending(profile: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(String(profile.pending_profile_json || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function canonicalDraft(profile: Record<string, unknown>) {
  return {
    public_display_name: profile.public_display_name || profile.full_name || '',
    professional_bio: profile.professional_bio || profile.bio || '',
    specializations: Array.isArray(profile.specializations) ? profile.specializations : [],
    profile_photo_url: profile.profile_photo_url || '',
    public_website_url: profile.public_website_url || '',
    linkedin_url: profile.linkedin_url || '',
    facebook_url: profile.facebook_url || '',
    instagram_url: profile.instagram_url || '',
    public_phone: profile.public_phone || '',
    public_email: profile.public_email || '',
    accepts_independent_requests: profile.accepts_independent_requests === true,
  };
}

function validatePayload(payload: Record<string, unknown>, professionalType: string) {
  const unknown = Object.keys(payload).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unknown.length) return { error: 'Campuri nepermise in profil', fields: unknown };

  const name = plain(payload.public_display_name, 'Numele public', 120, true);
  if (name.error) return name;
  const bio = plain(payload.professional_bio, 'Descrierea profesionala', 1200);
  if (bio.error) return bio;
  const profilePhoto = photo(payload.profile_photo_url);
  if (profilePhoto.error) return profilePhoto;
  const publicWebsite = url(payload.public_website_url, 'Website-ul profesional');
  if (publicWebsite.error) return publicWebsite;
  const linkedin = url(payload.linkedin_url, 'LinkedIn');
  if (linkedin.error) return linkedin;
  const facebook = url(payload.facebook_url, 'Facebook');
  if (facebook.error) return facebook;
  const instagram = url(payload.instagram_url, 'Instagram');
  if (instagram.error) return instagram;
  const publicEmail = email(payload.public_email);
  if (publicEmail.error) return publicEmail;
  const publicPhone = phone(payload.public_phone);
  if (publicPhone.error) return publicPhone;

  if (payload.specializations !== undefined && !Array.isArray(payload.specializations)) {
    return { error: 'Specializarile trebuie sa fie o lista' };
  }
  const allowed = new Set(SPECIALIZATIONS_BY_TYPE[professionalType] || []);
  const specializations = [...new Set((Array.isArray(payload.specializations) ? payload.specializations : [])
    .map((item) => text(item))
    .filter(Boolean))];
  if (specializations.length > 12) return { error: 'Poti selecta cel mult 12 specializari' };
  if (specializations.some((item) => !allowed.has(item))) return { error: 'Una dintre specializari nu este compatibila cu tipul profesional' };

  const acceptsIndependentRequests = payload.accepts_independent_requests === true;
  if (acceptsIndependentRequests && !publicEmail.value && !publicPhone.value) {
    return { error: 'Pentru cereri independente este necesar un telefon sau email public' };
  }

  return {
    value: {
      public_display_name: name.value,
      professional_bio: bio.value,
      specializations,
      profile_photo_url: profilePhoto.value,
      public_website_url: publicWebsite.value,
      linkedin_url: linkedin.value,
      facebook_url: facebook.value,
      instagram_url: instagram.value,
      public_phone: publicPhone.value,
      public_email: publicEmail.value,
      accepts_independent_requests: acceptsIndependentRequests,
    },
  };
}

function completeness(draft: Record<string, unknown>, hasAssignment: boolean) {
  let score = 0;
  if (text(draft.public_display_name).length >= 3) score += 15;
  if (text(draft.professional_bio).length >= 80) score += 25;
  if (Array.isArray(draft.specializations) && draft.specializations.length > 0) score += 20;
  if (text(draft.profile_photo_url)) score += 15;
  if (text(draft.public_email) || text(draft.public_phone)) score += 10;
  if (text(draft.public_website_url) || text(draft.linkedin_url) || text(draft.facebook_url) || text(draft.instagram_url)) score += 5;
  if (hasAssignment) score += 10;
  return score;
}

async function audit(svc: any, user: any, profileId: string, actionType: string, previous: Record<string, unknown>, next: Record<string, unknown>, note: string) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProfessionalProfile',
    entity_id: profileId,
    action_type: actionType,
    changed_fields: Object.keys(next),
    previous_values: JSON.stringify(previous),
    new_values: JSON.stringify(next),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note,
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action || 'get');
    const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
    const profile = profiles[0] || null;
    if (!profile) return res({ error: 'Nu exista un profil profesional asociat acestui cont' }, 404);

    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
      professional_id: profile.id,
      active_status: 'activ',
    }, '-created_date', 100);
    const hasAssignment = assignments.length > 0;
    const pending = parsePending(profile);
    const currentDraft = Object.keys(pending).length ? pending : canonicalDraft(profile);

    if (action === 'get') {
      return res({
        professional_id: profile.id,
        professional_type: profile.professional_type,
        locked_full_name: profile.full_name || '',
        draft: currentDraft,
        profile_review_status: profile.profile_review_status || profile.public_visibility_status || 'draft',
        public_visibility_status: profile.public_visibility_status || 'draft',
        verification_status: profile.verification_status || 'unverified',
        profile_completeness: Number(profile.profile_completeness || completeness(currentDraft, hasAssignment)),
        review_note: profile.review_note || '',
        submitted_at: profile.submitted_at || null,
        has_active_assignment: hasAssignment,
      });
    }

    if (action === 'save_draft') {
      const reviewStatus = profile.profile_review_status || profile.public_visibility_status || 'draft';
      if (reviewStatus === 'pending_review') return res({ error: 'Profilul este deja in verificare si nu poate fi modificat' }, 409);
      const checked = validatePayload(payload.profile || {}, profile.professional_type || '');
      if (checked.error) return res({ error: checked.error, fields: checked.fields || [] }, 400);
      const score = completeness(checked.value, hasAssignment);
      const updates = {
        pending_profile_json: JSON.stringify(checked.value),
        profile_review_status: 'draft',
        profile_completeness: score,
        profile_updated_at: new Date().toISOString(),
        review_note: '',
      };
      await svc.entities.ProfessionalProfile.update(profile.id, updates);
      await audit(svc, user, profile.id, 'save_professional_profile_draft', { profile_review_status: reviewStatus }, { profile_review_status: 'draft', profile_completeness: score }, 'Specialistul si-a salvat draftul. Datele publice aprobate nu au fost modificate.');
      return res({ success: true, draft: checked.value, profile_review_status: 'draft', profile_completeness: score });
    }

    if (action === 'submit_review') {
      const reviewStatus = profile.profile_review_status || profile.public_visibility_status || 'draft';
      if (reviewStatus === 'pending_review') return res({ error: 'Profilul este deja in verificare' }, 409);
      const checked = validatePayload(currentDraft, profile.professional_type || '');
      if (checked.error) return res({ error: checked.error }, 400);
      const score = completeness(checked.value, hasAssignment);
      const missing: string[] = [];
      if (text(checked.value.public_display_name).length < 3) missing.push('nume public');
      if (text(checked.value.professional_bio).length < 80) missing.push('descriere profesionala de minimum 80 de caractere');
      if (!Array.isArray(checked.value.specializations) || checked.value.specializations.length === 0) missing.push('cel putin o specializare');
      if (!hasAssignment) missing.push('cel putin o locatie asociata');
      if (missing.length) return res({ error: `Completeaza inainte de trimitere: ${missing.join(', ')}`, missing }, 400);

      const now = new Date().toISOString();
      const updates = {
        pending_profile_json: JSON.stringify(checked.value),
        profile_review_status: 'pending_review',
        verification_status: 'pending_review',
        submitted_at: now,
        profile_completeness: score,
        profile_updated_at: now,
        review_note: '',
      };
      await svc.entities.ProfessionalProfile.update(profile.id, updates);
      await audit(svc, user, profile.id, 'submit_professional_profile_review', { profile_review_status: reviewStatus }, { profile_review_status: 'pending_review', verification_status: 'pending_review', profile_completeness: score }, 'Profil profesional trimis spre verificare. Nu a fost publicat automat.');
      return res({ success: true, profile_review_status: 'pending_review', profile_completeness: score, submitted_at: now });
    }

    return res({ error: 'Actiune necunoscuta' }, 400);
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
