import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const VALID_ORGANIZATION_STATUSES = ['activa', 'inactiva'];

function response(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value) {
  return String(value ?? '').trim();
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parsePayload(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return isPlainObject(parsed) ? parsed : {};
  } catch (_error) {
    return { __invalid_payload: clean(value) };
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (value === undefined) return null;
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

async function signature(value) {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

function organizationCompletion(organization) {
  const checks = [
    clean(organization.public_display_name),
    clean(organization.public_description),
    clean(organization.public_phone) || clean(organization.public_email),
    clean(organization.website_url || organization.website)
      || clean(organization.facebook_url)
      || clean(organization.instagram_url)
      || clean(organization.linkedin_url),
    clean(organization.logo_url),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function locationCompletion(location) {
  const checks = [
    clean(location.public_display_name) || clean(location.name),
    clean(location.locality_name) || clean(location.city),
    clean(location.address),
    clean(location.public_phone) || clean(location.phone_public) || clean(location.public_email),
    clean(location.opening_hours_json) || clean(location.opening_hours),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function submissionScope(submission) {
  const subject = submission.section === 'public_profile' && submission.organization_id
    ? `organization:${submission.organization_id}`
    : `location:${submission.location_id || ''}`;
  return [
    subject,
    submission.section || '',
    submission.item_key || '',
    submission.access_origin || 'provider_workspace',
    submission.claim_request_id || '',
  ].join('::');
}

function chooseKeeper(rows) {
  const priority = { pending_review: 3, needs_more_info: 2, draft: 1 };
  return [...rows].sort((left, right) => {
    const statusDifference = (priority[right.status] || 0) - (priority[left.status] || 0);
    if (statusDifference !== 0) return statusDifference;
    const leftTime = new Date(left.created_date || 0).getTime();
    const rightTime = new Date(right.created_date || 0).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.id).localeCompare(String(right.id));
  })[0];
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id || '',
    action_type: 'data_integrity_repair',
    changed_fields: record.changed_fields || [],
    previous_values: JSON.stringify(record.previous || {}),
    new_values: JSON.stringify(record.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

async function loadData(svc) {
  const [organizations, locations, activeSubmissions] = await Promise.all([
    svc.entities.ProviderOrganization.filter({}, 'name', 500),
    svc.entities.ProviderLocation.filter({}, 'name', 500),
    svc.entities.ProviderWorkspaceSubmission.filter({ status: { $in: ACTIVE_SUBMISSION_STATUSES } }, '-created_date', 500),
  ]);
  return { organizations, locations, activeSubmissions };
}

function buildCandidates(data) {
  const candidates = [];
  const locationsByOrganization = new Map();

  for (const location of data.locations) {
    if (!locationsByOrganization.has(location.organization_id)) locationsByOrganization.set(location.organization_id, []);
    locationsByOrganization.get(location.organization_id).push(location);
  }

  for (const organization of data.organizations) {
    const name = organization.public_display_name || organization.name || 'Organizatie fara nume';
    const calculated = organizationCompletion(organization);
    const stored = Number(organization.profile_completeness || 0);
    if (stored !== calculated) {
      candidates.push({
        id: `organization_completeness:${organization.id}`,
        repair_type: 'organization_completeness',
        title: `${name}: actualizeaza completitudinea organizatiei`,
        detail: 'Recalculeaza scorul exclusiv din datele generale ale organizatiei. Locatiile au scor separat.',
        entity_type: 'ProviderOrganization',
        entity_id: organization.id,
        current_values: { profile_completeness: stored },
        proposed_values: { profile_completeness: calculated },
        changed_fields: ['profile_completeness'],
        guard: {
          id: organization.id,
          updated_date: organization.updated_date || '',
          public_display_name: organization.public_display_name || '',
          public_description: organization.public_description || '',
          public_phone: organization.public_phone || '',
          public_email: organization.public_email || '',
          website_url: organization.website_url || organization.website || '',
          facebook_url: organization.facebook_url || '',
          instagram_url: organization.instagram_url || '',
          linkedin_url: organization.linkedin_url || '',
          logo_url: organization.logo_url || '',
          profile_completeness: stored,
        },
        apply: { kind: 'organization_update', id: organization.id, updates: { profile_completeness: calculated } },
      });
    }

    if (!VALID_ORGANIZATION_STATUSES.includes(organization.status)) {
      const relatedLocations = locationsByOrganization.get(organization.id) || [];
      const hasActiveLocation = relatedLocations.some((location) => location.active_status !== 'inactiva' && location.status !== 'suspendata');
      const proposedStatus = hasActiveLocation ? 'activa' : 'inactiva';
      candidates.push({
        id: `organization_status:${organization.id}`,
        repair_type: 'organization_status',
        title: `${name}: normalizeaza statusul organizatiei`,
        detail: 'Valoarea actuala nu respecta schema. Statusul propus este derivat din locatiile active asociate.',
        entity_type: 'ProviderOrganization',
        entity_id: organization.id,
        current_values: { status: organization.status || 'lipsa' },
        proposed_values: { status: proposedStatus },
        changed_fields: ['status'],
        guard: {
          id: organization.id,
          updated_date: organization.updated_date || '',
          status: organization.status || '',
          related_locations: relatedLocations.map((location) => ({ id: location.id, status: location.status, active_status: location.active_status, updated_date: location.updated_date || '' })),
        },
        apply: { kind: 'organization_update', id: organization.id, updates: { status: proposedStatus } },
      });
    }
  }

  for (const location of data.locations) {
    const name = location.public_display_name || location.name || 'Locatie fara nume';
    const calculated = locationCompletion(location);
    const stored = Number(location.profile_completeness || 0);
    if (stored !== calculated) {
      candidates.push({
        id: `location_completeness:${location.id}`,
        repair_type: 'location_completeness',
        title: `${name}: actualizeaza completitudinea locatiei`,
        detail: 'Recalculeaza scorul din identitate, localitate, adresa, contact si program.',
        entity_type: 'ProviderLocation',
        entity_id: location.id,
        current_values: { profile_completeness: stored },
        proposed_values: { profile_completeness: calculated },
        changed_fields: ['profile_completeness'],
        guard: {
          id: location.id,
          updated_date: location.updated_date || '',
          public_display_name: location.public_display_name || location.name || '',
          locality_name: location.locality_name || location.city || '',
          address: location.address || '',
          public_phone: location.public_phone || location.phone_public || '',
          public_email: location.public_email || '',
          opening_hours_json: location.opening_hours_json || '',
          opening_hours: location.opening_hours || '',
          profile_completeness: stored,
        },
        apply: { kind: 'location_update', id: location.id, updates: { profile_completeness: calculated } },
      });
    }

    if (location.status === 'publicata' && location.profile_control_status === 'verified' && (
      location.public_visibility_status !== 'approved'
      || location.verification_state !== 'verified'
      || location.is_verified !== true
    )) {
      const proposed = {
        public_visibility_status: 'approved',
        verification_state: 'verified',
        is_verified: true,
      };
      candidates.push({
        id: `location_publication_alignment:${location.id}`,
        repair_type: 'location_publication_alignment',
        title: `${name}: aliniaza statusurile de publicare si verificare`,
        detail: 'Locatia este deja publicata si verificata. Reparatia aliniaza numai campurile legacy/derivate, fara a schimba continutul public.',
        entity_type: 'ProviderLocation',
        entity_id: location.id,
        current_values: {
          status: location.status,
          profile_control_status: location.profile_control_status,
          public_visibility_status: location.public_visibility_status || 'lipsa',
          verification_state: location.verification_state || 'lipsa',
          is_verified: location.is_verified === true,
        },
        proposed_values: proposed,
        changed_fields: Object.keys(proposed).filter((key) => location[key] !== proposed[key]),
        guard: {
          id: location.id,
          updated_date: location.updated_date || '',
          status: location.status,
          profile_control_status: location.profile_control_status,
          public_visibility_status: location.public_visibility_status || '',
          verification_state: location.verification_state || '',
          is_verified: location.is_verified === true,
        },
        apply: { kind: 'location_update', id: location.id, updates: proposed },
      });
    }
  }

  const duplicateGroups = new Map();
  for (const submission of data.activeSubmissions) {
    const normalizedPayload = parsePayload(submission.payload_json);
    const key = `${submissionScope(submission)}::${stableStringify(normalizedPayload)}`;
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(submission);
  }

  for (const rows of duplicateGroups.values()) {
    if (rows.length < 2) continue;
    const keeper = chooseKeeper(rows);
    const duplicates = rows.filter((row) => row.id !== keeper.id);
    const subject = keeper.organization_id || keeper.location_id || 'necunoscut';
    candidates.push({
      id: `identical_active_submissions:${keeper.id}`,
      repair_type: 'identical_active_submissions',
      title: `Cereri active identice: pastreaza o singura cerere pentru ${keeper.section}`,
      detail: `Pastreaza cererea ${keeper.status} selectata canonic si inchide ${duplicates.length} ${duplicates.length === 1 ? 'duplicat' : 'duplicate'}. Continutul nu este sters.`,
      entity_type: 'ProviderWorkspaceSubmission',
      entity_id: keeper.id,
      current_values: {
        subject,
        active_count: rows.length,
        statuses: rows.map((row) => row.status).join(', '),
      },
      proposed_values: {
        keeper_status: keeper.status,
        duplicates_withdrawn: duplicates.length,
      },
      changed_fields: ['status'],
      guard: {
        keeper: { id: keeper.id, status: keeper.status, updated_date: keeper.updated_date || '', payload_json: keeper.payload_json || '{}' },
        duplicates: duplicates.map((row) => ({ id: row.id, status: row.status, updated_date: row.updated_date || '', payload_json: row.payload_json || '{}' })),
      },
      apply: { kind: 'withdraw_duplicates', keeper_id: keeper.id, duplicate_ids: duplicates.map((row) => row.id) },
    });
  }

  return candidates;
}

async function scanRepairs(svc) {
  const data = await loadData(svc);
  const candidates = buildCandidates(data);
  return Promise.all(candidates.map(async (candidate) => ({
    ...candidate,
    expected_signature: await signature(candidate.guard),
  })));
}

function publicRepair(candidate) {
  return {
    id: candidate.id,
    repair_type: candidate.repair_type,
    title: candidate.title,
    detail: candidate.detail,
    entity_type: candidate.entity_type,
    entity_id: candidate.entity_id,
    current_values: candidate.current_values,
    proposed_values: candidate.proposed_values,
    changed_fields: candidate.changed_fields,
    expected_signature: candidate.expected_signature,
  };
}

async function applyCandidate(svc, user, candidate) {
  if (candidate.apply.kind === 'organization_update') {
    await svc.entities.ProviderOrganization.update(candidate.apply.id, candidate.apply.updates);
    await audit(svc, user, {
      entity_type: candidate.entity_type,
      entity_id: candidate.entity_id,
      changed_fields: candidate.changed_fields,
      previous: candidate.current_values,
      next: candidate.proposed_values,
      note: `${candidate.title}. Reparatie confirmata manual din Integritate date.`,
    });
    return;
  }

  if (candidate.apply.kind === 'location_update') {
    await svc.entities.ProviderLocation.update(candidate.apply.id, candidate.apply.updates);
    await audit(svc, user, {
      entity_type: candidate.entity_type,
      entity_id: candidate.entity_id,
      changed_fields: candidate.changed_fields,
      previous: candidate.current_values,
      next: candidate.proposed_values,
      note: `${candidate.title}. Reparatie confirmata manual din Integritate date.`,
    });
    return;
  }

  if (candidate.apply.kind === 'withdraw_duplicates') {
    for (const duplicateId of candidate.apply.duplicate_ids) {
      const duplicate = await svc.entities.ProviderWorkspaceSubmission.get(duplicateId).catch(() => null);
      if (!duplicate || !ACTIVE_SUBMISSION_STATUSES.includes(duplicate.status)) continue;
      await svc.entities.ProviderWorkspaceSubmission.update(duplicate.id, { status: 'withdrawn' });
    }
    await audit(svc, user, {
      entity_type: 'ProviderWorkspaceSubmission',
      entity_id: candidate.apply.keeper_id,
      changed_fields: ['status'],
      previous: candidate.current_values,
      next: candidate.proposed_values,
      note: `${candidate.title}. Duplicatele au fost inchise, iar cererea canonica a fost pastrata.`,
    });
    return;
  }

  throw new Error('Tip de reparatie necunoscut');
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return response({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return response({ error: 'Acces permis doar administratorilor Vezunde' }, 403);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'scan');

    if (action === 'scan') {
      const repairs = await scanRepairs(svc);
      return response({ repairs: repairs.map(publicRepair), count: repairs.length });
    }

    if (action === 'apply') {
      if (input.confirm !== true) return response({ error: 'Confirmarea explicita este obligatorie' }, 400);
      const repairId = clean(input.repair_id);
      const expectedSignature = clean(input.expected_signature);
      if (!repairId || !expectedSignature) return response({ error: 'repair_id si expected_signature sunt obligatorii' }, 400);

      const repairs = await scanRepairs(svc);
      const candidate = repairs.find((item) => item.id === repairId);
      if (!candidate) return response({ error: 'Reparatia nu mai este necesara sau datele s-au schimbat' }, 409);
      if (candidate.expected_signature !== expectedSignature) {
        return response({ error: 'Datele s-au schimbat dupa previzualizare. Reincarca pagina inainte de aplicare.' }, 409);
      }

      await applyCandidate(svc, user, candidate);
      return response({ success: true, repair: publicRepair(candidate) });
    }

    return response({ error: 'Actiune invalida' }, 400);
  } catch (error) {
    return response({ error: error.message || 'Eroare neasteptata' }, 500);
  }
}
