import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3F - Directory Research Operations (admin-only, internal).
// This function NEVER creates ProviderOrganization / ProviderLocation /
// LocationService / LocationSpecialization / LocationFacility /
// ProfessionalProfile / ProviderClaimRequest records and never modifies
// existing factual directory data. It manages ONLY the internal research
// workflow fields on ProviderLocation and ProviderEvidence records, through
// explicit admin actions with audit records. Nothing here is public-facing.

const RESEARCH_STATUSES = ['new', 'in_progress', 'ready_for_review', 'published', 'rejected', 'needs_recheck'];
const CHECKLIST_KEYS = ['website_identified', 'contact_page_identified', 'phone_checked', 'address_checked', 'schedule_checked', 'services_checked', 'source_dates_saved', 'duplicate_checked', 'ready_for_review'];
const EVIDENCE_ENTITY_TYPES = ['ProviderOrganization', 'ProviderLocation', 'LocationService'];
// Coverage is computed ONLY for general (non-clinical) service categories.
const GENERAL_SERVICE_KEYS = ['eyeglasses', 'frames', 'prescription_lenses', 'contact_lenses', 'optometry_consultation', 'ophthalmology_consultation', 'control_vedere_adulti', 'control_vedere_copii', 'consult_oftalmologic', 'lentile_contact', 'lentile_progresive'];
const STALE_DAYS = 180;

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2);
const digits = (s) => String(s || '').replace(/\D/g, '');

function bad(msg) { return Response.json({ error: msg }, { status: 400 }); }

function validUrl(u) {
  try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; }
}
function domainOf(u) {
  try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return ''; }
}
// No Google Maps / Google Places content may ever be stored as evidence.
function isGoogleSource(url, type) {
  const u = String(url || '').toLowerCase();
  return u.includes('google.') || u.includes('goo.gl') || u.includes('g.page') || String(type || '').toLowerCase().includes('google');
}
function parseChecklist(s) {
  try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function missingFields(loc) {
  const missing = [];
  if (!loc.website) missing.push('website');
  if (!loc.phone_public) missing.push('phone_public');
  if (!loc.address) missing.push('address');
  if (!loc.opening_hours) missing.push('opening_hours');
  if (!loc.description) missing.push('description');
  return missing;
}
function lastCheckedOf(loc, evidences) {
  const dates = [];
  if (loc.source_checked_at) dates.push(loc.source_checked_at);
  for (const e of evidences) {
    if (e.checked_at) dates.push(e.checked_at);
    if (e.collected_at) dates.push(e.collected_at);
  }
  return dates.sort().pop() || null;
}

async function audit(svc, user, rec) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: rec.entity_type,
    entity_id: rec.entity_id || '',
    action_type: rec.action_type,
    changed_fields: rec.changed_fields || [],
    previous_values: JSON.stringify(rec.previous || {}),
    new_values: JSON.stringify(rec.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: rec.note || '',
    performed_at: new Date().toISOString(),
  });
}

