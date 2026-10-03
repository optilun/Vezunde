// Fake Base44 pentru testele de echivalenta (scratch, nu intra in repo).
export function matches(row, query = {}) {
  for (const [key, expected] of Object.entries(query || {})) {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected && !expected.$in.includes(actual)) return false;
      if ('$nin' in expected && expected.$nin.includes(actual)) return false;
      if ('$ne' in expected && actual === expected.$ne) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const left = a[field] ?? '';
    const right = b[field] ?? '';
    if (left === right) return 0;
    return (left < right ? -1 : 1) * (desc ? -1 : 1);
  });
}

export function createFakeDb(tables) {
  const calls = [];
  const entities = new Proxy({}, {
    get(_target, name) {
      const rows = tables[name] || [];
      return {
        async filter(query, sort, limit, skip) {
          calls.push(`${String(name)}.filter`);
          const found = sortRows(rows.filter((row) => matches(row, query)), sort);
          const start = Number(skip) || 0;
          return found.slice(start, limit === undefined || limit === null ? undefined : start + limit).map((row) => ({ ...row }));
        },
        async get(id) {
          calls.push(`${String(name)}.get`);
          const row = rows.find((item) => item.id === id);
          if (!row) throw new Error('not found');
          return { ...row };
        },
        async list() { calls.push(`${String(name)}.list`); return rows.map((row) => ({ ...row })); },
        async create() { throw new Error(`write not allowed in test: ${String(name)}.create`); },
        async update() { throw new Error(`write not allowed in test: ${String(name)}.update`); },
      };
    },
  });
  return { entities, calls };
}

