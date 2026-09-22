import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeEmail,
  isValidEmail,
  isSendableEmail,
  isContactSuppressed,
  isPermanentEmailError,
  complianceMissing,
  validateSenderEmail,
  buildUnsubscribeUrls,
  buildListUnsubscribeHeaders,
  sendBatchViaResend,
  sendViaResend,
  legalConfig,
} from '../../shared/outreachEmailPolicy.js';
import {
  summarizeSendsByDay,
  effectiveDailyLimit,
  nextSendResumeAt,
  evaluateCampaignHealth,
  withLogHealthCounters,
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
  summarizeCampaignLogs,
} from '../../shared/outreachAudiencePolicy.js';
import { composeOutreachEmail } from '../../shared/outreachComposer.js';

// outreachSendOps — trimiterea efectiva a campaniilor de outreach, in loturi mici, apelata de
// pe cron (`Outreach Campaign Scheduler`, la 5 minute) exact ca `directoryAutoImportOps` /
// `advance_auto_import_runs`: un singur pas per invocare, lock + heartbeat, reluare sigura.
// Spre deosebire de sendOutreachCampaign din Optilun (o bucla sincrona intr-un singur apel HTTP,
// plafonata la 500 destinatari), aici fiecare invocare trimite cel mult
// MAX_BATCHES_PER_RUN * BATCH_SIZE emailuri si isi actualizeaza cursorul, ca sa nu depinda de
// cate destinatari are o campanie.
//
// Protectii impotriva trimiterii de doua ori catre aceeasi adresa:
// - doar cronul (cu credentialul de serviciu Base44) sau un admin poate porni trimiterea;
// - lock-ul campaniei se confirma de doua ori, la distanta de o clipa, inainte de a trimite ceva;
// - inainte de fiecare lot, rularea verifica din nou ca lock-ul e inca al ei;
// - fiecare lot pleaca cu o cheie de idempotenta Resend calculata din continutul lui: acelasi lot
//   trimis a doua oara in 24 de ore (doua rulari suprapuse, o reincercare dupa timeout) nu mai
//   pleaca, Resend intoarce raspunsul primei trimiteri.

const LOCK_MINUTES = 4;
const BATCH_SIZE = 25; // Resend Batch API accepta pana la 100; pornim conservator
const MAX_BATCHES_PER_RUN = 4; // cel mult 100 destinatari per invocare cron
// Dupa atatea loturi consecutive esuate tranzitoriu campania trece in 'failed' in loc sa
// reincerce la infinit la fiecare 5 minute (la cron de 5 min inseamna ~25 de minute de retry).
const MAX_CONSECUTIVE_SEND_FAILURES = 5;
// Jurnalul se scrie in paralel, cate atatea inregistrari deodata: webhook-urile Resend incep sa
// soseasca la o secunda dupa trimitere si cauta exact aceste inregistrari.
const LOG_WRITE_CONCURRENCY = 5;

const TERMINAL_LOG_STATUSES = new Set(['sent', 'delivered', 'bounced', 'complained', 'failed', 'invalid', 'skipped', 'duplicate', 'unsubscribed', 'replied', 'delivery_delayed']);
// Stari in care admin-ul a oprit explicit campania: o rulare in curs nu are voie sa le suprascrie
// inapoi in 'sending' la eliberarea lock-ului, altfel butonul Pauza/Anuleaza nu ar opri nimic.
const ADMIN_STOP_STATUSES = new Set(['paused', 'cancelled', 'failed']);

