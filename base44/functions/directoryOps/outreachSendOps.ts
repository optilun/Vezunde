import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeEmail,
  isValidEmail,
  isContactSuppressed,
  validateSenderEmail,
  buildUnsubscribeUrls,
  buildEmailHtml,
  buildPlainText,
  renderTemplateMergeFields,
  textToHtml,
  sendBatchViaResend,
  sendViaResend,
  legalConfig,
} from '../../shared/outreachEmailPolicy.js';

// outreachSendOps — trimiterea efectiva a campaniilor de outreach, in loturi mici, apelata de
// pe cron (`Outreach Campaign Scheduler`, la 5 minute) exact ca `directoryAutoImportOps` /
// `advance_auto_import_runs`: un singur pas per invocare, lock + heartbeat, reluare sigura.
// Spre deosebire de sendOutreachCampaign din Optilun (o bucla sincrona intr-un singur apel HTTP,
// plafonata la 500 destinatari), aici fiecare invocare trimite cel mult
// MAX_BATCHES_PER_RUN * BATCH_SIZE emailuri si isi actualizeaza cursorul, ca sa nu depinda de
// cate destinatari are o campanie.

const LOCK_MINUTES = 4;
const BATCH_SIZE = 25; // Resend Batch API accepta pana la 100; pornim conservator
const MAX_BATCHES_PER_RUN = 4; // cel mult 100 destinatari per invocare cron

const TERMINAL_LOG_STATUSES = new Set(['sent', 'delivered', 'bounced', 'complained', 'failed', 'invalid', 'skipped', 'duplicate']);

