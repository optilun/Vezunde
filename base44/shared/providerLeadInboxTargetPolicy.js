import { filterProviderLeadInbox } from './providerLeadInboxPolicy.js';

export function isProviderLeadInboxTarget(lead, locationId, scope = 'active', status = '') {
  return Boolean(
    lead
    && lead.location_id === locationId
    && filterProviderLeadInbox([lead], { scope, status, limit: 1 }).length === 1
  );
}
