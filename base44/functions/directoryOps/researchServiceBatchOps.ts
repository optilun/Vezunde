import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeServiceKey } from '../../shared/canonicalServiceRegistryExtended.js';
import {
  RESEARCH_SERVICE_BATCH_CHUNK_SIZE,
  RESEARCH_SERVICE_BATCH_CONTRACT_VERSION,
  computeServiceMatchingAllowed,
  isResearchServiceRowRollbackSafe,
  locationServiceRow,
  normalizeResearchServicePairs,
  planResearchServiceApplication,
  researchServiceBatchConfirmation,
  researchServiceBatchRollbackConfirmation,
  researchServiceRowNote,
  summarizeResearchServiceBatchPlan,
} from '../../shared/researchServiceApplyPlan.js';

// Loturi de aplicare a serviciilor venite din cercetare (admin-only).
//
// 2026-09-03, etapa 2. Etapa 1 scria serviciile aprobate pe o singura locatie, cu dry run
// si token de confirmare, dar fara nicio posibilitate de a le retrage. Importul de locatii
// are snapshot, lot, mutatii si rollback; serviciile nu aveau nimic. Fara asta, orice
// populare in masa ar fi fost ireversibila - iar directorul are 500+ locatii publicate si
// 26 de randuri de servicii, deci popularea in masa e exact ce urmeaza.
//
// Un lot este o lista de perechi (draft de cercetare, locatie existenta). Un draft descrie
// un singur furnizor, deci scara nu vine din "un draft peste multe locatii", ci din "multe
// drafturi recenzate, aplicate cu o singura aprobare".
//
// Ce NU face acest modul, deliberat:
//  - nu decide nimic despre servicii: planificarea e in shared/researchServiceApplyPlan.js
//  - nu scrie niciun serviciu fara o decizie de aprobare umana insotita de dovada
//  - nu atinge locatiile care nu mai sunt in regim directory
//  - nu sterge la rollback un rand pe care l-a modificat altcineva intre timp

const LOCK_TTL_MS = 5 * 60 * 1000;

const bad = (msg) => Response.json({ error: msg }, { status: 400 });
const nowIso = () => new Date().toISOString();

function parseJSON(value, fallback) {
  try {
    const parsed = value ? JSON.parse(value) : null;
    return parsed ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
    performed_at: nowIso(),
  });
}

function batchView(batch) {
  return {
    id: batch.id,
    batch_key: batch.batch_key,
    status: batch.status,
    pairs: parseJSON(batch.pairs_json, []),
    plan: parseJSON(batch.plan_json, []),
    result: parseJSON(batch.result_json, null),
    rollback_result: parseJSON(batch.rollback_result_json, null),
    pair_count: batch.pair_count || 0,
    planned_count: batch.planned_count || 0,
    created_count: batch.created_count || 0,
    skipped_count: batch.skipped_count || 0,
    blocked_count: batch.blocked_count || 0,
    failed_count: batch.failed_count || 0,
    execution_cursor: batch.execution_cursor || 0,
    applied_service_ids: batch.applied_service_ids || [],
    failure_message: batch.failure_message || '',
    rollback_error: batch.rollback_error || '',
    started_at: batch.started_at || '',
    finished_at: batch.finished_at || '',
  };
}

// Planificarea unei singure perechi. Reciteste mereu starea reala a locatiei si a
// draftului: un plan calculat acum zece minute nu are voie sa scrie orbeste.
async function planPair(svc, pair) {
  const base = { draft_id: pair.draft_id, location_id: pair.location_id, planned: [], skipped: [], blocked: [] };

  const draft = await svc.entities.AIResearchDraft.get(pair.draft_id).catch(() => null);
  if (!draft) return { ...base, error: 'Draftul de cercetare nu exista' };

  const loc = await svc.entities.ProviderLocation.get(pair.location_id).catch(() => null);
  if (!loc) return { ...base, error: 'Locatia nu exista' };
  if (loc.active_status === 'inactiva') return { ...base, location_name: loc.name || '', error: 'Locatia este inactiva' };
  if ((loc.profile_control_status || 'directory') !== 'directory') {
    return {
      ...base,
      location_name: loc.name || '',
      error: 'Locatia nu mai este in regim directory - serviciile se declara de catre furnizor',
    };
  }

  const source = draft.source_id ? await svc.entities.ResearchSource.get(draft.source_id).catch(() => null) : null;
  const existingRows = await svc.entities.LocationService.filter({ location_id: pair.location_id });

  const plan = planResearchServiceApplication({
    approvedFields: parseJSON(draft.approved_fields_json, {}),
    reviewDecisions: parseJSON(draft.review_decisions_json, {}),
    existingServiceKeys: existingRows.map((row) => row.service_key),
    fallbackSourceUrl: String(source?.source_url || '').trim(),
    sourceCheckedAt: source?.fetched_at || source?.submitted_at || '',
    now: nowIso(),
    matchingAllowedFor: (level, serviceKey) => computeServiceMatchingAllowed(level, serviceKey, loc),
  });

  return {
    ...base,
    location_name: loc.name || '',
    location_city: loc.city || '',
    source_title: source?.source_title || source?.source_domain || '',
    ...plan,
  };
}

