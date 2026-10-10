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
  deliveryChannelLabel,
  deliveryRecipientLabel,
  deliveryStatusLabel,
  deliveryStatusTone,
  accountModeLabel,
  billingStatusTone,
  correctionStatusLabel,
  enterpriseOfferLabel,
  enterpriseOfferTone,
  feedbackStatusLabel,
  feedbackStatusTone,
  humanizeCode,
  locationStatusLabel,
  mediaCleanupReasonLabel,
  organizationLinkLabel,
  profileControlLabel,
  profileStateOf,
  selectionRequestLabel,
  serviceNeedLevelLabel,
  selectionRequestTone,
  supportSourceLabel,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketPriorityTone,
  ticketStatusLabel,
  ticketStatusTone,
} from '../src/lib/adminLabels.js';
import { locationStatusIssues } from '../src/lib/adminLocationStatusRules.js';
import { chunk, fetchByIds, fetchWhereIn, uniqueIds, ID_CHUNK } from '../src/lib/adminEntityBatch.js';
import {
  REVIEW_PARTS,
  COUNT_CONCURRENCY,
  createLimiter,
  loadAdminCounts,
  loadSubscriptionSummary,
  mergeWorkspacePending,
  reviewTotal,
  sidebarBadgeFor,
  summarizeCounts,
} from '../src/lib/adminCounts.js';
import { daysLabel, deadlineInfo, oldestFirst, plural, relativeTime, waitingInfo } from '../src/lib/adminFormat.js';
import { buckets, changeBetween, inPreviousWindow, inWindow } from '../src/components/admin/analytics/analyticsWindow.js';
import { searchContactFollowUpTone } from '../src/lib/adminSearchContacts.js';
import { sourceHost, validateQuickEdit } from '../src/lib/adminProfileEdit.js';
import { buildLocationIndex, normalizeSearch, searchLocationIndex, searchTokens } from '../src/lib/adminSearch.js';
import { ORGANIZATION_ID_PREFIX, buildGlobalIndexes, searchEverything } from '../src/lib/adminGlobalSearch.js';
import {
  CAMPAIGN_STATUS_LABELS,
  CONTACT_STATUS_LABELS,
  campaignStatusLabel,
  campaignStatusTone,
  categoryBadgeClass,
  contactStatusTone,
  isAutoPausedCampaign,
  outcomeClass,
} from '../src/lib/adminOutreachLabels.js';
import { readdirSync } from 'node:fs';
import {
  accountDeletionDeadline,
  buildTicketPayload,
  isActiveTicket,
  needsAdmin,
  nextTicketToHandle,
  sortSupportTickets,
  ticketUpdateProblem,
  ticketWaiting,
} from '../src/lib/adminSupportRules.js';
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
    // 2026-10-10: cererile de pacienți fără destinatar intră în „De rezolvat acum” (verify-admin-notifications.mjs).
    adminPatientRequestOps: { attention_count: 0 },
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
    'src/components/admin/billing/AdminBillingCenter.jsx',
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

// ---------- Căutare de locație / Servicii pe locații (M7) ----------
await check('căutarea ignoră diacriticele, majusculele și forma veche (cu sedilă) a lui ș/ț', () => {
  assert.equal(normalizeSearch('Brașov'), 'brasov');
  assert.equal(normalizeSearch('Timişoara'), 'timisoara'); // ş cu sedilă (U+015F)
  assert.equal(normalizeSearch('Timișoara'), 'timisoara'); // ș cu virgulă (U+0219)
  assert.equal(normalizeSearch('CONSTANȚA'), 'constanta');
  assert.equal(normalizeSearch('Piaţa Unirii'), 'piata unirii');
  assert.deepEqual(searchTokens('  Optica   Iași '), ['optica', 'iasi']);
  // telefonul scris cu spații/puncte/prefix de țară e un singur cuvânt
  assert.deepEqual(searchTokens('0722 000 007'), ['0722000007']);
  assert.deepEqual(searchTokens('0722.000.007'), ['0722000007']);
  assert.deepEqual(searchTokens('+40 722 000 007'), ['0722000007']);
  assert.deepEqual(searchTokens('0040722000007'), ['0722000007']);
  assert.deepEqual(searchTokens('demo 6'), ['demo', '6'], 'cifrele scurte rămân cuvinte separate');
  assert.deepEqual(searchTokens('10 5'), ['10', '5']);
  assert.deepEqual(searchTokens('Str. Exemplu 12'), ['str.', 'exemplu', '12'], 'cu litere nu e telefon');
  assert.equal(normalizeSearch(null), '');
});

await check('căutarea după telefon: numărul scris cu spații se caută întreg, în orice format', () => {
  const index = buildLocationIndex([
    { id: 'a', name: 'A', phone_public: '0722 000 007' },
    { id: 'b', name: 'B', phone_public: '0722 000 070' },
    { id: 'c', name: 'C', phone_public: '+40 744 123 456' },
  ]);
  const ids = (query) => searchLocationIndex(index, query).items.map((item) => item.id).sort();
  assert.deepEqual(ids('0722 000 007'), ['a']);
  assert.deepEqual(ids('0722000007'), ['a']);
  assert.deepEqual(ids('0722.000.007'), ['a']);
  assert.deepEqual(ids('+40 722 000 007'), ['a']);
  assert.deepEqual(ids('0744 123 456'), ['c'], 'numărul salvat cu prefix de țară');
  assert.deepEqual(ids('0722 000'), ['a', 'b'], 'începutul numărului găsește ambele');
});

await check('căutarea de locații: toate cuvintele obligatorii, limită, total, cele mai bune primele', () => {
  const locations = [
    { id: 'a', name: 'Optica Demo 46 — Constanța', city: 'Constanța', county: 'Constanța' },
    { id: 'b', name: 'Optica Demo 6 — Constanța', city: 'Constanța', county: 'Constanța' },
    { id: 'c', name: 'Clinica Soare', city: 'Brașov', county: 'Brașov', address: 'Str. Demo 6' },
    { id: 'd', name: 'Optica Lumină', city: 'Iași', county: 'Iași' },
    { id: 'e', public_display_name: 'Ochelari Brașov', name: 'x', city: 'Brașov', county: 'Brașov' },
  ];
  const index = buildLocationIndex(locations);
  const ids = (result) => result.items.map((item) => item.id);
  assert.deepEqual(ids(searchLocationIndex(index, 'brasov')).sort(), ['c', 'e']);
  assert.equal(searchLocationIndex(index, 'brasov').total, 2);
  assert.deepEqual(ids(searchLocationIndex(index, 'optica ia')), ['d'], 'toate cuvintele trebuie să se potrivească');
  assert.equal(ids(searchLocationIndex(index, 'demo 6 constanta'))[0], 'b', '„Demo 6” înaintea lui „Demo 46”');
  assert.equal(searchLocationIndex(index, '', { limit: 2 }).items.length, 2);
  assert.equal(searchLocationIndex(index, '', { limit: 2 }).total, 5);
  assert.deepEqual(ids(searchLocationIndex(index, '', { filter: (location) => location.id === 'd' })), ['d']);
  assert.deepEqual(ids(searchLocationIndex(index, 'zzz')), []);
  assert.deepEqual(ids(searchLocationIndex([], 'a')), []);
});

