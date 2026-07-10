import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROVIDER_ROLES = ['organization_owner', 'location_manager'];
const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];

function res(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function normalize(value: unknown) {
  return text(value, 500)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(strada|str|nr|numarul|bl|bloc|sc|scara|et|etaj|ap|apartament)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(value: unknown) {
  const raw = String(value || '').replace(/\D/g, '');
  if (raw.length === 11 && raw.startsWith('40')) return `0${raw.slice(2)}`;
  if (raw.length === 10 && raw.startsWith('0')) return raw;
  return raw;
}

function tokens(value: unknown) {
  return [...new Set(normalize(value).split(' ').filter((item) => item.length > 1))];
}

function tokenSimilarity(a: unknown, b: unknown) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) return 0;
  const common = left.filter((item) => right.includes(item)).length;
  return common / Math.max(left.length, right.length);
}

function role(value: unknown) {
  const raw = text(value, 80);
  return raw === 'owner' ? 'organization_owner' : raw;
}

function safeNumber(value: unknown, min: number, max: number) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function validateLocation(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Datele locatiei sunt invalide' };
  const input = raw as Record<string, unknown>;
  const allowed = ['public_display_name', 'address', 'city', 'county', 'locality_siruta_code', 'public_phone', 'public_email', 'lat', 'lng', 'place_id'];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) return { error: 'Campuri nepermise', fields: unknown };

  const clean = {
    public_display_name: text(input.public_display_name, 180),
    address: text(input.address, 500),
    city: text(input.city, 120),
    county: text(input.county, 120),
    locality_siruta_code: text(input.locality_siruta_code, 30),
    public_phone: text(input.public_phone, 80),
    public_email: text(input.public_email, 180).toLowerCase(),
    lat: safeNumber(input.lat, -90, 90),
    lng: safeNumber(input.lng, -180, 180),
    place_id: text(input.place_id, 300),
  };

  if (!clean.public_display_name || !clean.address || !clean.city || !clean.county) return { error: 'Numele, adresa, localitatea si judetul sunt obligatorii' };
  if ((clean.lat === null) !== (clean.lng === null)) return { error: 'Completeaza si latitudinea, si longitudinea' };
  if (clean.public_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.public_email)) return { error: 'Email public invalid' };
  return { value: clean };
}

async function providerContext(svc: any, user: any, anchorLocationId: string) {
  if (!anchorLocationId) return { error: 'Locatia curenta este obligatorie', status: 400 };
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: anchorLocationId, status: 'active' }, '-created_date', 20);
  const membership = memberships.find((item: any) => PROVIDER_ROLES.includes(role(item.role)));
  if (!membership) return { error: 'Nu ai dreptul sa adaugi locatii pentru aceasta organizatie', status: 403 };
  const anchor = await svc.entities.ProviderLocation.get(anchorLocationId).catch(() => null);
  if (!anchor) return { error: 'Locatia curenta nu a fost gasita', status: 404 };
  const organizationId = anchor.organization_id || membership.organization_id || '';
  if (!organizationId) return { error: 'Organizatia locatiei nu a putut fi determinata', status: 409 };
  const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
  return { membership, anchor, organization, organizationId };
}

type SearchInput = { name?: unknown; city?: unknown; address?: unknown; phone?: unknown };

function normalizeSearch(raw: unknown) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as SearchInput : {};
  return {
    name: text(input.name, 180),
    city: text(input.city, 120),
    address: text(input.address, 500),
    phone: text(input.phone, 80),
  };
}

function scoreCandidate(search: ReturnType<typeof normalizeSearch>, location: any) {
  const reasons: string[] = [];
  let score = 0;
  const locationName = location.public_display_name || location.name || '';
  const locationAddress = location.address || '';
  const locationCity = location.locality_name || location.city || '';
  const locationPhone = location.public_phone || location.phone_public || '';

  if (search.phone && digits(search.phone).length >= 7 && digits(search.phone) === digits(locationPhone)) {
    score += 55;
    reasons.push('telefon identic');
  }

  if (search.address) {
    const exactAddress = normalize(search.address) === normalize(locationAddress);
    const addressSimilarity = tokenSimilarity(search.address, locationAddress);
    if (exactAddress) {
      score += 42;
      reasons.push('aceeași adresă');
    } else if (addressSimilarity >= 0.75) {
      score += 30;
      reasons.push('adresă foarte similară');
    } else if (addressSimilarity >= 0.45) {
      score += 18;
      reasons.push('adresă similară');
    }
  }

  if (search.name) {
    const exactName = normalize(search.name) === normalize(locationName);
    const nameSimilarity = tokenSimilarity(search.name, locationName);
    if (exactName) {
      score += 34;
      reasons.push('nume identic');
    } else if (nameSimilarity >= 0.75) {
      score += 26;
      reasons.push('nume foarte similar');
    } else if (nameSimilarity >= 0.45) {
      score += 14;
      reasons.push('nume similar');
    }
  }

  if (search.city && normalize(search.city) === normalize(locationCity)) {
    score += 16;
    reasons.push('aceeași localitate');
  }

  if (search.city && search.address && normalize(search.city) !== normalize(locationCity)) score -= 10;

  const finalScore = Math.max(0, Math.min(100, score));
  return {
    score: finalScore,
    reasons,
    confidence: finalScore >= 72 ? 'high' : finalScore >= 46 ? 'medium' : 'low',
  };
}

