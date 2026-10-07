// Corectitudinea panoului de admin (2026-10-07, audit admin).
//
// Blochează cele trei probleme P0 găsite la audit:
//  1. „Totul e la zi” afișat când nimic nu era verificat sau când o cerere căzuse;
//  2. profilurile din director (publicate, nerevendicate) marcate ca „neconcordanță/eroare critică”;
//  3. ecrane care citeau mai puține locații decât există (limite de 1.000 / 1.500).
// Plus etichetele în română în loc de coduri brute și gruparea evenimentelor de audit în masă.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  auditActorType,
  claimRelationshipLabel,
  claimStatusLabel,
  claimStatusTone,
  collapseAuditRuns,
  correctionStatusLabel,
  humanizeCode,
  locationStatusLabel,
  mediaCleanupReasonLabel,
  organizationLinkLabel,
  profileControlLabel,
  profileStateOf,
  selectionRequestLabel,
  selectionRequestTone,
} from '../src/lib/adminLabels.js';
import { locationStatusIssues } from '../src/lib/adminLocationStatusRules.js';
import { chunk, fetchByIds, fetchWhereIn, uniqueIds, ID_CHUNK } from '../src/lib/adminEntityBatch.js';
import {
  REVIEW_PARTS,
  loadAdminCounts,
  mergeWorkspacePending,
  reviewTotal,
  sidebarBadgeFor,
  summarizeCounts,
} from '../src/lib/adminCounts.js';
import { deadlineInfo, oldestFirst, plural, relativeTime, waitingInfo } from '../src/lib/adminFormat.js';
import { sourceHost, validateQuickEdit } from '../src/lib/adminProfileEdit.js';
import {
  ADMIN_NAV_LABELS,
  ADMIN_NAV_PRIMARY,
  ADMIN_NAV_SECONDARY,
  ADMIN_SECTIONS,
  adminHref,
  resolveAdminTarget,
} from '../src/lib/adminNavConfig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
let checks = 0;
async function check(name, fn) {
  try {
    await fn();
    checks += 1;
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

// ---------- Etichete ----------
await check('statusurile brute au etichete în română', () => {
  assert.equal(claimStatusLabel('in_asteptare'), 'În așteptare');
  assert.equal(claimStatusLabel('aprobata'), 'Aprobată');
  assert.equal(claimStatusLabel('respinsa'), 'Respinsă');
  assert.equal(claimStatusLabel('needs_more_info'), 'Așteaptă completări');
  assert.equal(claimStatusTone('aprobata'), 'success');
  assert.equal(claimStatusTone('respinsa'), 'danger');
  assert.equal(correctionStatusLabel('submitted'), 'Nouă');
  assert.equal(correctionStatusLabel('in_review'), 'În verificare');
  assert.equal(locationStatusLabel('publicata'), 'Publicată');
  assert.equal(locationStatusLabel('in_verificare'), 'În verificare');
});

await check('revendicări: relația, starea pe locație și legătura cu organizația au etichete în română', () => {
  assert.equal(claimRelationshipLabel('owner'), 'Proprietar');
  assert.equal(claimRelationshipLabel('organization_representative'), 'Reprezentant al organizației');
  assert.equal(claimRelationshipLabel('location_manager'), 'Manager de locație');
  assert.equal(claimRelationshipLabel('authorized_staff'), 'Personal autorizat');
  assert.equal(claimRelationshipLabel(''), '—');
  assert.equal(selectionRequestLabel('pending'), 'În așteptare');
  assert.equal(selectionRequestLabel('approved'), 'Aprobată');
  assert.equal(selectionRequestLabel('rejected'), 'Respinsă');
  assert.equal(selectionRequestTone('approved'), 'success');
  assert.equal(selectionRequestTone('pending'), 'warning');
  assert.equal(organizationLinkLabel('confirmed'), 'legătură confirmată');
  assert.equal(organizationLinkLabel('unassigned'), 'fără organizație');
  assert.equal(organizationLinkLabel(undefined), 'legătură necunoscută');
  const claims = source('src/components/admin/directory/DirOpsClaims.jsx');
  assert.ok(!/Relatie:|Mod: \{|\{item\.requestStatus\}|legatura \{item/.test(claims), 'DirOpsClaims nu mai arată valori brute (relație, stare, legătură)');
  assert.ok(!/Aproba\b|locatie\b|organizatie\b/.test(claims.replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), 'DirOpsClaims: text vizibil fără diacritice');
});

await check('valorile necunoscute devin text citibil, nu cod brut cu underscore', () => {
  assert.equal(humanizeCode('some_new_state'), 'Some new state');
  assert.equal(claimStatusLabel('ceva_nou'), 'Ceva nou');
  assert.equal(humanizeCode(''), '—');
  assert.equal(humanizeCode(null), '—');
});

await check('acțiunile de audit observate pe datele reale au etichetă', () => {
  for (const code of [
    'update_service_configuration_draft',
    'create_service_configuration_draft',
    'sync_organization_wide_access',
    'add_self_as_location_specialist',
    'national_audit_source_correction',
    'cleanup_test_data',
    'verify_profile',
    'suspend_profile',
    'unsuspend_profile',
  ]) {
    assert.ok(AUDIT_ACTION_LABELS[code], `lipsește eticheta pentru ${code}`);
    assert.ok(!auditActionLabel(code).includes('_'), `eticheta pentru ${code} conține underscore`);
  }
});

await check('fiecare acțiune scrisă de backend are etichetă în română (nu doar în engleză)', () => {
  // Codurile de mai jos sunt cele mai frecvente, din base44/functions/**.
  const mustHave = [
    'approve_submission', 'reject_submission', 'request_more_info', 'submit_for_review',
    'approve_professional_profile', 'resolve_directory_correction', 'reject_directory_correction',
    'create_directory_location', 'create_organization', 'data_integrity_repair', 'outreach_campaign_approved',
  ];
  for (const code of mustHave) assert.ok(AUDIT_ACTION_LABELS[code], `lipsește ${code}`);
  for (const [code, label] of Object.entries(AUDIT_ACTION_LABELS)) {
    assert.ok(label && label !== code && !label.includes('_'), `${code}: etichetă invalidă „${label}”`);
  }
});

await check('actorul unui eveniment de audit', () => {
  assert.equal(auditActorType({ admin_email: null, action_type: 'national_audit_source_correction' }), 'system');
  assert.equal(auditActorType({ admin_email: 'x@y.ro', admin_user_id: null, action_type: 'verify_profile' }), 'system');
  assert.equal(auditActorType({ admin_email: 'a@b.ro', action_type: 'verify_profile' }), 'admin');
  assert.equal(auditActorType({ admin_email: 'a@b.ro', action_type: 'provider_copy_opening_hours' }), 'provider');
  assert.equal(auditActorType({ admin_email: 'a@b.ro', action_type: 'update_service_configuration_draft' }), 'provider');
});

await check('o operație în masă se strânge într-un singur rând', () => {
  const bulk = Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, action_type: 'national_audit_source_correction', admin_email: null, entity_type: 'ProviderLocation' }));
  const human = [
    { id: 'h1', action_type: 'verify_profile', admin_email: 'a@b.ro', entity_type: 'ProviderLocation' },
    { id: 'h2', action_type: 'verify_profile', admin_email: 'a@b.ro', entity_type: 'ProviderLocation' },
    { id: 'h3', action_type: 'suspend_profile', admin_email: 'a@b.ro', entity_type: 'ProviderLocation' },
  ];
  const rows = collapseAuditRuns([...human, ...bulk]);
  assert.equal(rows.length, 4, 'două verificări + o suspendare + un grup');
  assert.equal(rows.filter((row) => row.kind === 'group').length, 1);
  assert.equal(rows.find((row) => row.kind === 'group').count, 40);
  // Sub prag nu se grupează (două evenimente identice rămân două rânduri).
  assert.equal(rows.filter((row) => row.kind === 'single').length, 3);
  assert.deepEqual(collapseAuditRuns([]), []);
  assert.deepEqual(collapseAuditRuns(null), []);
});

await check('starea unui profil într-un singur cuvânt', () => {
  assert.equal(profileStateOf({ status: 'publicata', profile_control_status: 'directory' }).label, 'Din director');
  assert.equal(profileStateOf({ status: 'publicata', profile_control_status: 'verified' }).label, 'Verificat');
  assert.equal(profileStateOf({ status: 'in_verificare', profile_control_status: 'verified' }).label, 'Verificat, nepublicat');
  assert.equal(profileStateOf({ status: 'publicata', profile_control_status: 'suspended' }).label, 'Suspendat');
  assert.equal(profileStateOf({ status: 'suspendata', profile_control_status: 'directory' }).label, 'Suspendat');
  assert.equal(profileStateOf({ status: 'publicata', profile_control_status: 'claimed' }).label, 'Revendicat');
  assert.equal(profileStateOf({ status: 'publicata' }).tone, 'neutral');
});

// ---------- Reguli de neconcordanță ----------
await check('profilul din director (publicat, nerevendicat) NU e o problemă', () => {
  const imported = {
    status: 'publicata',
    profile_control_status: 'directory',
    verification_state: 'unclaimed',
    is_verified: false,
    public_visibility_status: 'approved',
    claim_verification_status: 'none',
    pending_changes: null,
  };
  assert.deepEqual(locationStatusIssues(imported), []);
});

await check('profilul revendicat și publicat NU e o problemă', () => {
  assert.deepEqual(locationStatusIssues({
    status: 'publicata', profile_control_status: 'claimed', verification_state: 'in_verification', is_verified: false,
    public_visibility_status: 'approved', claim_verification_status: 'approved',
  }), []);
});

await check('suspendat și publicat este starea normală după suspendare', () => {
  // directoryOps.suspend_profile setează doar profile_control_status.
  assert.deepEqual(locationStatusIssues({
    status: 'publicata', profile_control_status: 'suspended', verification_state: 'unclaimed', is_verified: false,
    public_visibility_status: 'approved', claim_verification_status: 'none', pending_changes: null,
  }), []);
});

await check('verificat și coerent, sau verificat dar nepublicat/arhivat, nu sunt alarme', () => {
  assert.deepEqual(locationStatusIssues({
    status: 'publicata', profile_control_status: 'verified', verification_state: 'verified', is_verified: true,
    public_visibility_status: 'approved', claim_verification_status: 'none',
  }), []);
  // „Lunera Optic Store” din date reale: verificat, în verificare, arhivat, inactiv.
  assert.deepEqual(locationStatusIssues({
    status: 'in_verificare', profile_control_status: 'verified', verification_state: 'verified', is_verified: true,
    public_visibility_status: 'archived', claim_verification_status: 'approved', pending_changes: '',
  }), []);
});

await check('contradicțiile reale sunt prinse', () => {
  const claimNoControl = locationStatusIssues({ status: 'publicata', profile_control_status: 'directory', claim_verification_status: 'approved', public_visibility_status: 'approved' });
  assert.deepEqual(claimNoControl.map((issue) => [issue.code, issue.severity]), [['claim_without_control', 'error']]);

  const publishedHidden = locationStatusIssues({ status: 'publicata', profile_control_status: 'directory', public_visibility_status: 'draft' });
  assert.deepEqual(publishedHidden.map((issue) => issue.code), ['published_not_visible']);
  assert.match(publishedHidden[0].text, /ciornă/);

  const fieldsMismatch = locationStatusIssues({ status: 'publicata', profile_control_status: 'verified', verification_state: 'unclaimed', is_verified: false, public_visibility_status: 'approved' });
  assert.deepEqual(fieldsMismatch.map((issue) => issue.code), ['verification_fields_mismatch']);

  const legacy = locationStatusIssues({ status: 'publicata', profile_control_status: 'directory', public_visibility_status: 'approved', pending_changes: '{"a":1}' });
  assert.deepEqual(legacy.map((issue) => issue.code), ['legacy_pending_changes']);
  assert.deepEqual(locationStatusIssues(null), []);
});

await check('ecranele folosesc regulile comune, nu copii locale', () => {
  const profiles = source('src/components/admin/directory/DirOpsProfiles.jsx');
  const integrity = source('src/components/admin/system/AdminDataIntegrity.jsx');
  assert.match(profiles, /adminLocationStatusRules/, 'DirOpsProfiles trebuie să importe regulile comune');
  assert.match(integrity, /adminLocationStatusRules/, 'AdminDataIntegrity trebuie să importe regulile comune');
  assert.ok(!/publicata fara status verificat/.test(integrity), 'regula veche „publicată fără status verificat” trebuie eliminată');
  assert.ok(!/Locatia este publicata, dar profilul nu este verificat/.test(profiles), 'regula veche din Profiluri trebuie eliminată');
});

// ---------- Citire țintită ----------
await check('uniqueIds și chunk', () => {
  assert.deepEqual(uniqueIds(['a', 'b', ''], [null, 'a', ' c '], undefined), ['a', 'b', 'c']);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk(null), []);
});