function envMs(name, fallback) {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Intre scrierea lock-ului si a doua confirmare: destul cat o a doua invocare pornita in acelasi
// timp sa-si scrie si ea lock-ul, ca ultima scriere sa fie cea vazuta de amandoua.
function lockConfirmDelayMs() {
  return envMs('OUTREACH_LOCK_CONFIRM_MS', 1500);
}

// Pauza intre trimiterile individuale (doar cand Resend refuza un lot intreg din cauza unei
// singure adrese): limita implicita Resend e de 2 cereri pe secunda.
function singleSendSpacingMs() {
  return envMs('OUTREACH_SINGLE_SEND_SPACING_MS', 600);
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

// Esec de lot tranzitoriu (rate limit, indisponibilitate, retea, doua cereri simultane cu aceeasi
// cheie de idempotenta) vs. permanent (cheie gresita, domeniu neverificat, payload invalid).
// Tranzitoriu => nu avansam cursorul, reincercam la urmatorul ciclu de cron. Permanent => oprim
// campania cu mesaj, tot fara sa avansam cursorul, ca dupa remediere aceiasi destinatari sa fie
// reluati, nu sariti definitiv.
function isTransientBatchFailure(result) {
  if (!result) return true; // exceptie de retea/timeout: tratata ca tranzitorie
  const status = Number(result.status) || 0;
  if (status === 429 || status === 409 || status >= 500 || status === 0) return true;
  const text = `${result.json?.message || ''} ${result.text || ''}`;
  return !isPermanentEmailError(status, text);
}

function failureFrom(result) {
  return {
    transient: isTransientBatchFailure(result),
    message: result?.json?.message || result?.text || 'Eroare de retea la trimiterea lotului catre Resend',
    status: result?.status || 0,
  };
}

function clean(value) {
  return String(value ?? '').trim();
}

// Etichetele Resend accepta doar litere, cifre, _ si -.
function tagValue(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) || 'none';
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: Response.json({ error: 'Autentificare necesara' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: Response.json({ error: 'Acces permis doar administratorilor VIASEE' }, { status: 403 }) };
  return { user, svc: base44.asServiceRole };
}

// Cronul Base44 cheama functia cu credentialul de serviciu (Authorization identic cu
// Base44-Service-Authorization). `__automation_trigger` din corp e doar o indicatie de rutare,
// nu o dovada de identitate: fara verificarea de aici, oricine ar putea porni trimiterea din afara.
// Un credential inventat nu trece de citirea de validare facuta cu el.
async function automationServiceRole(base44, req) {
  const user = await base44.auth.me().catch(() => null);
  const authorization = req.headers.get('authorization') || '';
  const serviceAuthorization = req.headers.get('Base44-Service-Authorization') || '';
  const serviceCaller = authorization.startsWith('Bearer ') && authorization.length > 20 && authorization === serviceAuthorization;
  if (user?.role !== 'admin' && !serviceCaller) return null;
  const svc = base44.asServiceRole;
  try {
    await svc.entities.OutreachCampaign.filter({ status: 'sending' }, 'created_date', 1);
  } catch (_error) {
    return null;
  }
  return svc;
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
// Din acelasi jurnal ies si cat s-a trimis azi (limita zilnica) si contoarele reale ale campaniei
// (protectia la respingeri): nicio citire in plus.
async function loadCampaignProgress(svc, campaign) {
  const logs = await svc.entities.OutreachCampaignLog.filter({ campaign_id: campaign.id }, '-created_date', 20000).catch(() => []);
  const contactIds = new Set();
  const emails = new Set();
  for (const log of logs || []) {
    if (!TERMINAL_LOG_STATUSES.has(log.status)) continue;
    if (log.contact_id) contactIds.add(log.contact_id);
    const email = normalizeEmail(log.normalized_email || log.email);
    if (email) emails.add(email);
  }
  return {
    contactIds,
    emails,
    sends: summarizeSendsByDay(logs || []),
    counts: summarizeCampaignLogs(logs || [], campaign.recipient_count).counts,
  };
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

// O inregistrare de jurnal pierduta dupa o trimitere reusita ar lasa un eveniment Resend fara
// pereche: se reincearca de doua ori inainte de a renunta.
async function safeCampaignLog(svc, data) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await svc.entities.OutreachCampaignLog.create({ provider: 'resend', created_at: new Date().toISOString(), ...data });
    } catch (error) {
      if (attempt === 2) {
        console.error('outreachSendOps log create failed', data?.campaign_id, data?.contact_id, error?.message || error);
        return null;
      }
      await sleep(250 * (attempt + 1));
    }
  }
  return null;
}

async function inChunks(items, size, worker) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(worker));
  }
}