await check('Servicii pe locații: căutare în loc de lista nativă, nivel în română, fără culori scrise de mână', () => {
  assert.equal(serviceNeedLevelLabel('general'), 'General');
  assert.equal(serviceNeedLevelLabel('technical'), 'Tehnic');
  assert.equal(serviceNeedLevelLabel('specialized_medical'), 'Medical specializat');
  assert.equal(serviceNeedLevelLabel(undefined), 'General');
  const screen = source('src/components/admin/directory/DirOpsServices.jsx');
  assert.match(screen, /AdminLocationPicker/);
  assert.match(screen, /useAdminSelectedId/, 'locația aleasă stă în adresă');
  assert.ok(!/<select/.test(screen), 'lista nativă cu toate locațiile trebuie să dispară');
  for (const file of [
    'src/components/admin/directory/DirOpsServices.jsx',
    'src/components/admin/directory/DirOpsServiceRow.jsx',
    'src/components/admin/directory/DirOpsServiceAdd.jsx',
    'src/components/admin/ui/AdminLocationPicker.jsx',
  ]) {
    const text = source(file).replace(/\/\/.*$/gm, '');
    assert.ok(!/(red|green|amber|blue)-\d{2,3}/.test(text), `${file}: culori scrise de mână`);
    assert.ok(!/(Alege locatia|Adauga serviciu|Sursa oficiala|Data verificarii|Se salveaza|Schimba nivel|Aplica\b)/.test(text), `${file}: text vizibil fără diacritice`);
  }
});

// ---------- Căutarea globală (Ctrl/Cmd+K) ----------
await check('căutarea globală: grupuri, telefon în orice format, ținta fiecărui rezultat', () => {
  const indexes = buildGlobalIndexes({
    locations: [
      { id: 'l1', name: 'Optica Soare', city: 'Brașov', county: 'Brașov', organization_id: 'o1', phone_public: '0722 111 222', profile_control_status: 'verified' },
      { id: 'l2', name: 'Optica Soare 2', city: 'Iași', county: 'Iași', organization_id: 'o1' },
      { id: 'l3', name: 'Cabinet Lună', city: 'Cluj-Napoca', county: 'Cluj', organization_id: 'o2' },
    ],
    organizations: [
      { id: 'o1', name: 'Soare SRL', public_display_name: 'Optica Soare' },
      { id: 'o2', name: 'Lună SRL' },
    ],
    claims: [
      { id: 'c1', business_name: 'Optica Soare', contact_name: 'Maria Pop', email: 'maria@demo.ro', phone: '0733 000 111', status: 'in_asteptare' },
      { id: 'c2', business_name: 'Cabinet Lună', contact_name: 'Dan Lupu', email: 'dan@demo.ro', status: 'aprobata' },
    ],
    tickets: [
      { id: 't1', subject: 'Nu îmi văd programul', requester_name: 'Maria Pop', requester_email: 'maria@demo.ro', status: 'open' },
    ],
  });
  const sections = [{ key: 'revendicari', label: 'Revendicări', count: 2 }, { key: 'profiluri', label: 'Profiluri și locații', count: 0 }];
  const keys = (groups) => groups.flatMap((group) => group.items.map((item) => item.key));

  // fără text: doar meniul rapid cu secțiunile (și numărul de lucruri de rezolvat)
  const menu = searchEverything(indexes, '', sections);
  assert.deepEqual(menu.map((group) => group.key), ['sections']);
  assert.equal(menu[0].items[0].badge, '2');
  assert.equal(menu[0].items[1].badge, '');

  // secțiune găsită după un fragment, fără diacritice
  assert.deepEqual(keys(searchEverything(indexes, 'revend', sections)), ['section:revendicari']);

  // persoana apare la revendicări ȘI la tichete
  const maria = searchEverything(indexes, 'maria', sections);
  assert.deepEqual(maria.map((group) => group.key), ['claims', 'tickets']);

  // telefon scris oricum
  assert.ok(keys(searchEverything(indexes, '0722111222', sections)).includes('location:l1'));
  assert.ok(keys(searchEverything(indexes, '0733 000 111', sections)).includes('claim:c1'));

  // organizația arată câte locații are
  const org = searchEverything(indexes, 'soare', sections).find((group) => group.key === 'organizations').items[0];
  assert.equal(org.subtitle, 'Organizație · 2 locații');
  assert.deepEqual(org.target, { section: 'profiluri', tab: '', id: `${ORGANIZATION_ID_PREFIX}o1` });

  // locația se caută și după numele organizației
  const byOrg = searchEverything(indexes, 'soare srl', sections).find((group) => group.key === 'locations');
  assert.equal(byOrg, undefined, 'numele juridic nu e câmp de căutare pentru locații fără organization_name potrivit');
  const locationHit = searchEverything(indexes, 'brasov', sections).find((group) => group.key === 'locations').items[0];
  assert.deepEqual(locationHit.target, { section: 'profiluri', tab: '', id: 'l1' });
  assert.match(locationHit.subtitle, /Brașov/);
  assert.match(locationHit.subtitle, /Verificat/);

  // ținta revendicării depinde de stare; tichetul duce la Tichete suport
  const claims = searchEverything(indexes, 'cabinet', sections).find((group) => group.key === 'claims').items[0];
  assert.deepEqual(claims.target, { section: 'revendicari', tab: 'istoric', id: 'c2' });
  const pending = searchEverything(indexes, 'maria', sections).find((group) => group.key === 'claims').items[0];
  assert.deepEqual(pending.target, { section: 'revendicari', tab: '', id: 'c1' });
  const ticket = searchEverything(indexes, 'programul', sections).find((group) => group.key === 'tickets').items[0];
  assert.deepEqual(ticket.target, { section: 'support_tickets', tab: '', id: 't1' });
  assert.match(ticket.subtitle, /Deschis/);

  // nimic găsit / indexuri goale: fără erori
  assert.deepEqual(searchEverything(indexes, 'zzzzzz', sections), []);
  assert.deepEqual(searchEverything(buildGlobalIndexes(), 'maria', sections), []);
});

await check('ținta rezultatelor se deschide în ecranele potrivite (?id= în Profiluri, Revendicări, Tichete)', () => {
  const profiles = source('src/components/admin/directory/DirOpsProfiles.jsx');
  assert.match(profiles, /useAdminSelectedId/);
  assert.match(profiles, /ORGANIZATION_ID_PREFIX/);
  assert.match(profiles, /Arată toate profilurile/);
  const claims = source('src/components/admin/directory/DirOpsClaims.jsx');
  assert.match(claims, /id=\{`claim-\$\{claim\.id\}`\}/);
  assert.match(claims, /focusedView/);
  const tickets = source('src/components/admin/support/AdminSupportTickets.jsx');
  assert.match(tickets, /useAdminSelectedId/);
  assert.match(tickets, /handledFocus/);
  const shell = source('src/components/admin/shell/AdminAppShell.jsx');
  assert.match(shell, /AdminGlobalSearch/);
  assert.match(shell, /metaKey \|\| event\.ctrlKey/);
  assert.match(source('src/components/admin/AdminGlobalSearch.jsx'), /DialogTitle/, 'dialog accesibil, cu titlu');
});