function fakeEntity(rows, { failOn = null } = {}) {
  const calls = [];
  return {
    calls,
    async filter(query, sort, limit) {
      calls.push({ query, sort, limit });
      const [field, condition] = Object.entries(query)[0];
      if (failOn && failOn(calls.length)) throw new Error('offline');
      const values = new Set(condition.$in);
      return rows.filter((row) => values.has(row[field]));
    },
  };
}

await check('fetchByIds citește doar id-urile cerute, în pachete, fără limită de 1.000/1.500', async () => {
  const rows = Array.from({ length: 1700 }, (_, i) => ({ id: `loc${i}`, name: `Locatia ${i}` }));
  const entity = fakeEntity(rows);
  const wanted = ['loc0', 'loc1699', 'loc1250', 'loc1250'];
  const { byId, failed } = await fetchByIds(entity, wanted);
  assert.equal(failed, false);
  assert.deepEqual(Object.keys(byId).sort(), ['loc0', 'loc1250', 'loc1699']);
  assert.equal(entity.calls.length, 1);
  assert.deepEqual(entity.calls[0].query.id.$in.sort(), ['loc0', 'loc1250', 'loc1699']);

  const many = rows.slice(0, 250).map((row) => row.id);
  const big = fakeEntity(rows);
  const result = await fetchByIds(big, many);
  assert.equal(Object.keys(result.byId).length, 250);
  assert.equal(big.calls.length, 3, '250 de id-uri => 3 pachete de maximum 100');
  assert.ok(big.calls.every((call) => call.query.id.$in.length <= ID_CHUNK));
});

