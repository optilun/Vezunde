import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];

const PREPARATION_STEPS = [
  {
    key: 'organization_profile',
    section: 'public_profile',
    navigation_key: 'profile',
    label: 'Profilul organizatiei',
    description: 'Descrierea publica, datele de contact, website-ul si retelele sociale.',
  },
  {
    key: 'operating_hours',
    section: 'operating_hours',
    navigation_key: 'hours',
    label: 'Programul locatiei',
    description: 'Programul care va putea fi publicat dupa confirmarea accesului.',
  },
  {
    key: 'services',
    section: 'services',
    navigation_key: 'services',
    label: 'Serviciile locatiei',
    description: 'Serviciile declarate pentru verificarea si publicarea ulterioara.',
  },
];

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (_error) {
    return {};
  }
}

function sanitizeClaim(claim) {
  const submitted = parseJSON(claim.submitted_payload);
  return {
    id: claim.id,
    status: claim.status,
    mode: claim.mode || '',
    claim_subject_type: claim.claim_subject_type || submitted.claim_subject_type || '',
    claimant_relationship: claim.claimant_relationship || submitted.claimant_relationship || '',
    requested_membership_role: claim.requested_membership_role || submitted.requested_membership_role || '',
    business_name: claim.business_name || submitted.organization_name || '',
    contact_name: claim.contact_name || '',
    email: claim.email || '',
    phone: claim.phone || '',
    location_id: claim.location_id || submitted.location_id || '',
    created_date: claim.created_date || null,
    reviewed_at: claim.reviewed_at || null,
    latest_admin_note: claim.status === 'needs_more_info' ? (claim.review_notes || '') : '',
  };
}

function sanitizeLocation(location, claim) {
  const submitted = parseJSON(claim.submitted_payload);
  const proposed = submitted.proposed_location || {};
  if (!location) {
    return {
      id: claim.location_id || submitted.location_id || '',
      organization_id: claim.organization_id || '',
      organization_name: submitted.organization_name || '',
      name: proposed.name || claim.business_name || '',
      provider_type: proposed.provider_type || '',
      provider_profile_type: proposed.provider_profile_type || '',
      city: proposed.locality_name || '',
      locality_name: proposed.locality_name || '',
      locality_siruta_code: proposed.locality_siruta_code || '',
      county_name: proposed.county_name || '',
      address: proposed.address || '',
      phone_public: proposed.phone_public || '',
      public_email: proposed.public_email || '',
      status: 'in_verificare',
      public_visibility_status: 'draft',
      profile_control_status: 'directory',
      claim_verification_status: 'pending',
    };
  }
  return {
    id: location.id,
    organization_id: location.organization_id || claim.organization_id || '',
    name: location.public_display_name || location.name || claim.business_name || '',
    provider_type: location.provider_type || '',
    provider_profile_type: location.provider_profile_type || '',
    city: location.locality_name || location.city || '',
    locality_name: location.locality_name || location.city || '',
    locality_siruta_code: location.locality_siruta_code || '',
    county_name: location.county_name || location.county || '',
    address: location.address || '',
    phone_public: location.phone_public || location.public_phone || '',
    public_email: location.public_email || '',
    status: location.status || 'draft',
    public_visibility_status: location.public_visibility_status || 'draft',
    profile_control_status: location.profile_control_status || 'directory',
    claim_verification_status: location.claim_verification_status || 'pending',
  };
}

function sanitizeDraft(submission) {
  return {
    id: submission.id,
    location_id: submission.location_id,
    organization_id: submission.organization_id || '',
    claim_request_id: submission.claim_request_id || '',
    access_origin: submission.access_origin || 'claim_preparation',
    section: submission.section,
    item_key: submission.item_key || '',
    status: submission.status,
    payload_json: submission.payload_json || '{}',
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
  };
}

