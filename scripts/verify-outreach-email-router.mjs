// Verifica modulul de outreach email (VIASEE) - port + imbunatatire a sistemului din Optilun
// (vezi claude/... planul aprobat). Trei garantii centrale:
// 1. outreachWebhookOps si outreachUnsubscribeOps NU sunt niciodata accesibile prin __function -
//    router.ts le directioneaza direct, pe baza header-ului svix-signature / query string-ului
//    outreach_action, INAINTE de orice parsare __function/payload.
// 2. outreachSendOps verifica suprimarea chiar inainte de fiecare trimitere si trimite in loturi
//    (Resend Batch API), nu sincron ca la Optilun.
// 3. Cele 5 entitati noi raman admin-only (RLS), iar aprobarea unei campanii reale cere o
//    confirmare tastata, recalculata la momentul aprobarii.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTORY_FUNCTION_ROUTES } from '../base44/shared/directoryFunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function stripLineComments(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function extractFunctionBody(text, functionSignaturePattern) {
  const match = functionSignaturePattern.exec(text);
  assert.ok(match, `Nu am gasit ${functionSignaturePattern}`);
  const start = match.index;
  const nextFunction = text.indexOf('\nasync function', start + 1);
  const nextExport = text.indexOf('\nexport async function', start + 1);
  const candidates = [nextFunction, nextExport].filter((i) => i !== -1);
  const end = candidates.length ? Math.min(...candidates) : text.length;
  return text.slice(start, end);
}

// --- Rutare: outreachCampaignOps/outreachSendOps sunt logice, prin directoryOps -----------------
assert.equal(DIRECTORY_FUNCTION_ROUTES.outreachCampaignOps, 'directoryOps');
assert.equal(DIRECTORY_FUNCTION_ROUTES.outreachSendOps, 'directoryOps');
// outreachWebhookOps/outreachUnsubscribeOps NU trebuie sa apara aici - securitatea lor vine din
// semnatura Svix / tokenul semnat, nu dintr-o sesiune Base44 autentificata.
assert.equal(DIRECTORY_FUNCTION_ROUTES.outreachWebhookOps, undefined, 'outreachWebhookOps nu trebuie sa fie apelabil prin __function');
assert.equal(DIRECTORY_FUNCTION_ROUTES.outreachUnsubscribeOps, undefined, 'outreachUnsubscribeOps nu trebuie sa fie apelabil prin __function');

for (const moduleName of ['outreachCampaignOps', 'outreachSendOps', 'outreachWebhookOps', 'outreachUnsubscribeOps']) {
  assert.ok(existsSync(path.join(root, 'base44/functions/directoryOps', `${moduleName}.ts`)), `Modul lipsa: ${moduleName}.ts`);
  assert.ok(!existsSync(path.join(root, 'base44/functions', moduleName, 'entry.ts')), `${moduleName} nu trebuie sa aiba o functie fizica proprie`);
}

// --- router.ts: cele doua ramuri publice trebuie sa apara INAINTE de parsarea __function --------
const routerSource = source('base44/functions/directoryOps/router.ts');
assert.match(routerSource, /import \{ handle as outreachCampaignOpsHandle \} from '\.\/outreachCampaignOps\.ts'/);
assert.match(routerSource, /import \{ handle as outreachSendOpsHandle \} from '\.\/outreachSendOps\.ts'/);
assert.match(routerSource, /import \{ handle as outreachWebhookOpsHandle \} from '\.\/outreachWebhookOps\.ts'/);
assert.match(routerSource, /import \{ handle as outreachUnsubscribeOpsHandle \} from '\.\/outreachUnsubscribeOps\.ts'/);
assert.match(routerSource, /outreachCampaignOps: outreachCampaignOpsHandle/);
assert.match(routerSource, /outreachSendOps: outreachSendOpsHandle/);

const svixBranchIndex = routerSource.indexOf("if (req.headers.get('svix-signature'))");
const unsubscribeBranchIndex = routerSource.indexOf("outreach_action") ;
const jsonParseIndex = routerSource.indexOf('req.clone().json()');
assert.ok(svixBranchIndex !== -1 && svixBranchIndex < jsonParseIndex, 'Verificarea header-ului svix-signature trebuie sa fie inaintea parsarii __function');
assert.ok(unsubscribeBranchIndex !== -1 && unsubscribeBranchIndex < jsonParseIndex, 'Verificarea outreach_action trebuie sa fie inaintea parsarii __function');
assert.match(routerSource, /outreachWebhookOpsHandle\(req\)/);
assert.match(routerSource, /outreachUnsubscribeOpsHandle\(req\)/);