function clean(value) {
  return String(value ?? '').trim();
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: Response.json({ error: 'Autentificare necesara' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: Response.json({ error: 'Acces permis doar administratorilor VIASEE' }, { status: 403 }) };
  return { user, svc: base44.asServiceRole };
}

async function getSuppressionSet(svc) {
  const rows = await svc.entities.OutreachSuppression.list('-updated_at', 20000).catch(() => []);
  const set = new Set();
  for (const row of rows || []) {
    const email = normalizeEmail(row.normalized_email || row.email);
    if (email && row.is_active !== false) set.add(email);
  }
  return set;
}

async function getAlreadyProcessedContactIds(svc, campaignId) {
  const logs = await svc.entities.OutreachCampaignLog.filter({ campaign_id: campaignId }, '-created_date', 20000).catch(() => []);
  const set = new Set();
  for (const log of logs || []) {
    if (log.contact_id && TERMINAL_LOG_STATUSES.has(log.status)) set.add(log.contact_id);
  }
  return set;
}

async function safeCampaignLog(svc, data) {
  try {
    return await svc.entities.OutreachCampaignLog.create({ provider: 'resend', created_at: new Date().toISOString(), ...data });
  } catch (error) {
    console.error('outreachSendOps log create failed', error?.message || error);
    return null;
  }
}

async function claimCampaignForSending(svc) {
  // O singura campanie "ready" sau "sending" cu lock expirat/lipsa e preluata per invocare.
  const candidates = await svc.entities.OutreachCampaign.filter({ status: 'ready' }, 'created_date', 10).catch(() => []);
  const sendingStuck = await svc.entities.OutreachCampaign.filter({ status: 'sending' }, 'created_date', 10).catch(() => []);
  const pool = [...(candidates || []), ...(sendingStuck || [])];
  const nowMs = Date.now();
  for (const campaign of pool) {
    const lockExpired = !campaign.execution_lock_expires_at || new Date(campaign.execution_lock_expires_at).getTime() < nowMs;
    if (campaign.execution_lock_token && !lockExpired) continue; // blocata de alta invocare inca activa
    const token = crypto.randomUUID();
    const expiresAt = new Date(nowMs + LOCK_MINUTES * 60 * 1000).toISOString();
    const claimed = await svc.entities.OutreachCampaign.update(campaign.id, {
      execution_lock_token: token,
      execution_lock_expires_at: expiresAt,
      last_heartbeat_at: new Date().toISOString(),
      status: 'sending',
    });
    return claimed;
  }
  return null;
}

async function releaseLock(svc, campaignId, patch = {}) {
  await svc.entities.OutreachCampaign.update(campaignId, {
    execution_lock_token: '',
    execution_lock_expires_at: null,
    last_heartbeat_at: new Date().toISOString(),
    ...patch,
  }).catch((error) => console.error('outreachSendOps releaseLock failed', campaignId, error?.message || error));
}

async function advanceOneCampaign(svc, campaign, resendApiKey) {
  const sender = validateSenderEmail(campaign.from_email);
  if (!sender.ok) {
    await releaseLock(svc, campaign.id, { status: 'failed', failure_message: sender.error });
    return { campaign_id: campaign.id, error: sender.error };
  }
  if (!resendApiKey) {
    await releaseLock(svc, campaign.id, { status: 'failed', failure_message: 'RESEND_API_KEY nu este configurat.' });
    return { campaign_id: campaign.id, error: 'RESEND_API_KEY nu este configurat.' };
  }

  const ids = Array.isArray(campaign.recipient_contact_ids) ? campaign.recipient_contact_ids : [];
  const alreadyProcessed = await getAlreadyProcessedContactIds(svc, campaign.id);
  const suppressionSet = await getSuppressionSet(svc);

  let cursor = Number(campaign.current_cursor) || 0;
  let sentThisRun = 0;
  let failedThisRun = 0;
  let skippedThisRun = 0;

  for (let batchNum = 0; batchNum < MAX_BATCHES_PER_RUN && cursor < ids.length; batchNum += 1) {
    const batchIds = ids.slice(cursor, cursor + BATCH_SIZE);
    const payloads = [];
    const meta = [];

    for (const contactId of batchIds) {
      if (alreadyProcessed.has(contactId)) continue; // idempotenta: deja procesat intr-o rulare anterioara
      const contact = await svc.entities.OutreachContact.get(contactId).catch(() => null);
      if (!contact) { skippedThisRun += 1; continue; }
      const email = normalizeEmail(contact.normalized_email || contact.email);

      if (!email || !isValidEmail(email)) {
        await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email: contact.email || 'unknown', normalized_email: email, status: 'invalid', reason: 'invalid_email' });
        skippedThisRun += 1;
        continue;
      }
      if (isContactSuppressed(contact) || suppressionSet.has(email)) {
        await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email, status: 'skipped', reason: 'suppressed_at_send_time' });
        skippedThisRun += 1;
        continue;
      }

      const unsub = await buildUnsubscribeUrls(email, campaign.id);
      const unsubHtml = `<a href="${unsub.publicUrl}" style="color:#6b6b6b;text-decoration:underline;">Dezaboneaza-te</a>`;
      let bodyHtml = textToHtml(campaign.body_html || '');
      bodyHtml = renderTemplateMergeFields(bodyHtml, contact).replace(/\[UNSUBSCRIBE_LINK\]/g, unsubHtml);
      const finalHtml = buildEmailHtml(bodyHtml, unsubHtml, campaign.subject || 'VIASEE');

      payloads.push({
        from: `${campaign.from_name || 'VIASEE'} <${sender.email}>`,
        to: [email],
        reply_to: [campaign.reply_to_email || legalConfig().contactEmail],
        subject: campaign.subject,
        html: finalHtml,
        text: buildPlainText(bodyHtml, unsub.publicUrl),
        headers: {
          'List-Unsubscribe': `<${unsub.oneClickUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      meta.push({ contact, email });
    }

    if (payloads.length) {
      const result = await sendBatchViaResend(resendApiKey, payloads);
      if (result.ok) {
        for (let i = 0; i < meta.length; i += 1) {
          const { contact, email } = meta[i];
          const messageId = result.results?.[i]?.id || '';
          await safeCampaignLog(svc, {
            campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email,
            status: 'sent', resend_message_id: messageId, sent_at: new Date().toISOString(),
          });
          if (contact.status !== 'converted') {
            await svc.entities.OutreachContact.update(contact.id, {
              status: contact.status === 'new' ? 'contacted' : contact.status,
              last_contacted_at: new Date().toISOString(),
              last_status_change_at: new Date().toISOString(),
            }).catch(() => null);
          }
          sentThisRun += 1;
        }
      } else {
        const errorText = result.json?.message || result.text || 'Eroare Resend la trimiterea lotului';
        for (const { contact, email } of meta) {
          await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email, status: 'failed', error: errorText });
          failedThisRun += 1;
        }
      }
    }

    cursor += batchIds.length;
    await svc.entities.OutreachCampaign.update(campaign.id, {
      current_cursor: cursor,
      sent_count: (campaign.sent_count || 0) + sentThisRun,
      failed_count: (campaign.failed_count || 0) + failedThisRun,
      skipped_count: (campaign.skipped_count || 0) + skippedThisRun,
      last_heartbeat_at: new Date().toISOString(),
      execution_lock_expires_at: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString(),
    }).catch((error) => console.error('outreachSendOps progress update failed', campaign.id, error?.message || error));
  }

  const finished = cursor >= ids.length;
  await releaseLock(svc, campaign.id, {
    status: finished ? 'sent' : 'sending',
    sent_at: finished ? new Date().toISOString() : (campaign.sent_at || null),
  });

  return { campaign_id: campaign.id, sent: sentThisRun, failed: failedThisRun, skipped: skippedThisRun, finished };
}

async function actionAdvanceCampaignSends(svc) {
  const campaign = await claimCampaignForSending(svc);
  if (!campaign) return Response.json({ success: true, processed: false, message: 'Nicio campanie in stare ready/sending de avansat.' });
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  const outcome = await advanceOneCampaign(svc, campaign, resendApiKey);
  return Response.json({ success: true, processed: true, outcome });
}

async function actionSendTestEmail(svc, payload) {
  const campaignId = clean(payload.campaign_id);
  const toEmail = normalizeEmail(payload.to_email);
  if (!campaignId || !toEmail || !isValidEmail(toEmail)) {
    return Response.json({ error: 'campaign_id si un to_email valid sunt obligatorii' }, { status: 400 });
  }
  const campaign = await svc.entities.OutreachCampaign.get(campaignId).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  const sender = validateSenderEmail(campaign.from_email);
  if (!sender.ok) return Response.json({ error: sender.error }, { status: 400 });
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  if (!resendApiKey) return Response.json({ error: 'RESEND_API_KEY nu este configurat' }, { status: 500 });

  const unsub = await buildUnsubscribeUrls(toEmail, `test:${campaignId}`);
  const unsubHtml = `<a href="${unsub.publicUrl}" style="color:#6b6b6b;text-decoration:underline;">Dezaboneaza-te</a>`;
  let bodyHtml = textToHtml(campaign.body_html || '');
  bodyHtml = renderTemplateMergeFields(bodyHtml, { company_name: 'Firma Test', city: 'Bucuresti', county: 'Bucuresti' }).replace(/\[UNSUBSCRIBE_LINK\]/g, unsubHtml);
  const finalHtml = buildEmailHtml(bodyHtml, unsubHtml, `[TEST] ${campaign.subject || 'VIASEE'}`);

  const result = await sendViaResend(resendApiKey, {
    from: `${campaign.from_name || 'VIASEE'} <${sender.email}>`,
    to: [toEmail],
    reply_to: [campaign.reply_to_email || legalConfig().contactEmail],
    subject: `[TEST] ${campaign.subject || 'VIASEE'}`,
    html: finalHtml,
    text: buildPlainText(bodyHtml, unsub.publicUrl),
  });

  if (!result.ok) return Response.json({ error: result.json?.message || result.text || 'Eroare Resend' }, { status: 500 });
  return Response.json({ success: true, resend_message_id: result.json?.id || '' });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const input = await req.clone().json().catch(() => ({}));
    const action = clean(input.action);

    if (action === 'advance_campaign_sends' && input.__automation_trigger === true) {
      return await actionAdvanceCampaignSends(base44.asServiceRole);
    }

    const auth = await requireAdmin(base44);
    if (auth.error) return auth.error;
    const { svc } = auth;

    switch (action) {
      case 'advance_campaign_sends': return await actionAdvanceCampaignSends(svc);
      case 'send_test_email': return await actionSendTestEmail(svc, input);
      default:
        return Response.json({ error: `Actiune necunoscuta: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('outreachSendOps failed', error?.message || error);
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
