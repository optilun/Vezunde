import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { canAccessProviderLeadInbox } from '../../shared/providerLeadInboxPolicy.js';
import { hasProviderFeature, resolveProviderEntitlement } from '../../shared/providerEntitlementPolicy.js';
import {
  PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION,
  buildApprovedProviderContact,
  providerContactAccessEligibility,
  sanitizeProviderContactAccessStatus,
} from '../../shared/providerContactAccessPolicy.js';
import {
  acquireContactShareApprovalLock,
  releaseContactShareApprovalLock,
} from '../../shared/contactShareApprovalLock.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function expired(lead) {
  const parsed = Date.parse(String(lead?.expires_at || ''));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

async function authorizeLocation(svc, user, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  const membership = memberships.find((row) => canAccessProviderLeadInbox(row?.role));
  if (!membership) return { error: 'Nu ai acces la contactele acestei locatii.', status: 403 };
  return { location, membership };
}

async function resolveContactEntitlement(svc, locationId) {
  const rows = await svc.entities.ProviderSubscription.filter({ location_id: locationId }, '-created_date', 100);
  const entitlement = resolveProviderEntitlement(rows);
  return {
    entitlement,
    allowed: hasProviderFeature(entitlement, 'provider_contact.access_after_consent'),
  };
}

async function loadAccessContext(svc, leadId, locationId) {
  const lead = await svc.entities.ProviderLead.get(leadId).catch(() => null);
  if (!lead || lead.location_id !== locationId) return { error: 'Leadul nu a fost gasit.', status: 404 };
  if (expired(lead)) return { error: 'Leadul a expirat.', status: 409, lead };

  const [responses, approvals, contacts] = await Promise.all([
    svc.entities.ProviderLeadResponse.filter({
      lead_id: lead.id,
      location_id: locationId,
      status: 'active',
    }, '-updated_date', 20),
    svc.entities.ContactShareApproval.filter({
      lead_id: lead.id,
      request_id: lead.request_id,
      location_id: locationId,
      status: 'approved',
    }, '-updated_date', 20),
    svc.entities.PatientRequestContact.filter({
      request_id: lead.request_id,
      status: 'active',
    }, '-updated_date', 2),
  ]);

  const response = responses[0] || null;
  const approval = approvals[0] || null;
  const contact = contacts[0] || null;
  const eligibility = providerContactAccessEligibility({ lead, response, approval, contact });
  return { lead, response, approval, contact, eligibility };
}

async function writeAudit(svc, {
  lead,
  user,
  entitlement,
  outcome,
  reason,
  fields = [],
  approval = null,
}) {
  return svc.entities.ProviderLeadContactAccessAudit.create({
    lead_id: lead?.id || '',
    request_id: lead?.request_id || '',
    organization_id: lead?.organization_id || '',
    location_id: lead?.location_id || '',
    accessor_user_id: user?.id || '',
    access_contract_version: PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION,
    outcome,
    reason: clean(reason, 160),
    accessed_fields: Array.isArray(fields) ? fields : [],
    entitlement_plan_code: entitlement?.plan_code || 'free',
    approval_contract_version: approval?.approval_contract_version || '',
    accessed_at: new Date().toISOString(),
  });
}