await check('fetchByIds nu aruncă și raportează eșecul', async () => {
  const entity = fakeEntity([{ id: 'a' }], { failOn: () => true });
  const result = await fetchByIds(entity, ['a']);
  assert.equal(result.failed, true);
  assert.deepEqual(result.byId, {});
  assert.deepEqual(await fetchByIds(entity, []), { byId: {}, failed: false });
});

await check('fetchWhereIn aduce locațiile organizațiilor cerute, deduplicate', async () => {
  const rows = [
    { id: 'l1', organization_id: 'o1' }, { id: 'l2', organization_id: 'o1' }, { id: 'l3', organization_id: 'o2' }, { id: 'l4', organization_id: 'o3' },
  ];
  const entity = fakeEntity(rows);
  const { rows: found, failed } = await fetchWhereIn(entity, 'organization_id', ['o1', 'o2', 'o1']);
  assert.equal(failed, false);
  assert.deepEqual(found.map((row) => row.id).sort(), ['l1', 'l2', 'l3']);
});

await check('ecranele nu mai citesc directorul cu limite fixe', () => {
  const lifecycle = source('src/components/admin/directory/AdminLocationLifecycleReview.jsx');
  const claims = source('src/components/admin/directory/DirOpsClaims.jsx');
  const submissions = source('src/components/admin/directory/AdminWorkspaceSubmissionsReview.jsx');
  const migration = source('src/components/admin/directory/DirOpsMigrationQueue.jsx');
  assert.ok(!/ProviderLocation\.list\("name", 1000\)/.test(lifecycle), 'Lifecycle: limita de 1.000 trebuie eliminată');
  assert.ok(!/ProviderLocation\.list\(null, 1500\)/.test(claims), 'Revendicări: limita de 1.500 trebuie eliminată');
  assert.ok(!/ProviderLocation\.list\("name", 5000\)/.test(submissions), 'Coada de modificări: citirea integrală trebuie eliminată');
  assert.ok(!/ProviderOrganization\.list\("name", 5000\)/.test(submissions), 'Coada de modificări: citirea integrală trebuie eliminată');
  assert.ok(!/ProviderLocation\.list\(null, 5000\)/.test(migration), 'Review migrare: citirea integrală trebuie eliminată');
  for (const [name, text] of [['lifecycle', lifecycle], ['claims', claims], ['submissions', submissions], ['migration', migration]]) {
    assert.match(text, /adminEntityBatch/, `${name}: trebuie să folosească citirea pe id-uri`);
  }
});

