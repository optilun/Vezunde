// outreachSendSafety — protectiile trimiterii de outreach, separate de randarea emailului
// (outreachEmailPolicy.js) ca sa poata fi testate direct:
//
// 1. Limita zilnica per campanie, cu crestere automata (50, 100, 200...): domeniul de trimitere
//    mail.viasee.ro e nou, iar ~600 de emailuri reci trimise in 30 de minute de pe un domeniu fara
//    istoric ajung usor in Spam. Limita tine si sub plafonul zilnic al planului Resend.
// 2. Oprirea automata a campaniei la prea multe emailuri respinse sau la o reclamatie de spam.
//    Resend pune pe pauza TOT contul (comun cu optilun.com) peste 4% respinse / 0,08% spam.
// 3. Verificarea domeniului destinatarului (MX) inainte de trimitere: adresele de pe domenii
//    care nu mai exista sau nu au server de email ar fi respinse sigur.
//
// Ziua se socoteste dupa ora Romaniei (Europe/Bucharest), nu UTC: "azi" pentru admin e ziua lui.

import { formatRoCount } from './outreachEmailPolicy.js';

export const SEND_TIME_ZONE = 'Europe/Bucharest';
// Cand limita zilei s-a atins, trimiterea se reia a doua zi la aceasta ora (nu la miezul noptii:
// un email de prezentare primit la 00:05 arata a trimitere automata).
export const SEND_RESUME_HOUR = 9;

