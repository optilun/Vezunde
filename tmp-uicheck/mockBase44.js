window.__calls = [];
const now = new Date().toISOString();
const rows = [
  { id: 'a1', company_name: 'Optica Cont', email: 'shared@x.ro', city: 'Iasi', county: 'Iasi', provider_type: 'optica_medicala', kind: 'provider_account', email_scope: 'organization', shared_location_count: 1, added_manually: false, excluded: false, reason: '' },
  { id: 'd1', company_name: 'Optica Cont (director)', email: 'shared@x.ro', city: 'Iasi', county: 'Iasi', provider_type: 'optica_medicala', kind: 'directory', email_scope: 'location', shared_location_count: 1, added_manually: false, excluded: false, reason: 'duplicate' },
  { id: 'd2', company_name: 'Lensa', email: 'office@lensa.ro', city: 'Bucuresti', county: 'Bucuresti', provider_type: 'optica_medicala', kind: 'directory', email_scope: 'organization', shared_location_count: 79, added_manually: false, excluded: false, reason: '' },
];
const campaigns = {
  k3: { id: 'k3', name: 'Campanie esuata', category: 'marketing', status: 'failed', recipient_count: 10, current_cursor: 0, failure_message: 'Trimitere oprita, eroare permanenta (status 422): Invalid from', daily_send_limit: 50, daily_send_ramp: true, subject: 'S' },
  k4: { id: 'k4', name: 'Campanie reincercare', category: 'announcement', status: 'sending', recipient_count: 10, current_cursor: 0, failure_message: 'Lot esuat tranzitoriu (1/5), status 503: unavailable', daily_send_limit: 50, daily_send_ramp: true, subject: 'S' },
};
function respond(action, payload) {
  switch (action) {
    case 'list_recipients': return { category: 'marketing', counts: { candidates: 3, eligible: 2, excluded: 0, added_manually: 0, blocked: { duplicate: 1 } }, rows, facets: { counties: [], provider_types: [], sources: { directory: 2, provider_account: 1 } } };
    case 'search_contacts': return { contacts: [] };
    case 'get_campaign': { const c = campaigns[payload.id]; return { campaign: c, logs: [], send_stats: { sent_today: 0, prior_sending_days: 0, daily_limit_today: 50 } }; }
    case 'campaign_report': return { campaign: { id: payload.id, name: 'x', category: 'marketing' }, summary: { counts: { recipients: 10, sent: 0, delivered: 0, awaiting: 0, bounced: 0, complained: 0, failed: 0, unsubscribed: 0, replied: 0, not_sent: 1, pending_send: 9 }, rates: { delivered: 0, bounced: 0, complained: 0, unsubscribed: 0, replied: 0 }, not_sent_by_reason: { rejected_by_provider: 1 } }, rows: [{ id: 'l1', email: '=cmd@x.ro', company_name: '=HYPERLINK("x")', city: 'Iasi', kind: 'directory', outcome: 'not_sent', reason: 'rejected_by_provider', error: 'Invalid to', sent_at: '', delivered_at: '' }] };
    case 'list_templates': return { templates: [] };
    default: return {};
  }
}
export const base44 = {
  functions: {
    invoke: async (_name, payload) => { window.__calls.push(payload); return { data: respond(payload.action, payload) }; },
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : {};
      window.__calls.push({ url, body });
      if (body.mode === 'inspect') return new Response(JSON.stringify({ ok: true, inspect: true, email: 'office@lensa.ro', scope: 'marketing' }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, scope: body.scope === 'all' ? 'all' : 'marketing' }), { status: 200 });
    },
  },
  entities: {},
  auth: { me: async () => ({ role: 'admin' }) },
};