// ---------- Numărători ----------
function fakeClient({ failFunctions = [], failEntities = [], overrides = {} } = {}) {
  const functions = {
    adminServiceConfigurationReview: { submissions: [
      { id: 's1', section: 'services' },
      { id: 's2', section: 'public_profile', organization_id: 'org1' },
      { id: 's3', section: 'location_details' },
    ] },
    adminOrganizationProfileReview: { submissions: [{ id: 's2', section: 'public_profile', organization_id: 'org1' }] },
    providerLocationExpansionOps: { submissions: [{ id: 'n1' }] },
    providerLocationIdentityResolutionOps: { submissions: [{ id: 'n1' }, { id: 'n2' }] },
    providerLocationLifecycleOps: { submissions: [] },
    adminProfessionalProfileReview: { profiles: [{ id: 'p1' }] },
    providerPhotoUploadLifecycleOps: { assets: [] },
    ...overrides.functions,
  };
  const counts = { PatientRequestRecoveryCase: 2, ProviderClaimRequest: 0, SupportTicket: 0, DirectoryCorrectionRequest: 0, UserFeedback: 0, ...overrides.counts };
  const entities = new Proxy({}, {
    get: (_target, name) => ({
      count: async () => {
        if (failEntities.includes(name)) throw new Error('offline');
        return counts[name] ?? 0;
      },
    }),
  });
  return {
    entities,
    functions: {
      invoke: async (name) => {
        if (failFunctions.includes(name)) throw new Error('offline');
        if (!(name in functions)) throw new Error(`funcție necunoscută: ${name}`);
        return { data: functions[name] };
      },
    },
  };
}

await check('coada de modificări combină cele două surse fără dubluri', () => {
  const general = [{ id: 'a', section: 'services' }, { id: 'b', section: 'public_profile', organization_id: 'o' }];
  const organization = [{ id: 'b', section: 'public_profile', organization_id: 'o' }, { id: 'c', section: 'public_profile', organization_id: 'o2' }];
  assert.deepEqual(mergeWorkspacePending(general, organization).map((row) => row.id), ['a', 'b', 'c']);
  assert.deepEqual(mergeWorkspacePending(null, null), []);
});

await check('toate cele 6 surse ale Cozii de verificare sunt numărate', async () => {
  const counts = await loadAdminCounts(fakeClient());
  assert.deepEqual(Object.keys(counts.review).sort(), REVIEW_PARTS.map((part) => part.key).sort());
  assert.equal(counts.review.workspace, 3, 's1 + s3 din generală + s2 din organizație');
  assert.equal(counts.review.locations, 2, 'n1 e în ambele liste, n2 doar în a doua');
  assert.equal(counts.review.lifecycle, 0);
  assert.equal(counts.review.professionals, 1);
  assert.equal(counts.review.patient_requests, 2);
  assert.equal(counts.review.media_cleanup, 0);
  assert.equal(reviewTotal(counts.review).total, 8);
  assert.deepEqual(reviewTotal(counts.review).unavailable, []);
});