export const DAILY_SEND_LIMIT_DEFAULT = 50;
export const DAILY_SEND_LIMIT_MIN = 10;
export const DAILY_SEND_LIMIT_MAX = 2000;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function bucharestParts(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEND_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

// Diferenta (ms) dintre ora Romaniei si UTC la un moment dat: +2h iarna, +3h vara.
function bucharestOffsetMs(date) {
  const p = bucharestParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Cheia zilei in Romania, "2026-09-21". Comparabila lexicografic.
export function bucharestDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const p = bucharestParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

// Momentul UTC care corespunde unei ore locale din Romania. Ziua poate depasi luna (Date.UTC
// normalizeaza 32 septembrie -> 2 octombrie). A doua trecere corecteaza zilele cu schimbare de ora.
export function bucharestLocalTimeToUtc(year, month, day, hour = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  let utc = guess - bucharestOffsetMs(new Date(guess));
  utc = guess - bucharestOffsetMs(new Date(utc));
  return new Date(utc);
}

// Urmatoarea zi, la ora de reluare, in ora Romaniei.
export function nextSendResumeAt(now = new Date(), hour = SEND_RESUME_HOUR) {
  const p = bucharestParts(now);
  return bucharestLocalTimeToUtc(p.year, p.month, p.day + 1, hour);
}

// ── 1. Limita zilnica ──

export function normalizeDailySendLimit(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DAILY_SEND_LIMIT_DEFAULT;
  return Math.min(DAILY_SEND_LIMIT_MAX, Math.max(DAILY_SEND_LIMIT_MIN, n));
}

// Cresterea automata dubleaza limita in fiecare zi in care campania a trimis efectiv ceva:
// 50, 100, 200, 400... Se numara zilele de trimitere, nu zilele din calendar: o campanie pusa pe
// pauza o saptamana nu sare direct la 800 cand e reluata.
export function effectiveDailyLimit(campaign = {}, priorSendingDays = 0) {
  const base = normalizeDailySendLimit(campaign.daily_send_limit);
  if (campaign.daily_send_ramp === false) return base;
  const days = Math.max(0, Math.floor(Number(priorSendingDays) || 0));
  return Math.min(DAILY_SEND_LIMIT_MAX, base * 2 ** Math.min(days, 10));
}

// Din jurnalul campaniei: cate emailuri au plecat azi si in cate zile anterioare s-a trimis.
// Conteaza orice intrare cu sent_at (statusul se schimba ulterior prin webhook in delivered,
// bounced etc., dar sent_at ramane).
export function summarizeSendsByDay(logs = [], now = new Date()) {
  const todayKey = bucharestDateKey(now);
  const byDay = new Map();
  for (const log of logs || []) {
    if (!log?.sent_at) continue;
    const key = bucharestDateKey(log.sent_at);
    if (!key) continue;
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  const priorSendingDays = [...byDay.keys()].filter((key) => key < todayKey).length;
  return { todayKey, sentToday: byDay.get(todayKey) || 0, priorSendingDays, byDay };
}

// ── 2. Oprirea automata ──

// Pragurile sunt sub cele la care Resend opreste contul (4% respinse, 0,08% spam), ca sa ne oprim
// noi primii. Rata de respingere se calculeaza peste cel putin 50 de trimise: la primele emailuri
// un singur bounce ar insemna 10-20% si ar opri campania fara motiv real.
export const CAMPAIGN_HEALTH_LIMITS = Object.freeze({
  maxBounceRate: 0.03,
  minBounceSample: 50,
  maxComplaints: 1,
});

export const HEALTH_PAUSE_REASONS = new Set(['bounce_rate', 'complaints']);

function nonNegative(value) {
  return Math.max(0, Number(value) || 0);
}

function formatPercent(rate) {
  return `${(Math.round(rate * 1000) / 10).toFixed(1).replace('.', ',')}%`;
}

// Dupa o reluare manuala, contoarele se socotesc de la zero (health_baseline), altfel campania
// s-ar opri din nou imediat, pe aceleasi respingeri pe care adminul tocmai le-a acceptat.
export function evaluateCampaignHealth(campaign = {}, limits = CAMPAIGN_HEALTH_LIMITS) {
  const base = campaign.health_baseline && typeof campaign.health_baseline === 'object' ? campaign.health_baseline : {};
  const sent = Math.max(0, nonNegative(campaign.sent_count) - nonNegative(base.sent));
  const bounced = Math.max(0, nonNegative(campaign.bounced_count) - nonNegative(base.bounced));
  const complained = Math.max(0, nonNegative(campaign.complained_count) - nonNegative(base.complained));
  const bounceRate = sent ? bounced / sent : 0;

  if (complained >= limits.maxComplaints) {
    return {
      healthy: false,
      reason: 'complaints',
      sent, bounced, complained, bounceRate,
      message: `Oprita automat: ${formatRoCount(complained, 'reclamatie de spam', 'reclamatii de spam', 'o')}. Resend poate opri tot contul de email peste 0,08% reclamatii. Verifica jurnalul inainte sa reiei.`,
    };
  }
  if (bounced / Math.max(sent, limits.minBounceSample) > limits.maxBounceRate) {
    return {
      healthy: false,
      reason: 'bounce_rate',
      sent, bounced, complained, bounceRate,
      message: `Oprita automat: ${formatRoCount(bounced, 'email respins', 'emailuri respinse', 'un')} din ${sent} trimise (${formatPercent(bounceRate)}). Resend poate opri tot contul de email peste 4%. Adresele respinse au fost deja scoase din lista; reia campania daca restul listei pare in regula.`,
    };
  }
  return { healthy: true, reason: '', sent, bounced, complained, bounceRate, message: '' };
}

export function healthPausePatch(health, now = new Date()) {
  return {
    status: 'paused',
    pause_reason: health.reason,
    failure_message: health.message,
    auto_paused_at: now.toISOString(),
  };
}

export function healthBaselineFrom(campaign = {}, now = new Date()) {
  return {
    sent: nonNegative(campaign.sent_count),
    bounced: nonNegative(campaign.bounced_count),
    complained: nonNegative(campaign.complained_count),
    at: now.toISOString(),
  };
}

// ── 3. Verificarea domeniului destinatarului ──

// ok             — domeniul are server de email (MX)
// domain_missing — domeniul nu exista (NXDOMAIN)
// no_mail_server — domeniul exista, dar nu are MX (sau are Null MX, RFC 7505)
// dns_error      — serverele DNS ale domeniului raspund cu eroare (SERVFAIL): emailul nu poate fi
//                  livrat acum, dar poate fi o problema trecatoare
// lookup_failed  — NOI n-am putut intreba (retea, timeout). Nu spune nimic despre domeniu, deci
//                  nu blocheaza trimiterea.
export const UNDELIVERABLE_DOMAIN_STATUSES = new Set(['domain_missing', 'no_mail_server']);
export const DOMAIN_STATUSES = ['ok', 'domain_missing', 'no_mail_server', 'dns_error'];

const DOH_ENDPOINTS = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];
const DNS_TYPE_MX = 15;

export function emailDomain(email = '') {
  const at = String(email || '').lastIndexOf('@');
  return at === -1 ? '' : String(email).slice(at + 1).trim().toLowerCase().replace(/\.$/, '');
}

// Raspunsul JSON DNS-over-HTTPS (Status 0 = NOERROR, 2 = SERVFAIL, 3 = NXDOMAIN).
export function classifyMxLookup(json) {
  if (!json || typeof json.Status !== 'number') return 'lookup_failed';
  if (json.Status === 3) return 'domain_missing';
  if (json.Status !== 0) return 'dns_error';
  const exchanges = (Array.isArray(json.Answer) ? json.Answer : [])
    .filter((answer) => Number(answer?.type) === DNS_TYPE_MX)
    .map((answer) => String(answer?.data || '').trim());
  // Null MX: "0 ." — domeniul declara explicit ca nu primeste email.
  const real = exchanges.filter((data) => data && !/^\d+\s+\.?$/.test(data));
  // Fara MX nu trimitem: regula veche din RFC 5321 (livrare la adresa A) nu functioneaza in
  // practica — pe acele adrese sta un site, nu un server de email.
  return real.length ? 'ok' : 'no_mail_server';
}

export async function lookupEmailDomain(domain, { fetchImpl = globalThis.fetch, timeoutMs = 4000 } = {}) {
  const name = String(domain || '').trim().toLowerCase();
  if (!name || !name.includes('.')) return 'domain_missing';
  let result = 'lookup_failed';
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const response = await fetchImpl(`${endpoint}?name=${encodeURIComponent(name)}&type=MX`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response?.ok) continue;
      const status = classifyMxLookup(await response.json());
      if (status === 'lookup_failed') continue;
      // SERVFAIL de la un resolver: il intrebam si pe al doilea inainte sa tragem o concluzie.
      if (status === 'dns_error') { result = 'dns_error'; continue; }
      return status;
    } catch (_error) {
      // urmatorul resolver
    }
  }
  return result;
}

// Verifica mai multe domenii o singura data fiecare (gmail.com apare de zeci de ori).
export async function lookupEmailDomains(domains, { fetchImpl = globalThis.fetch, concurrency = 8, cache = new Map() } = {}) {
  const pending = [...new Set((domains || []).map((d) => String(d || '').trim().toLowerCase()).filter(Boolean))]
    .filter((domain) => !cache.has(domain));
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pending.length)) }, async () => {
    while (index < pending.length) {
      const domain = pending[index];
      index += 1;
      cache.set(domain, await lookupEmailDomain(domain, { fetchImpl }));
    }
  });
  await Promise.all(workers);
  return cache;
}

export function isDomainUndeliverable(status) {
  return UNDELIVERABLE_DOMAIN_STATUSES.has(status);
}

export function domainStatusMessage(status) {
  if (status === 'domain_missing') return 'Domeniul adresei nu mai exista.';
  if (status === 'no_mail_server') return 'Domeniul adresei nu are server de email.';
  if (status === 'dns_error') return 'Serverele DNS ale domeniului raspund cu eroare.';
  return '';
}

export { DAY_MS };