// --- outreachWebhookOps.ts: fara sesiune Base44, esec inchis pe semnatura invalida/lipsa ---------
const webhookSource = source('base44/functions/directoryOps/outreachWebhookOps.ts');
assert.doesNotMatch(stripLineComments(webhookSource), /auth\.me\(\)/, 'Webhook-ul Resend nu are niciodata o sesiune Base44 - nu trebuie sa apeleze auth.me()');
assert.match(webhookSource, /verifySvixSignature/);
assert.match(webhookSource, /RESEND_WEBHOOK_SECRET/);
assert.match(webhookSource, /status: 400.*Semnatura webhook invalida|Semnatura webhook invalida.*status: 400|error: 'Semnatura webhook invalida' \}, 400\)/s);
for (const eventType of ['email.delivered', 'email.bounced', 'email.complained', 'email.failed', 'email.opened', 'email.clicked']) {
  assert.match(webhookSource, new RegExp(eventType.replace('.', '\\.')));
}

// --- outreachUnsubscribeOps.ts: doar token semnat, fara fallback "legacy" pe email in clar -------
const unsubscribeSource = source('base44/functions/directoryOps/outreachUnsubscribeOps.ts');
assert.doesNotMatch(stripLineComments(unsubscribeSource), /auth\.me\(\)/, 'Dezabonarea publica nu are o sesiune Base44');
assert.match(unsubscribeSource, /verifyUnsubscribeToken/);
assert.doesNotMatch(unsubscribeSource, /searchParams\.get\('email'\)/, 'Nu trebuie sa existe un fallback de dezabonare pe baza unui email trimis in clar, fara semnatura');