function draftStep(step, draft) {
  if (!draft || draft.status === 'withdrawn') {
    return {
      ...step,
      status: 'missing',
      completed: false,
      detail: 'Nu a fost inceput.',
      submission_status: draft?.status || '',
    };
  }
  if (draft.status === 'needs_more_info' || draft.status === 'rejected') {
    return {
      ...step,
      status: 'needs_action',
      completed: false,
      detail: 'Sunt necesare completari.',
      submission_status: draft.status,
    };
  }
  if (draft.status === 'pending_review') {
    return {
      ...step,
      status: 'in_review',
      completed: true,
      detail: 'Informatiile sunt in verificare.',
      submission_status: draft.status,
    };
  }
  return {
    ...step,
    status: 'complete',
    completed: true,
    detail: draft.status === 'approved' ? 'Informatii aprobate.' : 'Draft salvat.',
    submission_status: draft.status,
  };
}

function buildStatusCenter(claim, location, drafts) {
  const latestDraftBySection = new Map();
  for (const draft of drafts) {
    if (!latestDraftBySection.has(draft.section)) latestDraftBySection.set(draft.section, draft);
  }

  const locationReady = Boolean(location?.id && location?.name && location?.locality_siruta_code);
  const preparationItems = [
    draftStep(PREPARATION_STEPS[0], latestDraftBySection.get('public_profile')),
    {
      key: 'location_identity',
      section: 'location_details',
      navigation_key: 'status',
      label: 'Identitatea locatiei',
      description: 'Numele si localitatea canonica asociate solicitarii.',
      status: locationReady ? 'complete' : 'in_review',
      completed: locationReady,
      detail: locationReady ? 'Identitate asociata solicitarii.' : 'Datele canonice sunt verificate de VIASEE.',
      submission_status: '',
    },
    draftStep(PREPARATION_STEPS[1], latestDraftBySection.get('operating_hours')),
    draftStep(PREPARATION_STEPS[2], latestDraftBySection.get('services')),
  ];
  const completedCount = preparationItems.filter((item) => item.completed).length;
  const percentage = Math.round((completedCount / preparationItems.length) * 100);
  const blockedItems = [
    {
      key: 'photos',
      navigation_key: '',
      label: 'Fotografiile locatiei',
      description: 'Disponibile dupa aprobarea solicitarii.',
      status: 'blocked',
      completed: false,
      detail: 'Blocat pana la confirmarea accesului.',
    },
    {
      key: 'specialists',
      navigation_key: '',
      label: 'Specialistii locatiei',
      description: 'Asocierile si invitatiile devin disponibile in workspace-ul organizatiei.',
      status: 'blocked',
      completed: false,
      detail: 'Blocat pana la confirmarea accesului.',
    },
    {
      key: 'publication',
      navigation_key: '',
      label: 'Publicarea profilului',
      description: 'Publicarea necesita aprobarea solicitarii si verificarea informatiilor.',
      status: 'blocked',
      completed: false,
      detail: 'Profilul ramane privat.',
    },
  ];

  const claimNeedsAction = claim?.status === 'needs_more_info';
  const stepNeedingAction = preparationItems.find((item) => item.status === 'needs_action');
  const missingStep = preparationItems.find((item) => item.status === 'missing');
  const waitingForVerification = !claimNeedsAction && !stepNeedingAction && !missingStep && percentage < 100;
  let nextAction;
  if (claimNeedsAction) {
    nextAction = {
      type: 'claim',
      navigation_key: 'status',
      label: 'Vezi completarile solicitate',
      description: claim.latest_admin_note || 'VIASEE are nevoie de informatii suplimentare pentru verificare.',
    };
  } else if (stepNeedingAction) {
    nextAction = {
      type: 'section',
      navigation_key: stepNeedingAction.navigation_key,
      label: `Completeaza: ${stepNeedingAction.label}`,
      description: stepNeedingAction.detail,
    };
  } else if (missingStep) {
    nextAction = {
      type: 'section',
      navigation_key: missingStep.navigation_key,
      label: `Continua cu: ${missingStep.label}`,
      description: missingStep.description,
    };
  } else {
    nextAction = {
      type: 'wait',
      navigation_key: 'status',
      label: 'Urmareste verificarea solicitarii',
      description: 'Pregatirea initiala este completa. Profilul ramane privat pana la aprobare.',
    };
  }

  const actionRequiredCount = preparationItems.filter((item) => ['missing', 'needs_action'].includes(item.status)).length
    + (claimNeedsAction ? 1 : 0);
  return {
    version: 1,
    state: claimNeedsAction
      ? 'needs_action'
      : waitingForVerification
        ? 'waiting_verification'
        : percentage === 100
          ? 'preparation_complete'
          : 'in_progress',
    headline: claimNeedsAction
      ? 'Sunt necesare completari'
      : waitingForVerification
        ? 'Datele locatiei sunt in verificare'
        : percentage === 100
          ? 'Pregatirea initiala este completa'
          : 'Continua pregatirea profilului',
    message: claimNeedsAction
      ? (claim.latest_admin_note || 'Verifica informatiile solicitate de echipa VIASEE.')
      : waitingForVerification
        ? 'Ai completat tot ce este disponibil momentan. Identitatea canonica a locatiei este verificata de VIASEE.'
        : percentage === 100
          ? 'Informatiile pregatite sunt salvate. Asteapta confirmarea relatiei cu locatia.'
          : 'Completeaza informatiile disponibile cat timp solicitarea este verificata.',
    claim_status: claim?.status || '',
    preparation_progress: {
      percentage,
      completed_count: completedCount,
      total_count: preparationItems.length,
    },
    action_required_count: actionRequiredCount,
    blocked_count: blockedItems.length,
    preparation_complete: percentage === 100,
    items: [...preparationItems, ...blockedItems],
    next_action: nextAction,
  };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    await req.json().catch(() => ({}));

    const claims = await svc.entities.ProviderClaimRequest.filter({ user_id: user.id }, '-created_date', 50);
    const activeClaim = claims.find((claim) => (
      ACTIVE_CLAIM_STATUSES.includes(claim.status)
      && claim.mode !== 'new_location_duplicate_review'
      && Boolean(claim.location_id)
    ));
    if (!activeClaim) {
      return Response.json({
        mode: 'none',
        latest_claim_status: claims[0] ? {
          id: claims[0].id,
          status: claims[0].status,
          mode: claims[0].mode || '',
          reviewed_at: claims[0].reviewed_at || null,
        } : null,
      });
    }

    const location = await svc.entities.ProviderLocation.get(activeClaim.location_id).catch(() => null);
    if (!location) {
      return Response.json({
        mode: 'none',
        latest_claim_status: {
          id: activeClaim.id,
          status: activeClaim.status,
          mode: activeClaim.mode || '',
          reviewed_at: activeClaim.reviewed_at || null,
        },
      });
    }

    const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
      claim_request_id: activeClaim.id,
      submitted_by_user_id: user.id,
      access_origin: 'claim_preparation',
    }, '-created_date', 100);
    const activeDrafts = drafts.filter((draft) => !draft.preparation_locked_at && draft.preparation_lock_reason !== 'claim_rejected');

    const claimSummary = sanitizeClaim(activeClaim);
    const locationSummary = sanitizeLocation(location, activeClaim);
    const preparationDrafts = activeDrafts.map(sanitizeDraft);

    return Response.json({
      mode: 'applicant_preparation',
      user: { id: user.id, full_name: user.full_name || user.name || '', email: user.email || '' },
      claim: claimSummary,
      location_summary: locationSummary,
      preparation_drafts: preparationDrafts,
      status_center: buildStatusCenter(claimSummary, locationSummary, preparationDrafts),
      allowed_sections: ['public_profile', 'operating_hours', 'services'],
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