function isWaitingForNextDay(campaign, nowMs = Date.now()) {
  const resumeAt = campaign?.next_send_after ? new Date(campaign.next_send_after).getTime() : 0;
  return Number.isFinite(resumeAt) && resumeAt > nowMs;
}

function hasActiveLock(campaign, nowMs = Date.now()) {
  if (!campaign?.execution_lock_token) return false;
  const expiresAt = campaign.execution_lock_expires_at ? new Date(campaign.execution_lock_expires_at).getTime() : 0;
  return Number.isFinite(expiresAt) && expiresAt >= nowMs;
}

async function readCampaign(svc, campaignId) {
  return svc.entities.OutreachCampaign.get(campaignId).catch(() => null);
}

async function claimCampaignForSending(svc) {
  // O singura campanie "ready" sau "sending" cu lock expirat/lipsa e preluata per invocare.
  const candidates = await svc.entities.OutreachCampaign.filter({ status: 'ready' }, 'created_date', 10).catch(() => []);
  const sendingStuck = await svc.entities.OutreachCampaign.filter({ status: 'sending' }, 'created_date', 10).catch(() => []);
  const pool = [...(candidates || []), ...(sendingStuck || [])];
  for (const candidate of pool) {
    const nowMs = Date.now();
    if (hasActiveLock(candidate, nowMs)) continue; // blocata de alta invocare inca activa
    // Limita zilei atinsa: campania asteapta ziua urmatoare si NU ocupa ciclul de cron, ca alta
    // campanie aflata in trimitere sa poata avansa intre timp.
    if (isWaitingForNextDay(candidate, nowMs)) continue;
    // Starea se re-citeste imediat inainte de preluare: lista de candidati poate fi veche de cateva
    // sute de milisecunde (alta invocare a luat-o intre timp, adminul a pus-o pe pauza).
    const fresh = await readCampaign(svc, candidate.id);
    if (!fresh || !['ready', 'sending'].includes(fresh.status)) continue;
    if (hasActiveLock(fresh, nowMs) || isWaitingForNextDay(fresh, nowMs)) continue;
    const token = crypto.randomUUID();
    await svc.entities.OutreachCampaign.update(fresh.id, {
      execution_lock_token: token,
      execution_lock_expires_at: new Date(nowMs + LOCK_MINUTES * 60 * 1000).toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      // Statusul se scrie doar la prima preluare: o campanie deja 'sending' nu are nevoie, iar
      // fiecare scriere de status in plus e o sansa sa acopere o pauza data chiar atunci.
      ...(fresh.status === 'ready' ? { status: 'sending' } : {}),
    });
    // Base44 nu are update conditionat, deci doua invocari suprapuse pot scrie amandoua un lock.
    // Castiga ultima scriere; confirmam de doua ori, la o clipa distanta, ca si invocarea care a
    // scris prima sa vada lock-ul celeilalte si sa renunte.
    const first = await readCampaign(svc, fresh.id);
    if (!first || first.execution_lock_token !== token) continue;
    await sleep(lockConfirmDelayMs());
    const confirmed = await readCampaign(svc, fresh.id);
    if (!confirmed || confirmed.execution_lock_token !== token) continue;
    return confirmed;
  }
  return null;
}

// Orice scriere de final se face doar daca lock-ul e inca al acestei rulari: daca a expirat si a
// fost preluat de alta invocare, cea noua conduce campania si nu trebuie deranjata.
async function releaseOwnedLock(svc, campaignId, lockToken, patch = {}) {
  const live = await readCampaign(svc, campaignId);
  if (!live || live.execution_lock_token !== lockToken) return null;
  await svc.entities.OutreachCampaign.update(campaignId, {
    execution_lock_token: '',
    execution_lock_expires_at: null,
    last_heartbeat_at: new Date().toISOString(),
    ...patch,
  }).catch((error) => console.error('outreachSendOps releaseLock failed', campaignId, error?.message || error));
  return live;
}

