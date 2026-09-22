import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeEmail,
  isValidEmail,
  isContactSuppressed,
  isPermanentEmailError,
  complianceMissing,
  validateSenderEmail,
  buildUnsubscribeUrls,
  buildListUnsubscribeHeaders,
  buildEmailHtml,
  buildPlainText,
  renderTemplateMergeFields,
  textToHtml,
  sendBatchViaResend,
  sendViaResend,
  legalConfig,
} from '../../shared/outreachEmailPolicy.js';
import {
  summarizeSendsByDay,
  effectiveDailyLimit,
  nextSendResumeAt,
  evaluateCampaignHealth,
  healthPausePatch,
  autoPauseAuditRecord,
  emailDomain,
  lookupEmailDomains,
  isDomainUndeliverable,
  domainStatusMessage,
  DOMAIN_STATUSES,
} from '../../shared/outreachSendSafety.js';
import {
  buildSuppressionMap,
  isSuppressedFor,
  normalizeCategory,
  contactKind,
} from '../../shared/outreachAudiencePolicy.js';
import { composeOutreachEmail } from '../../shared/outreachComposer.js';

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
// Dupa atatea loturi consecutive esuate tranzitoriu campania trece in 'failed' in loc sa
// reincerce la infinit la fiecare 5 minute (la cron de 5 min inseamna ~25 de minute de retry).
const MAX_CONSECUTIVE_SEND_FAILURES = 5;

const TERMINAL_LOG_STATUSES = new Set(['sent', 'delivered', 'bounced', 'complained', 'failed', 'invalid', 'skipped', 'duplicate']);
// Stari in care admin-ul a oprit explicit campania: o rulare in curs nu are voie sa le suprascrie
// inapoi in 'sending' la eliberarea lock-ului, altfel butonul Pauza/Anuleaza nu ar opri nimic.
const ADMIN_STOP_STATUSES = new Set(['paused', 'cancelled', 'failed']);

// Esec de lot tranzitoriu (rate limit, indisponibilitate, retea) vs. permanent (cheie gresita,
// domeniu neverificat, payload invalid). Tranzitoriu => nu avansam cursorul, reincercam la
// urmatorul ciclu de cron. Permanent => oprim campania cu mesaj, tot fara sa avansam cursorul,
// ca dupa remediere aceiasi destinatari sa fie reluati, nu sariti definitiv.
function isTransientBatchFailure(result) {
  if (!result) return true; // exceptie de retea/timeout: tratata ca tranzitorie
  const status = Number(result.status) || 0;
  if (status === 429 || status >= 500 || status === 0) return true;
  const text = `${result.json?.message || ''} ${result.text || ''}`;
  return !isPermanentEmailError(status, text);
}

function clean(value) {
  return String(value ?? '').trim();
}