// --- outreachSendOps.ts: bypass de automatizare, suprimare verificata inainte de trimitere, -------
// trimitere in lot (nu sincron ca la Optilun), idempotenta prin log-uri terminale --------------
const sendOpsSource = source('base44/functions/directoryOps/outreachSendOps.ts');
assert.match(sendOpsSource, /action === 'advance_campaign_sends' && input\.__automation_trigger === true/, 'Bypass-ul de automatizare trebuie sa verifice explicit actiunea si flag-ul, ca la directoryAutoImportOps');
assert.match(sendOpsSource, /user\.role !== 'admin'/, 'O rulare manuala (fara __automation_trigger) trebuie sa ramana rezervata adminilor');
// __automation_trigger e doar o indicatie de rutare: cronul se identifica prin credentialul de
// serviciu (Authorization === Base44-Service-Authorization), validat cu o citire reala.
const automationBody = extractFunctionBody(sendOpsSource, /async function automationServiceRole\(/);
assert.match(automationBody, /authorization === serviceAuthorization/);
assert.match(automationBody, /Base44-Service-Authorization/);
assert.match(automationBody, /svc\.entities\.OutreachCampaign\.filter\(/, 'Credentialul de serviciu trebuie validat cu o citire facuta cu el');
assert.match(sendOpsSource, /const svc = await automationServiceRole\(base44, req\);\s*if \(!svc\) return Response\.json\([^)]*\{ status: 403 \}\)/, 'Un apel de automatizare fara credential de serviciu trebuie refuzat');
assert.doesNotMatch(sendOpsSource, /actionAdvanceCampaignSends\(base44\.asServiceRole\)/, 'asServiceRole nu se da fara verificarea credentialului');
assert.match(sendOpsSource, /loadCampaignProgress/);
assert.match(sendOpsSource, /sendBatchViaResend/);
// Idempotenta Resend: cheie din continutul lotului, etichete campanie + contact pe fiecare email.
assert.match(sendOpsSource, /sendBatchViaResend\(apiKey, payloads, \{ idempotencyKey \}\)/);
assert.match(sendOpsSource, /name: 'viasee_campaign'/);
assert.match(sendOpsSource, /name: 'viasee_contact'/);
assert.match(sendOpsSource, /issuedAt: tokenIssuedAt/, 'Tokenul de dezabonare trebuie sa fie determinist, altfel cheia de idempotenta difera la reincercare');

const advanceBody = extractFunctionBody(sendOpsSource, /async function advanceOneCampaign\(/);
assert.doesNotMatch(advanceBody, /\bsendViaResend\(/, 'Trimiterea reala a campaniei trebuie sa foloseasca Resend Batch API, nu trimitere sincrona per destinatar');
// Suprimarea e pe categorii (marketing / anunturi); 'all' (respingeri, reclamatii, dezabonare
// totala) blocheaza orice campanie. Vezi shared/outreachAudiencePolicy.js.
const suppressionCheckIndex = advanceBody.search(/isContactSuppressed\(contact\)\s*\|\|\s*isSuppressedFor\(suppressionMap, email, category\)/);
const batchSendIndex = advanceBody.indexOf('deliverBatch(');
assert.ok(suppressionCheckIndex !== -1, 'Verificarea de suprimare per-destinatar lipseste din advanceOneCampaign');
assert.ok(suppressionCheckIndex < batchSendIndex, 'Suprimarea trebuie verificata inainte de trimiterea efectiva a lotului');

// Un esec de lot (rate limit, 5xx, retea) nu are voie sa arda destinatarii: fara log terminal
// 'failed' per contact si fara avansarea cursorului, ca urmatorul ciclu de cron sa ii reia.
assert.doesNotMatch(
  advanceBody,
  /safeCampaignLog\([^;]*status: 'failed'/s,
  'Un esec de lot nu trebuie sa scrie log-uri terminale failed per destinatar: ei ar fi sariti definitiv, desi nu au primit nimic',
);
assert.match(advanceBody, /batchFailure = delivery\.failure/, 'Esecul de lot trebuie retinut si tratat dupa bucla, nu ignorat');
assert.match(sendOpsSource, /isTransientBatchFailure\(result\)/, 'Esecurile tranzitorii trebuie deosebite de cele permanente');
// Inaintea fiecarui lot: lock-ul e inca al rularii, adminul n-a oprit campania.
const gateIndex = advanceBody.lastIndexOf('checkBeforeSend(', batchSendIndex);
assert.ok(gateIndex !== -1 && gateIndex < batchSendIndex, 'Verificarea lock-ului trebuie facuta chiar inainte de trimiterea lotului');
assert.match(extractFunctionBody(sendOpsSource, /async function checkBeforeSend\(/), /live\.execution_lock_token !== lockToken/);
const batchFailureIndex = advanceBody.indexOf('batchFailure = delivery.failure');
const cursorAdvanceIndex = advanceBody.indexOf('cursor += span');
// Lotul se noteaza "in aer" inainte de trimitere, ca un raspuns pierdut sa fie retrimis identic.
const inflightIndex = advanceBody.indexOf('inflight_batch: { cursor, span, key');
assert.ok(inflightIndex !== -1 && inflightIndex < batchSendIndex, 'Lotul trebuie notat ca nesigur inainte de trimitere');
// Citirile de care depinde idempotenta nu au voie sa devina liste goale la o eroare.
for (const name of ['loadCampaignProgress', 'getSuppressionMap']) {
  assert.doesNotMatch(extractFunctionBody(sendOpsSource, new RegExp(`async function ${name}\\(`)), /\.catch\(\(\) => \[\]\)/, `${name}: o citire esuata nu poate deveni o lista goala`);
}
assert.ok(batchFailureIndex !== -1 && cursorAdvanceIndex !== -1);
assert.ok(
  advanceBody.slice(batchFailureIndex, cursorAdvanceIndex).includes('break;'),
  'Dupa un esec de lot trebuie iesit din bucla INAINTE de avansarea cursorului',
);

// Aceeasi adresa nu primeste aceeasi campanie de doua ori, chiar daca apare pe mai multe locatii.
assert.match(advanceBody, /seenEmails\.has\(email\)/, 'Lipseste deduplicarea per adresa in interiorul campaniei');
assert.match(advanceBody, /duplicate_email_in_campaign/);

// Temeiul legal + provenienta sunt conditie de trimitere, nu doar o statistica in preview.
assert.match(advanceBody, /complianceMissing\(contact\)/, 'Contactele fara metadate de conformitate trebuie sarite la trimitere');
assert.match(advanceBody, /missing_compliance_metadata/);

// Fara lista inghetata de destinatari campania s-ar marca 'sent' fara sa trimita nimic.
assert.match(advanceBody, /recipient_contact_ids/);
assert.match(advanceBody, /if \(!ids\.length\)/, 'Lipseste garda pentru campanie fara destinatari');

// Pauza/anularea data de admin in timpul unei rulari nu trebuie suprascrisa inapoi in 'sending'.
assert.match(sendOpsSource, /ADMIN_STOP_STATUSES/);
assert.match(sendOpsSource, /async function releaseLockPreservingAdminStop\(/);
assert.doesNotMatch(
  advanceBody,
  /status: finished \? 'sent' : 'sending'/,
  'Statusul final trebuie scris prin releaseLockPreservingAdminStop, ca sa nu suprascrie o pauza data intre timp',
);
assert.match(advanceBody, /releaseLockPreservingAdminStop\(/);

// Preluarea unei campanii se confirma prin doua re-citiri, la o clipa distanta (Base44 nu are
// update conditionat, iar ordinea a doua scrieri simultane nu e garantata).
const claimBody = extractFunctionBody(sendOpsSource, /async function claimCampaignForSending\(/);
assert.match(claimBody, /first\.execution_lock_token !== token/, 'Lipseste confirmarea lock-ului prin re-citire');
assert.match(claimBody, /await sleep\(lockConfirmDelayMs\(\)\);\s*const confirmed = /, 'Lipseste a doua confirmare, dupa o pauza');
assert.match(claimBody, /confirmed\.execution_lock_token !== token/);
assert.match(claimBody, /hasActiveLock\(fresh, nowMs\)/, 'Re-citirea dinaintea preluarii trebuie sa respecte un lock activ');

// --- outreachCampaignOps.ts: aprobare cu confirmare tastata + materializare cu conformitate ------
const campaignOpsSource = source('base44/functions/directoryOps/outreachCampaignOps.ts');
assert.match(campaignOpsSource, /expectedConfirmation = `TRIMITE \$\{campaign\.name\} \$\{eligible\.length\}`/, 'Fraza de confirmare trebuie sa includa numarul de destinatari recalculat la momentul aprobarii');
assert.match(campaignOpsSource, /confirmationText !== expectedConfirmation/);
assert.match(campaignOpsSource, /sha256Hex/);
assert.match(campaignOpsSource, /campaign\.status !== 'draft'/, 'Editarea unei campanii trebuie restrictionata la starea draft');
assert.match(campaignOpsSource, /lawful_basis: 'legitimate_interest'/);
assert.match(campaignOpsSource, /source_url: location\.source_url/);

// Filtrele campaniei (judet / tip / stare profil) trebuie aplicate pe CONTACTE cand se calculeaza
// lista de destinatari. Cand se filtra doar dupa tag-uri, o campanie tintita pe un judet pleca
// catre toata tara, fara niciun semn in interfata.
// Regulile stau in shared/outreachAudiencePolicy.js (contactMatchesFilters), folosite la fel de
// lista de destinatari din interfata, previzualizare si aprobare.
const audiencePolicySource = source('base44/shared/outreachAudiencePolicy.js');
assert.match(audiencePolicySource, /export function contactMatchesFilters\(/);
assert.ok(audiencePolicySource.includes('contactMatchesFilters(contact, spec)'), 'Audienta trebuie filtrata pe segmentul complet, nu doar pe tag-uri');
const eligibleBody = extractFunctionBody(campaignOpsSource, /async function eligibleContactsForSegment\(/);
assert.match(eligibleBody, /computeAudience\(svc, audienceSpecFrom\(filters\)\)/, 'Aprobarea foloseste aceeasi audienta ca lista din interfata');
for (const field of ['counties.includes(contact.county)', 'providerTypes.includes(contact.provider_type)', 'controlStatuses.includes(contact.profile_control_status', 'emailScopes.includes(contact.email_scope']) {
  assert.ok(audiencePolicySource.includes(field), `contactMatchesFilters trebuie sa filtreze si dupa ${field}`);
}

// Clasificarea automata a contactelor materializate (tip / marime retea / stare profil).
assert.match(campaignOpsSource, /const PROVIDER_TYPE_TAGS = \{/);
for (const providerType of ['optica_medicala', 'clinica_oftalmologica', 'cabinet_oftalmologic', 'cabinet_optometric', 'laborator_optic', 'optometrist_independent', 'medic_oftalmolog_independent']) {
  assert.match(campaignOpsSource, new RegExp(`${providerType}:`), `Lipseste tag-ul automat pentru provider_type ${providerType}`);
}
assert.match(campaignOpsSource, /function networkTag\(/);
assert.match(campaignOpsSource, /function mergeTags\(/);
assert.match(campaignOpsSource, /AUTO_TAG_PREFIXES/, 'Tag-urile automate trebuie sa aiba prefixe rezervate, ca sa nu stearga tag-urile puse manual');

// --- Sincronizarea contactelor din director ------------------------------------------------------
// 2026-09-21: sincronizarea se oprea dupa 160 de contacte din ~1000 de locatii, pentru ca un lot de
// 300 de scrieri depasea timpul maxim al functiei. Plus: campurile cu doua adrese ("a@x.ro / b@x.ro")
// erau respinse in intregime, iar locatiile nepublicate primeau un email care spune ca "apar in
// rezultate".
{
  const chunkMatch = campaignOpsSource.match(/const SYNC_CHUNK_SIZE = (\d+);/);
  assert.ok(chunkMatch, 'SYNC_CHUNK_SIZE trebuie declarat explicit');
  assert.ok(Number(chunkMatch[1]) <= 60, `Un lot de sincronizare de ${chunkMatch[1]} scrieri risca sa depaseasca timpul maxim al functiei`);

  const policy = await import('../base44/shared/outreachEmailPolicy.js');
  assert.equal(policy.firstValidEmail('programari@x.ro / secretariat@x.ro'), 'programari@x.ro');
  assert.equal(policy.firstValidEmail('  Office@Exemplu.RO '), 'office@exemplu.ro');
  assert.equal(policy.firstValidEmail('a@x.ro, b@x.ro'), 'a@x.ro');
  assert.equal(policy.firstValidEmail('fara adresa'), '');
  assert.equal(policy.firstValidEmail(''), '');

  const syncBody = extractFunctionBody(campaignOpsSource, /async function actionSyncContactsFromDirectory\(/);
  assert.match(syncBody, /everyLocation\.filter\(isOutreachCandidate\)/, 'Sincronizarea ia doar locatiile publice cu o adresa valida');
  const groupBody = extractFunctionBody(campaignOpsSource, /function groupCandidatesByEmail\(/);
  assert.match(groupBody, /firstValidEmail\(location\.public_email\)/, 'Adresa se extrage cu firstValidEmail, nu se respinge tot campul');
  // Un contact se scrie cel mult o data per sincronizare: bucla merge pe adrese, nu pe locatii.
  assert.match(syncBody, /const groups = groupCandidatesByEmail\(candidates\)/);
  assert.match(syncBody, /const chunk = groups\.slice\(cursor, cursor \+ SYNC_CHUNK_SIZE\)/, 'Cursorul avanseaza pe adrese unice, nu pe locatii');
  assert.match(syncBody, /for \(const group of chunk\)/);
  assert.doesNotMatch(syncBody, /for \(const location of chunk\)/, 'Bucla pe locatii rescria acelasi contact de zeci de ori pentru lanturi');
  const nameBody = extractFunctionBody(campaignOpsSource, /function groupDisplayName\(/);
  assert.match(nameBody, /organization\?\.public_display_name \|\| organization\?\.name/, 'O adresa comuna unui lant poarta numele organizatiei, nu al primei sucursale');
  assert.match(syncBody, /if \(!syncPatchChangesContact\(existing, patch\)\)/, 'Contactele neschimbate nu se rescriu la fiecare resincronizare');
  assert.match(syncBody, /unique_emails:/, 'Raspunsul raporteaza cate adrese unice sunt, ca numarul final sa nu surprinda');

  const publicBody = extractFunctionBody(campaignOpsSource, /function isLocationPublic\(/);
  assert.match(publicBody, /status === 'publicata'/);
  assert.match(publicBody, /profile_control_status !== 'suspended'/);
  assert.match(publicBody, /active_status !== 'inactiva'/);

  const contactsUi = source('src/components/admin/outreach/OutreachContactsList.jsx');
  assert.match(contactsUi, /attempt < 3/, 'Un lot cazut se reincearca inainte ca sincronizarea sa se opreasca');
  assert.match(contactsUi, /Sincronizarea s-a oprit la/, 'O oprire trebuie sa spuna unde s-a oprit si ca se poate relua');
}

// --- A cui e adresa: locatie sau organizatie ------------------------------------------------------
// O adresa folosita de mai multe locatii (Lensa: 79) e a organizatiei. Se marcheaza separat, ca sa
// poata primi o campanie cu alt text decat "profilul din [ORAS]".
{
  assert.match(campaignOpsSource, /const AUTO_TAG_PREFIXES = \[[^\]]*'adresa:'/, 'Tag-ul adresa: e automat si se reimprospateaza la sincronizare');
  const scopeBody = extractFunctionBody(campaignOpsSource, /function groupAddressScope\(/);
  assert.match(scopeBody, /sharedLocationCount > 1 \? 'organization' : 'location'/);
  assert.match(audiencePolicySource, /filters\.target_email_scope/, 'Campaniile pot tinti separat adresele de organizatie');
  assert.match(campaignOpsSource, /const editable = \[[^\]]*'target_email_scope'/, 'Tipul adresei trebuie sa fie editabil pe campanie');
  // Ritmul de trimitere (limita zilnica) se alege in ciorna, pe langa segment.
  assert.match(campaignOpsSource, /const editable = \[[^\]]*'daily_send_limit', 'daily_send_ramp'/, 'Limita zilnica trebuie sa fie editabila pe campanie');
  const syncBodyScope = extractFunctionBody(campaignOpsSource, /async function actionSyncContactsFromDirectory\(/);
  for (const field of ['email_scope: scope.emailScope', 'shared_location_count: scope.sharedLocationCount', 'shared_city_count: scope.sharedCityCount']) {
    assert.ok(syncBodyScope.includes(field), `Sincronizarea trebuie sa scrie ${field}`);
  }
  for (const field of ['email_scope', 'shared_location_count', 'shared_city_count']) {
    assert.match(source('base44/entities/OutreachContact.jsonc'), new RegExp(`"${field}"`), `OutreachContact.${field} trebuie declarat in schema`);
  }
  assert.match(source('base44/entities/OutreachCampaign.jsonc'), /"target_email_scope"/);

  const policy = await import('../base44/shared/outreachEmailPolicy.js');
  const cases = [[1, 'o locatie'], [5, '5 locatii'], [19, '19 locatii'], [20, '20 de locatii'], [79, '79 de locatii'], [101, '101 locatii'], [120, '120 de locatii'], [200, '200 de locatii']];
  for (const [count, expected] of cases) {
    assert.equal(policy.formatRoCount(count, 'locatie', 'locatii', 'o'), expected, `Numeral gresit pentru ${count}`);
  }
  const text = '[FIRMA] apare cu [LOCATII] din [ORASE].';
  assert.equal(
    policy.renderTemplateMergeFields(text, { company_name: 'Lensa', shared_location_count: 79, shared_city_count: 34, city: 'Alba Iulia' }),
    'Lensa apare cu 79 de locatii din 34 de orase.',
  );
  assert.equal(
    policy.renderTemplateMergeFields(text, { company_name: 'Optica X', shared_location_count: 4, shared_city_count: 1, city: 'Bucuresti' }),
    'Optica X apare cu 4 locatii din Bucuresti.',
  );

  const contactsUiScope = source('src/components/admin/outreach/OutreachContactsList.jsx');
  assert.match(contactsUiScope, /"adresa:organizatie"/, 'Distributia de la sincronizare arata cate adrese sunt de organizatie');
  assert.match(contactsUiScope, /contact\.email_scope === "organization"/, 'Lista de contacte marcheaza vizibil adresele de organizatie');
  assert.match(contactsUiScope, /hideContactOnlyFilters/, 'La sincronizare nu se afiseaza filtre care nu se aplica acolo');
}
const syncBody = extractFunctionBody(campaignOpsSource, /async function actionSyncContactsFromDirectory\(/);
assert.match(syncBody, /provider_type: location\.provider_type/, 'Contactul trebuie sa poarte tipul locatiei, ca segmentarea sa functioneze');
assert.match(syncBody, /profile_control_status: location\.profile_control_status/);
assert.match(syncBody, /tags: mergeTags\(existing\.tags, autoTags\)/, 'La resincronizare tag-urile manuale nu trebuie pierdute');
assert.match(syncBody, /countLocationsByOrganization|locationCounts/, 'Marimea retelei se calculeaza peste toate locatiile organizatiei');

// --- outreachEmailPolicy.js: functiile pure necesare exista si nu ating Base44 direct -------------
const policySource = source('base44/shared/outreachEmailPolicy.js');
for (const fnName of [
  'verifySvixSignature', 'sendBatchViaResend', 'sendViaResend', 'buildUnsubscribeUrls',
  'createUnsubscribeToken', 'verifyUnsubscribeToken', 'legalConfig', 'complianceMissing',
  'isContactSuppressed', 'validateSenderEmail', 'buildListUnsubscribeHeaders', 'isPermanentEmailError',
]) {
  assert.match(policySource, new RegExp(`export (?:async )?function ${fnName}\\(`), `Lipseste exportul ${fnName} din outreachEmailPolicy.js`);
}

// Antetul de dezabonare (RFC 8058) se construeste dintr-un singur loc, si la campanii si la test.
assert.match(policySource, /'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'/);
assert.equal(
  (sendOpsSource.match(/buildListUnsubscribeHeaders\(unsub\.oneClickUrl\)/g) || []).length,
  2,
  'Si trimiterea reala si emailul de test trebuie sa foloseasca aceleasi antete de dezabonare',
);

// --- Entitati: campurile de care depinde trimiterea exista in schema ------------------------------
// recipient_contact_ids a lipsit din schema desi codul scria si citea campul: aprobarea parea sa
// reuseasca, iar prima rulare marca instant campania 'sent' fara sa fi trimis vreun email.
const campaignSchema = JSON.parse(source('base44/entities/OutreachCampaign.jsonc'));
for (const field of ['recipient_contact_ids', 'current_cursor', 'consecutive_send_failures', 'execution_lock_token', 'failure_message']) {
  assert.ok(campaignSchema.properties?.[field], `OutreachCampaign.${field} trebuie declarat in schema: codul de trimitere depinde de el`);
}
assert.equal(campaignSchema.properties.recipient_contact_ids.type, 'array');
for (const field of ['cta_label', 'cta_url']) {
  assert.ok(campaignSchema.properties?.[field], `OutreachCampaign.${field} trebuie declarat: sablonul de email randeaza butonul din el`);
}

// Campurile pe care se face segmentarea trebuie sa existe pe contact, altfel filtrele tac.
const contactSchema = JSON.parse(source('base44/entities/OutreachContact.jsonc'));
for (const field of ['provider_type', 'profile_control_status', 'organization_location_count', 'tags', 'county']) {
  assert.ok(contactSchema.properties?.[field], `OutreachContact.${field} trebuie declarat: segmentarea campaniilor filtreaza pe el`);
}

// Sablonul de email: continutul dinamic e escapat, iar linkul butonului accepta doar http/https.
assert.match(policySource, /export function escapeHtml\(/);
assert.match(policySource, /export function safeHttpUrl\(/);
assert.match(policySource, /\^https\?:/, 'safeHttpUrl trebuie sa respinga alte scheme decat http/https');
const buildHtmlBody = extractFunctionBody(policySource, /export function buildEmailHtml\(/);
assert.match(buildHtmlBody, /escapeHtml\(campaignSubject/, 'Subiectul intra in HTML si trebuie escapat');
assert.match(buildHtmlBody, /safeHttpUrl\(options\.ctaUrl\)/);

// Blocul vizual din email e o imagine gazduita de noi (public/email/viasee-cautare.jpg): clientii
// de email nu randeaza SVG si nici data-URI, deci un <img> catre un URL https e singura varianta
// care se vede la fel in Gmail, Outlook si Apple Mail.
assert.match(policySource, /export function buildListingPreviewBlock\(/);
assert.match(
  policySource,
  /export const ARTWORK_URL = 'https:\/\/viasee\.ro\/email\/[\w.-]+'/,
  'Imaginea din email trebuie servita de pe viasee.ro, peste https',
);
assert.ok(
  existsSync(path.join(root, 'public/email/viasee-cautare.jpg')),
  'Fisierul imaginii trebuie sa existe in public/email, altfel emailurile trimit un <img> rupt',
);
const previewBody = extractFunctionBody(policySource, /export function buildListingPreviewBlock\(/);
assert.match(
  previewBody,
  /safeHttpUrl\(showcase\.artworkUrl \|\| ARTWORK_URL\)/,
  'URL-ul imaginii trece prin safeHttpUrl: doar http/https, niciodata javascript: sau data:',
);
assert.match(previewBody, /if \(!url\) return '';/, 'Fara URL valid nu se emite un <img> rupt');
assert.match(previewBody, /const alt = escapeHtml\(/, 'Textul alternativ contine numele firmei si trebuie escapat');
assert.match(previewBody, /alt="\$\{alt\}"/, 'Imaginea are nevoie de alt: multi clienti blocheaza implicit imaginile');
assert.match(previewBody, /escapeHtml\(showcase\.name/, 'Numele firmei intra in HTML si trebuie escapat');
assert.match(previewBody, /width="556"/, 'Outlook are nevoie de atributul width pe imagine, nu doar de CSS');
assert.match(previewBody, /max-width:556px;height:auto/, 'Imaginea trebuie sa se scaleze pe telefon fara sa se deformeze');

// Banda de sus poarta logo-ul real al site-ului, randat din public/brand/viasee-wordmark.svg:
// simbol + wordmark intr-o singura imagine, ca in ViaseeBrand.jsx. Alt-ul ramane numele
// brandului, stilizat ca wordmarkul,
// fiindca multi clienti blocheaza implicit imaginile.
assert.match(
  policySource,
  /export const LOGO_URL = 'https:\/\/viasee\.ro\/email\/[\w.-]+\.png'/,
  'Logo-ul din email trebuie servit ca PNG de pe viasee.ro, peste https',
);
assert.ok(
  existsSync(path.join(root, 'public/email/viasee-brand.png')),
  'Fisierul logo-ului trebuie sa existe in public/email, altfel banda de sus ramane goala',
);
assert.match(buildHtmlBody, /<img src="\$\{LOGO_URL\}" alt="\$\{escapeHtml\(legal\.brand\)\}"/, 'Logo-ul are nevoie de alt cu numele brandului');
assert.match(buildHtmlBody, /LOGO_URL[^`]*width="126"/, 'Outlook are nevoie de atributul width pe logo');

// Banda de sus reia gradientul din hero-ul site-ului. Outlook (motorul Word) nu randeaza
// gradiente, deci are nevoie de un bgcolor solid dedesubt.
assert.match(
  buildHtmlBody,
  /bgcolor="\$\{BAND\}"[^`]*background-image:linear-gradient/,
  'Banda de sus are nevoie de un bgcolor solid ca fallback pentru Outlook',
);

// Culorile si tipografia vin din designul real al site-ului, nu inventate. Aceste valori sunt
// citite direct din src/index.css si din sectiunea de categorii a home-ului (CategoryShowcase.jsx +
// CategoryStrip.jsx, unde stau acum culorile placutelor).
for (const [token, value] of [['INK', '#171717'], ['CREAM', '#f8f4ec'], ['LILAC', '#e8e0ea'], ['LILAC_EDGE', '#d4c6d8'], ['BLUE', '#345bc8']]) {
  assert.match(policySource, new RegExp(`const ${token} = '${value}'`), `${token} trebuie sa ramana culoarea reala din designul VIASEE (${value})`);
}
assert.doesNotMatch(policySource, /Fraunces/, 'Titlurile din email urmeaza hero-ul site-ului: Manrope greu, nu serif');
const homeShowcase = source('src/components/home/CategoryShowcase.jsx') + source('src/components/home/CategoryStrip.jsx');
for (const value of ['#e8e0ea', '#d4c6d8', '#345bc8']) {
  assert.ok(homeShowcase.includes(value), `Culoarea ${value} trebuie sa existe in sectiunea de categorii: emailul o reia de acolo`);
}

// Fisa se construieste per destinatar, nu o data pe campanie.
// Compunerea emailului sta intr-un singur loc (shared/outreachComposer.js), folosit de trimitere,
// de test si de previzualizarea din admin.
const composerSource = source('base44/shared/outreachComposer.js');
assert.ok(composerSource.indexOf('showcase:') !== -1, 'Trimiterea trebuie sa alimenteze fisa din email');
assert.match(composerSource, /name: contact\.company_name/, 'Fisa trebuie construita din datele contactului curent');
assert.match(composerSource, /campaign\.show_listing_preview === false/, 'Fisa trebuie sa poata fi dezactivata per campanie');
assert.match(advanceBody, /composeOutreachEmail\(campaign, contact, \{ unsubscribeUrl: unsub\.publicUrl \}\)/, 'Fiecare destinatar primeste emailul compus pentru el');

// --- Entitati: toate cele 5 raman admin-only (RLS) ------------------------------------------------
for (const entityName of ['OutreachContact', 'OutreachCampaign', 'OutreachCampaignLog', 'OutreachSuppression', 'OutreachTemplate']) {
  const schema = JSON.parse(source(`base44/entities/${entityName}.jsonc`));
  for (const action of ['create', 'read', 'update', 'delete']) {
    assert.equal(
      schema.rls?.[action]?.user_condition?.role,
      'admin',
      `${entityName}.rls.${action} trebuie sa ramana admin-only`,
    );
  }
}

// --- Workflow cron: acelasi tipar ca Directory Auto Import Scheduler -----------------------------
const workflowSource = source('base44/workflows/Outreach Campaign Scheduler.jsonc');
const workflow = JSON.parse(workflowSource);
assert.equal(workflow.trigger.config.trigger_type, 'scheduled');
assert.equal(workflow.trigger.config.cron_expression, '*/5 * * * *');
assert.equal(workflow.trigger.config.timezone, 'Europe/Bucharest');
const step = workflow.definition.do[0].advance_outreach_campaign_sends;
assert.equal(step.with.function_name, 'directoryOps');
assert.equal(step.with.args.__function, 'outreachSendOps');
assert.equal(step.with.args.payload.action, 'advance_campaign_sends');
assert.equal(step.with.args.payload.__automation_trigger, true);

// --- Frontend: nav + tab wiring, si apelurile catre logica noua folosesc rutele inregistrate -----
const navConfigSource = source('src/lib/adminNavConfig.js');
assert.match(navConfigSource, /key: "outreach"/);

const adminPageSource = source('src/pages/AdminDirectoryOps.jsx');
assert.match(adminPageSource, /@\/components\/admin\/outreach\/OutreachWorkspace/);
assert.match(adminPageSource, /tab === "outreach" && <OutreachWorkspace \/>/);

for (const componentFile of [
  'src/components/admin/outreach/OutreachCampaignList.jsx',
  'src/components/admin/outreach/OutreachCampaignDetail.jsx',
  'src/components/admin/outreach/OutreachContactsList.jsx',
]) {
  const componentSource = source(componentFile);
  assert.match(componentSource, /outreachCampaignOps/, `${componentFile} trebuie sa apeleze outreachCampaignOps`);
}

// Sablonul salvat trebuie sa poata porni o campanie: altfel ramane un text pe care cineva il
// copiaza manual. Precompletarea copiaza continutul in ciorna, deci editarea ulterioara a
// sablonului nu schimba campaniile deja pornite.
const campaignDetailSource = source('src/components/admin/outreach/OutreachCampaignDetail.jsx');
assert.match(campaignDetailSource, /'list_templates'|"list_templates"/, 'Ciorna trebuie sa poata incarca sabloanele salvate');
assert.match(campaignDetailSource, /body_html: template\.body/, 'Sablonul precompleteaza continutul campaniei');
assert.match(campaignDetailSource, /subject: template\.subject/, 'Sablonul precompleteaza subiectul campaniei');
assert.ok(
  campaignOpsSource.includes("'template_id'"),
  'template_id trebuie sa fie salvabil pe campanie, ca sa se stie din ce sablon a pornit',
);

const unsubscribePageSource = source('src/pages/Unsubscribe.jsx');
assert.match(unsubscribePageSource, /outreach_action=unsubscribe/);

const appSource = source('src/App.jsx');
assert.match(appSource, /path="\/dezabonare" element=\{<Unsubscribe \/>\}/);

console.log(JSON.stringify({
  outreach_logical_routes: ['outreachCampaignOps', 'outreachSendOps'],
  outreach_unauthenticated_handlers: ['outreachWebhookOps', 'outreachUnsubscribeOps'],
  outreach_entities_admin_only: ['OutreachContact', 'OutreachCampaign', 'OutreachCampaignLog', 'OutreachSuppression', 'OutreachTemplate'],
  outreach_scheduler_cron: workflow.trigger.config.cron_expression,
}, null, 2));
