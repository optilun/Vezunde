// base44/shared/outreachEmailPolicy.js
// Logica pura pentru modulul de outreach email VIASEE (fara efecte Base44/retea, usor testabila).
// Portata din sistemul de outreach al Optilun (base44 app 6984db05b4843f9d480897e9,
// functiile sendOutreachCampaign/resendWebhook/outreachUnsubscribe), adaptata pentru VIASEE:
// - textul legal/motivul de trimitere e specific directorului VIASEE
// - linkurile de dezabonare trec prin functia umbrela `directoryOps` (?outreach_action=unsubscribe)
// - adaugat sendBatchViaResend pentru trimitere in loturi (folosit de outreachSendOps pe cron)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SUPPRESSED_STATUSES = new Set(['unsubscribed', 'bounced', 'invalid', 'complained']);
// Trimiterea se face de pe subdomeniul dedicat mail.viasee.ro, nu de pe radacina: verificarea
// radacinii in Resend ar cere modificarea SPF-ului existent (`include:_spf.mx.cloudflare.net`),
// care e chiar cel care face sa functioneze primirea de email pe viasee.ro prin Cloudflare Email
// Routing. Subdomeniul are SPF/DKIM proprii, deci reputatia campaniilor nu atinge nici mailul
// tranzactional, nici casuta de contact. Raspunsurile merg spre contact@viasee.ro (reply_to).
export const DEFAULT_FROM_EMAIL = 'contact@mail.viasee.ro';
// Adresa afisata in email si folosita ca reply_to. NU e aceeasi cu expeditorul: de pe subdomeniul
// de trimitere nu se citeste nimic, in timp ce contact@viasee.ro e casuta reala, livrata prin
// Cloudflare Email Routing. Un footer care afiseaza adresa de trimitere ar invita raspunsuri intr-o
// casuta pe care nu o citeste nimeni.
export const DEFAULT_CONTACT_EMAIL = 'contact@viasee.ro';
export const DEFAULT_FROM_NAME = 'VIASEE';
export const DEFAULT_WEBSITE = 'https://viasee.ro';

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email = '') {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function getDomain(email = '') {
  return normalizeEmail(email).split('@')[1] || '';
}

function splitEnvList(value = '') {
  return String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function getAllowedSenderDomains() {
  return [
    ...splitEnvList(Deno.env.get('OUTREACH_ALLOWED_SENDER_DOMAINS')),
    ...splitEnvList(Deno.env.get('RESEND_VERIFIED_DOMAINS')),
    // Fallback-ul ramane strict subdomeniul verificat efectiv in Resend. Nu punem aici 'viasee.ro':
    // ar trece validarea noastra si ar esua abia la Resend, cu un mesaj mult mai greu de diagnosticat.
    'mail.viasee.ro',
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

export function getAllowedSenderEmails() {
  return [
    ...splitEnvList(Deno.env.get('OUTREACH_ALLOWED_SENDER_EMAILS')),
    DEFAULT_FROM_EMAIL,
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

export function validateSenderEmail(fromEmail = DEFAULT_FROM_EMAIL) {
  const email = normalizeEmail(fromEmail || DEFAULT_FROM_EMAIL);
  if (!isValidEmail(email)) return { ok: false, email, error: 'Adresa expeditorului nu este valida.' };
  const domain = getDomain(email);
  const allowedEmails = getAllowedSenderEmails();
  const allowedDomains = getAllowedSenderDomains();
  const allowed = allowedEmails.includes(email) || allowedDomains.includes(domain);
  if (!allowed) {
    return {
      ok: false,
      email,
      error: 'Domeniul expeditorului nu este permis. Configureaza OUTREACH_ALLOWED_SENDER_DOMAINS / RESEND_VERIFIED_DOMAINS si verifica domeniul in Resend inainte de a trimite.',
    };
  }
  return { ok: true, email, domain };
}

export function getEmailStatus(contact) {
  const explicit = contact?.email_status;
  if (SUPPRESSED_STATUSES.has(explicit)) return explicit;
  if (SUPPRESSED_STATUSES.has(contact?.status)) return contact.status;
  return 'active';
}

export function isContactSuppressed(contact) {
  return SUPPRESSED_STATUSES.has(getEmailStatus(contact));
}

export function textToHtml(text = '') {
  if (String(text).includes('<')) return String(text);
  return String(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPermanentEmailError(status, errorText = '') {
  const text = String(errorText).toLowerCase();
  return status === 422 || status === 400
    || text.includes('invalid')
    || text.includes('not a valid email')
    || text.includes('hard bounce')
    || text.includes('permanent');
}

export function renderTemplateMergeFields(bodyHtml, contact = {}) {
  const name = contact.contact_name || contact.company_name || '';
  const company = contact.company_name || '';
  const city = contact.city || '';
  const county = contact.county || '';
  return String(bodyHtml || '')
    .replace(/\[NUME\]/g, name)
    .replace(/\[NAME\]/g, name)
    .replace(/\[FIRMA\]/g, company)
    .replace(/\[ORAS\]/g, city)
    .replace(/\[JUDET\]/g, county);
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const padded = String(input).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(input).length / 4) * 4, '=');
  return atob(padded);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(sig));
}

export function getUnsubscribeSecret() {
  return Deno.env.get('OUTREACH_UNSUBSCRIBE_SECRET') || '';
}

export function getPublicBaseUrl() {
  return String(Deno.env.get('OUTREACH_PUBLIC_BASE_URL') || Deno.env.get('PUBLIC_SITE_URL') || DEFAULT_WEBSITE).replace(/\/$/, '');
}

export function getUnsubscribeEndpointBaseUrl() {
  return String(Deno.env.get('OUTREACH_UNSUBSCRIBE_ENDPOINT') || `${getPublicBaseUrl()}/api/functions/directoryOps`).replace(/\/$/, '');
}

export async function createUnsubscribeToken(email, campaignId) {
  const secret = getUnsubscribeSecret();
  if (!secret) throw new Error('OUTREACH_UNSUBSCRIBE_SECRET nu este configurat. Nu se poate trimite email promotional fara token de dezabonare securizat.');
  const payload = {
    v: 1,
    e: normalizeEmail(email),
    cid: campaignId || null,
    iat: new Date().toISOString(),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = await signValue(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifyUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();
  if (!secret) throw new Error('OUTREACH_UNSUBSCRIBE_SECRET nu este configurat.');
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Token de dezabonare invalid.');
  const expected = await signValue(parts[0], secret);
  if (!timingSafeEqual(expected, parts[1])) throw new Error('Semnatura tokenului de dezabonare este invalida.');
  const payload = JSON.parse(base64UrlDecode(parts[0]));
  const email = normalizeEmail(payload.e || payload.email);
  if (!isValidEmail(email)) throw new Error('Email invalid in token.');
  return { email, campaign_id: payload.cid || payload.campaign_id || null, token_version: payload.v || 1 };
}

export async function buildUnsubscribeUrls(email, campaignId) {
  const token = await createUnsubscribeToken(email, campaignId);
  const publicUrl = `${getPublicBaseUrl()}/dezabonare?t=${encodeURIComponent(token)}`;
  const oneClickUrl = `${getUnsubscribeEndpointBaseUrl()}?outreach_action=unsubscribe&t=${encodeURIComponent(token)}`;
  return { token, publicUrl, oneClickUrl };
}

// Antetele de dezabonare, identice pentru campanii si pentru emailurile de test (un test trebuie sa
// arate exact ca trimiterea reala). Pe langa linkul one-click (RFC 8058, cerut de Gmail/Yahoo
// pentru expeditori in volum) includem si varianta mailto:, pentru clientii care nu implementeaza
// POST-ul one-click si pentru cazul in care endpointul HTTP e indisponibil.
export function buildListUnsubscribeHeaders(oneClickUrl) {
  const mailto = legalConfig().unsubscribeMailto;
  const parts = [`<${oneClickUrl}>`];
  if (mailto) parts.push(`<mailto:${mailto}?subject=unsubscribe>`);
  return {
    'List-Unsubscribe': parts.join(', '),
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export function legalConfig() {
  return {
    brand: Deno.env.get('OUTREACH_BRAND_NAME') || 'VIASEE',
    legalCompany: Deno.env.get('OUTREACH_LEGAL_COMPANY_NAME') || 'VIASEE',
    contactEmail: Deno.env.get('OUTREACH_CONTACT_EMAIL') || DEFAULT_CONTACT_EMAIL,
    unsubscribeMailto: Deno.env.get('OUTREACH_UNSUBSCRIBE_MAILTO') || '',
    website: Deno.env.get('OUTREACH_WEBSITE') || DEFAULT_WEBSITE,
    reason: Deno.env.get('OUTREACH_REASON_TEXT')
      || 'Primesti acest email pentru ca adresa ta publica de contact apare in directorul national VIASEE, ca reprezentant al unei optici, clinici sau cabinet din domeniul sanatatii vizuale.',
  };
}

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Linkurile din email accepta doar http/https: orice altceva (javascript:, data:) e aruncat.
export function safeHttpUrl(value = '') {
  const raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  return escapeHtml(raw);
}

// Textul de preview afisat de client langa subiect, in lista de mesaje. Ascuns in corpul emailului.
export function buildPreheader(bodyContent, explicit = '') {
  const text = String(explicit || stripHtml(bodyContent)).replace(/\s+/g, ' ').trim();
  return text.slice(0, 140);
}

export const PROVIDER_TYPE_LABELS = {
  optica_medicala: 'Optica medicala',
  clinica_oftalmologica: 'Clinica oftalmologica',
  cabinet_oftalmologic: 'Cabinet oftalmologic',
  cabinet_optometric: 'Cabinet optometric',
  laborator_optic: 'Laborator optic',
  optometrist_independent: 'Optometrist',
  medic_oftalmolog_independent: 'Medic oftalmolog',
};

const FONT_SANS = "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

// Paleta si tipografia sunt luate din designul real al site-ului (src/index.css + componentele din
// src/components/home), nu inventate: negru #171717, crem #F8F4EC, cardurile pastel din
// CategoryShowcase (lila #e8e0ea cu bordura #d4c6d8 — exact cardul "Medici si clinici", categoria
// din care face parte destinatarul) si accentul albastru #345bc8 al iconitelor patrate.
// Manrope, greutate 800, pentru titluri — ca in hero-ul "Spune ce cauti.". Fara serif, fara
// culori din afara sistemului.
const INK = '#171717';
const CREAM = '#f8f4ec';
const LILAC = '#e8e0ea';
const LILAC_EDGE = '#d4c6d8';
const BLUE = '#345bc8';
const BLUE_EDGE = '#274bac';
const WARM_GREY = '#6f6a63';
const HAIRLINE = '#e5ded2';

// Panoul vizual: cardul de categorie al site-ului, adus in email. Are pastelul si bordura din
// CategoryShowcase, iconita patrata albastra, si liniile subtiri/reperele "+" care dau aerul de
// desen tehnic optic al ilustratiilor VIASEE. Construit din tabele si culori — nicio imagine de
// gazduit, deci nimic de blocat de clientul de email si nimic care sa dispara cu imaginile oprite.
export function buildListingPreviewBlock(showcase = {}) {
  if (!showcase || showcase.enabled === false) return '';
  const name = escapeHtml(showcase.name || 'Optica dumneavoastra');
  const typeLabel = escapeHtml(showcase.typeLabel || PROVIDER_TYPE_LABELS[showcase.providerType] || 'Furnizor listat');
  const place = escapeHtml([showcase.city, showcase.county].filter(Boolean).join(', ') || 'Romania');
  const chip = escapeHtml(showcase.chip || 'Profil nerevendicat');
  const initial = escapeHtml((String(showcase.name || 'V').trim().charAt(0) || 'V').toUpperCase());
  const tick = `<span style="color:${LILAC_EDGE};font-size:11px;line-height:1;">+</span>`;

  return '<tr><td style="padding:26px 32px 2px;" class="vs-pad">'
    + `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${LILAC}" style="background-color:${LILAC};background-image:repeating-linear-gradient(0deg,transparent,transparent 17px,rgba(23,23,23,0.045) 17px,rgba(23,23,23,0.045) 18px),repeating-linear-gradient(90deg,transparent,transparent 17px,rgba(23,23,23,0.045) 17px,rgba(23,23,23,0.045) 18px);border:1px solid ${LILAC_EDGE};border-radius:20px;">`
    + '<tr><td style="padding:16px 18px 20px;">'

    // Randul de reper, ca adnotarile din ilustratiile site-ului.
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
    + `<td align="left" style="font-family:${FONT_SANS};">${tick}</td>`
    + `<td align="center" style="font-family:${FONT_SANS};font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${WARM_GREY};">Fisa dumneavoastra in director</td>`
    + `<td align="right" style="font-family:${FONT_SANS};">${tick}</td>`
    + '</tr></table>'

    + '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #ffffff;border-radius:16px;margin-top:12px;"><tr><td style="padding:18px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
    + `<td width="52" valign="top" style="width:52px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td align="center" valign="middle" bgcolor="${BLUE}" width="44" height="44" style="width:44px;height:44px;background:${BLUE};border:1px solid ${BLUE_EDGE};border-radius:12px;font-family:${FONT_SANS};font-size:19px;font-weight:800;color:${CREAM};">${initial}</td></tr></table></td>`
    + '<td valign="top" style="padding-left:13px;">'
    + `<p style="margin:0 0 5px;font-family:${FONT_SANS};font-size:18px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;color:${INK};">${name}</p>`
    + `<p style="margin:0;font-family:${FONT_SANS};font-size:12px;line-height:1.5;color:${WARM_GREY};">${typeLabel} &nbsp;&middot;&nbsp; ${place}</p>`
    + '</td></tr></table>'
    + `<div style="height:0;border-top:1px dashed ${LILAC_EDGE};font-size:0;line-height:0;margin:15px 0 13px;">&nbsp;</div>`
    + '<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
    + `<td bgcolor="${CREAM}" style="background:${CREAM};border:1px solid ${HAIRLINE};border-radius:999px;padding:5px 12px;font-family:${FONT_SANS};font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:${INK};">${chip}</td>`
    + `<td style="padding-left:10px;font-family:${FONT_SANS};font-size:11px;color:${WARM_GREY};">vizibil public pe viasee.ro</td>`
    + '</tr></table>'
    + '</td></tr></table>'

    + '</td></tr></table>'
    + '</td></tr>';
}

// Sablonul de email. Reia structura paginii VIASEE: bara neagra cu wordmark-ul, o eticheta mica
// cu majuscule distantate (ca badge-ul din site), titlu greu si strans, apoi continutul.
// Constrangeri de email: tabele, CSS inline, fara flex/grid, buton pe tabel pentru Outlook,
// fonturi Google cu fallback real, `color-scheme: light` impotriva inversarii in modul intunecat.
export function buildEmailHtml(bodyContent, unsubscribeHtml, campaignSubject = 'VIASEE', options = {}) {
  const year = new Date().getFullYear();
  const legal = legalConfig();
  const subject = escapeHtml(campaignSubject || legal.brand);
  const ctaUrl = safeHttpUrl(options.ctaUrl);
  const ctaLabel = escapeHtml(options.ctaLabel || 'Vezi detalii');
  const preheader = escapeHtml(buildPreheader(bodyContent, options.preheader));
  const eyebrow = escapeHtml(options.eyebrow || 'Director national de sanatate vizuala');
  const previewBlock = options.showcase ? buildListingPreviewBlock(options.showcase) : '';

  const ctaBlock = ctaUrl
    ? '<tr><td align="center" style="padding:24px 32px 4px;">'
      + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>'
      + `<td align="center" bgcolor="${INK}" style="border-radius:999px;">`
      + `<a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-family:${FONT_SANS};font-size:14px;font-weight:800;line-height:1;color:${CREAM};text-decoration:none;border-radius:999px;">${ctaLabel} &nbsp;&rarr;</a>`
      + '</td></tr></table></td></tr>'
    : '';

  return '<!DOCTYPE html>'
    + '<html lang="ro"><head><meta charset="utf-8"/>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"/>'
    + '<meta name="color-scheme" content="light"/><meta name="supported-color-schemes" content="light"/>'
    + `<title>${subject}</title>`
    + '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet"/>'
    + '<style>'
    + `a{color:${INK};}`
    + '@media only screen and (max-width:600px){'
    + '.vs-pad{padding-left:20px!important;padding-right:20px!important;}'
    + '.vs-h1{font-size:24px!important;}'
    + '}'
    + '</style>'
    + '</head>'
    + `<body style="margin:0;padding:0;background:${CREAM};font-family:${FONT_SANS};color:${INK};-webkit-font-smoothing:antialiased;">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</div>`
    + `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${CREAM};padding:30px 14px;"><tr><td align="center">`
    + `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:620px;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:22px;overflow:hidden;">`

    // Bara neagra de sus, ca headerul site-ului.
    + `<tr><td bgcolor="${INK}" style="background:${INK};padding:20px 32px;" class="vs-pad">`
    + `<span style="font-family:${FONT_SANS};font-size:16px;font-weight:800;letter-spacing:0.26em;color:#ffffff;text-transform:uppercase;">${escapeHtml(legal.brand)}</span>`
    + '</td></tr>'

    // Eticheta mica + titlu greu, ca in hero.
    + '<tr><td style="padding:32px 32px 0;" class="vs-pad">'
    + `<span style="display:inline-block;background:${CREAM};border:1px solid ${HAIRLINE};border-radius:999px;padding:5px 12px;font-family:${FONT_SANS};font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${WARM_GREY};">${eyebrow}</span>`
    + `<h1 class="vs-h1" style="margin:16px 0 0;font-family:${FONT_SANS};font-size:30px;line-height:1.14;font-weight:800;letter-spacing:-0.025em;color:${INK};">${subject}</h1>`
    + '</td></tr>'

    + `<tr><td style="padding:18px 32px 4px;" class="vs-pad"><div style="font-family:${FONT_SANS};font-size:15px;line-height:1.7;color:#3d3a35;">${bodyContent}</div></td></tr>`
    + previewBlock
    + ctaBlock
    + `<tr><td style="padding:28px 32px 0;" class="vs-pad"><div style="height:1px;background:${HAIRLINE};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`

    + `<tr><td bgcolor="${CREAM}" style="background:${CREAM};padding:22px 32px 26px;" class="vs-pad">`
    + `<p style="margin:0 0 8px;font-family:${FONT_SANS};color:${WARM_GREY};font-size:12px;line-height:1.6;"><strong style="color:${INK};">${escapeHtml(legal.brand)}</strong> &mdash; director national pentru servicii de sanatate vizuala.</p>`
    + `<p style="margin:0 0 10px;font-family:${FONT_SANS};color:${WARM_GREY};font-size:12px;line-height:1.6;">Contact: <a href="mailto:${escapeHtml(legal.contactEmail)}" style="color:${INK};text-decoration:underline;">${escapeHtml(legal.contactEmail)}</a> &nbsp;&middot;&nbsp; <a href="${safeHttpUrl(legal.website) || '#'}" style="color:${INK};text-decoration:underline;">${escapeHtml(String(legal.website).replace(/^https?:\/\//, ''))}</a></p>`
    + `<p style="margin:0 0 10px;font-family:${FONT_SANS};color:#8a857d;font-size:11px;line-height:1.55;">${escapeHtml(legal.reason)}</p>`
    + `<p style="margin:0;font-family:${FONT_SANS};color:#8a857d;font-size:11px;line-height:1.55;">${unsubscribeHtml}</p>`
    + `<p style="margin:12px 0 0;font-family:${FONT_SANS};color:#b8b0a3;font-size:10px;">&copy; ${year} ${escapeHtml(legal.legalCompany)}</p>`
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

export function buildPlainText(bodyHtml, unsubscribeUrl, options = {}) {
  const legal = legalConfig();
  const ctaUrl = String(options.ctaUrl || '').trim();
  const lines = [stripHtml(bodyHtml)];
  if (/^https?:\/\//i.test(ctaUrl)) lines.push('', `${options.ctaLabel || 'Vezi detalii'}: ${ctaUrl}`);
  return lines.concat([
    '',
    '---',
    `${legal.brand}`,
    `Contact: ${legal.contactEmail}`,
    `Website: ${legal.website}`,
    `De ce primesti acest email: ${legal.reason}`,
    `Dezabonare: ${unsubscribeUrl}`,
  ]).join('\n');
}

export function compactDetails(value) {
  try {
    const text = JSON.stringify(value || {});
    return JSON.parse(text.length > 5000 ? text.slice(0, 5000) : text);
  } catch (_) {
    return {};
  }
}

export function complianceMissing(contact) {
  const missing = [];
  if (!contact?.lawful_basis) missing.push('lawful_basis');
  if (!contact?.source_url && !contact?.source) missing.push('source_url/source');
  if (!contact?.collection_date) missing.push('collection_date');
  if (!contact?.source_type && !contact?.source) missing.push('source_type');
  return missing;
}

export async function sendViaResend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* noop */ }
  return { ok: res.ok, status: res.status, text, json };
}

// Trimitere in lot prin Resend Batch API (max 100 email-uri/apel). Fiecare `payloads[i]` are
// aceeasi forma ca payload-ul acceptat de sendViaResend. Rezultatul e in aceeasi ordine ca inputul
// cand Resend reuseste (json.data[i].id); la eroare (ok:false) ordinea rezultatelor Resend nu mai e garantata per e-mail, deci
// apelantul trebuie sa trateze intreg lotul ca esuat si sa reincerce mai tarziu.
export async function sendBatchViaResend(apiKey, payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) return { ok: true, status: 200, results: [] };
  if (payloads.length > 100) throw new Error('Resend Batch API accepta maxim 100 de email-uri per apel.');
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payloads),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* noop */ }
  const results = Array.isArray(json?.data) ? json.data : [];
  return { ok: res.ok, status: res.status, text, json, results };
}

// ── Verificare semnatura webhook Resend (Svix) — portata identic din Optilun (resendWebhook/entry.ts) ──

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifySvixSignature(payload, headers, secret) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatureHeader = headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > 5 * 60 * 1000) return false;

  const signedContent = `${id}.${timestamp}.${payload}`;
  const secretValue = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secretValue),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const candidates = signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^v\d+,/, ''));

  return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}

export function extractResendMessageId(event) {
  const data = event?.data || {};
  return data.email_id || data.id || data.message_id || data.email?.id || event?.email_id || event?.message_id || '';
}

export function extractResendRecipientEmail(event) {
  const data = event?.data || {};
  const raw = Array.isArray(data.to) ? data.to[0] : data.to || data.recipient || data.email || data.rcpt_to || '';
  if (typeof raw !== 'string') return '';
  const match = raw.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : raw);
}