async function searchCandidates(svc: any, context: any, rawSearch: unknown) {
  const search = normalizeSearch(rawSearch);
  const all = await svc.entities.ProviderLocation.list('-created_date', 1500);
  return all
    .map((location: any) => ({ location, ...scoreCandidate(search, location) }))
    .filter((item: any) => item.score >= 32)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3)
    .map(({ location, score, reasons, confidence }: any) => ({
      id: location.id,
      name: location.public_display_name || location.name || 'Locatie',
      address: location.address || '',
      city: location.locality_name || location.city || '',
      phone: location.public_phone || location.phone_public || '',
      organization_id: location.organization_id || '',
      relation: location.organization_id === context.organizationId ? 'same_organization' : 'directory_candidate',
      score,
      reasons,
      confidence,
    }));
}

async function providerGet(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await providerContext(svc, user, text(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const submissions = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: context.anchor.id,
    access_origin: 'provider_workspace',
    section: 'location_create',
    item_key: 'new_location',
    submitted_by_user_id: user.id,
  }, '-created_date', 20);
  const active = submissions.find((item: any) => ACTIVE_SUBMISSION_STATUSES.includes(item.status)) || null;
  return res({
    organization: { id: context.organizationId, name: context.organization?.name || context.anchor.organization_name || 'Organizatia ta' },
    anchor_location_id: context.anchor.id,
    submission: active ? { id: active.id, status: active.status, admin_note: active.admin_note || '', payload: JSON.parse(active.payload_json || '{}') } : null,
  });
}

async function providerSearch(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await providerContext(svc, user, text(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const search = normalizeSearch(payload.search);
  const hasEnough = normalize(search.name).length >= 2 || normalize(search.address).length >= 4 || digits(search.phone).length >= 7;
  if (!hasEnough) return res({ candidates: [] });
  return res({ candidates: await searchCandidates(svc, context, search) });
}

async function providerSave(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await providerContext(svc, user, text(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const checked = validateLocation(payload.location);
  if (checked.error) return res({ error: checked.error, fields: checked.fields || [] }, 400);
  const duplicateCandidates = await searchCandidates(svc, context, {
    name: checked.value.public_display_name,
    address: checked.value.address,
    city: checked.value.city,
    phone: checked.value.public_phone,
  });
  const payloadValue = { kind: 'new_location_for_existing_organization', location: checked.value, duplicate_candidates: duplicateCandidates };
  const existing = (await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: context.anchor.id,
    access_origin: 'provider_workspace',
    section: 'location_create',
    item_key: 'new_location',
    submitted_by_user_id: user.id,
    status: { $in: ['draft', 'needs_more_info'] },
  }, '-created_date', 10))[0] || null;
  const data = { payload_json: JSON.stringify(payloadValue), status: 'draft', admin_note: '' };
  const submission = existing
    ? await svc.entities.ProviderWorkspaceSubmission.update(existing.id, data)
    : await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: context.organizationId,
        location_id: context.anchor.id,
        access_origin: 'provider_workspace',
        section: 'location_create',
        item_key: 'new_location',
        payload_json: JSON.stringify(payloadValue),
        status: 'draft',
        submitted_by_user_id: user.id,
      });
  return res({ success: true, submission: { id: submission.id, status: submission.status, payload: payloadValue } });
}

async function providerSubmit(svc: any, user: any, payload: Record<string, unknown>) {
  const context = await providerContext(svc, user, text(payload.anchor_location_id, 120));
  if (context.error) return res({ error: context.error }, context.status);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(text(payload.submission_id, 120)).catch(() => null);
  if (!submission || submission.submitted_by_user_id !== user.id || submission.section !== 'location_create' || submission.organization_id !== context.organizationId) return res({ error: 'Cererea nu a fost gasita' }, 404);
  if (!['draft', 'needs_more_info'].includes(submission.status)) return res({ error: 'Cererea nu poate fi trimisa' }, 409);
  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'pending_review', submitted_at: new Date().toISOString(), admin_note: '' });
  return res({ success: true });
}

