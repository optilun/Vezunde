import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function cleanString(value) {
  return String(value || '').trim();
}

function parsePendingProfile(profile) {
  try {
    const parsed = JSON.parse(String(profile.pending_profile_json || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function sanitizeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    full_name: profile.full_name || '',
    public_display_name: profile.public_display_name || profile.full_name || '',
    professional_type: profile.professional_type || '',
    role: profile.role || '',
    specializations: Array.isArray(profile.specializations) ? profile.specializations : [],
    professional_bio: profile.professional_bio || profile.bio || '',
    profile_photo_url: profile.profile_photo_url || '',
    public_website_url: profile.public_website_url || '',
    linkedin_url: profile.linkedin_url || '',
    facebook_url: profile.facebook_url || '',
    instagram_url: profile.instagram_url || '',
    public_phone: profile.public_phone || '',
    public_email: profile.public_email || '',
    accepts_independent_requests: profile.accepts_independent_requests === true,
    verification_status: profile.verification_status || 'unverified',
    public_visibility_status: profile.public_visibility_status || 'draft',
    profile_review_status: profile.profile_review_status || profile.public_visibility_status || 'draft',
    pending_profile: parsePendingProfile(profile),
    review_note: profile.review_note || '',
    submitted_at: profile.submitted_at || null,
    profile_completeness: Number(profile.profile_completeness || 0),
    is_public: profile.is_public === true,
  };
}

function sanitizeAssignment(assignment, location) {
  return {
    id: assignment.id,
    professional_id: assignment.professional_id,
    location_id: assignment.location_id,
    professional_type: assignment.professional_type || '',
    active_status: assignment.active_status || 'activ',
    public_status: assignment.public_status || 'privat',
    visibility_consent_status: assignment.visibility_consent_status || 'not_requested',
    visibility_requested_at: assignment.visibility_requested_at || null,
    visibility_decided_at: assignment.visibility_decided_at || null,
    visibility_revoked_at: assignment.visibility_revoked_at || null,
    confirmed_by_professional_at: assignment.confirmed_by_professional_at || null,
    location: location ? {
      id: location.id,
      name: location.public_display_name || location.name || 'Locatie',
      organization_id: location.organization_id || null,
      city: location.locality_name || location.city || '',
      address: location.address || '',
      profile_control_status: location.profile_control_status || 'directory',
      status: location.status || 'draft',
    } : null,
  };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });

    const svc = base44.asServiceRole;
    const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
    const profile = profiles[0] || null;

    if (!profile) {
      return Response.json({
        mode: 'none',
        professional: null,
        assignments: [],
      });
    }

    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
      professional_id: profile.id,
      active_status: 'activ',
    }, '-created_date', 100);

    const rows = [];
    for (const assignment of assignments) {
      const locationId = cleanString(assignment.location_id);
      const location = locationId
        ? await svc.entities.ProviderLocation.get(locationId).catch(() => null)
        : null;
      rows.push(sanitizeAssignment(assignment, location));
    }

    return Response.json({
      mode: 'professional_workspace',
      user: {
        id: user.id,
        full_name: user.full_name || user.name || '',
        email: user.email || '',
      },
      professional: sanitizeProfile(profile),
      assignments: rows,
      public_assignment_count: rows.filter((item) => item.public_status === 'public').length,
      private_assignment_count: rows.filter((item) => item.public_status !== 'public').length,
      pending_visibility_count: rows.filter((item) => item.visibility_consent_status === 'pending').length,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
