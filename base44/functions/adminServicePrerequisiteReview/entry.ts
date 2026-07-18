import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getCanonicalServiceDefinition } from '../../../shared/canonicalServiceRegistryExtended.js';
import {
  evaluateServicePrerequisites,
  servicePrerequisiteStatusLabel,
} from '../../../shared/servicePrerequisiteEngine.js';

function clean(value) {
  return String(value || '').trim();
}

function parsePayload(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function selectedServiceKeys(payload) {
  return [...new Set(Object.values(payload?.selected_ids || {}).flat().map(clean).filter(Boolean))];
}

async function loadPrerequisiteContext(svc, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) throw new Error('Locatia nu a fost gasita');

  const [assignments, equipment, facilities] = await Promise.all([
    svc.entities.ProfessionalLocationAssignment.filter({
      location_id: locationId,
      active_status: 'activ',
    }, null, 200),
    svc.entities.LocationEquipment.filter({ location_id: locationId }, null, 300).catch(() => []),
    svc.entities.LocationFacility.filter({ location_id: locationId }, null, 300).catch(() => []),
  ]);

  const professionalIds = [...new Set(assignments.map((assignment) => assignment.professional_id).filter(Boolean))];
  const professionals = (await Promise.all(
    professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
  )).filter(Boolean);

  return { location, assignments, professionals, equipment, facilities };
}

async function evaluateSubmission(svc, submission) {
  const payload = parsePayload(submission.payload_json);
  const keys = selectedServiceKeys(payload);
  const context = await loadPrerequisiteContext(svc, submission.location_id);
  const evaluations = keys.map((key) => {
    const result = evaluateServicePrerequisites(key, context);
    const definition = result.definition || getCanonicalServiceDefinition(key);
    const blockers = [...result.blockers];
    const eligible = result.eligible;
    const status = result.status;

    return {
      service_key: key,
      label: definition?.label || key,
      group: definition?.group || null,
      kind: definition?.kind || null,
      requires_review: definition?.requires_review === true,
      eligible,
      status,
      status_label: servicePrerequisiteStatusLabel(status),
      blockers,
      evidence: result.evidence,
      required_professional_types: result.definition?.required_professional_types || [],
      required_equipment_types: result.definition?.required_equipment_types || [],
      equipment_requirement_mode: result.definition?.equipment_requirement_mode || 'all',
      required_infrastructure_types: result.definition?.required_infrastructure_types || [],
    };
  });

  const blocked = evaluations.filter((evaluation) => !evaluation.eligible);
  return {
    payload,
    context,
    evaluations,
    blocked,
    approval_allowed: blocked.length === 0,
    summary: {
      selected_count: evaluations.length,
      eligible_count: evaluations.length - blocked.length,
      blocked_count: blocked.length,
      medical_review_count: evaluations.filter((evaluation) => evaluation.requires_review).length,
    },
  };
}

function reviewPayload(evaluation) {
  return {
    approval_allowed: evaluation.approval_allowed,
    summary: evaluation.summary,
    services: evaluation.evaluations,
  };
}

async function delegate(base44, action, payload) {
  const result = await base44.functions.invoke('adminWorkspaceReview', {
    action,
    submission_id: payload.submission_id,
    status: payload.status,
    section: payload.section,
    location_id: payload.location_id,
    organization_id: payload.organization_id,
    note: payload.note || '',
  });
  return result?.data || result || {};
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces permis doar administratorilor Vezunde' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const action = clean(payload.action || 'list');
    const svc = base44.asServiceRole;

    if (action === 'list') {
      return Response.json(await delegate(base44, 'list', payload));
    }

    const submissionId = clean(payload.submission_id);
    if (!submissionId) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
    const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
    if (!submission) return Response.json({ error: 'Submission nu a fost gasit' }, { status: 404 });

    if (action === 'get') {
      if (submission.section !== 'services') {
        const delegated = await delegate(base44, 'get', payload);
        return Response.json({ ...delegated, prerequisite_review: null });
      }
      const evaluation = await evaluateSubmission(svc, submission);
      return Response.json({ submission, prerequisite_review: reviewPayload(evaluation) });
    }

    if (action === 'approve') {
      if (submission.section !== 'services') {
        return Response.json(await delegate(base44, 'approve', payload));
      }
      if (submission.status !== 'pending_review') {
        return Response.json({ error: 'Submission nu este in asteptare' }, { status: 400 });
      }

      const preApprovalEvaluation = await evaluateSubmission(svc, submission);
      if (!preApprovalEvaluation.approval_allowed) {
        return Response.json({
          error: 'Serviciile nu pot fi aprobate deoarece exista cerinte neindeplinite.',
          code: 'SERVICE_PREREQUISITES_NOT_MET',
          prerequisite_review: reviewPayload(preApprovalEvaluation),
        }, { status: 409 });
      }

      const delegated = await delegate(base44, 'approve', payload);
      if (delegated.error) return Response.json(delegated, { status: 400 });

      // Keep the compatibility endpoint non-blocking too. The underlying review
      // stores services as provider-declared; it does not create a Vezunde verification.
      const postApprovalEvaluation = await evaluateSubmission(svc, submission);
      return Response.json({
        success: true,
        provider_declared_services: postApprovalEvaluation.evaluations.map((item) => item.service_key),
        promoted_services: [],
        prerequisite_review: reviewPayload(postApprovalEvaluation),
      });
    }

    if (action === 'reject' || action === 'request_more_info') {
      return Response.json(await delegate(base44, action, payload));
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
});