// Duplicate detection: normalized org/location name, city, address, website
// domain, public phone. READ-ONLY — never merges, never blocks, never writes.
async function findDuplicates(svc, cand, excludeId) {
  const [locs, orgs] = await Promise.all([
    svc.entities.ProviderLocation.list(null, 5000),
    svc.entities.ProviderOrganization.list(null, 5000),
  ]);
  const orgMap = {};
  for (const o of orgs) orgMap[o.id] = o.name || '';
  const nameToks = tokens(cand.name || '');
  const orgToks = tokens(cand.org_name || '');
  const candDomain = domainOf(cand.website || '');
  const candPhone = digits(cand.phone || '');
  const out = [];
  for (const l of locs) {
    if (excludeId && l.id === excludeId) continue;
    const reasons = [];
    const sameCity = cand.city && norm(l.city) === norm(cand.city);
    if (sameCity && nameToks.length > 0 && tokens(l.name).some((t) => nameToks.includes(t))) reasons.push('nume asemanator in acelasi oras');
    if (sameCity && cand.address && l.address && norm(l.address) === norm(cand.address)) reasons.push('aceeasi adresa');
    if (candDomain && domainOf(l.website) === candDomain) reasons.push('acelasi domeniu website');
    if (candPhone.length >= 6 && digits(l.phone_public) === candPhone) reasons.push('acelasi telefon public');
    if (sameCity && orgToks.length > 0 && tokens(orgMap[l.organization_id] || '').some((t) => orgToks.includes(t))) reasons.push('organizatie asemanatoare in acelasi oras');
    if (reasons.length > 0) {
      out.push({ id: l.id, name: l.name, city: l.city, address: l.address || '', provider_type: l.provider_type, profile_control_status: l.profile_control_status || 'directory', match_reasons: reasons });
    }
  }
  return out.slice(0, 10);
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Neautentificat' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori Vezunde' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const action = p.action;

    // ---------- RESEARCH QUEUE (read-only) ----------
    if (action === 'queue') {
      const f = p.filters || {};
      const [locs, services, evidences, orgs] = await Promise.all([
        svc.entities.ProviderLocation.list(null, 5000),
        svc.entities.LocationService.list(null, 2000),
        svc.entities.ProviderEvidence.list(null, 2000),
        svc.entities.ProviderOrganization.list(null, 5000),
      ]);
      const orgMap = {};
      for (const o of orgs) orgMap[o.id] = o.name || '';
      const svcCount = {};
      const serviceLoc = {};
      for (const s of services) {
        serviceLoc[s.id] = s.location_id;
        if (s.is_active === false) continue;
        svcCount[s.location_id] = (svcCount[s.location_id] || 0) + 1;
      }
      const evByLoc = {};
      for (const e of evidences) {
        if (e.evidence_status !== 'active') continue;
        const locId = e.entity_type === 'ProviderLocation' ? e.entity_id : (e.entity_type === 'LocationService' ? serviceLoc[e.entity_id] : null);
        if (!locId) continue;
        if (!evByLoc[locId]) evByLoc[locId] = [];
        evByLoc[locId].push(e);
      }
      const rows = [];
      for (const loc of locs) {
        const rs = loc.research_status || 'new';
        if (f.city && norm(loc.city) !== norm(f.city)) continue;
        if (f.county && norm(loc.county || '') !== norm(f.county)) continue;
        if (f.provider_type && loc.provider_type !== f.provider_type) continue;
        if (f.research_status && rs !== f.research_status) continue;
        if (f.profile_control_status && (loc.profile_control_status || 'directory') !== f.profile_control_status) continue;
        if (f.migration_review_required === true && !loc.migration_review_required) continue;
        if (f.missing_services === true && (svcCount[loc.id] || 0) > 0) continue;
        const ev = evByLoc[loc.id] || [];
        if (f.source_completeness === 'no_source' && loc.source_url) continue;
        if (f.source_completeness === 'no_evidence' && ev.length > 0) continue;
        if (f.source_completeness === 'has_source' && !loc.source_url && ev.length === 0) continue;
        const lastChecked = lastCheckedOf(loc, ev);
        if (f.checked_before && lastChecked && lastChecked > f.checked_before) continue;
        rows.push({
          id: loc.id,
          organization: orgMap[loc.organization_id] || '',
          name: loc.name,
          city: loc.city,
          county: loc.county || '',
          provider_type: loc.provider_type,
          profile_control_status: loc.profile_control_status || 'directory',
          research_status: rs,
          active_sources: ev.length + (loc.source_url ? 1 : 0),
          last_checked: lastChecked,
          missing_fields: missingFields(loc),
          assigned_to: loc.research_assigned_to || '',
          services_count: svcCount[loc.id] || 0,
          migration_review_required: !!loc.migration_review_required,
        });
      }
      return Response.json({ rows });
    }

    // ---------- RESEARCH PROFILE VIEW (read-only) ----------
    if (action === 'profile') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const [org, services, allEvidence] = await Promise.all([
        loc.organization_id ? svc.entities.ProviderOrganization.get(loc.organization_id).catch(() => null) : Promise.resolve(null),
        svc.entities.LocationService.filter({ location_id: loc.id }, null, 200),
        svc.entities.ProviderEvidence.list(null, 2000),
      ]);
      const serviceIds = services.map((s) => s.id);
      const evidence = allEvidence.filter((e) =>
        (e.entity_type === 'ProviderLocation' && e.entity_id === loc.id) ||
        (e.entity_type === 'LocationService' && serviceIds.includes(e.entity_id)) ||
        (e.entity_type === 'ProviderOrganization' && loc.organization_id && e.entity_id === loc.organization_id)
      );
      const duplicates = await findDuplicates(svc, {
        name: loc.name, org_name: org ? org.name : '', city: loc.city,
        address: loc.address, website: loc.website, phone: loc.phone_public,
      }, loc.id);
      return Response.json({
        location: loc,
        organization: org,
        services,
        evidence,
        duplicates,
        checklist: parseChecklist(loc.research_checklist),
        missing_fields: missingFields(loc),
      });
    }

    // ---------- ADD EVIDENCE ----------
    if (action === 'add_evidence') {
      if (!EVIDENCE_ENTITY_TYPES.includes(p.entity_type)) return bad('entity_type invalid');
      if (!p.entity_id) return bad('entity_id lipseste');
      if (!p.source_url || !validUrl(p.source_url)) return bad('source_url valid (http/https) este obligatoriu — sursele fara URL nu sunt acceptate');
      if (isGoogleSource(p.source_url, p.source_type)) return bad('Continutul din Google Maps / Google Places nu poate fi stocat ca dovada');
      if (!['low', 'medium', 'high'].includes(p.confidence)) return bad('confidence invalid (low/medium/high)');
      let entity = null;
      if (p.entity_type === 'ProviderOrganization') entity = await svc.entities.ProviderOrganization.get(p.entity_id).catch(() => null);
      if (p.entity_type === 'ProviderLocation') entity = await svc.entities.ProviderLocation.get(p.entity_id).catch(() => null);
      if (p.entity_type === 'LocationService') entity = await svc.entities.LocationService.get(p.entity_id).catch(() => null);
      if (!entity) return bad('Entitatea tinta nu exista');

      // Older evidence is never overwritten silently — superseding is explicit and audited.
      if (p.supersede_previous === true && p.field_name) {
        const prev = await svc.entities.ProviderEvidence.filter({ entity_type: p.entity_type, entity_id: p.entity_id, field_name: p.field_name, evidence_status: 'active' }, null, 100);
        for (const e of prev) {
          await svc.entities.ProviderEvidence.update(e.id, { evidence_status: 'superseded' });
          await audit(svc, user, { entity_type: 'ProviderEvidence', entity_id: e.id, action_type: 'supersede_evidence', changed_fields: ['evidence_status'], previous: { evidence_status: 'active' }, next: { evidence_status: 'superseded' }, note: 'Inlocuita explicit de o dovada noua' });
        }
      }
      const row = await svc.entities.ProviderEvidence.create({
        entity_type: p.entity_type,
        entity_id: p.entity_id,
        field_name: p.field_name || '',
        value_snapshot: p.value_snapshot || '',
        source_url: p.source_url,
        source_type: p.source_type || '',
        source_title: p.source_title || '',
        collected_at: new Date().toISOString(),
        collected_by: user.email,
        checked_at: p.checked_at || new Date().toISOString(),
        confidence: p.confidence,
        evidence_status: 'active',
        notes: p.notes || '',
      });
      await audit(svc, user, { entity_type: 'ProviderEvidence', entity_id: row.id, action_type: 'add_evidence', changed_fields: ['source_url', 'field_name', 'confidence'], next: { entity_type: p.entity_type, entity_id: p.entity_id, field_name: p.field_name || '', source_url: p.source_url }, note: p.notes || '' });
      return Response.json({ evidence: row });
    }

    // ---------- SET EVIDENCE STATUS ----------
    if (action === 'set_evidence_status') {
      const e = await svc.entities.ProviderEvidence.get(p.evidence_id).catch(() => null);
      if (!e) return bad('Dovada nu exista');
      if (!['superseded', 'rejected'].includes(p.status)) return bad('Status invalid (superseded/rejected)');
      const note = String(p.note || '').trim();
      if (p.status === 'rejected' && !note) return bad('Respingerea unei dovezi necesita o nota');
      await svc.entities.ProviderEvidence.update(e.id, { evidence_status: p.status });
      await audit(svc, user, { entity_type: 'ProviderEvidence', entity_id: e.id, action_type: 'set_evidence_status', changed_fields: ['evidence_status'], previous: { evidence_status: e.evidence_status }, next: { evidence_status: p.status }, note });
      return Response.json({ success: true });
    }

    // ---------- SET RESEARCH STATUS (internal workflow only) ----------
    // 'published' here is a RESEARCH workflow state only — it never changes
    // public status / profile_control_status (those change only via directoryOps).
    if (action === 'set_research_status') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      if (!RESEARCH_STATUSES.includes(p.status)) return bad('Status de research invalid');
      const note = String(p.note || '').trim();
      if (['rejected', 'needs_recheck'].includes(p.status) && !note) return bad('Acest status necesita o nota');
      const nowIso = new Date().toISOString();
      const updates = { research_status: p.status };
      if (p.status === 'in_progress' && !loc.research_started_at) updates.research_started_at = nowIso;
      if (p.status === 'ready_for_review') updates.research_completed_at = nowIso;
      if (['published', 'rejected'].includes(p.status)) {
        updates.research_reviewed_by = user.email;
        updates.research_reviewed_at = nowIso;
      }
      if (p.next_recheck_at) updates.next_recheck_at = p.next_recheck_at;
      if (note) updates.research_notes = note;
      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'set_research_status', changed_fields: Object.keys(updates), previous: { research_status: loc.research_status || 'new' }, next: { research_status: p.status }, note });
      return Response.json({ success: true });
    }

    // ---------- ASSIGN RESEARCH ----------
    if (action === 'assign_research') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const assignee = String(p.assigned_to || '').trim();
      await svc.entities.ProviderLocation.update(loc.id, { research_assigned_to: assignee });
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'assign_research', changed_fields: ['research_assigned_to'], previous: { research_assigned_to: loc.research_assigned_to || '' }, next: { research_assigned_to: assignee }, note: p.note || '' });
      return Response.json({ success: true });
    }

    // ---------- CHECKLIST (each item explicit — never automatic) ----------
    if (action === 'set_checklist_item') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      if (!CHECKLIST_KEYS.includes(p.item_key)) return bad('Element de checklist invalid');
      const checklist = parseChecklist(loc.research_checklist);
      if (p.done === true) {
        checklist[p.item_key] = { done: true, at: new Date().toISOString(), by: user.email };
      } else {
        delete checklist[p.item_key];
      }
      await svc.entities.ProviderLocation.update(loc.id, { research_checklist: JSON.stringify(checklist) });
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'set_checklist_item', changed_fields: ['research_checklist'], next: { item_key: p.item_key, done: p.done === true }, note: '' });
      return Response.json({ success: true, checklist });
    }

    // ---------- RESEARCH NOTES / RECHECK DATE ----------
    if (action === 'set_research_notes') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const updates = {};
      if (typeof p.notes === 'string') updates.research_notes = p.notes;
      if (p.next_recheck_at) updates.next_recheck_at = p.next_recheck_at;
      if (Object.keys(updates).length === 0) return bad('Nimic de actualizat');
      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'set_research_notes', changed_fields: Object.keys(updates), next: updates, note: '' });
      return Response.json({ success: true });
    }

    // ---------- DUPLICATE CHECK (read-only, never writes) ----------
    if (action === 'duplicate_check') {
      const duplicates = await findDuplicates(svc, {
        name: p.name, org_name: p.org_name, city: p.city,
        address: p.address, website: p.website, phone: p.phone,
      }, p.exclude_id || null);
      return Response.json({ duplicates });
    }

    // ---------- COVERAGE OVERVIEW (read-only) ----------
    if (action === 'coverage') {
      const [locs, services, evidences] = await Promise.all([
        svc.entities.ProviderLocation.list(null, 5000),
        svc.entities.LocationService.list(null, 2000),
        svc.entities.ProviderEvidence.list(null, 2000),
      ]);
      const serviceLoc = {};
      for (const s of services) serviceLoc[s.id] = s.location_id;
      const evByLoc = {};
      for (const e of evidences) {
        if (e.evidence_status !== 'active') continue;
        const locId = e.entity_type === 'ProviderLocation' ? e.entity_id : (e.entity_type === 'LocationService' ? serviceLoc[e.entity_id] : null);
        if (!locId) continue;
        if (!evByLoc[locId]) evByLoc[locId] = [];
        evByLoc[locId].push(e);
      }
      const byCity = {};
      const byCounty = {};
      const pcsCounts = { directory: 0, claimed: 0, verified: 0, suspended: 0 };
      const researchCounts = {};
      let noWebsite = 0;
      let noEvidence = 0;
      let notCheckedRecently = 0;
      const staleBefore = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
      for (const loc of locs) {
        byCity[loc.city] = (byCity[loc.city] || 0) + 1;
        const county = loc.county || 'Necunoscut';
        byCounty[county] = (byCounty[county] || 0) + 1;
        const pcs = loc.profile_control_status || 'directory';
        if (pcsCounts[pcs] !== undefined) pcsCounts[pcs] += 1;
        const rs = loc.research_status || 'new';
        researchCounts[rs] = (researchCounts[rs] || 0) + 1;
        if (!loc.website) noWebsite += 1;
        const ev = evByLoc[loc.id] || [];
        if (ev.length === 0) noEvidence += 1;
        const lastChecked = lastCheckedOf(loc, ev);
        if (!lastChecked || lastChecked < staleBefore) notCheckedRecently += 1;
      }
      // General service coverage only — clinical capability coverage is never
      // computed from unverified data.
      const serviceCoverage = {};
      for (const key of GENERAL_SERVICE_KEYS) serviceCoverage[key] = 0;
      for (const s of services) {
        if (s.is_active === false) continue;
        if (GENERAL_SERVICE_KEYS.includes(s.service_key)) serviceCoverage[s.service_key] += 1;
      }
      return Response.json({
        total_locations: locs.length,
        by_city: byCity,
        by_county: byCounty,
        profile_control_counts: pcsCounts,
        research_status_counts: researchCounts,
        without_website: noWebsite,
        without_active_evidence: noEvidence,
        not_checked_recently: notCheckedRecently,
        stale_days: STALE_DAYS,
        ready_for_review: researchCounts.ready_for_review || 0,
        rejected: researchCounts.rejected || 0,
        general_service_coverage: serviceCoverage,
      });
    }

    return bad('Actiune necunoscuta');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