async function adminList(svc: any, user: any) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const rows = await svc.entities.ProviderWorkspaceSubmission.filter({ access_origin: 'provider_workspace', section: 'location_create', item_key: 'new_location', status: 'pending_review' }, '-submitted_at', 100);
  const items = [];
  for (const row of rows) {
    const anchor = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
    const organization = row.organization_id ? await svc.entities.ProviderOrganization.get(row.organization_id).catch(() => null) : null;
    items.push({
      id: row.id,
      submitted_at: row.submitted_at || null,
      organization: { id: row.organization_id || '', name: organization?.name || anchor?.organization_name || 'Organizatie' },
      anchor_location: anchor ? { id: anchor.id, name: anchor.public_display_name || anchor.name || 'Locatie', provider_type: anchor.provider_type || '', provider_profile_type: anchor.provider_profile_type || '' } : null,
      payload: JSON.parse(row.payload_json || '{}'),
    });
  }
  return res({ submissions: items });
}

async function adminDecide(svc: any, user: any, payload: Record<string, unknown>) {
  if (user.role !== 'admin') return res({ error: 'Acces interzis' }, 403);
  const action = text(payload.action, 40);
  const note = text(payload.note, 1000);
  const submission = await svc.entities.ProviderWorkspaceSubmission.get(text(payload.submission_id, 120)).catch(() => null);
  if (!submission || submission.section !== 'location_create' || submission.status !== 'pending_review') return res({ error: 'Cererea nu mai este disponibila' }, 404);
  if (!['approve', 'request_more_info', 'reject'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
  if (action !== 'approve' && !note) return res({ error: 'Nota este obligatorie' }, 400);
  if (action !== 'approve') {
    await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: action === 'request_more_info' ? 'needs_more_info' : 'rejected', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), admin_note: note });
    return res({ success: true });
  }

  const parsed = JSON.parse(submission.payload_json || '{}');
  const checked = validateLocation(parsed.location);
  if (checked.error) return res({ error: checked.error }, 400);
  const anchor = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
  if (!anchor) return res({ error: 'Locatia de referinta nu exista' }, 404);
  const existingSameOrg = await svc.entities.ProviderLocation.filter({ organization_id: submission.organization_id }, '-created_date', 200);
  const duplicate = existingSameOrg.find((item: any) => normalize(item.address) === normalize(checked.value.address) && normalize(item.locality_name || item.city) === normalize(checked.value.city));
  if (duplicate) return res({ error: 'Exista deja o locatie a organizatiei la aceeasi adresa', duplicate_location_id: duplicate.id }, 409);

  const location = await svc.entities.ProviderLocation.create({
    organization_id: submission.organization_id,
    name: checked.value.public_display_name,
    public_display_name: checked.value.public_display_name,
    address: checked.value.address,
    city: checked.value.city,
    locality_name: checked.value.city,
    county: checked.value.county,
    county_name: checked.value.county,
    locality_siruta_code: checked.value.locality_siruta_code,
    public_phone: checked.value.public_phone,
    phone_public: checked.value.public_phone,
    public_email: checked.value.public_email,
    lat: checked.value.lat,
    lng: checked.value.lng,
    place_id: checked.value.place_id,
    provider_type: anchor.provider_type || '',
    provider_profile_type: anchor.provider_profile_type || '',
    profile_control_status: 'verified',
    active_status: 'activa',
    status: 'activa',
  });

  const sourceMemberships = await svc.entities.ProviderMembership.filter({ user_id: submission.submitted_by_user_id, location_id: anchor.id, status: 'active' }, '-created_date', 20);
  const sourceMembership = sourceMemberships[0] || null;
  if (sourceMembership) {
    await svc.entities.ProviderMembership.create({
      user_id: submission.submitted_by_user_id,
      organization_id: submission.organization_id,
      location_id: location.id,
      role: sourceMembership.role,
      status: 'active',
    });
  }

  await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'approved', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), admin_note: note, applied_entity_id: location.id });
  const activeLocations = await svc.entities.ProviderLocation.filter({ organization_id: submission.organization_id, active_status: 'activa' }, '-created_date', 500);
  return res({ success: true, location_id: location.id, location_structure: activeLocations.length >= 2 ? 'multi_location' : 'single_location', active_location_count: activeLocations.length });
}

Deno.serve(async (req) => {
  try {
    const svc = createClientFromRequest(req);
    const user = await svc.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const payload = await req.json().catch(() => ({}));
    const action = text(payload.action, 60);
    if (action === 'get') return providerGet(svc, user, payload);
    if (action === 'search') return providerSearch(svc, user, payload);
    if (action === 'save_draft') return providerSave(svc, user, payload);
    if (action === 'submit_review') return providerSubmit(svc, user, payload);
    if (action === 'admin_list') return adminList(svc, user);
    if (['approve', 'request_more_info', 'reject'].includes(action)) return adminDecide(svc, user, payload);
    return res({ error: 'Actiune necunoscuta' }, 400);
  } catch (error) {
    return res({ error: error instanceof Error ? error.message : 'Eroare neasteptata' }, 500);
  }
});
