const now = new Date().toISOString();
const rows = [
  { id: 'c1', company_name: 'Lensa', email: 'office@lensa.ro', city: 'Bucuresti', county: 'Bucuresti', provider_type: 'optica_medicala', kind: 'directory', email_scope: 'organization', shared_location_count: 79, added_manually: false, excluded: false, reason: '' },
  { id: 'c2', company_name: 'Optica Cont', contact_name: 'Ana Pop', email: 'owner@cont.ro', city: 'Iasi', county: 'Iasi', provider_type: 'optica_medicala', kind: 'provider_account', email_scope: 'organization', shared_location_count: 1, added_manually: false, excluded: false, reason: '' },
  { id: 'c3', company_name: 'Clinica Vitreum', email: 'contact@vitreum.ro', city: 'Baia Mare', county: 'Maramures', provider_type: 'clinica_oftalmologica', kind: 'directory', email_scope: 'organization', shared_location_count: 19, added_manually: false, excluded: true, reason: '' },
  { id: 'c4', company_name: 'Retina Center', email: 'contact@retinacenter.ro', city: 'Cluj-Napoca', county: 'Cluj', provider_type: 'clinica_oftalmologica', kind: 'directory', email_scope: 'location', shared_location_count: 1, added_manually: false, excluded: false, reason: 'undeliverable_domain' },
  { id: 'c5', company_name: 'Optica Malaga', email: 'office@opticamalaga.ro', city: 'Timisoara', county: 'Timis', provider_type: 'optica_medicala', kind: 'directory', email_scope: 'location', shared_location_count: 1, added_manually: true, excluded: false, reason: '' },
];
const campaigns = [
  { id: 'k1', name: 'Revendicare, adrese de organizatie', category: 'marketing', status: 'draft', recipient_count: 86, sent_count: 0, delivered_count: 0, bounced_count: 0, created_date: now, subject: 'Locatiile dumneavoastra din directorul VIASEE', body_html: 'Buna ziua,\n\nVIASEE este directorul national... [FIRMA] apare deja in rezultate cu [LOCATII] din [ORASE].', cta_label: 'Revendica locatiile', cta_url: 'https://viasee.ro/adauga-sau-revendica', show_listing_preview: true, audience_sources: ['directory'], target_email_scope: ['organization'], excluded_contact_ids: ['c3'], included_contact_ids: ['c5'], from_email: 'contact@mail.viasee.ro', reply_to_email: 'contact@viasee.ro', daily_send_limit: 50, daily_send_ramp: true, template_id: 't1' },
  { id: 'k2', name: 'Anunt functii noi, octombrie', category: 'announcement', status: 'sending', recipient_count: 120, sent_count: 50, delivered_count: 46, bounced_count: 1, created_date: now, current_cursor: 52, next_send_after: new Date(Date.now() + 36e5 * 14).toISOString(), subject: 'Noutati VIASEE', daily_send_limit: 50, daily_send_ramp: true },
];
const templates = [
  { id: 't1', name: 'Prezentare VIASEE + revendicare — adrese de organizatie', category: 'marketing', subject: 'Locatiile dumneavoastra din directorul VIASEE', body: 'x', cta_label: 'Revendica locatiile' },
  { id: 't2', name: 'Prezentare VIASEE + revendicare — adrese de locatie', category: 'marketing', subject: 'Profilul dumneavoastra din directorul VIASEE', body: 'x' },
  { id: 't3', name: 'Functii noi', category: 'announcement', subject: 'Noutati VIASEE', body: 'x' },
];
const reportRows = [
  { id: 'l1', email: 'owner@cont.ro', company_name: 'Optica Cont', city: 'Iasi', kind: 'provider_account', outcome: 'delivered', reason: '', error: '', sent_at: now, delivered_at: now },
  { id: 'l2', email: 'office@lensa.ro', company_name: 'Lensa', city: 'Bucuresti', kind: 'directory', outcome: 'awaiting', reason: '', error: '', sent_at: now, delivered_at: '' },
  { id: 'l3', email: 'a@optica-a.ro', company_name: 'Optica A', city: 'Cluj-Napoca', kind: 'directory', outcome: 'bounced', reason: '', error: 'Mailbox does not exist', sent_at: now, delivered_at: '' },
  { id: 'l4', email: 'contact@retinacenter.ro', company_name: 'Retina Center', city: 'Cluj-Napoca', kind: 'directory', outcome: 'not_sent', reason: 'undeliverable_domain', error: 'Domeniul adresei nu mai exista.', sent_at: '', delivered_at: '' },
  { id: 'queued:c9', email: 'office@medicaloptic.ro', company_name: 'Medical Optic', city: 'Bacau', kind: 'directory', outcome: 'queued', reason: '', error: '', sent_at: '', delivered_at: '' },
];
function respond(action, payload) {
  switch (action) {
    case 'list_campaigns': return { campaigns };
    case 'outreach_overview': return { by_category: { marketing: { campaigns: 1, active: 0, sent: 0, delivered: 0, bounced: 0 }, announcement: { campaigns: 1, active: 1, sent: 50, delivered: 46, bounced: 1 } }, contacts: { directory: 593, provider_account: 1 }, suppressed: { marketing: 2, announcement: 0, all: 11 } };
    case 'list_templates': return { templates };
    case 'get_campaign': { const c = campaigns.find((x) => x.id === payload.id); return { campaign: c, logs: [], send_stats: c.status === 'draft' ? null : { sent_today: 50, prior_sending_days: 0, daily_limit_today: 50 } }; }
    case 'list_recipients': return { category: 'marketing', counts: { candidates: 5, eligible: 3, excluded: 1, added_manually: 1, blocked: { undeliverable_domain: 1 } }, rows, facets: { counties: ['Bucuresti', 'Cluj', 'Iasi', 'Maramures', 'Timis'], provider_types: ['optica_medicala', 'clinica_oftalmologica'], sources: { directory: 593, provider_account: 1 } } };
    case 'search_contacts': return { contacts: [{ id: 'c7', company_name: 'Optica Iris', email: 'iris@iris.ro', city: 'Arad', kind: 'directory' }] };
    case 'render_preview': return { subject: payload.subject || 'Subiect', html: '<html><body style="font-family:sans-serif;background:#f8f4ec;padding:30px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;padding:32px"><h1>' + (payload.subject || '') + '</h1><p>Previzualizare email pentru Lensa.</p></div></body></html>', recipient: { company_name: 'Lensa', email: 'office@lensa.ro', kind: 'directory' } };
    case 'campaign_report': return { campaign: { id: 'k2', name: 'Anunt', category: 'announcement' }, summary: { counts: { recipients: 120, sent: 50, delivered: 46, awaiting: 3, bounced: 1, complained: 0, failed: 0, unsubscribed: 2, replied: 1, not_sent: 2, pending_send: 68 }, rates: { delivered: 92, bounced: 2, complained: 0, unsubscribed: 4, replied: 2 }, not_sent_by_reason: { undeliverable_domain: 1, suppressed: 1 } }, rows: reportRows };
    case 'approve_campaign': return { expected_confirmation: 'TRIMITE Revendicare, adrese de organizatie 86', recipient_count: 86, error: 'confirmation_text este obligatoriu' };
    default: return {};
  }
}
export const base44 = {
  functions: {
    invoke: async (_name, payload) => ({ data: respond(payload.action, payload) }),
    fetch: async () => new Response('{}'),
  },
  entities: { OutreachContact: { list: async () => [] } },
};