// ---------- Emailuri automate: jurnalul de trimiteri ----------
await check('emailurile eșuate din ultimele 7 zile apar în Panou, în meniu și duc în jurnal', async () => {
  const counts = await loadAdminCounts(fakeClient({ overrides: { counts: { CommunicationDelivery: 3 } } }));
  assert.equal(counts.email_failures, 3);
  const row = summarizeCounts(counts).rows.find((item) => item.key === 'email_failures');
  assert.deepEqual([row.section, row.tab, row.count], ['automatic_emails', 'jurnal', 3]);
  assert.equal(sidebarBadgeFor(counts, 'automatic_emails'), 3);
  const clean = await loadAdminCounts(fakeClient());
  assert.equal(sidebarBadgeFor(clean, 'automatic_emails'), null, '0 nu se afișează');
  assert.ok(!summarizeCounts(clean).rows.some((item) => item.key === 'email_failures'));

  // interogarea: doar „failed”, doar ultima săptămână
  let seen = null;
  const client = fakeClient();
  const proxied = { ...client, entities: new Proxy({}, { get: (_t, name) => ({ count: async (query) => { if (name === 'CommunicationDelivery') seen = query; return 0; } }) }) };
  const now = Date.parse('2026-10-07T12:00:00Z');
  await loadAdminCounts(proxied, now);
  assert.equal(seen.status, 'failed');
  assert.equal(seen.created_date.$gte, new Date(now - 7 * 86400000).toISOString());

  // o sursă indisponibilă nu înseamnă „la zi”
  const down = await loadAdminCounts(fakeClient({ failEntities: ['CommunicationDelivery'] }));
  assert.equal(down.email_failures, null);
  assert.ok(summarizeCounts(down).unavailable.includes('Emailuri netrimise'));
});

await check('jurnalul de trimiteri: stări, destinatari și canale în română', () => {
  assert.equal(deliveryStatusLabel('failed'), 'Eșuat');
  assert.equal(deliveryStatusLabel('sent'), 'Trimis');
  assert.equal(deliveryStatusLabel('skipped'), 'Sărit');
  assert.equal(deliveryStatusLabel('pending'), 'În așteptare');
  assert.equal(deliveryStatusTone('failed'), 'danger');
  assert.equal(deliveryStatusTone('sent'), 'success');
  assert.equal(deliveryRecipientLabel('patient_contact'), 'Contact pacient');
  assert.equal(deliveryRecipientLabel('provider_user'), 'Utilizator furnizor');
  assert.equal(deliveryChannelLabel('in_app'), 'În aplicație');
  const log = source('src/components/admin/automatic-emails/EmailDeliveryLog.jsx');
  assert.match(log, /CommunicationDelivery/);
  assert.ok(!/(red|green|amber|blue|emerald|sky)-\d{2,3}/.test(log.replace(/\/\/.*$/gm, '')), 'jurnalul folosește tokenii semantici');
  const workspace = source('src/components/admin/automatic-emails/AutomaticEmailWorkspace.jsx');
  assert.match(workspace, /Jurnal trimiteri/);
  assert.ok(!/(Operatia nu a reusit|Salveaza si activeaza|Se incarca emailurile|Anuleaza editarea|Editeaza mesajul)/.test(workspace), 'text fără diacritice în ecranul de emailuri');
});

// ---------- Campanii și marketing ----------
await check('campanii: stări, tonuri și oprirea automată în română', () => {
  assert.equal(campaignStatusLabel('draft'), 'Ciornă');
  assert.equal(campaignStatusLabel('ready'), 'Pregătită');
  assert.equal(campaignStatusLabel('paused'), 'Pauzată');
  assert.equal(campaignStatusLabel('failed'), 'Eșuată');
  assert.equal(campaignStatusLabel('cancelled'), 'Anulată');
  for (const label of Object.values(CAMPAIGN_STATUS_LABELS)) assert.ok(!/[a-z]_[a-z]/.test(label), label);
  assert.equal(campaignStatusTone('sent'), 'success');
  assert.equal(campaignStatusTone('failed'), 'danger');
  assert.equal(campaignStatusTone('paused'), 'warning');
  assert.equal(campaignStatusTone('draft'), 'neutral');
  assert.equal(isAutoPausedCampaign({ status: 'paused', pause_reason: 'bounce_rate' }), true);
  assert.equal(isAutoPausedCampaign({ status: 'paused', pause_reason: 'complaints' }), true);
  assert.equal(isAutoPausedCampaign({ status: 'paused', pause_reason: 'manual' }), false, 'o pauză manuală nu e oprire automată');
  assert.equal(isAutoPausedCampaign({ status: 'sending', pause_reason: 'bounce_rate' }), false);
  assert.equal(isAutoPausedCampaign(null), false);
});

await check('contacte: stări în română și tonuri', () => {
  assert.equal(CONTACT_STATUS_LABELS.replied, 'A răspuns');
  assert.equal(CONTACT_STATUS_LABELS.complained, 'Plângere spam');
  assert.equal(contactStatusTone('bounced'), 'danger');
  assert.equal(contactStatusTone('unsubscribed'), 'danger');
  assert.equal(contactStatusTone('interested'), 'success');
  assert.equal(contactStatusTone('contacted'), 'info');
  assert.equal(contactStatusTone('new'), 'neutral');
  assert.match(categoryBadgeClass('announcement'), /info/);
  assert.match(outcomeClass('bounced'), /danger/);
  assert.match(outcomeClass('delivered'), /success/);
});

await check('modulul de campanii: fără culori scrise de mână și fără text vizibil fără diacritice', () => {
  const dir = 'src/components/admin/outreach';
  const files = readdirSync(path.join(root, dir)).filter((name) => /\.(jsx|js)$/.test(name));
  assert.ok(files.length >= 8, 'fișierele modulului');
  for (const name of files) {
    const text = source(`${dir}/${name}`).replace(/\/\/.*$/gm, '');
    assert.ok(!/(red|green|amber|blue|sky|violet|emerald)-\d{2,3}/.test(text), `${name}: culori scrise de mână`);
    const bad = text.match(/(Pregatita|Esuata|Anulata|Pausata|Sabloane|Se incarca|Inapoi|Renunta|Reincarca|Campanie noua|Creeaza si|Aproba si|Salveaza)/);
    assert.ok(!bad, `${name}: text fără diacritice („${bad && bad[0]}”)`);
  }
  const list = source(`${dir}/OutreachCampaignList.jsx`);
  assert.match(list, /Prima ta campanie/);
  assert.match(list, /Pornește prima campanie/);
  const contacts = source(`${dir}/OutreachContactsList.jsx`);
  assert.ok(!/slice\(0, 500\)/.test(contacts), 'lista de contacte nu mai taie tăcut la 500');
  assert.match(contacts, /Arată încă/);
});

