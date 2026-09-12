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
assert.match(sendOpsSource, /getAlreadyProcessedContactIds/);
assert.match(sendOpsSource, /sendBatchViaResend/);

const advanceBody = extractFunctionBody(sendOpsSource, /async function advanceOneCampaign\(/);
assert.doesNotMatch(advanceBody, /\bsendViaResend\(/, 'Trimiterea reala a campaniei trebuie sa foloseasca Resend Batch API, nu trimitere sincrona per destinatar');
const suppressionCheckIndex = advanceBody.search(/isContactSuppressed\(contact\)\s*\|\|\s*suppressionSet\.has\(email\)/);
const batchSendIndex = advanceBody.indexOf('sendBatchViaResend(');
assert.ok(suppressionCheckIndex !== -1, 'Verificarea de suprimare per-destinatar lipseste din advanceOneCampaign');
assert.ok(suppressionCheckIndex < batchSendIndex, 'Suprimarea trebuie verificata inainte de trimiterea efectiva a lotului');

// --- outreachCampaignOps.ts: aprobare cu confirmare tastata + materializare cu conformitate ------
const campaignOpsSource = source('base44/functions/directoryOps/outreachCampaignOps.ts');
assert.match(campaignOpsSource, /expectedConfirmation = `TRIMITE \$\{campaign\.name\} \$\{eligible\.length\}`/, 'Fraza de confirmare trebuie sa includa numarul de destinatari recalculat la momentul aprobarii');
assert.match(campaignOpsSource, /confirmationText !== expectedConfirmation/);
assert.match(campaignOpsSource, /sha256Hex/);
assert.match(campaignOpsSource, /campaign\.status !== 'draft'/, 'Editarea unei campanii trebuie restrictionata la starea draft');
assert.match(campaignOpsSource, /lawful_basis: 'legitimate_interest'/);
assert.match(campaignOpsSource, /source_url: location\.source_url/);

// --- outreachEmailPolicy.js: functiile pure necesare exista si nu ating Base44 direct -------------
const policySource = source('base44/shared/outreachEmailPolicy.js');
for (const fnName of [
  'verifySvixSignature', 'sendBatchViaResend', 'sendViaResend', 'buildUnsubscribeUrls',
  'createUnsubscribeToken', 'verifyUnsubscribeToken', 'legalConfig', 'complianceMissing',
  'isContactSuppressed', 'validateSenderEmail',
]) {
  assert.match(policySource, new RegExp(`export (?:async )?function ${fnName}\\(`), `Lipseste exportul ${fnName} din outreachEmailPolicy.js`);
}

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