await check('un eșec devine „indisponibil”, nu 0', async () => {
  const counts = await loadAdminCounts(fakeClient({ failFunctions: ['providerLocationLifecycleOps', 'adminProfessionalProfileReview'], failEntities: ['SupportTicket'] }));
  assert.equal(counts.review.lifecycle, null);
  assert.equal(counts.review.professionals, null);
  assert.equal(counts.tickets, null);
  assert.equal(counts.claims, 0);
  const { unavailable } = reviewTotal(counts.review);
  assert.deepEqual(unavailable.sort(), ['lifecycle', 'professionals']);

  // Un răspuns cu câmpul `error` este tot un eșec.
  const withError = await loadAdminCounts(fakeClient({ overrides: { functions: { providerLocationLifecycleOps: { error: 'forbidden' } } } }));
  assert.equal(withError.review.lifecycle, null);
});

await check('„Totul e la zi” numai când totul e încărcat, disponibil și 0', async () => {
  assert.equal(summarizeCounts(null).allClear, false, 'cât timp se încarcă');
  assert.equal(summarizeCounts(null).loaded, false);

  const allZero = await loadAdminCounts(fakeClient({ overrides: {
    functions: {
      adminServiceConfigurationReview: { submissions: [] }, adminOrganizationProfileReview: { submissions: [] },
      providerLocationExpansionOps: { submissions: [] }, providerLocationIdentityResolutionOps: { submissions: [] },
      adminProfessionalProfileReview: { profiles: [] },
    },
    counts: { PatientRequestRecoveryCase: 0 },
  } }));
  assert.equal(summarizeCounts(allZero).allClear, true);

  const oneDown = await loadAdminCounts(fakeClient({ failFunctions: ['providerLocationLifecycleOps'], overrides: {
    functions: {
      adminServiceConfigurationReview: { submissions: [] }, adminOrganizationProfileReview: { submissions: [] },
      providerLocationExpansionOps: { submissions: [] }, providerLocationIdentityResolutionOps: { submissions: [] },
      adminProfessionalProfileReview: { profiles: [] },
    },
    counts: { PatientRequestRecoveryCase: 0 },
  } }));
  const summary = summarizeCounts(oneDown);
  assert.equal(summary.allClear, false, 'o sursă indisponibilă nu poate însemna „la zi”');
  assert.deepEqual(summary.unavailable, ['Schimbări de stare a locațiilor']);
});

await check('rândurile „De rezolvat” duc direct la sub-tabul potrivit', async () => {
  const counts = await loadAdminCounts(fakeClient({ overrides: { counts: { ProviderClaimRequest: 2, SupportTicket: 1 } } }));
  const summary = summarizeCounts(counts);
  const workspace = summary.rows.find((row) => row.key === 'review:workspace');
  assert.deepEqual([workspace.section, workspace.tab, workspace.count], ['workspace_reviews', 'workspace', 3]);
  const locations = summary.rows.find((row) => row.key === 'review:locations');
  assert.equal(locations.tab, 'locations');
  assert.equal(summary.rows.find((row) => row.key === 'claims').section, 'revendicari');
  assert.equal(summary.rows.find((row) => row.key === 'tickets').section, 'support_tickets');
  assert.ok(summary.rows.every((row) => row.count > 0), 'nu se afișează rânduri cu 0');
});

await check('insigna din meniu', async () => {
  const counts = await loadAdminCounts(fakeClient({ overrides: { counts: { ProviderClaimRequest: 4 } } }));
  assert.equal(sidebarBadgeFor(counts, 'workspace_reviews'), 8);
  assert.equal(sidebarBadgeFor(counts, 'revendicari'), 4);
  assert.equal(sidebarBadgeFor(counts, 'corectii'), null, '0 nu se afișează');
  assert.equal(sidebarBadgeFor(counts, 'profiluri'), null);
  assert.equal(sidebarBadgeFor(null, 'revendicari'), null);
});

// ---------- Formatare ----------
await check('timp relativ în română', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  assert.equal(relativeTime('2026-10-07T11:59:40Z', now), 'chiar acum');
  assert.equal(relativeTime('2026-10-07T11:55:00Z', now), 'acum 5 min');
  assert.equal(relativeTime('2026-10-07T11:00:00Z', now), 'acum o oră');
  assert.equal(relativeTime('2026-10-07T09:00:00Z', now), 'acum 3 ore');
  assert.equal(relativeTime('2026-10-06T10:00:00Z', now), 'ieri');
  assert.equal(relativeTime('2026-10-03T12:00:00Z', now), 'acum 4 zile');
  assert.equal(relativeTime('', now), '');
  assert.equal(relativeTime('nu e data', now), '');
  assert.equal(plural(1, 'revendicare', 'revendicări'), '1 revendicare');
  assert.equal(plural(3, 'revendicare', 'revendicări'), '3 revendicări');
});