// ---------- Tichete suport și feedback ----------
const SUPPORT_NOW = Date.parse('2026-10-07T12:00:00Z');
const supportAgo = (days) => new Date(SUPPORT_NOW - days * 86400000).toISOString();
const ticket = (id, extra = {}) => ({ id, status: 'open', priority: 'normal', created_date: supportAgo(1), updated_date: supportAgo(1), ...extra });

await check('suport: stări, priorități, categorii și surse în română, fără coduri brute', () => {
  assert.equal(ticketStatusLabel('open'), 'Deschis');
  assert.equal(ticketStatusLabel('in_progress'), 'În lucru');
  assert.equal(ticketStatusLabel('waiting_user'), 'Așteaptă utilizatorul');
  assert.equal(ticketStatusLabel('resolved'), 'Rezolvat');
  assert.equal(ticketStatusLabel(undefined), 'Deschis', 'fără stare = deschis');
  assert.equal(ticketStatusTone('open'), 'info');
  assert.equal(ticketStatusTone('in_progress'), 'warning');
  assert.equal(ticketStatusTone('waiting_user'), 'neutral', 'ce așteaptă utilizatorul nu cere nimic de la tine');
  assert.equal(ticketStatusTone('resolved'), 'success');
  assert.equal(ticketPriorityLabel('urgent'), 'Urgentă');
  assert.equal(ticketPriorityLabel('high'), 'Ridicată');
  assert.equal(ticketPriorityTone('urgent'), 'danger');
  assert.equal(ticketPriorityTone('high'), 'warning');
  assert.equal(ticketPriorityTone('normal'), 'neutral');
  assert.equal(ticketCategoryLabel('account'), 'Cont și autentificare');
  assert.equal(ticketCategoryLabel('patient_request'), 'Solicitări pacienți');
  assert.equal(supportSourceLabel('help_center'), 'Ajutor și suport');
  assert.equal(supportSourceLabel('account_deletion_request'), 'Cerere de ștergere a contului');
  assert.equal(supportSourceLabel('account_sidebar'), 'Meniul contului');
  assert.equal(supportSourceLabel(''), '—');
  assert.equal(feedbackStatusLabel('new'), 'Nou');
  assert.equal(feedbackStatusLabel('reviewed'), 'Revizuit');
  assert.equal(feedbackStatusTone('reviewed'), 'success');
  assert.equal(accountModeLabel('provider'), 'Organizație / furnizor');
  assert.equal(accountModeLabel('professional'), 'Profil profesional');
});

await check('suport: „cere acțiune” = deschis sau în lucru; „active” rămâne aceeași definiție ca în meniu', () => {
  assert.equal(needsAdmin({ status: 'open' }), true);
  assert.equal(needsAdmin({}), true, 'fără stare = deschis');
  assert.equal(needsAdmin({ status: 'in_progress' }), true);
  assert.equal(needsAdmin({ status: 'waiting_user' }), false);
  assert.equal(needsAdmin({ status: 'resolved' }), false);
  assert.equal(isActiveTicket({ status: 'waiting_user' }), true, 'numărul din meniu include „Așteaptă utilizatorul”');
  assert.equal(isActiveTicket({ status: 'closed' }), false);
});

await check('suport: de cât timp așteaptă un tichet (avertisment de la 3 zile, alertă de la 7)', () => {
  assert.equal(ticketWaiting(ticket('a', { created_date: supportAgo(1) }), SUPPORT_NOW).tone, 'neutral');
  assert.equal(ticketWaiting(ticket('b', { created_date: supportAgo(4) }), SUPPORT_NOW).tone, 'warning');
  assert.equal(ticketWaiting(ticket('c', { created_date: supportAgo(8) }), SUPPORT_NOW).tone, 'danger');
  assert.equal(ticketWaiting(ticket('c', { created_date: supportAgo(8) }), SUPPORT_NOW).label, 'acum 8 zile');
  // „În lucru” se măsoară de la ultima modificare, nu de la creare
  assert.equal(ticketWaiting(ticket('d', { status: 'in_progress', created_date: supportAgo(30), updated_date: supportAgo(1) }), SUPPORT_NOW).tone, 'neutral');
  // ce așteaptă utilizatorul nu primește alertă, oricât ar sta
  assert.equal(ticketWaiting(ticket('e', { status: 'waiting_user', updated_date: supportAgo(20) }), SUPPORT_NOW).tone, 'neutral');
  assert.equal(ticketWaiting(ticket('f', { status: 'resolved' }), SUPPORT_NOW), null, 'un tichet încheiat nu așteaptă nimic');
});

await check('suport: ordinea de lucru (termene de ștergere, apoi acțiune după prioritate și vechime, apoi utilizatorul, apoi istoric)', () => {
  const tickets = [
    ticket('resolved-new', { status: 'resolved', updated_date: supportAgo(0.5) }),
    ticket('resolved-old', { status: 'closed', updated_date: supportAgo(20) }),
    ticket('waiting-old', { status: 'waiting_user', updated_date: supportAgo(9) }),
    ticket('waiting-new', { status: 'waiting_user', updated_date: supportAgo(2) }),
    ticket('open-1d', { created_date: supportAgo(1) }),
    ticket('open-6d', { created_date: supportAgo(6) }),
    ticket('high-progress', { status: 'in_progress', priority: 'high', updated_date: supportAgo(3) }),
    ticket('urgent-open', { priority: 'urgent', created_date: supportAgo(2) }),
    ticket('delete-5d', { source: 'account_deletion_request', created_date: supportAgo(5) }),
    ticket('delete-28d', { source: 'account_deletion_request', status: 'in_progress', created_date: supportAgo(28) }),
    ticket('delete-done', { source: 'account_deletion_request', status: 'resolved', created_date: supportAgo(40), updated_date: supportAgo(35) }),
  ];
  assert.deepEqual(
    sortSupportTickets(tickets, SUPPORT_NOW).map((item) => item.id),
    ['delete-28d', 'delete-5d', 'urgent-open', 'high-progress', 'open-6d', 'open-1d', 'waiting-old', 'waiting-new', 'resolved-new', 'resolved-old', 'delete-done'],
  );
});

await check('suport: după ce termini un tichet, următorul care cere acțiune', () => {
  const ordered = sortSupportTickets([
    ticket('a', { priority: 'urgent' }),
    ticket('b', { created_date: supportAgo(5) }),
    ticket('c', { status: 'waiting_user' }),
  ], SUPPORT_NOW);
  assert.equal(nextTicketToHandle(ordered, 'a'), 'b');
  assert.equal(nextTicketToHandle(ordered, 'b'), 'a');
  assert.equal(nextTicketToHandle([ticket('only')], 'only'), '', 'nu mai e nimic de rezolvat');
  assert.equal(nextTicketToHandle([ticket('x', { status: 'waiting_user' })], 'y'), '', 'un tichet care așteaptă utilizatorul nu e „următorul”');
});

