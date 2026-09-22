import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeEmail, verifyUnsubscribeToken } from '../../shared/outreachEmailPolicy.js';
import { normalizeCategory, mergeSuppressionCategories } from '../../shared/outreachAudiencePolicy.js';

// outreachUnsubscribeOps — dezabonare cu un click, portat din Optilun (outreachUnsubscribe/entry.ts),
// adaptat la modelul de rute al VIASEE: apelat direct de router.ts pe baza query string-ului
// `?outreach_action=unsubscribe`, INAINTE de parsarea normala __function/payload — nu apare
// niciodata in DIRECTORY_FUNCTION_ROUTES si nu poate fi atins prin `__function`. Fara auth Base44:
// securitatea vine exclusiv din tokenul semnat HMAC (vezi createUnsubscribeToken/verifyUnsubscribeToken
// in outreachEmailPolicy.js). Spre deosebire de Optilun, NU acceptam un fallback "legacy" fara
// semnatura (email+campaign_id in clar) — VIASEE nu are linkuri vechi de migrat, iar a accepta
// dezabonare pe baza unui email trimis in clar ar permite oricui sa dezaboneze adresa altcuiva.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, List-Unsubscribe, List-Unsubscribe-Post',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders() });
}

// Dezabonarea e pe categorii: linkul dintr-un email de prezentare scoate adresa doar din
// prezentari, cel dintr-un anunt doar din anunturi. Pagina ofera apoi si "de la tot" (scope=all).
// Campania se afla din token; un token fara campanie cunoscuta dezaboneaza de la tot.
async function scopeForCampaign(svc, campaignId) {
  const id = String(campaignId || '').replace(/^test:/, '');
  if (!id) return 'all';
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  return campaign ? normalizeCategory(campaign.category) : 'all';
}

async function upsertSuppression(svc, email, source, campaignId, scope) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const now = new Date().toISOString();
  const existing = await svc.entities.OutreachSuppression.filter({ normalized_email: normalized }).catch(() => []);
  const previous = existing?.[0] || null;
  const payload = {
    email: normalized,
    normalized_email: normalized,
    // O respingere sau o reclamatie anterioara ramane motivul principal al suprimarii.
    status: ['bounced', 'complained'].includes(previous?.status) ? previous.status : 'unsubscribed',
    categories: mergeSuppressionCategories(previous, [scope]),
    reason: source,
    source,
    campaign_id: campaignId || '',
    provider: 'resend',
    is_active: true,
    updated_at: now,
  };
  if (existing?.[0]?.id) {
    await svc.entities.OutreachSuppression.update(existing[0].id, payload).catch((error) => {
      console.error('outreachUnsubscribeOps suppression update failed', normalized, error?.message || error);
    });
    return;
  }
  await svc.entities.OutreachSuppression.create({ ...payload, created_at: now }).catch((error) => {
    console.error('outreachUnsubscribeOps suppression create failed', normalized, error?.message || error);
  });
}

async function markContactsUnsubscribed(svc, email, campaignId, source, scope) {
  const now = new Date().toISOString();
  let contacts = await svc.entities.OutreachContact.filter({ normalized_email: email }).catch(() => []);
  if (!contacts?.length) contacts = await svc.entities.OutreachContact.filter({ email }).catch(() => []);

  for (const contact of contacts || []) {
    const audit = [
      ...(Array.isArray(contact.consent_audit) ? contact.consent_audit : []),
      { action: 'unsubscribed', scope, source, at: now, campaign_id: campaignId || null },
    ].slice(-25);
    // De la tot: ca pana acum, adresa iese din orice campanie. Dintr-o categorie: ramane activa
    // pentru celelalte.
    const patch = scope === 'all'
      ? { email_status: 'unsubscribed', status: 'unsubscribed' }
      : { unsubscribed_categories: [...new Set([...(Array.isArray(contact.unsubscribed_categories) ? contact.unsubscribed_categories : []), scope])] };
    await svc.entities.OutreachContact.update(contact.id, {
      ...patch,
      normalized_email: email,
      unsubscribe_reason: source,
      last_status_change_at: now,
      consent_audit: audit,
    }).catch((error) => console.error('outreachUnsubscribeOps contact update failed', contact.id, error?.message || error));
  }

  const logs = campaignId
    ? await svc.entities.OutreachCampaignLog.filter({ campaign_id: campaignId }).catch(() => [])
    : [];
  const matchingLogs = (logs || []).filter((log) => normalizeEmail(log.normalized_email || log.email) === email);
  for (const log of matchingLogs) {
    await svc.entities.OutreachCampaignLog.update(log.id, {
      status: 'unsubscribed',
      reason: source,
      unsubscribed_at: now,
    }).catch(() => null);
  }
  if (!matchingLogs.length) {
    await svc.entities.OutreachCampaignLog.create({
      campaign_id: campaignId || 'global_unsubscribe',
      email,
      normalized_email: email,
      status: 'unsubscribed',
      reason: source,
      provider: 'resend',
      unsubscribed_at: now,
      created_at: now,
    }).catch(() => null);
  }

  await upsertSuppression(svc, email, source, campaignId, scope);

  return { contacts_updated: contacts?.length || 0 };
}

export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const url = new URL(req.url);

    let body = {};
    if (req.method === 'POST') {
      const text = await req.text().catch(() => '');
      if (text) {
        try { body = JSON.parse(text); }
        catch (_e) { body = Object.fromEntries(new URLSearchParams(text)); }
      }
    }

    const token = url.searchParams.get('t') || body.token || body.t || '';
    if (!token) return json({ error: 'Link de dezabonare invalid: lipseste tokenul.' }, 400);

    const oneClick = req.method === 'POST' || req.headers.get('List-Unsubscribe-Post') === 'List-Unsubscribe=One-Click';
    const verified = await verifyUnsubscribeToken(token);
    const email = verified.email;
    const campaignId = verified.campaign_id || '';
    const source = oneClick ? 'one_click_signed_token' : 'signed_unsubscribe_link';
    const scope = body.scope === 'all' ? 'all' : await scopeForCampaign(svc, campaignId);

    const result = await markContactsUnsubscribed(svc, email, campaignId, source, scope);
    return json({ ok: true, email, campaign_id: campaignId || null, scope, ...result });
  } catch (error) {
    console.error('outreachUnsubscribeOps failed', error?.message || error);
    return json({ error: error?.message || 'Dezabonarea a esuat' }, 400);
  }
}