// ---------- Navigare pe adresa ----------
await check('fiecare sectiune are adresa ei, iar Panoul are adresa curata', () => {
  assert.equal(adminHref('dashboard'), '/admin/operatiuni');
  assert.equal(adminHref(), '/admin/operatiuni');
  assert.equal(adminHref('profiluri'), '/admin/operatiuni?s=profiluri');
  assert.equal(adminHref('workspace_reviews', 'lifecycle'), '/admin/operatiuni?s=workspace_reviews&t=lifecycle');
  assert.equal(adminHref('outreach', 'campanii', 'abc123'), '/admin/operatiuni?s=outreach&t=campanii&id=abc123');
});

await check('adresele si cheile vechi duc in sectiunea in care a ajuns functia', () => {
  assert.deepEqual(resolveAdminTarget('mapping'), { section: 'import_directory', tab: 'mapping' });
  assert.deepEqual(resolveAdminTarget('contract_geo'), { section: 'data_integrity', tab: 'contract_geo' });
  assert.deepEqual(resolveAdminTarget('ai'), { section: 'research', tab: 'ai' });
  assert.deepEqual(resolveAdminTarget('specialist_reviews'), { section: 'workspace_reviews', tab: 'professionals' });
  assert.deepEqual(resolveAdminTarget('fotografii'), { section: 'workspace_reviews', tab: 'workspace' });
  assert.deepEqual(resolveAdminTarget('setari'), { section: 'dashboard', tab: '' });
  // Un sub-tab ales explicit bate varianta implicita a redirectarii.
  assert.deepEqual(resolveAdminTarget('ai', 'batches'), { section: 'research', tab: 'batches' });
});

await check('o sectiune necunoscuta sau goala cade pe Panou', () => {
  assert.deepEqual(resolveAdminTarget('nu_exista'), { section: 'dashboard', tab: '' });
  assert.deepEqual(resolveAdminTarget(''), { section: 'dashboard', tab: '' });
  assert.deepEqual(resolveAdminTarget(null, 'x'), { section: 'dashboard', tab: '' });
  assert.equal(adminHref('nu_exista'), '/admin/operatiuni');
});

await check('toate intrarile din meniu au eticheta si sunt sectiuni valide, fara chei duplicate', () => {
  const keys = [...ADMIN_NAV_PRIMARY, ...ADMIN_NAV_SECONDARY].map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) {
    assert.ok(ADMIN_SECTIONS.has(key), `${key} lipseste din ADMIN_SECTIONS`);
    assert.ok(ADMIN_NAV_LABELS[key], `${key} nu are eticheta`);
  }
  for (const key of ['adauga', 'import_directory', 'geografie', 'audit']) {
    assert.ok(ADMIN_SECTIONS.has(key), `ecranul ascuns ${key} trebuie sa ramana accesibil`);
    assert.ok(ADMIN_NAV_LABELS[key]);
  }
});

await check('pagina conecteaza fiecare sectiune (nicio sectiune nu ramane goala) si foloseste adresa', () => {
  const page = source('src/pages/AdminDirectoryOps.jsx');
  assert.match(page, /useAdminRoute/);
  assert.ok(!/useState\("dashboard"\)/.test(page), 'sectiunea nu mai poate fi stare locala');
  for (const key of ADMIN_SECTIONS) {
    if (key === 'dashboard' || key === 'analytics') {
      assert.match(page, new RegExp(`section === "${key}"`), `${key} nu e randata`);
      continue;
    }
    assert.match(page, new RegExp(`\\b${key}: \\{`), `${key} nu are antet in SECTION_HEADERS`);
    assert.match(page, new RegExp(`section === "${key}"`), `${key} nu e randata`);
  }
});

await check('sub-tab-urile stau in adresa, nu in stare locala', () => {
  for (const file of [
    'src/components/admin/review/AdminReviewQueue.jsx',
    'src/components/admin/directory/AdminProfilesSection.jsx',
    'src/components/admin/directory/DirResearch.jsx',
    'src/components/admin/outreach/OutreachWorkspace.jsx',
    'src/components/admin/support/AdminSupportCenter.jsx',
    'src/components/admin/directory/DirOpsClaims.jsx',
  ]) {
    assert.match(source(file), /useAdminSubTab/, `${file}: sub-tab-ul trebuie sa foloseasca adresa`);
  }
  assert.match(source('src/components/admin/outreach/OutreachWorkspace.jsx'), /useAdminSelectedId/, 'campania deschisa trebuie sa fie in adresa');
});