await check('suport: termenul de 30 de zile al cererilor de ștergere', () => {
  const deletion = ticket('d', { source: 'account_deletion_request', created_date: supportAgo(25) });
  assert.equal(accountDeletionDeadline(deletion, SUPPORT_NOW).daysLeft, 5);
  assert.equal(accountDeletionDeadline(deletion, SUPPORT_NOW).tone, 'warning');
  assert.equal(accountDeletionDeadline({ ...deletion, created_date: supportAgo(33) }, SUPPORT_NOW).tone, 'danger');
  assert.equal(accountDeletionDeadline({ ...deletion, status: 'resolved' }, SUPPORT_NOW), null, 'încheiată: fără termen');
  assert.equal(accountDeletionDeadline(ticket('x'), SUPPORT_NOW), null, 'un tichet obișnuit nu are termen');
});

await check('suport: un răspuns scris e obligatoriu când utilizatorul trebuie să afle ce s-a întâmplat', () => {
  for (const status of ['waiting_user', 'resolved', 'closed']) {
    assert.notEqual(ticketUpdateProblem({ status, response: '' }), '', status);
    assert.notEqual(ticketUpdateProblem({ status, response: '   \n ' }), '', `${status}: spațiile nu sunt răspuns`);
    assert.equal(ticketUpdateProblem({ status, response: 'Am rezolvat.' }), '', status);
  }
  for (const status of ['open', 'in_progress']) assert.equal(ticketUpdateProblem({ status, response: '' }), '', status);
  assert.match(ticketUpdateProblem({ status: 'waiting_user', response: '' }), /ceri utilizatorului/);
});

await check('suport: ce se salvează pe tichet (data răspunsului se schimbă doar când textul e nou)', () => {
  const stored = ticket('t', { support_response: 'Răspuns vechi.' });
  const unchanged = buildTicketPayload({ ticket: stored, status: 'resolved', priority: 'normal', response: ' Răspuns vechi. ', adminId: 'u1', now: SUPPORT_NOW });
  assert.deepEqual(unchanged, { status: 'resolved', priority: 'normal', support_response: 'Răspuns vechi.' });
  const changed = buildTicketPayload({ ticket: stored, status: 'waiting_user', priority: 'high', response: 'Ne poți trimite o captură?', adminId: 'u1', now: SUPPORT_NOW });
  assert.equal(changed.status, 'waiting_user');
  assert.equal(changed.priority, 'high');
  assert.equal(changed.responded_at, '2026-10-07T12:00:00.000Z');
  assert.equal(changed.responded_by_user_id, 'u1');
  const cleared = buildTicketPayload({ ticket: stored, status: 'in_progress', priority: 'normal', response: '', now: SUPPORT_NOW });
  assert.equal('responded_at' in cleared, false, 'fără text nou nu se marchează ca răspuns');
});

await check('ecranele de suport: componente comune, fără culori scrise de mână și fără text vizibil fără diacritice', () => {
  const dir = 'src/components/admin/support';
  const files = readdirSync(path.join(root, dir)).filter((name) => /\.(jsx|js)$/.test(name));
  assert.ok(files.includes('SupportParts.jsx'));
  for (const name of files) {
    const text = source(`${dir}/${name}`).replace(/\/\/.*$/gm, '');
    assert.ok(!/(red|green|amber|blue|sky|violet|emerald)-\d{2,3}/.test(text), `${name}: culori scrise de mână`);
    assert.ok(!/window\.confirm/.test(text), `${name}: confirmare nativă`);
    const bad = text.match(/(Actualizeaza|Cauta dupa|Se incarca|Selecteaza|Marcheaza|Arhiveaza|Rezolvate \/ inchise|Organizatie|Raspuns|Schimba filtrul|Utilizator indisponibil)/);
    assert.ok(!bad, `${name}: text fără diacritice („${bad && bad[0]}”)`);
  }
  const tickets = source(`${dir}/AdminSupportTickets.jsx`);
  for (const needle of ['sortSupportTickets', 'ticketUpdateProblem', 'buildTicketPayload', 'nextTicketToHandle', 'Trimite și rezolvă', 'Trimite și așteaptă utilizatorul', 'Alte opțiuni']) {
    assert.ok(tickets.includes(needle), `AdminSupportTickets: lipsește ${needle}`);
  }
  assert.ok(!/SummaryCard/.test(tickets), 'cardurile-sumar sunt înlocuite de filtrele cu numere');
  assert.match(tickets, /Nu se trimite email/, 'adminul trebuie să știe că utilizatorul nu primește email');
  const feedback = source(`${dir}/AdminUserFeedback.jsx`);
  assert.match(feedback, /Marchează revizuit/);
  assert.ok(!/SummaryCard/.test(feedback));
});

// ---------- Procese automate care cer atenție (Panou + meniu) ----------
await check('import, campanii și plăți care cer atenție apar în Panou și în meniu, cu interogările potrivite', async () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const client = fakeClient({ overrides: { counts: { DirectoryAutoImportRun: 1, OutreachCampaign: 2, ProviderSubscription: 3 } } });
  const seen = [];
  const recording = {
    ...client,
    entities: new Proxy({}, { get: (_t, name) => ({ count: async (query) => { seen.push({ name, query }); return client.entities[name].count(query); } }) }),
  };
  const counts = await loadAdminCounts(recording, now);
  assert.equal(counts.import_attention, 1);
  assert.equal(counts.campaigns_attention, 4, 'oprite automat (2) + eșuate (2)');
  assert.equal(counts.payments_attention, 3);

  const importQuery = seen.find((entry) => entry.name === 'DirectoryAutoImportRun').query;
  assert.deepEqual(importQuery.status, { $in: ['blocked', 'failed'] });
  assert.equal(importQuery.created_date.$gte, '2026-09-07T12:00:00.000Z', 'ultimele 30 de zile');
  const campaignQueries = seen.filter((entry) => entry.name === 'OutreachCampaign').map((entry) => entry.query);
  assert.equal(campaignQueries.length, 2);
  const paused = campaignQueries.find((query) => query.status === 'paused');
  assert.deepEqual(paused.pause_reason, { $in: ['bounce_rate', 'complaints'] }, 'o pauză manuală nu cere atenție');
  assert.equal(paused.updated_date.$gte, '2026-09-23T12:00:00.000Z', 'ultimele 14 zile');
  assert.equal(campaignQueries.find((query) => query.status === 'failed').updated_date.$gte, '2026-09-23T12:00:00.000Z');
  assert.deepEqual(seen.find((entry) => entry.name === 'ProviderSubscription').query, { status: { $in: ['past_due', 'unpaid'] } });

  const rows = summarizeCounts(counts).rows;
  const pick = (key) => rows.find((row) => row.key === key);
  assert.deepEqual([pick('import_attention').section, pick('import_attention').count], ['import_directory', 1]);
  assert.deepEqual([pick('campaigns_attention').section, pick('campaigns_attention').count], ['outreach', 4]);
  assert.deepEqual([pick('payments_attention').section, pick('payments_attention').count], ['billing', 3]);
  assert.equal(sidebarBadgeFor(counts, 'outreach'), 4);
  assert.equal(sidebarBadgeFor(counts, 'billing'), 3);
  assert.equal(pick('import_attention').note, 'ultimele 30 de zile');
  assert.equal(pick('campaigns_attention').note, 'ultimele 14 zile');
  assert.deepEqual(rows.filter((row) => row.group === 'systems').map((row) => row.key), ['import_attention', 'campaigns_attention', 'payments_attention']);
  assert.ok(rows.filter((row) => row.group === 'people').every((row) => !['import_attention', 'campaigns_attention', 'payments_attention', 'email_failures'].includes(row.key)));

  const clean = await loadAdminCounts(fakeClient(), now);
  assert.equal(sidebarBadgeFor(clean, 'outreach'), null, '0 nu se afișează');
  assert.equal(sidebarBadgeFor(clean, 'billing'), null);
  assert.equal(summarizeCounts(clean).rows.filter((row) => ['import_attention', 'campaigns_attention', 'payments_attention'].includes(row.key)).length, 0);
});

