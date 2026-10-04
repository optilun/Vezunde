export const PROVIDER_PROFILE_COMPLETENESS_CONTRACT_VERSION = 'provider-profile-completeness-v1';

function clean(value) {
  return String(value ?? '').trim();
}

function checklistResult(items) {
  const checklist = items.map((item) => ({
    key: item.key,
    group: item.group,
    label: item.label,
    done: Boolean(item.done),
    status: item.done ? 'complete' : 'missing',
    impact: item.impact || 'quality',
    action: item.action || '',
  }));
  const completed = checklist.filter((item) => item.done);
  const requiredMissing = checklist.filter((item) => item.impact === 'required' && !item.done);
  return {
    contract_version: PROVIDER_PROFILE_COMPLETENESS_CONTRACT_VERSION,
    percentage: checklist.length ? Math.round((completed.length / checklist.length) * 100) : 0,
    total_items: checklist.length,
    completed_count: completed.length,
    missing_count: checklist.length - completed.length,
    required_missing_count: requiredMissing.length,
    publication_ready: requiredMissing.length === 0,
    checklist,
    missing_items: checklist.filter((item) => !item.done),
  };
}

export function computeOrganizationCompleteness(organization = {}) {
  const hasContact = Boolean(clean(organization.public_phone) || clean(organization.public_email));
  const hasWeb = Boolean(clean(organization.website_url || organization.website)
    || clean(organization.facebook_url)
    || clean(organization.instagram_url)
    || clean(organization.linkedin_url));
  return checklistResult([
    { key: 'organization_identity', group: 'organization', label: 'Numele public al organizației', done: clean(organization.public_display_name), impact: 'required', action: 'Completează profilul organizației.' },
    { key: 'organization_description', group: 'organization', label: 'Descrierea organizației', done: clean(organization.public_description), action: 'Adaugă o descriere publică.' },
    { key: 'organization_contact', group: 'contact', label: 'Telefon sau email general', done: hasContact, impact: 'required', action: 'Adaugă un canal public de contact.' },
    { key: 'organization_web', group: 'contact', label: 'Website sau rețele sociale', done: hasWeb, action: 'Adaugă website-ul sau un profil social oficial.' },
    { key: 'organization_logo', group: 'media', label: 'Logo-ul organizației', done: clean(organization.logo_url), action: 'Adaugă logo-ul organizației.' },
  ]);
}

export function computeLocationCompleteness({ location = {}, content = {} } = {}) {
  const hasPublicContact = Boolean(clean(location.phone_public || location.public_phone) || clean(location.public_email));
  const hasOpeningHours = Boolean(content.has_opening_hours || clean(location.opening_hours) || clean(location.opening_hours_json));
  const hasServices = Number(content.approved_service_count || 0) > 0;
  const hasTeam = Number(content.approved_public_team_count || 0) > 0;
  const hasPhoto = Boolean(content.has_primary_photo || Number(content.approved_media_count || 0) > 0 || clean(location.photo_url));
  const controlled = ['claimed', 'verified'].includes(clean(location.profile_control_status));
  const verified = clean(location.profile_control_status) === 'verified' || clean(location.verification_state) === 'verified';
  return checklistResult([
    { key: 'location_identity', group: 'location', label: 'Numele și tipul locației', done: clean(location.public_display_name || location.name) && location.provider_type && location.provider_profile_type, impact: 'required', action: 'Completează identitatea locației.' },
    { key: 'location_locality', group: 'location', label: 'Localitatea', done: clean(location.locality_siruta_code || location.locality_name || location.city), impact: 'required', action: 'Selectează localitatea.' },
    { key: 'location_address', group: 'location', label: 'Adresa', done: clean(location.address), impact: 'required', action: 'Completează adresa locației.' },
    { key: 'location_contact', group: 'contact', label: 'Telefon sau email public', done: hasPublicContact, impact: 'required', action: 'Adaugă un canal public de contact.' },
    { key: 'location_hours', group: 'program', label: 'Programul de funcționare', done: hasOpeningHours, action: 'Completează programul locației.' },
    { key: 'location_services', group: 'services', label: 'Cel puțin un serviciu public', done: hasServices, impact: 'required', action: 'Configurează serviciile locației.' },
    { key: 'location_team', group: 'specialists', label: 'Specialiști publici', done: hasTeam, action: 'Adaugă specialiștii care au acceptat afișarea.' },
    { key: 'location_photo', group: 'media', label: 'Fotografie publică', done: hasPhoto, action: 'Adaugă o fotografie a locației.' },
    { key: 'location_claim', group: 'verification', label: 'Profil revendicat', done: controlled, action: 'Finalizează revendicarea profilului.' },
    { key: 'location_verification', group: 'verification', label: 'Profil verificat', done: verified, action: 'Finalizează verificarea profilului.' },
  ]);
}

export function summarizeProviderCompleteness({ organizationCompletion, locationCompletions = [] } = {}) {
  const active = locationCompletions.filter(Boolean);
  const averageLocationPercentage = active.length
    ? Math.round(active.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / active.length)
    : 0;
  const organizationPercentage = Number(organizationCompletion?.percentage || 0);
  const requiredMissingCount = Number(organizationCompletion?.required_missing_count || 0)
    + active.reduce((sum, item) => sum + Number(item.required_missing_count || 0), 0);
  return {
    contract_version: PROVIDER_PROFILE_COMPLETENESS_CONTRACT_VERSION,
    overall_percentage: active.length ? Math.round((organizationPercentage + averageLocationPercentage) / 2) : organizationPercentage,
    organization_percentage: organizationPercentage,
    average_location_percentage: averageLocationPercentage,
    required_missing_count: requiredMissingCount,
    publication_ready: requiredMissingCount === 0,
    active_location_count: active.length,
  };
}
