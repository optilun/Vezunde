import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { professionalSpecializationsFor } from '../../shared/professionalIdentity.js';
import {
  assignmentPublicEligibility,
  nextProfessionalProfileState,
} from '../../shared/professionalProfileStatus.js';

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

  const allowedSpecializations = new Set(professionalSpecializationsFor(professionalType));
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

// Eligibilitatea asocierii traieste in shared/professionalProfileStatus.js, ca sa fie acelasi
// adevar aici, in manageProfessionalAssignment si in motorul de recomandare.
function nextAssignmentStatus(profile, assignment, location) {
  return assignmentPublicEligibility({ profile, assignment, location }).eligible ? 'public' : 'privat';
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
    // Profilul se trece prin politica asa cum este, nu fortat pe "verificat si aprobat".
    // Apelantul decide starea inainte de reconciliere: aprobarea trimite un profil aprobat,
    // arhivarea trimite unul arhivat, si atunci toate asocierile pica pe privat, corect.
    const nextStatus = nextAssignmentStatus(profile, assignment, location);

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

// 2026-09-03: arhivarea si reactivarea inchid ciclul de viata al profilului profesional.
//
// `archived` exista de la inceput in enum-ul `public_visibility_status`, dar nicio actiune nu il
// putea seta: un profil aprobat gresit, un specialist care si-a incetat activitatea sau o
// identitate contestata nu aveau cale de iesire in afara de editarea manuala a bazei. Locatiile
// aveau de mult echivalentul (`suspendata`); persoanele nu.
//
// Arhivarea este singura actiune care scoate offline deliberat un profil public, deci cere nota
// obligatorie si trece asocierile pe privat - altfel ar fi ramas marcate publice sub un profil
// care nu mai e vizibil, iar orice reactivare le-ar fi republicat tacit.
async function lifecycle(svc, user, payload) {
  const profileId = text(payload.professional_id || payload.profile_id);
  const action = text(payload.action);
  const note = text(payload.note);
  if (!profileId) return res({ error: 'professional_id este obligatoriu' }, 400);
  if (!note) return res({ error: 'Nota este obligatorie' }, 400);

  const profile = await svc.entities.ProfessionalProfile.get(profileId).catch(() => null);
  if (!profile) return res({ error: 'Profilul profesional nu a fost gasit' }, 404);

  const currentlyArchived = profile.public_visibility_status === 'archived';
  if (action === 'archive' && currentlyArchived) return res({ error: 'Profilul este deja arhivat' }, 409);
  if (action === 'restore' && !currentlyArchived) return res({ error: 'Profilul nu este arhivat' }, 409);

  const now = new Date().toISOString();
  const updates = {
    ...nextProfessionalProfileState(action, profile),
    reviewed_at: now,
    reviewed_by_user_id: user.id,
    review_note: note,
    profile_updated_at: now,
  };
  await svc.entities.ProfessionalProfile.update(profile.id, updates);

  // Reconcilierea foloseste profilul DUPA schimbare, nu inainte: la arhivare toate asocierile
  // devin private, iar la reactivare raman private pana la o noua aprobare - reactivarea readuce
  // profilul in lucru, nu il republica.
  const reconciled = await reconcileAssignmentsAfterApproval(svc, user, { ...profile, ...updates });

  await audit(svc, user, {
    entity_type: 'ProfessionalProfile',
    entity_id: profile.id,
    action_type: action === 'archive' ? 'archive_professional_profile' : 'restore_professional_profile',
    changed_fields: Object.keys(updates),
    previous: {
      profile_review_status: profile.profile_review_status,
      verification_status: profile.verification_status,
      public_visibility_status: profile.public_visibility_status,
      is_public: profile.is_public,
    },
    next: { ...updates, private_assignment_ids: reconciled.private },
    note,
  });

  return res({
    success: true,
    status: action === 'archive' ? 'archived' : 'draft',
    assignments: reconciled,
  });
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

  if (action === 'approve') {
    const checked = validateDraft(parseDraft(profile), profile.professional_type || '');
    if (checked.error) return res({ error: checked.error, fields: checked.fields || [] }, 400);

    const previous = Object.fromEntries(ALLOWED_FIELDS.map((key) => [key, profile[key]]));
    const updates = {
      ...checked.value,
      bio: checked.value.professional_bio,
      ...nextProfessionalProfileState('approve', profile),
      pending_profile_json: '',
      reviewed_at: now,
      reviewed_by_user_id: user.id,
      verified_at: now,
      verified_by_user_id: user.id,
      review_note: note,
      profile_updated_at: now,
    };
    await svc.entities.ProfessionalProfile.update(profile.id, updates);
    // Reconcilierea vede profilul DUPA aprobare. Inainte de 2026-09-03 primea profilul vechi si
    // compensa fortand "verificat si aprobat" in interior, ceea ce facea functia inutilizabila
    // pentru orice alta tranzitie (de exemplu arhivarea, unde raspunsul corect e opusul).
    const assignments = await reconcileAssignmentsAfterApproval(svc, user, { ...profile, ...updates });
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
      ...nextProfessionalProfileState('request_more_info', profile),
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
    ...nextProfessionalProfileState('reject', profile),
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

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return res({ error: 'Acces permis doar administratorilor VIASEE' }, 403);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action || 'list');
    if (action === 'list') return listProfiles(svc, payload);
    if (action === 'archive' || action === 'restore') return lifecycle(svc, user, payload);
    return decide(svc, user, payload);
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
}