await check('procese automate: o sursă indisponibilă nu devine 0 și nu lasă „Totul e la zi”', async () => {
  const brokenImport = await loadAdminCounts(fakeClient({ failEntities: ['DirectoryAutoImportRun'], overrides: { counts: { PatientRequestRecoveryCase: 0 } } }));
  assert.equal(brokenImport.import_attention, null);
  const summary = summarizeCounts({ ...brokenImport, review: { workspace: 0, locations: 0, lifecycle: 0, professionals: 0, patient_requests: 0, media_cleanup: 0 } });
  assert.equal(summary.allClear, false);
  assert.ok(summary.unavailable.some((label) => /Import director/.test(label)), summary.unavailable.join(' | '));

  // dacă doar una dintre cele două numărători de campanii eșuează, nu afirmăm un total parțial
  const client = fakeClient();
  const partial = {
    ...client,
    entities: new Proxy({}, { get: (_t, name) => ({ count: async (query) => {
      if (name === 'OutreachCampaign' && query.status === 'failed') throw new Error('offline');
      return client.entities[name].count(query);
    } }) }),
  };
  const counts = await loadAdminCounts(partial);
  assert.equal(counts.campaigns_attention, null);
  assert.equal(sidebarBadgeFor(counts, 'outreach'), null);
});

// ---------- Plăți și abonamente ----------
await check('plăți: tonurile stărilor Stripe (plata restantă e roșie, încasat verde) și ofertele Enterprise în română', () => {
  for (const status of ['active', 'paid', 'succeeded']) assert.equal(billingStatusTone(status), 'success', status);
  for (const status of ['past_due', 'unpaid', 'failed', 'uncollectible', 'disputed', 'configuration_review']) assert.equal(billingStatusTone(status), 'danger', status);
  for (const status of ['open', 'requires_action', 'incomplete']) assert.equal(billingStatusTone(status), 'warning', status);
  assert.equal(billingStatusTone('canceled'), 'neutral');
  assert.equal(billingStatusTone(undefined), 'neutral');
  assert.equal(enterpriseOfferLabel('sent'), 'Trimisă');
  assert.equal(enterpriseOfferLabel('accepted'), 'Acceptată și plătită');
  assert.equal(enterpriseOfferLabel('expired'), 'Expirată');
  assert.equal(enterpriseOfferTone('accepted'), 'success');
  assert.equal(enterpriseOfferTone('expired'), 'warning');
  assert.equal(enterpriseOfferTone('canceled'), 'neutral');
});

await check('plăți: sumarul abonamentelor (active Pro, plată restantă, anulate) vine din numărători pe server', async () => {
  const client = fakeClient({ overrides: { counts: { ProviderSubscription: 3 } } });
  const seen = [];
  const recording = {
    ...client,
    entities: new Proxy({}, { get: (_t, name) => ({ count: async (query) => { seen.push({ name, query }); return client.entities[name].count(query); } }) }),
  };
  assert.deepEqual(await loadSubscriptionSummary(recording), { active: 3, attention: 3, canceled: 3 });
  assert.equal(seen.length, 3);
  assert.deepEqual(seen[0].query, { plan_code: 'pro', status: { $in: ['active', 'trialing', 'grace_period'] } }, 'aceeași definiție ca „Conturi Pro active” din Panou');
  assert.deepEqual(seen[1].query, { status: { $in: ['past_due', 'unpaid'] } });
  assert.deepEqual(seen[2].query, { status: 'canceled' });
  const down = await loadSubscriptionSummary(fakeClient({ failEntities: ['ProviderSubscription'] }));
  assert.deepEqual(down, { active: null, attention: null, canceled: null }, 'indisponibil nu devine 0');
});