// Oprirea automata: campania trece pe pauza cu motivul scris pentru admin, iar actiunea ramane in
// auditul campaniei. O campanie deja oprita de admin (pauza, anulare) ramane cum a lasat-o el.
async function pauseForHealth(svc, campaignId, lockToken, health, extraPatch = {}) {
  const live = await readCampaign(svc, campaignId);
  if (!live || live.execution_lock_token !== lockToken) return;
  const canPause = ['ready', 'sending'].includes(live.status);
  await releaseOwnedLock(svc, campaignId, lockToken, canPause ? { ...extraPatch, ...healthPausePatch(health) } : extraPatch);
  if (!canPause) return;
  await svc.entities.DirectoryAuditRecord.create(autoPauseAuditRecord(campaignId, health, 'trimitere'))
    .catch((error) => console.error('outreachSendOps auto-pause audit failed', campaignId, error?.message || error));
}

// Eliberarea lock-ului la finalul unei rulari: daca admin-ul a apasat Pauza / Anuleaza in timp ce
// lotul era in aer, starea lui ramane. O campanie neterminata nu-si rescrie statusul ('sending'
// e deja scris la preluare), deci nu are cum sa acopere o pauza.
async function releaseLockPreservingAdminStop(svc, campaignId, lockToken, { finished, patch = {} }) {
  const live = await readCampaign(svc, campaignId);
  if (!live || live.execution_lock_token !== lockToken) return 'lock_lost';
  if (ADMIN_STOP_STATUSES.has(live.status)) {
    // Motivul opririi (scris de admin sau de oprirea automata din webhook in timpul lotului)
    // trebuie sa ramana vizibil: nu il stergem odata cu eliberarea lock-ului.
    const { failure_message: _keepStopReason, ...rest } = patch;
    await releaseOwnedLock(svc, campaignId, lockToken, rest);
    return live.status;
  }
  await releaseOwnedLock(svc, campaignId, lockToken, finished
    ? { ...patch, status: 'sent', sent_at: new Date().toISOString() }
    : patch);
  return finished ? 'sent' : live.status;
}

// Inainte de fiecare lot: lock-ul e inca al nostru, adminul n-a oprit campania, iar respingerile
// venite intre timp prin webhook n-au trecut pragul.
async function checkBeforeSend(svc, campaignId, lockToken, logCounts) {
  const live = await readCampaign(svc, campaignId);
  if (!live || live.execution_lock_token !== lockToken) return { lostLock: true };
  if (ADMIN_STOP_STATUSES.has(live.status)) return { stoppedByAdmin: live.status };
  const health = evaluateCampaignHealth(withLogHealthCounters(live, logCounts));
  if (!health.healthy) return { health };
  return { live };
}

async function idempotencyKeyFor(campaignId, cursor, payloads) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payloads)));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `viasee-outreach-${campaignId}-${cursor}-${hex}`;
}

// Cand Resend refuza lotul intreg (422) din cauza unei singure adrese, emailurile se trimit pe rand
// ca adresa problema sa fie gasita si trecuta in raport, iar ceilalti destinatari sa primeasca
// emailul. Daca nu trece NICIUNUL, problema e a campaniei (expeditor, continut), nu a unei adrese:
// se opreste trimiterea fara sa marcheze vreun destinatar.
async function deliverIndividually(apiKey, payloads, keyBase) {
  const perRecipient = [];
  let succeeded = 0;
  let rejected = 0;
  let lastRejection = null;
  for (let i = 0; i < payloads.length; i += 1) {
    if (i > 0) await sleep(singleSendSpacingMs());
    let result = null;
    try {
      result = await sendViaResend(apiKey, payloads[i], { idempotencyKey: `${keyBase}-${i}` });
    } catch (error) {
      console.error('outreachSendOps single send threw', error?.message || error);
      result = null;
    }
    if (result?.ok) {
      perRecipient.push({ id: result.json?.id || '' });
      succeeded += 1;
      continue;
    }
    if (result && (result.status === 422 || result.status === 400)) {
      rejected += 1;
      lastRejection = result;
      perRecipient.push({ rejected: result.json?.message || result.text || 'Adresa refuzata de Resend' });
      if (!succeeded && rejected >= Math.min(3, payloads.length)) break;
      continue;
    }
    // Esec tranzitoriu la mijloc: ce a plecat deja se trece in jurnal, restul se reia la
    // urmatorul ciclu (cheile de idempotenta impiedica o a doua trimitere a celor plecate).
    return { perRecipient: succeeded ? perRecipient : [], failure: failureFrom(result) };
  }
  if (!succeeded) return { perRecipient: [], failure: { ...failureFrom(lastRejection), transient: false } };
  return { perRecipient, failure: null };
}