export function resendEventTime(event) {
  return event?.created_at || event?.data?.created_at || new Date().toISOString();
}

export function compactRawEvent(event) {
  const raw = JSON.stringify(event || {});
  if (raw.length <= 12000) return event;
  const data = event?.data || {};
  return {
    truncated: true,
    type: event?.type,
    created_at: event?.created_at,
    data: {
      email_id: data.email_id || data.id,
      message_id: data.message_id,
      to: data.to,
      subject: data.subject,
      bounce: data.bounce,
      click: data.click,
      open: data.open,
      error: data.error || data.message || data.reason,
      tags: data.tags,
    },
  };
}

function permanentFailure(event) {
  const data = event?.data || {};
  const bounce = data.bounce || {};
  const text = JSON.stringify({ bounce, error: data.error, message: data.message, reason: data.reason, status: data.status }).toLowerCase();
  return event?.type === 'email.bounced'
    || bounce.type === 'Permanent'
    || text.includes('permanent')
    || text.includes('hard bounce')
    || text.includes('suppressed')
    || text.includes('invalid recipient')
    || text.includes('invalid email')
    || text.includes('recipient address');
}

export function statusForResendEvent(event) {
  switch (event?.type) {
    case 'email.sent': return 'sent';
    case 'email.delivered': return 'delivered';
    case 'email.delivery_delayed': return 'delivery_delayed';
    case 'email.opened': return 'opened';
    case 'email.clicked': return 'clicked';
    case 'email.bounced': return 'bounced';
    case 'email.complained': return 'complained';
    case 'email.failed': return permanentFailure(event) ? 'bounced' : 'failed';
    default: return 'unknown';
  }
}

export function timestampFieldForStatus(status) {
  if (status === 'sent') return 'sent_at';
  if (status === 'delivered') return 'delivered_at';
  if (status === 'delivery_delayed') return 'delivery_delayed_at';
  if (status === 'bounced') return 'bounced_at';
  if (status === 'complained') return 'complained_at';
  if (status === 'failed') return 'failed_at';
  return 'created_at';
}

export function getResendErrorMessage(event) {
  const data = event?.data || {};
  if (typeof data.error === 'string') return data.error;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.reason === 'string') return data.reason;
  if (data.bounce?.message) return data.bounce.message;
  return '';
}