await check('plăți: ecranele folosesc componentele comune, fără culori scrise de mână și fără text fără diacritice', () => {
  const dir = 'src/components/admin/billing';
  for (const name of readdirSync(path.join(root, dir)).filter((file) => /\.(jsx|js)$/.test(file))) {
    const text = source(`${dir}/${name}`).replace(/\/\/.*$/gm, '');
    assert.ok(!/(red|green|amber|blue|sky|violet|emerald)-\d{2,3}/.test(text), `${name}: culori scrise de mână`);
    assert.ok(!/window\.confirm/.test(text), `${name}: confirmare nativă`);
    const bad = text.match(/(Sincronizeaza|Reincearca|Se incarca|Cauta in|Locatie \/|Plata restanta|Retrage oferta[^"]*ofert[^a])/);
    assert.ok(!bad, `${name}: text fără diacritice („${bad && bad[0]}”)`);
  }
  const center = source(`${dir}/AdminBillingCenter.jsx`);
  assert.match(center, /AdminTabs/);
  assert.match(center, /loadSubscriptionSummary/);
  assert.ok(!/\[view, setView\] = useState/.test(center), 'fila nu mai e stare locală');
  assert.ok(center.split('\n').every((line) => line.length < 200), 'liniile nu mai sunt comprimate la sute de caractere');
});

// ---------- Analytics ----------
await check('analytics: perioadele sunt zile calendaristice întregi, iar cea de dinainte are aceeași lungime', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const rows = ['2026-09-23', '2026-09-24', '2026-09-30', '2026-10-01', '2026-10-06', '2026-10-07'].map((created_date) => ({ created_date, count: 1 }));
  assert.deepEqual(inWindow(rows, 7, now).map((row) => row.created_date), ['2026-10-01', '2026-10-06', '2026-10-07'], '7 zile = azi + 6 zile dinainte');
  assert.deepEqual(inPreviousWindow(rows, 7, now).map((row) => row.created_date), ['2026-09-24', '2026-09-30'], 'cele 7 zile dinainte');
  assert.equal(inWindow(rows, 30, now).length, 6);
  assert.equal(inPreviousWindow(rows, 30, now).length, 0);
  assert.equal(inPreviousWindow(rows, 90, now), null, 'peste 90 de zile nu avem istoric de comparat');
  assert.equal(inWindow(null, 7, now), null);
  assert.equal(inPreviousWindow(null, 7, now), null);
  // fără suprapunere
  const all = Array.from({ length: 14 }, (_, index) => ({ created_date: new Date(now - index * 86400000).toISOString().slice(0, 10), count: 1 }));
  assert.equal(inWindow(all, 7, now).length, 7);
  assert.equal(inPreviousWindow(all, 7, now).length, 7);
});

await check('analytics: comparația cu perioada de dinainte nu inventează diferențe', () => {
  assert.deepEqual(changeBetween(5, 3), { diff: 2, pct: 67 });
  assert.deepEqual(changeBetween(1, 4), { diff: -3, pct: -75 });
  assert.deepEqual(changeBetween(3, 0), { diff: 3, pct: null }, 'de la 0 nu are procent');
  assert.deepEqual(changeBetween(2, 2), { diff: 0, pct: 0 });
  assert.equal(changeBetween(0, 0), null, 'nimic în ambele perioade: fără săgeată');
  assert.equal(changeBetween(null, 2), null, 'indisponibil nu se compară');
  assert.equal(changeBetween(2, null), null);
});

await check('analytics: graficul pe săptămâni (peste 30 de zile) începe lunea', () => {
  const rows = [{ created_date: '2026-10-07', count: 2 }, { created_date: '2026-10-05', count: 3 }, { created_date: '2026-10-04', count: 1 }];
  assert.deepEqual(buckets(rows, 90), [{ created_date: '2026-09-28', count: 1 }, { created_date: '2026-10-05', count: 5 }]);
  assert.deepEqual(buckets(rows, 30).map((row) => row.created_date), ['2026-10-04', '2026-10-05', '2026-10-07'], 'până la 30 de zile: pe zile');
  assert.equal(buckets(null, 30), null);
});

await check('zilele se scriu corect în română („7 zile”, „30 de zile”, „101 zile”)', () => {
  assert.equal(daysLabel(1), '1 zi');
  assert.equal(daysLabel(7), '7 zile');
  assert.equal(daysLabel(19), '19 zile');
  assert.equal(daysLabel(20), '20 de zile');
  assert.equal(daysLabel(30), '30 de zile');
  assert.equal(daysLabel(90), '90 de zile');
  assert.equal(daysLabel(100), '100 de zile');
  assert.equal(daysLabel(101), '101 zile');
  assert.equal(daysLabel(120), '120 de zile');
});

await check('analytics: ecranele au actualizare, comparație și stări oneste, fără culori scrise de mână', () => {
  const dir = 'src/components/admin/analytics';
  for (const name of readdirSync(path.join(root, dir)).filter((file) => /\.(jsx|js)$/.test(file))) {
    const text = source(`${dir}/${name}`).replace(/\/\/.*$/gm, '');
    assert.ok(!/(red|green|amber|blue|sky|violet|emerald)-\d{2,3}/.test(text), `${name}: culori scrise de mână`);
    assert.ok(!/Se incarca|Actualizeaza|Indisponibil momentan\.\.\./.test(text), `${name}: text fără diacritice`);
  }
  const page = source(`${dir}/AdminAnalytics.jsx`);
  assert.match(page, /Actualizează/);
  assert.match(page, /AdminChips/);
  assert.match(page, /truncated/, 'o listă tăiată de server trebuie spusă');
  assert.match(source(`${dir}/useAdminAnalytics.js`), /inPreviousWindow/);
  assert.match(source(`${dir}/useSearchAnalytics.js`), /response\.data\?\.error/, 'eroarea serverului nu mai trece drept date');
  assert.match(source(`${dir}/CountyCoverageCard.jsx`), /De cercetat/);
});

// ---------- Contacte din căutări ----------
await check('contacte din căutări: „Nou” cere acțiune (albastru), „Contactat” e verde, necunoscutul cade pe „Nou”', () => {
  assert.equal(searchContactFollowUpTone({ follow_up_status: 'nou' }), 'info');
  assert.equal(searchContactFollowUpTone({ follow_up_status: 'contactat' }), 'success');
  assert.equal(searchContactFollowUpTone({ follow_up_status: 'fara_raspuns' }), 'warning');
  assert.equal(searchContactFollowUpTone({ follow_up_status: 'nu_mai_contacta' }), 'neutral');
  assert.equal(searchContactFollowUpTone({ follow_up_status: 'status-necunoscut' }), 'info');
  assert.equal(searchContactFollowUpTone(null), 'info');
  const screen = source('src/components/admin/patients/AdminSearchContacts.jsx').replace(/\/\/.*$/gm, '');
  assert.ok(!/(red|green|amber|blue|sky|violet|emerald)-\d{2,3}/.test(screen), 'culori scrise de mână');
  assert.ok(!/SummaryCard|function Tag\(/.test(screen), 'componentele locale duplicate au fost înlocuite');
  assert.match(screen, /AdminListControls/);
  assert.match(screen, /Marchează contactat/);
  assert.ok(!/window\.confirm/.test(screen));
});

// ---------- Plasa de siguranță pentru erori + sume cu monedă lipsă ----------
const { ADMIN_ERROR_EVENT, CHUNK_RELOAD_GAP_MS, CHUNK_RELOAD_KEY, claimAutoReload, errorEventProperties, errorReport, isChunkLoadError } = await import('../src/lib/adminErrors.js');
const { money } = await import('../src/lib/billingFormat.js');

await check('erori de afișare: „versiune nouă publicată” se recunoaște, o eroare obișnuită nu', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://viasee.ro/assets/AdminAnalytics-Cx3.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
    'Loading CSS chunk 7 failed.',
    'Unable to preload CSS for /assets/index-abc.css',
  ]) assert.equal(isChunkLoadError(new TypeError(message)), true, message);
  assert.equal(isChunkLoadError({ name: 'ChunkLoadError', message: 'x' }), true);
  for (const value of [new Error("Cannot read properties of undefined (reading 'category')"), new RangeError('Invalid currency code : null'), null, undefined, {}, 'text'])
    assert.equal(isChunkLoadError(value), false, String(value));
});

await check('reîncărcare automată: o singură dată pe minut, nu într-un ciclu; fără spațiu de stocare = nu reîncărcăm', () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(claimAutoReload(storage, 1_000_000), true, 'prima eroare: reîncărcăm');
  assert.equal(store.get(CHUNK_RELOAD_KEY), '1000000');
  assert.equal(claimAutoReload(storage, 1_000_000 + 5_000), false, 'după reîncărcare, aceeași eroare: arătăm butonul, nu reîncărcăm iar');
  assert.equal(claimAutoReload(storage, 1_000_000 + CHUNK_RELOAD_GAP_MS - 1), false);
  assert.equal(claimAutoReload(storage, 1_000_000 + CHUNK_RELOAD_GAP_MS + 1), true, 'după un minut, o nouă publicare se poate reîncărca');
  const broken = { getItem() { throw new Error('blocat'); }, setItem() { throw new Error('blocat'); } };
  assert.equal(claimAutoReload(broken, 5), false);
  assert.equal(claimAutoReload(null, 5), false);
  assert.equal(claimAutoReload(undefined, 5), false);
});