async function planBatch(svc, batch) {
  const pairs = normalizeResearchServicePairs(parseJSON(batch.pairs_json, []));
  const plan = [];
  for (const pair of pairs) {
    plan.push(await planPair(svc, pair));
  }
  return { pairs, plan, summary: summarizeResearchServiceBatchPlan(plan) };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Neautentificat' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Acces interzis: doar administratori Vezunde' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const action = p.action;

    const loadBatch = async () => {
      const id = String(p.batch_id || '').trim();
      if (!id) return null;
      return svc.entities.ResearchServiceApplyBatch.get(id).catch(() => null);
    };

    // ---------- LIST ----------
    if (action === 'list') {
      const rows = await svc.entities.ResearchServiceApplyBatch.list('-created_date', 50);
      return Response.json({ batches: rows.map(batchView) });
    }

    // ---------- STATUS ----------
    if (action === 'status') {
      const batch = await loadBatch();
      if (!batch) return bad('Lotul nu exista');
      return Response.json({ batch: batchView(batch) });
    }

    // ---------- CREATE ----------
    if (action === 'create') {
      const pairs = normalizeResearchServicePairs(p.pairs);
      const batchKey = `RSB-${crypto.randomUUID().slice(0, 12)}`;
      const batch = await svc.entities.ResearchServiceApplyBatch.create({
        batch_key: batchKey,
        contract_version: RESEARCH_SERVICE_BATCH_CONTRACT_VERSION,
        status: 'draft',
        pairs_json: JSON.stringify(pairs),
        pair_count: pairs.length,
        created_by_user_id: user.id,
        created_by_email: user.email,
      });
      await audit(svc, user, {
        entity_type: 'ResearchServiceApplyBatch',
        entity_id: batch.id,
        action_type: 'research_service_batch_created',
        changed_fields: ['batch_key', 'pairs'],
        next: { batch_key: batchKey, pair_count: pairs.length },
      });
      return Response.json({ batch: batchView(batch) });
    }

    // ---------- ADD / REMOVE PAIR ----------
    if (action === 'add_pair' || action === 'remove_pair') {
      const batch = await loadBatch();
      if (!batch) return bad('Lotul nu exista');
      if (!['draft', 'planned'].includes(batch.status)) {
        return bad('Lotul nu mai poate fi modificat: a fost deja aprobat sau rulat');
      }
      const draftId = String(p.draft_id || '').trim();
      const locationId = String(p.location_id || '').trim();
      if (!draftId || !locationId) return bad('draft_id si location_id sunt obligatorii');

      const current = normalizeResearchServicePairs(parseJSON(batch.pairs_json, []));
      const next = action === 'add_pair'
        ? normalizeResearchServicePairs([...current, { draft_id: draftId, location_id: locationId }])
        : current.filter((pair) => !(pair.draft_id === draftId && pair.location_id === locationId));

      // Orice schimbare de continut invalideaza planul si aprobarea: token-ul urmator va
      // fi altul, deci un plan vechi nu poate fi aplicat pe o lista noua.
      const updated = await svc.entities.ResearchServiceApplyBatch.update(batch.id, {
        pairs_json: JSON.stringify(next),
        pair_count: next.length,
        status: 'draft',
        plan_json: '',
        approval_token_hash: '',
        planned_count: 0,
      });
      return Response.json({ batch: batchView(updated) });
    }

    // ---------- PLAN (dry run) ----------
    if (action === 'plan') {
      const batch = await loadBatch();
      if (!batch) return bad('Lotul nu exista');
      if (!['draft', 'planned'].includes(batch.status)) {
        return bad('Lotul a fost deja aprobat sau rulat');
      }

      const { pairs, plan, summary } = await planBatch(svc, batch);
      const confirmation = researchServiceBatchConfirmation(batch.batch_key, summary.planned_count);
      const updated = await svc.entities.ResearchServiceApplyBatch.update(batch.id, {
        status: 'planned',
        pairs_json: JSON.stringify(pairs),
        plan_json: JSON.stringify(plan),
        pair_count: summary.pair_count,
        planned_count: summary.planned_count,
        skipped_count: summary.skipped_count,
        blocked_count: summary.blocked_count,
        approval_token_hash: await sha256Hex(confirmation),
      });

      return Response.json({
        batch: batchView(updated),
        summary,
        confirmation_required: confirmation,
      });
    }

    // ---------- RUN ----------
    if (action === 'run') {
      const batch = await loadBatch();
      if (!batch) return bad('Lotul nu exista');
      if (!['planned', 'approved', 'running'].includes(batch.status)) {
        return bad(`Lotul nu poate fi rulat din starea ${batch.status}`);
      }

      // Prima rulare cere token-ul de confirmare. Reluarile (cursor > 0) nu il mai cer,
      // dar nici nu pot schimba planul: ruleaza exact planul aprobat.
      const isFirstCall = batch.status === 'planned';
      if (isFirstCall) {
        const confirmation = String(p.confirmation || '').trim();
        if (!confirmation) return bad('Confirmarea este obligatorie');
        if (await sha256Hex(confirmation) !== String(batch.approval_token_hash || '')) {
          return bad('Confirmare invalida - replanifica lotul si foloseste token-ul afisat');
        }
      }

      const lockToken = crypto.randomUUID();
      const lockExpiry = new Date(Date.now() + LOCK_TTL_MS).toISOString();
      const existingLock = String(batch.execution_lock_token || '');
      const lockExpired = !batch.execution_lock_expires_at || batch.execution_lock_expires_at < nowIso();
      if (existingLock && !lockExpired) return bad('Lotul este deja in executie');

      const plan = parseJSON(batch.plan_json, []);
      const pairs = normalizeResearchServicePairs(parseJSON(batch.pairs_json, []));
      if (plan.length !== pairs.length) return bad('Planul nu mai corespunde perechilor - replanifica lotul');

      await svc.entities.ResearchServiceApplyBatch.update(batch.id, {
        status: 'running',
        execution_lock_token: lockToken,
        execution_lock_expires_at: lockExpiry,
        last_heartbeat_at: nowIso(),
        started_at: batch.started_at || nowIso(),
        approved_by_user_id: batch.approved_by_user_id || user.id,
        approved_by_email: batch.approved_by_email || user.email,
        approved_at: batch.approved_at || nowIso(),
      });

      const appliedServiceIds = [...(batch.applied_service_ids || [])];
      const appliedEvidenceIds = [...(batch.applied_evidence_ids || [])];
      const results = parseJSON(batch.result_json, []);
      let cursor = batch.execution_cursor || 0;
      let created = batch.created_count || 0;
      let failed = batch.failed_count || 0;

      const end = Math.min(plan.length, cursor + RESEARCH_SERVICE_BATCH_CHUNK_SIZE);
      for (; cursor < end; cursor += 1) {
        const entry = plan[cursor];
        const pairResult = {
          draft_id: entry.draft_id,
          location_id: entry.location_id,
          location_name: entry.location_name || '',
          created: [],
          failed: [],
          error: entry.error || '',
        };

        if (entry.error) {
          failed += 1;
          results.push(pairResult);
          continue;
        }

        for (const item of entry.planned || []) {
          const normalized = normalizeServiceKey(item.service_key);
          if (normalized.status !== 'canonical' || !normalized.definition) {
            pairResult.failed.push({ service_key: item.service_key, reason: 'cheie necanonica la executie' });
            failed += 1;
            continue;
          }
          try {
            const row = await svc.entities.LocationService.create(locationServiceRow({
              locationId: entry.location_id,
              normalized,
              level: item.confirmation_level,
              matchingAllowed: item.matching_allowed,
              sourceUrl: item.service_source_url,
              confirmedAt: item.service_confirmed_at,
              notes: researchServiceRowNote(entry.draft_id, item.snippet),
            }));
            appliedServiceIds.push(row.id);

            const evidence = await svc.entities.ProviderEvidence.create({
              entity_type: 'LocationService',
              entity_id: row.id,
              field_name: 'service_key',
              value_snapshot: item.service_key,
              source_url: item.service_source_url,
              source_type: 'site_oficial',
              source_title: entry.source_title || '',
              collected_at: item.service_confirmed_at,
              collected_by: user.email,
              checked_at: nowIso(),
              confidence: 'medium',
              evidence_status: 'active',
              notes: item.snippet,
            }).catch(() => null);
            if (evidence?.id) appliedEvidenceIds.push(evidence.id);

            await audit(svc, user, {
              entity_type: 'LocationService',
              entity_id: row.id,
              action_type: 'apply_research_service',
              changed_fields: ['service_key', 'confirmation_level', 'matching_allowed'],
              next: {
                service_key: item.service_key,
                confirmation_level: item.confirmation_level,
                matching_allowed: item.matching_allowed,
                research_draft_id: entry.draft_id,
                research_service_batch_key: batch.batch_key,
              },
              note: item.snippet,
            });
            created += 1;
            pairResult.created.push({ id: row.id, service_key: item.service_key });
          } catch (rowError) {
            failed += 1;
            pairResult.failed.push({ service_key: item.service_key, reason: rowError.message });
          }
        }
        results.push(pairResult);
      }

      const finished = cursor >= plan.length;
      const status = finished ? (failed > 0 ? 'completed_with_errors' : 'completed') : 'running';
      const updated = await svc.entities.ResearchServiceApplyBatch.update(batch.id, {
        status,
        execution_cursor: cursor,
        created_count: created,
        failed_count: failed,
        applied_service_ids: appliedServiceIds,
        applied_evidence_ids: appliedEvidenceIds,
        result_json: JSON.stringify(results),
        last_heartbeat_at: nowIso(),
        execution_lock_token: '',
        execution_lock_expires_at: '',
        finished_at: finished ? nowIso() : '',
      });

      if (finished) {
        await audit(svc, user, {
          entity_type: 'ResearchServiceApplyBatch',
          entity_id: batch.id,
          action_type: 'research_service_batch_completed',
          changed_fields: ['status', 'created_count'],
          next: { batch_key: batch.batch_key, status, created_count: created, failed_count: failed },
        });
      }

      return Response.json({ batch: batchView(updated), finished, remaining: Math.max(0, plan.length - cursor) });
    }

    // ---------- ROLLBACK ----------
    if (action === 'rollback') {
      const batch = await loadBatch();
      if (!batch) return bad('Lotul nu exista');
      if (!['completed', 'completed_with_errors', 'rollback_failed'].includes(batch.status)) {
        return bad(`Lotul nu poate fi retras din starea ${batch.status}`);
      }

      const appliedServiceIds = batch.applied_service_ids || [];
      const expected = researchServiceBatchRollbackConfirmation(batch.batch_key, appliedServiceIds.length);
      if (String(p.confirmation || '').trim() !== expected) {
        return bad(`Confirmare invalida. Scrie exact: ${expected}`);
      }

      await svc.entities.ResearchServiceApplyBatch.update(batch.id, {
        status: 'rolling_back',
        rollback_started_at: nowIso(),
      });

      const results = parseJSON(batch.result_json, []);
      const draftByServiceId = {};
      for (const pairResult of results) {
        for (const item of pairResult.created || []) draftByServiceId[item.id] = pairResult.draft_id;
      }

      const removed = [];
      const kept = [];
      for (const serviceId of appliedServiceIds) {
        const row = await svc.entities.LocationService.get(serviceId).catch(() => null);
        if (!row) {
          kept.push({ id: serviceId, reason: 'randul nu mai exista' });
          continue;
        }
        // Aceeasi regula ca la rollback-ul de import: nu se sterge nimic ce a fost
        // modificat dupa scriere. Daca furnizorul sau un admin a confirmat serviciul
        // intre timp, retragerea lotului nu are voie sa il stearga.
        if (!isResearchServiceRowRollbackSafe(row, draftByServiceId[serviceId])) {
          kept.push({ id: serviceId, service_key: row.service_key, reason: 'a fost modificat dupa scriere' });
          continue;
        }
        try {
          await svc.entities.LocationService.delete(serviceId);
          removed.push({ id: serviceId, service_key: row.service_key });
          await audit(svc, user, {
            entity_type: 'LocationService',
            entity_id: serviceId,
            action_type: 'rollback_research_service',
            changed_fields: ['is_active'],
            previous: { service_key: row.service_key, confirmation_level: row.confirmation_level },
            next: { research_service_batch_key: batch.batch_key },
          });
        } catch (deleteError) {
          kept.push({ id: serviceId, service_key: row.service_key, reason: deleteError.message });
        }
      }

      for (const evidenceId of batch.applied_evidence_ids || []) {
        await svc.entities.ProviderEvidence.delete(evidenceId).catch(() => null);
      }

      const rollbackResult = { removed, kept };
      const status = kept.length > 0 ? 'rollback_failed' : 'rolled_back';
      const updated = await svc.entities.ResearchServiceApplyBatch.update(batch.id, {
        status,
        rollback_finished_at: nowIso(),
        rollback_result_json: JSON.stringify(rollbackResult),
        rollback_error: kept.length > 0 ? `${kept.length} randuri nu au putut fi retrase` : '',
      });

      await audit(svc, user, {
        entity_type: 'ResearchServiceApplyBatch',
        entity_id: batch.id,
        action_type: 'research_service_batch_rolled_back',
        changed_fields: ['status'],
        next: { batch_key: batch.batch_key, removed: removed.length, kept: kept.length },
      });

      return Response.json({ batch: batchView(updated), removed, kept });
    }

    return bad('Actiune necunoscuta');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