// Eticheta din fisa afisata in email. Un profil deja revendicat nu trebuie sa primeasca un email
// care ii spune ca e nerevendicat.
function listingChipFor(controlStatus) {
  if (controlStatus === 'claimed') return 'Profil revendicat';
  if (controlStatus === 'verified') return 'Profil verificat';
  return 'Profil nerevendicat';
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: Response.json({ error: 'Autentificare necesara' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: Response.json({ error: 'Acces permis doar administratorilor VIASEE' }, { status: 403 }) };
  return { user, svc: base44.asServiceRole };
}

// Adresa -> categoriile blocate ('all' sau marketing / announcement). O dezabonare de la
// prezentari nu opreste anunturile; o respingere sau o reclamatie opreste tot.
async function getSuppressionMap(svc) {
  const rows = await svc.entities.OutreachSuppression.list('-updated_at', 20000).catch(() => []);
  return buildSuppressionMap(rows || []);
}

// Idempotenta rularilor: ce a fost deja procesat intr-un ciclu anterior nu se mai trimite o data.
// Intoarce si adresele deja atinse in aceasta campanie, nu doar id-urile de contact: doua
// OutreachContact diferite (doua locatii ale aceleiasi firme) pot avea aceeasi adresa publica, iar
// aceeasi persoana nu trebuie sa primeasca aceeasi campanie de doua ori.
// Din acelasi jurnal iese si cat s-a trimis azi (limita zilnica): nicio citire in plus.
async function getAlreadyProcessedContactIds(svc, campaignId) {
  const logs = await svc.entities.OutreachCampaignLog.filter({ campaign_id: campaignId }, '-created_date', 20000).catch(() => []);
  const contactIds = new Set();
  const emails = new Set();
  for (const log of logs || []) {
    if (!TERMINAL_LOG_STATUSES.has(log.status)) continue;
    if (log.contact_id) contactIds.add(log.contact_id);
    const email = normalizeEmail(log.normalized_email || log.email);
    if (email) emails.add(email);
  }
  return { contactIds, emails, sends: summarizeSendsByDay(logs || []) };
}

// Oprirea automata: campania trece pe pauza cu motivul scris pentru admin, iar actiunea ramane
// in auditul campaniei.
async function pauseForHealth(svc, campaignId, health, extraPatch = {}) {
  await releaseLock(svc, campaignId, { ...extraPatch, ...healthPausePatch(health) });
  await svc.entities.DirectoryAuditRecord.create(autoPauseAuditRecord(campaignId, health, 'trimitere'))
    .catch((error) => console.error('outreachSendOps auto-pause audit failed', campaignId, error?.message || error));
}

// Rezultatul verificarii domeniului se pastreaza pe contact (vizibil in lista de contacte) doar
// cand s-a schimbat; 'lookup_failed' nu spune nimic despre domeniu si nu se scrie.
async function rememberDomainStatus(svc, contact, status) {
  if (!DOMAIN_STATUSES.includes(status) || contact.email_domain_status === status) return;
  await svc.entities.OutreachContact.update(contact.id, {
    email_domain_status: status,
    email_domain_checked_at: new Date().toISOString(),
  }).catch(() => null);
}

async function safeCampaignLog(svc, data) {
  try {
    return await svc.entities.OutreachCampaignLog.create({ provider: 'resend', created_at: new Date().toISOString(), ...data });
  } catch (error) {
    console.error('outreachSendOps log create failed', error?.message || error);
    return null;
  }
}

function isWaitingForNextDay(campaign, nowMs = Date.now()) {
  const resumeAt = campaign?.next_send_after ? new Date(campaign.next_send_after).getTime() : 0;
  return Number.isFinite(resumeAt) && resumeAt > nowMs;
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
    // Limita zilei atinsa: campania asteapta ziua urmatoare si NU ocupa ciclul de cron, ca alta
    // campanie aflata in trimitere sa poata avansa intre timp.
    if (isWaitingForNextDay(campaign, nowMs)) continue;
    // Starea se re-citeste imediat inainte de preluare: lista de candidati poate fi veche de cateva
    // sute de milisecunde, iar o campanie pusa intre timp pe pauza nu trebuie repornita de noi.
    const fresh = await svc.entities.OutreachCampaign.get(campaign.id).catch(() => null);
    if (!fresh || !['ready', 'sending'].includes(fresh.status)) continue;
    if (isWaitingForNextDay(fresh, nowMs)) continue;
    const token = crypto.randomUUID();
    const expiresAt = new Date(nowMs + LOCK_MINUTES * 60 * 1000).toISOString();
    await svc.entities.OutreachCampaign.update(campaign.id, {
      execution_lock_token: token,
      execution_lock_expires_at: expiresAt,
      last_heartbeat_at: new Date().toISOString(),
      status: 'sending',
    });
    // Re-citire de confirmare: Base44 nu are update conditionat, deci doua invocari de cron
    // suprapuse pot scrie amandoua un lock. Castiga cea al carei token se regaseste la re-citire;
    // cealalta renunta, ca sa nu trimita doua rulari in paralel din aceeasi campanie.
    const claimed = await svc.entities.OutreachCampaign.get(campaign.id).catch(() => null);
    if (!claimed || claimed.execution_lock_token !== token) continue;
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

// Eliberarea lock-ului la finalul unei rulari re-citeste starea din baza inainte sa scrie statusul:
// daca admin-ul a apasat Pauza / Anuleaza in timp ce lotul era in aer, starea lui trebuie sa ramana,
// altfel rularea ar readuce campania in 'sending' si urmatorul ciclu de cron ar continua trimiterea.
async function releaseLockPreservingAdminStop(svc, campaignId, { finished, previousSentAt, patch = {} }) {
  const current = await svc.entities.OutreachCampaign.get(campaignId).catch(() => null);
  if (current && ADMIN_STOP_STATUSES.has(current.status)) {
    // Motivul opririi (scris de admin sau de oprirea automata din webhook in timpul lotului)
    // trebuie sa ramana vizibil: nu il stergem odata cu eliberarea lock-ului.
    const { failure_message: _keepStopReason, ...rest } = patch;
    await releaseLock(svc, campaignId, rest);
    return current.status;
  }
  const status = finished ? 'sent' : 'sending';
  await releaseLock(svc, campaignId, {
    ...patch,
    status,
    sent_at: finished ? new Date().toISOString() : (previousSentAt || null),
  });
  return status;
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
  if (!ids.length) {
    // Fara lista inghetata de destinatari cursorul n-are in ce sa indexeze, iar conditia de final
    // (cursor >= ids.length) ar fi adevarata din start: campania s-ar marca 'sent' fara sa fi
    // trimis niciun email. Oprim explicit, cu mesaj, in loc sa raportam un succes fals.
    const message = 'Campania nu are lista de destinatari (recipient_contact_ids). Reaproba campania pentru a regenera lista.';
    await releaseLock(svc, campaign.id, { status: 'failed', failure_message: message });
    return { campaign_id: campaign.id, error: message };
  }

  // Oprirea automata se verifica inainte de orice trimitere: respingerile si reclamatiile vin prin
  // webhook intre doua cicluri de cron, iar webhook-ul poate sa nu fi apucat sa opreasca el campania.
  const initialHealth = evaluateCampaignHealth(campaign);
  if (!initialHealth.healthy) {
    await pauseForHealth(svc, campaign.id, initialHealth);
    return { campaign_id: campaign.id, sent: 0, skipped: 0, finished: false, auto_paused: initialHealth.reason };
  }

  const processed = await getAlreadyProcessedContactIds(svc, campaign.id);
  const alreadyProcessed = processed.contactIds;
  const seenEmails = new Set(processed.emails);
  const suppressionMap = await getSuppressionMap(svc);
  const category = normalizeCategory(campaign.category);

  // Limita zilnica: cat mai are voie campania sa trimita azi (ora Romaniei).
  const dailyLimit = effectiveDailyLimit(campaign, processed.sends.priorSendingDays);
  let remainingToday = dailyLimit - processed.sends.sentToday;
  // Un domeniu se verifica o singura data per rulare (gmail.com apare de zeci de ori).
  const domainCache = new Map();

  let cursor = Number(campaign.current_cursor) || 0;
  let sentThisRun = 0;
  let skippedThisRun = 0;
  let stoppedByAdmin = '';
  let batchFailure = null;
  let healthStop = null;

  for (let batchNum = 0; batchNum < MAX_BATCHES_PER_RUN && cursor < ids.length && remainingToday > 0; batchNum += 1) {
    if (batchNum > 0) {
      // Pauza/anularea data de admin trebuie sa opreasca campania in maximum un lot, nu abia la
      // finalul rularii: re-citim starea inainte de fiecare lot urmator.
      const live = await svc.entities.OutreachCampaign.get(campaign.id).catch(() => null);
      if (live && ADMIN_STOP_STATUSES.has(live.status)) { stoppedByAdmin = live.status; break; }
      // Si respingerile venite intre timp prin webhook: nu mai trimitem inca un lot peste prag.
      const liveHealth = live ? evaluateCampaignHealth(live) : null;
      if (liveHealth && !liveHealth.healthy) { healthStop = liveHealth; break; }
    }
    const batchIds = ids.slice(cursor, cursor + Math.min(BATCH_SIZE, remainingToday));
    const payloads = [];
    const meta = [];

    const batchContacts = [];
    for (const contactId of batchIds) {
      if (alreadyProcessed.has(contactId)) continue; // idempotenta: deja procesat intr-o rulare anterioara
      const contact = await svc.entities.OutreachContact.get(contactId).catch(() => null);
      if (!contact) { skippedThisRun += 1; continue; }
      batchContacts.push(contact);
    }
    await lookupEmailDomains(
      batchContacts.map((contact) => emailDomain(normalizeEmail(contact.normalized_email || contact.email))),
      { cache: domainCache },
    );

    for (const contact of batchContacts) {
      const email = normalizeEmail(contact.normalized_email || contact.email);

      if (!email || !isValidEmail(email)) {
        await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email: contact.email || 'unknown', normalized_email: email, status: 'invalid', reason: 'invalid_email' });
        skippedThisRun += 1;
        continue;
      }
      if (isContactSuppressed(contact) || isSuppressedFor(suppressionMap, email, category)) {
        await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email, status: 'skipped', reason: 'suppressed_at_send_time' });
        skippedThisRun += 1;
        continue;
      }
      if ((Array.isArray(contact.unsubscribed_categories) && contact.unsubscribed_categories.includes(category))
        || (contactKind(contact) === 'provider_account' && contact.account_active === false)) {
        // Dezabonat doar din categoria acestei campanii, sau un cont de furnizor inchis intre
        // aprobare si trimitere.
        const reason = contact.account_active === false ? 'inactive_account' : 'unsubscribed_category';
        await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email, status: 'skipped', reason });
        skippedThisRun += 1;
        continue;
      }
      if (seenEmails.has(email)) {
        // Aceeasi adresa publica poate aparea pe mai multe locatii ale aceleiasi firme. Un singur
        // email per adresa si per campanie: altfel acelasi destinatar ar primi acelasi mesaj de
        // cateva ori, ceea ce se traduce direct in reclamatii de spam si reputatie pierduta.
        await safeCampaignLog(svc, { campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email, status: 'duplicate', reason: 'duplicate_email_in_campaign' });
        skippedThisRun += 1;
        continue;
      }
      const missingCompliance = complianceMissing(contact);
      if (missingCompliance.length) {
        // Temeiul legal si provenienta sunt conditia in care trimitem acest tip de email. Un contact
        // fara ele (adaugat manual, fara sursa) nu se trimite: se raporteaza, ca sa fie completat.
        await safeCampaignLog(svc, {
          campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email,
          status: 'skipped', reason: `missing_compliance_metadata:${missingCompliance.join(',')}`,
        });
        skippedThisRun += 1;
        continue;
      }
      // Domeniul adresei trebuie sa poata primi email. Un domeniu disparut sau fara server de
      // email inseamna un bounce sigur, iar bounce-urile sunt exact ce opreste contul Resend.
      // 'lookup_failed' (n-am putut intreba DNS-ul) NU blocheaza: nu spune nimic despre adresa.
      const domainStatus = domainCache.get(emailDomain(email)) || 'lookup_failed';
      await rememberDomainStatus(svc, contact, domainStatus);
      if (isDomainUndeliverable(domainStatus)) {
        await safeCampaignLog(svc, {
          campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email,
          status: 'invalid', reason: `undeliverable_domain:${domainStatus}`, error: domainStatusMessage(domainStatus),
        });
        skippedThisRun += 1;
        continue;
      }
      if (domainStatus === 'dns_error') {
        await safeCampaignLog(svc, {
          campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email,
          status: 'skipped', reason: 'domain_dns_error', error: domainStatusMessage(domainStatus),
        });
        skippedThisRun += 1;
        continue;
      }

      const unsub = await buildUnsubscribeUrls(email, campaign.id);
      // Emailul se compune per destinatar (fisa lui, subsolul potrivit sursei, dezabonarea din
      // categoria campaniei), din acelasi loc ca testul si previzualizarea din admin.
      const composed = composeOutreachEmail(campaign, contact, { unsubscribeUrl: unsub.publicUrl });

      payloads.push({
        from: `${campaign.from_name || 'VIASEE'} <${sender.email}>`,
        to: [email],
        reply_to: [campaign.reply_to_email || legalConfig().contactEmail],
        subject: campaign.subject,
        html: composed.html,
        text: composed.text,
        headers: buildListUnsubscribeHeaders(unsub.oneClickUrl),
      });
      meta.push({ contact, email });
      seenEmails.add(email);
    }

    if (payloads.length) {
      let result = null;
      try {
        result = await sendBatchViaResend(resendApiKey, payloads);
      } catch (error) {
        console.error('outreachSendOps batch threw', campaign.id, error?.message || error);
        result = null; // exceptie de retea: tratata mai jos ca esec tranzitoriu
      }

      if (!result || !result.ok) {
        // Esecul e al lotului intreg, nu al unui destinatar anume: NU marcam contactele ca 'failed'
        // si NU avansam cursorul. Altfel o eroare trecatoare (rate limit, 5xx) ar arde definitiv
        // 25 de destinatari, care n-ar mai primi niciodata emailul si n-ar mai fi reincercati.
        batchFailure = {
          transient: isTransientBatchFailure(result),
          message: result?.json?.message || result?.text || 'Eroare de retea la trimiterea lotului catre Resend',
          status: result?.status || 0,
        };
        break;
      }

      // La succes Resend intoarce rezultatele in ordinea payload-urilor. Daca lungimile nu se
      // potrivesc, nu ne mai putem baza pe indexare: logam fara message id, ca sa nu legam un
      // eveniment de webhook de destinatarul gresit.
      const idsAligned = Array.isArray(result.results) && result.results.length === meta.length;
      for (let i = 0; i < meta.length; i += 1) {
        const { contact, email } = meta[i];
        const messageId = idsAligned ? (result.results[i]?.id || '') : '';
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
      remainingToday -= meta.length;
    }

    cursor += batchIds.length;
    await svc.entities.OutreachCampaign.update(campaign.id, {
      current_cursor: cursor,
      sent_count: (campaign.sent_count || 0) + sentThisRun,
      skipped_count: (campaign.skipped_count || 0) + skippedThisRun,
      consecutive_send_failures: 0, // un lot reusit reseteaza sirul de esecuri tranzitorii
      last_heartbeat_at: new Date().toISOString(),
      execution_lock_expires_at: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString(),
    }).catch((error) => console.error('outreachSendOps progress update failed', campaign.id, error?.message || error));
  }

  const progressPatch = {
    current_cursor: cursor,
    sent_count: (campaign.sent_count || 0) + sentThisRun,
    skipped_count: (campaign.skipped_count || 0) + skippedThisRun,
  };

  if (healthStop) {
    await pauseForHealth(svc, campaign.id, healthStop, progressPatch);
    return { campaign_id: campaign.id, sent: sentThisRun, skipped: skippedThisRun, finished: false, auto_paused: healthStop.reason };
  }

  if (batchFailure) {
    const failures = (Number(campaign.consecutive_send_failures) || 0) + 1;
    const giveUp = !batchFailure.transient || failures >= MAX_CONSECUTIVE_SEND_FAILURES;
    const failureMessage = batchFailure.transient
      ? `Lot esuat tranzitoriu (${failures}/${MAX_CONSECUTIVE_SEND_FAILURES}), status ${batchFailure.status}: ${batchFailure.message}`
      : `Trimitere oprita, eroare permanenta (status ${batchFailure.status}): ${batchFailure.message}`;

    // In ambele cazuri cursorul ramane pe loc: destinatarii lotului esuat vor fi reluati, fie de
    // urmatorul ciclu de cron (tranzitoriu), fie dupa ce admin-ul remediaza cauza si reia campania.
    await releaseLock(svc, campaign.id, {
      ...progressPatch,
      status: giveUp ? 'failed' : 'sending',
      consecutive_send_failures: failures,
      failure_message: failureMessage,
    });
    return {
      campaign_id: campaign.id, sent: sentThisRun, skipped: skippedThisRun,
      finished: false, retry_scheduled: !giveUp, error: failureMessage,
    };
  }

  if (stoppedByAdmin) {
    await releaseLock(svc, campaign.id, progressPatch);
    return { campaign_id: campaign.id, sent: sentThisRun, skipped: skippedThisRun, finished: false, stopped_by_admin: stoppedByAdmin };
  }

  const finished = cursor >= ids.length;
  // Limita zilei atinsa si mai sunt destinatari: reluare a doua zi la 09:00, ora Romaniei.
  const dailyLimitReached = !finished && remainingToday <= 0;
  const nextSendAfter = dailyLimitReached ? nextSendResumeAt(new Date()).toISOString() : null;
  const finalStatus = await releaseLockPreservingAdminStop(svc, campaign.id, {
    finished,
    previousSentAt: campaign.sent_at || null,
    patch: { ...progressPatch, failure_message: '', next_send_after: nextSendAfter },
  });

  return {
    campaign_id: campaign.id, sent: sentThisRun, skipped: skippedThisRun, finished, status: finalStatus,
    daily_limit: dailyLimit, daily_limit_reached: dailyLimitReached, next_send_after: nextSendAfter,
  };
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
  const testCtaOptions = {
    ctaLabel: campaign.cta_label,
    ctaUrl: campaign.cta_url,
    showcase: campaign.show_listing_preview === false ? null : {
      name: 'Optica Exemplu', providerType: 'optica_medicala', city: 'Bucuresti', county: 'Bucuresti',
      chip: listingChipFor('directory'),
    },
  };
  const finalHtml = buildEmailHtml(bodyHtml, unsubHtml, `[TEST] ${campaign.subject || 'VIASEE'}`, testCtaOptions);

  const result = await sendViaResend(resendApiKey, {
    from: `${campaign.from_name || 'VIASEE'} <${sender.email}>`,
    to: [toEmail],
    reply_to: [campaign.reply_to_email || legalConfig().contactEmail],
    subject: `[TEST] ${campaign.subject || 'VIASEE'}`,
    html: finalHtml,
    text: buildPlainText(bodyHtml, unsub.publicUrl, testCtaOptions),
    // Aceleasi antete ca la trimiterea reala: un test trebuie sa arate exact ca emailul livrat,
    // inclusiv butonul de dezabonare afisat de Gmail/Outlook langa numele expeditorului.
    headers: buildListUnsubscribeHeaders(unsub.oneClickUrl),
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