await check('meniul este format din legaturi reale cu aria-current', () => {
  const sidebar = source('src/components/admin/shell/AdminSidebarContent.jsx');
  assert.match(sidebar, /<Link/);
  assert.match(sidebar, /aria-current/);
  assert.match(sidebar, /sidebarBadgeFor/);
});

// ---------- Editare rapida si termene ----------
await check('validarea editarii rapide blocheaza greselile evidente, nu datele reale', () => {
  assert.deepEqual(validateQuickEdit({ phone_public: '0774 410 745 / 0770 977 478', public_email: 'contact@optiplus.ro', website: 'https://www.optiplus.ro' }), []);
  assert.deepEqual(validateQuickEdit({ phone_public: '', public_email: '', website: '', description: 'x' }), []);
  assert.equal(validateQuickEdit({ phone_public: '123' }).length, 1);
  assert.equal(validateQuickEdit({ phone_public: 'sunati-ma' }).length >= 1, true);
  assert.equal(validateQuickEdit({ public_email: 'fara-arond' }).length, 1);
  assert.equal(validateQuickEdit({ website: 'www.exemplu.ro' }).length, 1);
  assert.equal(validateQuickEdit({ website: 'https://exemplu' }).length, 1);
});

await check('sursa se afiseaza ca domeniu scurt', () => {
  assert.equal(sourceHost('https://www.optiplus.ro/magazine/pantelimon?x=1'), 'optiplus.ro');
  assert.equal(sourceHost(''), '');
  assert.equal(sourceHost(null), '');
  assert.equal(sourceHost('nu e un url'), 'nu e un url');
});

await check('termenul de raspuns (ex. 30 de zile pentru date personale)', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  assert.equal(deadlineInfo('2026-09-30T12:00:00Z', 30, now).daysLeft, 23);
  assert.equal(deadlineInfo('2026-09-30T12:00:00Z', 30, now).tone, 'neutral');
  assert.equal(deadlineInfo('2026-09-15T12:00:00Z', 30, now).tone, 'neutral', '8 zile rămase: încă în afara pragului de 7 zile');
  assert.equal(deadlineInfo('2026-09-14T12:00:00Z', 30, now).tone, 'warning');
  assert.equal(deadlineInfo('2026-09-14T12:00:00Z', 30, now).label, '7 zile rămase');
  assert.equal(deadlineInfo('2026-09-07T12:00:00Z', 30, now).label, 'termen astăzi');
  const late = deadlineInfo('2026-08-01T12:00:00Z', 30, now);
  assert.equal(late.tone, 'danger');
  assert.match(late.label, /depășit/);
  assert.equal(deadlineInfo('', 30, now), null);
  assert.equal(deadlineInfo('nu e data', 30, now), null);
});

await check('tokenii semantici exista in CSS si in Tailwind (StatusBadge nu mai depinde de culori scrise de mana)', () => {
  const css = source('src/index.css');
  const tailwind = source('tailwind.config.js');
  const badge = source('src/components/admin/ui/StatusBadge.jsx');
  for (const tone of ['success', 'warning', 'info', 'danger']) {
    for (const part of ['', '-soft', '-border']) assert.match(css, new RegExp(`--${tone}${part}:`), `--${tone}${part} lipseste din index.css`);
    assert.match(tailwind, new RegExp(`${tone}: \\{`), `${tone} lipseste din tailwind.config.js`);
    assert.match(badge, new RegExp(`${tone}:`), `${tone} lipseste din StatusBadge`);
  }
  assert.ok(!/(green|amber|red|blue)-\d{2,3}/.test(badge), 'StatusBadge nu mai are culori scrise de mana');
});

await check('nicio casuta nativa window.confirm in panoul de admin (in afara de rezerva din AdminConfirm)', () => {
  const files = [
    'src/components/admin/system/AdminDataRepairs.jsx',
    'src/components/admin/system/AdminFragmentedOrganizations.jsx',
    'src/components/admin/system/AdminLocationGeocoding.jsx',
    'src/components/admin/system/AdminDataIntegrity.jsx',
    'src/components/admin/directory/DirOpsServices.jsx',
    'src/components/admin/directory/DirOpsCorrections.jsx',
    'src/components/admin/outreach/OutreachTemplateEditor.jsx',
    'src/components/admin/outreach/OutreachCampaignDetail.jsx',
    'src/components/admin/billing/AdminEnterpriseOffers.jsx',
  ];
  for (const file of files) {
    const text = source(file);
    assert.ok(!/window\.confirm/.test(text), `${file}: window.confirm trebuie inlocuit cu useAdminConfirm`);
    assert.match(text, /useAdminConfirm/, `${file}: lipseste useAdminConfirm`);
  }
});