export function buildDataset({ orgALocations = 3 } = {}) {
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 8, 1, 0, 0, tick++)).toISOString();
  const t = {};
  const add = (entity, row) => { (t[entity] ||= []).push({ created_date: stamp(), updated_date: stamp(), ...row }); return row; };
  const users = ['u1', 'u2', 'u3'].map((id, index) => add('User', { id, email: `${id}@exemplu.test`, full_name: `Utilizator ${index + 1}`, role: 'user' }));
  void users;
  const orgs = [
    add('ProviderOrganization', { id: 'orgA', name: 'Optica A', public_display_name: 'Optica A', public_description: 'desc', status: 'activa' }),
    add('ProviderOrganization', { id: 'orgB', name: 'Optica B', status: 'activa' }),
    add('ProviderOrganization', { id: 'orgC', name: 'Optica C', public_phone: '0700', status: 'activa' }),
  ];
  void orgs;
  const locations = [];
  for (let i = 1; i <= orgALocations; i += 1) locations.push(add('ProviderLocation', { id: `A${i}`, organization_id: 'orgA', name: `A loc ${i}`, provider_type: 'optica', provider_profile_type: 'optica_medicala', locality_siruta_code: '1', address: `Str ${i}`, opening_hours: i % 2 ? 'L-V' : '', photo_url: i === 1 ? 'p.jpg' : '', status: 'publicata', active_status: i === 2 ? 'inactiva' : 'activa', profile_control_status: i === 1 ? 'verified' : 'claimed' }));
  for (let i = 1; i <= 2; i += 1) locations.push(add('ProviderLocation', { id: `B${i}`, organization_id: 'orgB', name: `B loc ${i}`, status: 'publicata', active_status: 'activa' }));
  for (let i = 1; i <= 3; i += 1) locations.push(add('ProviderLocation', { id: `C${i}`, organization_id: 'orgC', name: `C loc ${i}`, status: 'draft', active_status: 'activa', pending_changes: i === 2 ? JSON.stringify({ fields: { photo_url: 'logo.png' }, media_review: { target_type: 'organization_logo' } }) : '' }));

  for (const location of locations.filter((item) => item.organization_id === 'orgA')) {
    add('ProviderMembership', { id: `m-u1-${location.id}`, user_id: 'u1', organization_id: 'orgA', location_id: location.id, role: 'organization_owner', status: 'active', organization_wide_access: true, claim_scope: 'organization' });
  }
  add('ProviderMembership', { id: 'm-u2-A1', user_id: 'u2', organization_id: 'orgA', location_id: 'A1', role: 'location_manager', status: 'active' });
  add('ProviderMembership', { id: 'm-u3-A1', user_id: 'u3', organization_id: 'orgA', location_id: 'A1', role: 'location_staff', status: 'inactive' });
  add('ProviderMembership', { id: 'm-u1-B1', user_id: 'u1', location_id: 'B1', role: 'location_manager', status: 'active' });
  add('ProviderMembership', { id: 'm-u3-B1', user_id: 'u3', organization_id: 'orgB', location_id: 'B1', role: 'organization_owner', status: 'active' });
  add('ProviderMembership', { id: 'm-u1-C1', user_id: 'u1', organization_id: 'orgC', location_id: 'C1', role: 'organization_owner', status: 'active' });

  let n = 0;
  for (const location of locations) {
    n += 1;
    for (let s = 0; s < 3 + (n % 3); s += 1) add('LocationService', { id: `svc-${location.id}-${s}`, location_id: location.id, service_key: `s${s}`, is_active: s !== 0 });
    add('LocationSpecialization', { id: `spec-${location.id}`, location_id: location.id, is_active: n % 2 === 0 });
    add('ProfessionalLocationAssignment', { id: `team-${location.id}-1`, location_id: location.id, active_status: 'activ', public_status: 'public' });
    add('ProfessionalLocationAssignment', { id: `team-${location.id}-2`, location_id: location.id, active_status: 'activ', public_status: 'privat' });
    add('ProviderMediaAsset', { id: `media-${location.id}-1`, location_id: location.id, status: 'approved', storage_reference: `ref-${location.id}` });
    add('ProviderMediaAsset', { id: `media-${location.id}-2`, location_id: location.id, status: 'pending' });
    add('ProviderArticle', { id: `art-${location.id}`, location_id: location.id, status: 'approved', published_at: n % 2 ? stamp() : null });
    for (const [index, spec] of [
      { section: 'services', status: 'pending_review', submitted_by_user_id: 'u1' },
      { section: 'team', status: 'draft', submitted_by_user_id: 'u2' },
      { section: 'media', status: 'needs_more_info', submitted_by_user_id: 'u1', claim_request_id: 'claim-1' },
      { section: 'article', status: 'pending_review', submitted_by_user_id: 'u3', claim_request_id: 'claim-2' },
      { section: 'services', status: 'approved', submitted_by_user_id: 'u1', reviewed_at: stamp() },
      { section: 'location_details', status: 'rejected', submitted_by_user_id: 'u2', reviewed_at: stamp(), admin_note: 'nota' },
    ].entries()) {
      add('ProviderWorkspaceSubmission', { id: `sub-${location.id}-${index}`, location_id: location.id, organization_id: location.organization_id, access_origin: 'provider_workspace', ...spec });
    }
    add('ProviderWorkspaceSubmission', { id: `prep-${location.id}`, location_id: location.id, organization_id: location.organization_id, access_origin: 'claim_preparation', section: 'services', status: 'draft', submitted_by_user_id: 'u1' });
  }
  for (const org of ['orgA', 'orgB', 'orgC']) {
    add('ProviderWorkspaceSubmission', { id: `orgsub-${org}`, organization_id: org, access_origin: 'provider_workspace', section: 'public_profile', status: 'pending_review', submitted_by_user_id: 'u1', payload_json: '{"public_description":"noua"}' });
    add('ProviderWorkspaceSubmission', { id: `orgsub-${org}-other`, organization_id: org, access_origin: 'provider_workspace', section: 'public_profile', status: 'draft', submitted_by_user_id: 'u2' });
  }
  add('ProviderMemberInvitation', { id: 'inv-1', organization_id: 'orgA', invited_location_ids: ['A1'], status: 'pending', invited_email_normalized: 'nou@exemplu.test', proposed_role: 'location_staff' });
  add('ProviderMemberInvitation', { id: 'inv-2', organization_id: 'orgC', invited_location_ids: ['C2'], status: 'pending', invited_email_normalized: 'alt@exemplu.test', proposed_role: 'location_manager' });
  return t;
}