async function denyWithAudit(svc, params, message, status, reason) {
  try {
    await writeAudit(svc, { ...params, outcome: 'denied', reason });
  } catch (_auditError) {
    return res({ error: 'Accesul nu poate fi procesat in siguranta.' }, 503);
  }
  return res({ error: message }, status);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'status', 40);
    const locationId = clean(input.location_id, 120);
    const leadId = clean(input.lead_id, 120);
    if (!locationId || !leadId) return res({ error: 'location_id si lead_id sunt obligatorii.' }, 400);

    const authorized = await authorizeLocation(svc, user, locationId);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);
    const entitlementResult = await resolveContactEntitlement(svc, locationId);
    const context = await loadAccessContext(svc, leadId, locationId);
    if (context.error && !context.lead) return res({ error: context.error }, context.status);

    const safeStatus = sanitizeProviderContactAccessStatus({
      eligible: entitlementResult.allowed && context.eligibility?.eligible === true,
      reasons: !entitlementResult.allowed
        ? ['pro_entitlement_required']
        : (context.eligibility?.reasons || [context.error || 'contact_locked']),
      approvedFields: context.eligibility?.approved_fields || [],
    });

    if (action === 'status') {
      return res({
        contract_version: PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION,
        entitlement: entitlementResult.entitlement,
        contact_access: safeStatus,
      });
    }
    if (action !== 'read') return res({ error: 'Actiune necunoscuta.' }, 400);

    if (!entitlementResult.allowed) {
      return denyWithAudit(svc, {
        lead: context.lead,
        user,
        entitlement: entitlementResult.entitlement,
        approval: context.approval,
      }, 'Accesul la contact este disponibil in planul Pro.', 402, 'pro_entitlement_required');
    }

    const lock = await acquireContactShareApprovalLock(svc, context.lead.id);
    if (!lock) return res({ error: 'Acordul pentru contact este actualizat in alta sesiune. Reincearca.' }, 409);
    try {
      const [checkedAuthorization, checkedEntitlement, checkedContext] = await Promise.all([
        authorizeLocation(svc, user, locationId),
        resolveContactEntitlement(svc, locationId),
        loadAccessContext(svc, leadId, locationId),
      ]);

      if (checkedAuthorization.error) {
        return res({ error: checkedAuthorization.error }, checkedAuthorization.status);
      }
      if (!checkedEntitlement.allowed) {
        return denyWithAudit(svc, {
          lead: checkedContext.lead || context.lead,
          user,
          entitlement: checkedEntitlement.entitlement,
          approval: checkedContext.approval,
        }, 'Accesul la contact este disponibil in planul Pro.', 402, 'pro_entitlement_required');
      }
      if (checkedContext.error || checkedContext.eligibility?.eligible !== true) {
        const reason = checkedContext.eligibility?.reasons?.[0] || checkedContext.error || 'contact_locked';
        return denyWithAudit(svc, {
          lead: checkedContext.lead || context.lead,
          user,
          entitlement: checkedEntitlement.entitlement,
          approval: checkedContext.approval,
        }, 'Clientul nu a aprobat accesul la contact sau aprobarea nu mai este valida.', 409, reason);
      }

      const contact = buildApprovedProviderContact(
        checkedContext.contact,
        checkedContext.eligibility.approved_fields,
      );
      const accessedFields = Object.keys(contact);
      if (accessedFields.length === 0) {
        return denyWithAudit(svc, {
          lead: checkedContext.lead,
          user,
          entitlement: checkedEntitlement.entitlement,
          approval: checkedContext.approval,
        }, 'Datele de contact aprobate nu sunt disponibile.', 409, 'approved_contact_values_empty');
      }

      try {
        await writeAudit(svc, {
          lead: checkedContext.lead,
          user,
          entitlement: checkedEntitlement.entitlement,
          approval: checkedContext.approval,
          outcome: 'granted',
          reason: 'approved_contact_access',
          fields: accessedFields,
        });
      } catch (_auditError) {
        return res({ error: 'Accesul nu poate fi procesat in siguranta.' }, 503);
      }

      return res({
        contract_version: PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION,
        entitlement: checkedEntitlement.entitlement,
        contact_access: {
          available: true,
          state: 'patient_approved',
          approved_fields: checkedContext.eligibility.approved_fields,
        },
        contact,
        conversation_enabled: false,
      });
    } finally {
      await releaseContactShareApprovalLock(svc, lock);
    }
  } catch (_error) {
    return res({ error: 'Accesul la contact nu a putut fi procesat.' }, 500);
  }
});