async function deliverBatch(apiKey, campaignId, cursor, payloads) {
  const idempotencyKey = await idempotencyKeyFor(campaignId, cursor, payloads);
  let batch = null;
  try {
    batch = await sendBatchViaResend(apiKey, payloads, { idempotencyKey });
  } catch (error) {
    console.error('outreachSendOps batch threw', campaignId, error?.message || error);
    batch = null; // exceptie de retea: tratata mai jos ca esec tranzitoriu
  }
  if (batch?.ok) {
    // La succes Resend intoarce rezultatele in ordinea payload-urilor. Daca lungimile nu se
    // potrivesc, nu ne mai putem baza pe indexare: logam fara message id (webhook-ul gaseste
    // jurnalul dupa etichetele campanie + contact).
    const aligned = Array.isArray(batch.results) && batch.results.length === payloads.length;
    return { perRecipient: payloads.map((_, i) => ({ id: aligned ? (batch.results[i]?.id || '') : '' })), failure: null };
  }
  if (batch && batch.status === 422 && payloads.length > 1) {
    return deliverIndividually(apiKey, payloads, idempotencyKey);
  }
  // Esecul e al lotului intreg, nu al unui destinatar anume: NU marcam contactele si NU avansam
  // cursorul. Altfel o eroare trecatoare (rate limit, 5xx) ar arde definitiv 25 de destinatari.
  return { perRecipient: [], failure: failureFrom(batch) };
}

async function writeSendLogs(svc, campaignId, meta, perRecipient) {
  let sent = 0;
  let rejected = 0;
  const work = [];
  for (let i = 0; i < meta.length; i += 1) {
    const entry = perRecipient[i];
    if (!entry) continue; // neincercat (lotul s-a oprit inainte)
    work.push({ ...meta[i], entry });
    if (entry.rejected) rejected += 1;
    else sent += 1;
  }
  await inChunks(work, LOG_WRITE_CONCURRENCY, async ({ contact, email, entry }) => {
    if (entry.rejected) {
      await safeCampaignLog(svc, {
        campaign_id: campaignId, contact_id: contact.id, email, normalized_email: email,
        status: 'invalid', reason: 'rejected_by_provider', error: String(entry.rejected).slice(0, 500),
      });
      return;
    }
    const now = new Date().toISOString();
    await safeCampaignLog(svc, {
      campaign_id: campaignId, contact_id: contact.id, email, normalized_email: email,
      status: 'sent', resend_message_id: entry.id || '', sent_at: now,
    });
    if (contact.status !== 'converted') {
      await svc.entities.OutreachContact.update(contact.id, {
        status: contact.status === 'new' ? 'contacted' : contact.status,
        last_contacted_at: now,
        last_status_change_at: now,
      }).catch(() => null);
    }
  });
  return { sent, rejected };
}