await check('raportul de eroare: secțiune, eroare, adresă, moment, urmă; nu cade pe valori ciudate', () => {
  const error = new TypeError("Cannot read properties of null (reading 'category')");
  const report = errorReport({ error, componentStack: '\n    at OutreachCampaignDetail (x.jsx:10)\n    at div', section: 'Campanii și marketing', href: 'https://viasee.ro/admin/operatiuni?s=outreach', now: Date.UTC(2026, 9, 8, 6, 0, 0) });
  assert.match(report, /^Secțiune: Campanii și marketing$/m);
  assert.match(report, /^Eroare: TypeError: Cannot read properties of null \(reading 'category'\)$/m);
  assert.match(report, /^Adresă: https:\/\/viasee\.ro\/admin\/operatiuni\?s=outreach$/m);
  assert.match(report, /^Moment: 2026-10-08T06:00:00\.000Z$/m);
  assert.match(report, /Componente:\n.*OutreachCampaignDetail/s);
  for (const value of [undefined, null, 'doar text', 42, {}, { message: 'fără nume' }]) {
    const text = errorReport({ error: value });
    assert.match(text, /^Eroare: /m);
    assert.ok(!/undefined|\[object Object\]/.test(text.split('\n').find((line) => line.startsWith('Eroare:')) || ''), String(value));
  }
  assert.ok(errorReport().length > 0);
});

await check('eroarea de afișare se raportează în statistici: doar câmpuri sigure, tăiate; nu cade pe valori ciudate', () => {
  assert.equal(ADMIN_ERROR_EVENT, 'admin_render_error');
  const props = errorEventProperties({
    error: new TypeError(`Cannot read properties of null (reading 'category') ${'x'.repeat(500)}`),
    componentStack: '\n    at OutreachCampaignDetail (http://x/src/a.jsx?t=1:10:5)\n    at div\n    at OutreachWorkspace (http://x/src/b.jsx:1:1)\n    at Suspense',
    section: 'Campanii și marketing',
  });
  assert.deepEqual(Object.keys(props).sort(), ['auto_reload', 'error_message', 'error_name', 'kind', 'section', 'where']);
  assert.equal(props.kind, 'randare');
  assert.equal(props.error_name, 'TypeError');
  assert.ok(props.error_message.length <= 200);
  assert.equal(props.where, 'OutreachCampaignDetail > div > OutreachWorkspace');
  assert.equal(errorEventProperties({ error: new TypeError('Failed to fetch dynamically imported module: x'), reloading: true }).kind, 'versiune_noua');
  assert.equal(errorEventProperties({ error: new TypeError('Failed to fetch dynamically imported module: x'), reloading: true }).auto_reload, true);
  for (const value of [undefined, null, 'text', 42, {}]) {
    const out = errorEventProperties({ error: value });
    for (const [key, item] of Object.entries(out)) assert.ok(['string', 'boolean'].includes(typeof item), `${key} pentru ${String(value)}`);
  }
  assert.ok(errorEventProperties().section === '');
  assert.match(source('src/components/admin/shell/AdminErrorBoundary.jsx'), /base44\.analytics\.track\(\{\s*eventName: ADMIN_ERROR_EVENT/);
});

await check('sume Stripe: moneda lipsă sau greșită nu mai aruncă „Invalid currency code”; suma care nu e număr arată „—”', () => {
  const norm = (text) => text.replace(/\s/g, ' ');
  assert.match(norm(money(150000, 'ron')), /1\.500,00/);
  assert.match(norm(money(150000, 'RON')), /1\.500,00/);
  assert.match(norm(money(19900)), /199,00/, 'fără monedă: RON');
  for (const currency of [null, '', '   ', undefined]) assert.match(norm(money(19900, currency)), /199,00/, `monedă ${JSON.stringify(currency)}`);
  assert.doesNotThrow(() => money(19900, 'xx'));
  assert.doesNotThrow(() => money(19900, 'nu-e-cod'));
  assert.match(norm(money(19900, 'nu-e-cod')), /199,00 NU-E-COD/);
  assert.match(norm(money(0, 'eur')), /0,00/);
  assert.match(norm(money('15000', 'ron')), /150,00/, 'suma ca text numeric');
  for (const amount of [null, undefined, '', 'abc', NaN, Infinity]) assert.equal(money(amount, 'ron'), '—', String(amount));
});

await check('numărători: cel mult 4 cereri deodată (fără rafală către platformă), aceleași 17 cereri, același rezultat', async () => {
  assert.equal(COUNT_CONCURRENCY, 4);
  let active = 0;
  let peak = 0;
  let total = 0;
  const base = fakeClient();
  const track = async (work) => {
    active += 1; total += 1; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    try { return await work(); } finally { active -= 1; }
  };
  const client = {
    entities: new Proxy({}, { get: (_t, name) => ({ count: (query) => track(() => base.entities[name].count(query)) }) }),
    functions: { invoke: (name, payload) => track(() => base.functions.invoke(name, payload)) },
  };
  const limited = await loadAdminCounts(client);
  assert.equal(total, 17, 'aceleași 17 cereri ca înainte');
  assert.ok(peak <= 4, `cel mult 4 deodată, am văzut ${peak}`);
  assert.ok(peak >= 2, 'totuși în paralel, nu una câte una');
  assert.deepEqual({ ...limited, loadedAt: 0 }, { ...(await loadAdminCounts(fakeClient())), loadedAt: 0 }, 'același rezultat');
  // limitatorul: o sarcină care eșuează nu blochează coada
  const run = createLimiter(1);
  const order = [];
  const results = await Promise.allSettled([
    run(async () => { order.push('a'); throw new Error('x'); }),
    run(async () => { order.push('b'); return 2; }),
    run(() => { order.push('c'); return 3; }),
  ]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'fulfilled', 'fulfilled']);
  assert.match(source('src/components/admin/useAdminCounts.jsx'), /FOCUS_REFRESH_MIN_INTERVAL_MS/, 'aceeași pauză minimă ca în contul de furnizor');
});

await check('plasa de siguranță e montată: pagina, secțiunea și căutarea globală; „Plăți” folosește formatul sigur', () => {
  const page = source('src/pages/AdminDirectoryOps.jsx');
  assert.match(page, /<AdminErrorBoundary variant="page"/);
  assert.match(page, /<AdminErrorBoundary resetKey=\{`\$\{section\}\/\$\{tab\}`\}/);
  assert.match(source('src/components/admin/shell/AdminAppShell.jsx'), /<AdminErrorBoundary variant="silent"/);
  const boundary = source('src/components/admin/shell/AdminErrorBoundary.jsx');
  assert.match(boundary, /claimAutoReload/);
  assert.match(boundary, /Reîncarcă pagina/);
  assert.match(boundary, /Copiază detaliile/);
  const billing = source('src/components/admin/billing/AdminBillingCenter.jsx');
  assert.match(billing, /from "@\/lib\/billingFormat"/);
  assert.ok(!/toLocaleDateString\("ro-RO"\);\s*$/m.test(billing.split('\n').filter((line) => line.startsWith('const formatDay')).join('\n')), 'formatDay verifică data');
});

console.log(`Panoul de admin: ${checks} verificări de corectitudine au trecut.`);