await check('shell-ul admin nu mai foloseste CSS-ul contului de furnizor (.workspace-neutral)', () => {
  const shell = source('src/components/admin/shell/AdminAppShell.jsx');
  assert.ok(!/workspace-neutral/.test(shell), 'AdminAppShell nu trebuie sa foloseasca .workspace-neutral');
  assert.match(shell, /admin-surface/);
  assert.match(shell, /admin-surface\.css/);
  const css = source('src/styles/admin-surface.css');
  assert.ok(!/!important/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'admin-surface.css nu trebuie sa foloseasca !important');
  assert.ok(!/:has\(/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'admin-surface.css nu trebuie sa foloseasca :has()');
});

// ---------- Coada de verificare (M2) ----------
await check('cât așteaptă un element: ton neutru, apoi avertisment (3 zile) și alertă (7 zile)', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const ago = (days) => new Date(now - days * 86400000).toISOString();
  assert.equal(waitingInfo(ago(0.1), now).tone, 'neutral');
  assert.equal(waitingInfo(ago(2), now).tone, 'neutral');
  assert.equal(waitingInfo(ago(3), now).tone, 'warning');
  assert.equal(waitingInfo(ago(6), now).tone, 'warning');
  assert.equal(waitingInfo(ago(7), now).tone, 'danger');
  assert.equal(waitingInfo(ago(8), now).label, 'acum 8 zile');
  assert.equal(waitingInfo(ago(1), now).label, 'ieri');
  assert.equal(waitingInfo('', now), null);
  assert.equal(waitingInfo('nu-e-data', now), null);
});

await check('cozile se rezolvă cele mai vechi primele; elementele fără dată merg la final', () => {
  const rows = [{ id: 'c', d: '2026-10-06' }, { id: 'x' }, { id: 'a', d: '2026-10-01' }, { id: 'b', d: '2026-10-03' }];
  assert.deepEqual(oldestFirst(rows, (row) => row.d).map((row) => row.id), ['a', 'b', 'c', 'x']);
  assert.deepEqual(rows.map((row) => row.id), ['c', 'x', 'a', 'b'], 'nu modifică lista primită');
});

await check('motivele de curățare a fotografiilor și controlul profilului au etichete în română', () => {
  for (const code of ['upload_replaced_before_attachment', 'photo_draft_replaced', 'photo_draft_withdrawn', 'submission_rejected', 'submission_withdrawn', 'submission_approved']) {
    const label = mediaCleanupReasonLabel(code);
    assert.ok(label && !label.includes('_') && label !== code, `${code}: ${label}`);
  }
  assert.equal(mediaCleanupReasonLabel(''), 'Fișier nefolosit');
  assert.equal(profileControlLabel('directory'), 'Din director');
  assert.equal(profileControlLabel('suspended'), 'Suspendat');
  assert.equal(profileControlLabel(undefined), 'Necunoscut');
});

await check('cozile folosesc bara de decizie comună, fără casete de notă proprii și fără culori scrise de mână', () => {
  const withBar = [
    'src/components/admin/directory/AdminWorkspaceSubmissionsReview.jsx',
    'src/components/admin/directory/AdminNewLocationReview.jsx',
    'src/components/admin/directory/AdminProfessionalProfileReview.jsx',
  ];
  for (const file of withBar) {
    const text = source(file);
    assert.match(text, /AdminDecisionBar/, `${file}: lipsește AdminDecisionBar`);
    assert.ok(!/<textarea/.test(text), `${file}: nota se scrie în bara de decizie, nu într-o casetă proprie`);
  }
  const screens = [
    ...withBar,
    'src/components/admin/directory/AdminPhotoCleanupQueue.jsx',
    'src/components/admin/review/AdminPatientRequestRecoveryQueue.jsx',
    'src/components/admin/ui/AdminDecisionBar.jsx',
    'src/components/admin/ui/AdminNotice.jsx',
  ];
  for (const file of screens) {
    const text = source(file).replace(/\/\/.*$/gm, '');
    assert.ok(!/(red|green|amber|blue)-\d{2,3}/.test(text), `${file}: culori scrise de mână (folosește tokenii semantici)`);
    assert.ok(!/(Aproba\b|Cere informatii|Locatie\b|Organizatie\b|Specialisti\b|trimisa\b|Respinge solicitarea)/.test(text), `${file}: text vizibil fără diacritice`);
  }
});

await check('bara de decizie: motivul obligatoriu se validează local, eroarea apare lângă butoane', () => {
  const bar = source('src/components/admin/ui/AdminDecisionBar.jsx');
  assert.match(bar, /note: "required"|action\.note === "required"/, 'acțiunile cu motiv obligatoriu');
  assert.match(bar, /Scrie mai întâi motivul/, 'mesaj local pentru motiv lipsă');
  assert.match(bar, /role="alert"/, 'eroarea se anunță');
  assert.match(bar, /event\.key === "Escape"/, 'Esc închide câmpul');
  assert.match(bar, /aria-expanded/, 'starea butoanelor care deschid câmpul');
});

await check('coada: la final propune singură următoarea coadă cu lucru', () => {
  const queue = source('src/components/admin/review/AdminReviewQueue.jsx');
  assert.match(queue, /nextWithWork/);
  assert.match(queue, /Gata aici/);
});

console.log(`Panoul de admin: ${checks} verificări de corectitudine au trecut.`);
