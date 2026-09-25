import {
  derivePatientRequestLifecycle,
  patientRequestHasExpired,
} from './patientRequestLifecyclePolicy.js';
import { providerLeadIsHistorical } from './providerLeadInboxPolicy.js';

// Read-only projection. The location inbox remains responsible for persistence.
export async function projectOrganizationLeadExpirations(svc, leads, now = new Date()) {
  const requestIds = [...new Set(leads
    .filter((lead) => !providerLeadIsHistorical(lead)
      && lead.request_id && patientRequestHasExpired(lead, now))
    .map((lead) => lead.request_id))];
  const requests = new Map();
  for (let index = 0; index < requestIds.length; index += 4) {
    await Promise.all(requestIds.slice(index, index + 4).map(async (id) => {
      const request = await svc.entities.PatientRequest.get(id);
      if (request) requests.set(id, request);
    }));
  }
  return leads.map((lead) => {
    const request = requests.get(lead.request_id);
    if (!request || request.id !== lead.request_id || providerLeadIsHistorical(lead)) return lead;
    const lifecycle = derivePatientRequestLifecycle({ request, now });
    if (!lifecycle.terminal) return lead;
    const expired = lifecycle.state === 'expired';
    return {
      ...lead,
      status: expired ? 'expired' : 'closed',
      delivery_state: expired ? 'expired' : 'withdrawn',
      closure_reason: 'request_' + lifecycle.state,
      closed_at: request.closed_at || request.resolved_at
        || (expired ? request.expiration_processed_at || request.expires_at : null),
    };
  });
}