async function advanceOneCampaign(svc, campaign, resendApiKey) {
  const lockToken = campaign.execution_lock_token;
  const sender = validateSenderEmail(campaign.from_email);
  if (!sender.ok) {
    await releaseOwnedLock(svc, campaign.id, lockToken, { status: 'failed', failure_message: sender.error });
    return { campaign_id: campaign.id, error: sender.error };
  }
  if (!resendApiKey) {
    await releaseOwnedLock(svc, campaign.id, lockToken, { status: 'failed', failure_message: 'RESEND_API_KEY nu este configurat.' });
    return { campaign_id: campaign.id, error: 'RESEND_API_KEY nu este configurat.' };
  }

  const ids = Array.isArray(campaign.recipient_contact_ids) ? campaign.recipient_contact_ids : [];
  if (!ids.length) {
    // Fara lista inghetata de destinatari cursorul n-are in ce sa indexeze, iar conditia de final
    // (cursor >= ids.length) ar fi adevarata din start: campania s-ar marca 'sent' fara sa fi
    // trimis niciun email. Oprim explicit, cu mesaj, in loc sa raportam un succes fals.
    const message = 'Campania nu are lista de destinatari (recipient_contact_ids). Reaproba campania pentru a regenera lista.';
    await releaseOwnedLock(svc, campaign.id, lockToken, { status: 'failed', failure_message: message });
    return { campaign_id: campaign.id, error: message };
  }

  const processed = await loadCampaignProgress(svc, campaign);
  const logCounts = processed.counts;

  // Oprirea automata se verifica inainte de orice trimitere, din jurnal (sursa de adevar), nu doar
  // din contoarele campaniei: respingerile vin prin webhook intre doua cicluri de cron.
  const initialHealth = evaluateCampaignHealth(withLogHealthCounters(campaign, logCounts));
  if (!initialHealth.healthy) {
    await pauseForHealth(svc, campaign.id, lockToken, initialHealth);
    return { campaign_id: campaign.id, sent: 0, skipped: 0, finished: false, auto_paused: initialHealth.reason };
  }

  const alreadyProcessed = processed.contactIds;
  const seenEmails = new Set(processed.emails);
  const suppressionMap = await getSuppressionMap(svc);
  const category = normalizeCategory(campaign.category);
  // Data aprobarii fixeaza tokenul de dezabonare: acelasi lot compus din nou arata identic.
  const tokenIssuedAt = campaign.approved_at || campaign.created_date || '';

  // Limita zilnica: cat mai are voie campania sa trimita azi (ora Romaniei).
  const dailyLimit = effectiveDailyLimit(campaign, processed.sends.priorSendingDays);
  let remainingToday = dailyLimit - processed.sends.sentToday;
  // Un domeniu se verifica o singura data per rulare (gmail.com apare de zeci de ori).
  const domainCache = new Map();

  const baseSent = Math.max(Number(campaign.sent_count) || 0, logCounts.sent);
  const baseSkipped = Math.max(Number(campaign.skipped_count) || 0, logCounts.not_sent);
  let cursor = Number(campaign.current_cursor) || 0;
  let sentThisRun = 0;
  let skippedThisRun = 0;
  let stoppedByAdmin = '';
  let batchFailure = null;
  let healthStop = null;
  let lostLock = false;

  for (let batchNum = 0; batchNum < MAX_BATCHES_PER_RUN && cursor < ids.length && remainingToday > 0; batchNum += 1) {
    if (batchNum > 0) {
      // Pauza/anularea data de admin trebuie sa opreasca campania in maximum un lot, nu abia la
      // finalul rularii: re-citim starea inainte de fiecare lot urmator.
      const gate = await checkBeforeSend(svc, campaign.id, lockToken, logCounts);
      if (gate.lostLock) { lostLock = true; break; }
      if (gate.stoppedByAdmin) { stoppedByAdmin = gate.stoppedByAdmin; break; }
      if (gate.health) { healthStop = gate.health; break; }
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

      if (!email || !isSendableEmail(email)) {
        // Verificarea stricta: o singura adresa invalida face Resend sa refuze tot lotul.
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
        // Serverul DNS al domeniului a raspuns cu eroare (nu noi n-am putut intreba): adresa nu
        // primeste in aceasta campanie. Nu se reincearca; apare in raport ca \"Eroare DNS la domeniu\".
        await safeCampaignLog(svc, {
          campaign_id: campaign.id, contact_id: contact.id, email, normalized_email: email,
          status: 'skipped', reason: 'domain_dns_error', error: domainStatusMessage(domainStatus),
        });
        skippedThisRun += 1;
        continue;
      }

      const unsub = await buildUnsubscribeUrls(email, campaign.id, { issuedAt: tokenIssuedAt });
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
        // Webhook-ul leaga fiecare eveniment Resend de campania si contactul exact, chiar daca
        // evenimentul ajunge inaintea jurnalului sau adresa apare in mai multe campanii.
        tags: [
          { name: 'viasee_campaign', value: tagValue(campaign.id) },
          { name: 'viasee_contact', value: tagValue(contact.id) },
        ],
      });
      meta.push({ contact, email });
      seenEmails.add(email);
    }

    if (payloads.length) {
      const gate = await checkBeforeSend(svc, campaign.id, lockToken, logCounts);
      if (gate.lostLock) { lostLock = true; break; }
      if (gate.stoppedByAdmin) { stoppedByAdmin = gate.stoppedByAdmin; break; }
      if (gate.health) { healthStop = gate.health; break; }

      const delivery = await deliverBatch(resendApiKey, campaign.id, cursor, payloads);
      // Ce a plecat se trece in jurnal inainte de orice alta decizie: si cand lotul s-a oprit la
      // jumatate, destinatarii care au primit deja nu mai sunt reluati.
      const written = await writeSendLogs(svc, campaign.id, meta, delivery.perRecipient);
      sentThisRun += written.sent;
      skippedThisRun += written.rejected;
      remainingToday -= written.sent;
      if (delivery.failure) { batchFailure = delivery.failure; break; }
    }

    cursor += batchIds.length;
    await svc.entities.OutreachCampaign.update(campaign.id, {
      current_cursor: cursor,
      sent_count: baseSent + sentThisRun,
      skipped_count: baseSkipped + skippedThisRun,
      consecutive_send_failures: 0, // un lot reusit reseteaza sirul de esecuri tranzitorii
      last_heartbeat_at: new Date().toISOString(),
      execution_lock_expires_at: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString(),
    }).catch((error) => console.error('outreachSendOps progress update failed', campaign.id, error?.message || error));
  }

  const summary = { campaign_id: campaign.id, sent: sentThisRun, skipped: skippedThisRun };
  if (lostLock) {
    // Alta invocare a preluat campania (lock expirat): nu scriem nimic peste ea.
    return { ...summary, finished: false, lost_lock: true };
  }

  const progressPatch = {
    current_cursor: cursor,
    sent_count: baseSent + sentThisRun,
    skipped_count: baseSkipped + skippedThisRun,
  };

  if (healthStop) {
    await pauseForHealth(svc, campaign.id, lockToken, healthStop, progressPatch);
    return { ...summary, finished: false, auto_paused: healthStop.reason };
  }

  if (batchFailure) {
    const live = await readCampaign(svc, campaign.id);
    if (!live || live.execution_lock_token !== lockToken) return { ...summary, finished: false, lost_lock: true };
    const failures = (Number(live.consecutive_send_failures) || 0) + 1;
    const giveUp = !batchFailure.transient || failures >= MAX_CONSECUTIVE_SEND_FAILURES;
    const failureMessage = batchFailure.transient
      ? `Lot esuat tranzitoriu (${failures}/${MAX_CONSECUTIVE_SEND_FAILURES}), status ${batchFailure.status}: ${batchFailure.message}`
      : `Trimitere oprita, eroare permanenta (status ${batchFailure.status}): ${batchFailure.message}`;

    // In ambele cazuri cursorul ramane pe loc: destinatarii lotului esuat vor fi reluati, fie de
    // urmatorul ciclu de cron (tranzitoriu), fie dupa ce admin-ul remediaza cauza si reia campania.
    // O pauza sau o anulare data de admin intre timp ramane neatinsa.
    const adminStopped = ADMIN_STOP_STATUSES.has(live.status);
    await releaseOwnedLock(svc, campaign.id, lockToken, {
      ...progressPatch,
      consecutive_send_failures: failures,
      ...(adminStopped ? {} : { failure_message: failureMessage }),
      ...(!adminStopped && giveUp ? { status: 'failed' } : {}),
    });
    return {
      ...summary,
      finished: false, retry_scheduled: !giveUp && !adminStopped, error: failureMessage,
      ...(adminStopped ? { stopped_by_admin: live.status } : {}),
    };
  }

  if (stoppedByAdmin) {
    await releaseOwnedLock(svc, campaign.id, lockToken, progressPatch);
    return { ...summary, finished: false, stopped_by_admin: stoppedByAdmin };
  }

  const finished = cursor >= ids.length;
  // Limita zilei atinsa si mai sunt destinatari: reluare a doua zi la 09:00, ora Romaniei.
  const dailyLimitReached = !finished && remainingToday <= 0;
  const nextSendAfter = dailyLimitReached ? nextSendResumeAt(new Date()).toISOString() : null;
  const finalStatus = await releaseLockPreservingAdminStop(svc, campaign.id, lockToken, {
    finished,
    patch: { ...progressPatch, failure_message: '', next_send_after: nextSendAfter },
  });

  return {
    ...summary, finished, status: finalStatus,
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
  if (!campaignId || !toEmail || !isValidEmail(toEmail) || !isSendableEmail(toEmail)) {
    return Response.json({ error: 'campaign_id si un to_email valid sunt obligatorii' }, { status: 400 });
  }
  const campaign = await svc.entities.OutreachCampaign.get(campaignId).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  const sender = validateSenderEmail(campaign.from_email);
  if (!sender.ok) return Response.json({ error: sender.error }, { status: 400 });
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  if (!resendApiKey) return Response.json({ error: 'RESEND_API_KEY nu este configurat' }, { status: 500 });

  // Testul poate arata emailul exact asa cum il primeste un destinatar ales din lista (numele,
  // orasul, fisa lui), dar pleaca doar la adresa de test.
  const sampleContactId = clean(payload.sample_contact_id);
  const sample = sampleContactId ? await svc.entities.OutreachContact.get(sampleContactId).catch(() => null) : null;
  const contact = sample || {
    company_name: 'Optica Exemplu', provider_type: 'optica_medicala', city: 'Bucuresti', county: 'Bucuresti',
    profile_control_status: 'directory',
  };
  const unsub = await buildUnsubscribeUrls(toEmail, `test:${campaignId}`);
  const composed = composeOutreachEmail(campaign, contact, {
    unsubscribeUrl: unsub.publicUrl,
    subject: `[TEST] ${campaign.subject || 'VIASEE'}`,
  });

  const result = await sendViaResend(resendApiKey, {
    from: `${campaign.from_name || 'VIASEE'} <${sender.email}>`,
    to: [toEmail],
    reply_to: [campaign.reply_to_email || legalConfig().contactEmail],
    subject: composed.subject,
    html: composed.html,
    text: composed.text,
    // Aceleasi antete ca la trimiterea reala: un test trebuie sa arate exact ca emailul livrat,
    // inclusiv butonul de dezabonare afisat de Gmail/Outlook langa numele expeditorului.
    headers: buildListUnsubscribeHeaders(unsub.oneClickUrl),
    // Un test nu apartine niciunei campanii: webhook-ul nu il trece in raport (doar o respingere
    // sau o reclamatie ajunge in lista de suprimari, ca la orice adresa).
    tags: [{ name: 'viasee_test', value: tagValue(campaignId) }],
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
      const svc = await automationServiceRole(base44, req);
      if (!svc) return Response.json({ error: 'Autentificare de admin sau serviciu necesara.' }, { status: 403 });
      return await actionAdvanceCampaignSends(svc);
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
