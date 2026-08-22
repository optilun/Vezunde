import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(new URL('../src/components/workspace/provider/ProviderLeadContactAccess.jsx', import.meta.url), 'utf8');
// Redesign pe doua coloane (2026-08-18): ProviderLeadInboxLegacy.jsx mai decide doar
// entitlement-ul (provider_contact.access_after_consent / provider_chat.access); randarea
// efectiva a ProviderLeadContactAccess/ProviderLeadChat s-a mutat in leads/LeadDetailPanel.jsx,
// iar eticheta "Detalii Pro" in leads/LeadFullDetails.jsx. Verificam fiecare in locul lui real.
const orchestrator = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInboxLegacy.jsx', import.meta.url), 'utf8');
const detailPanel = await readFile(new URL('../src/components/workspace/provider/leads/LeadDetailPanel.jsx', import.meta.url), 'utf8');
const fullDetails = await readFile(new URL('../src/components/workspace/provider/leads/LeadFullDetails.jsx', import.meta.url), 'utf8');

assert.match(panel, /providerLeadContactAccessOps/);
assert.match(panel, /action: "status"/);
assert.match(panel, /action: "read"/);
assert.match(panel, /location_id: locationId/);
assert.match(panel, /lead_id: leadId/);
assert.match(panel, /Verifică acordul/);
assert.match(panel, /Afișează telefonul/);
assert.match(panel, /Fiecare citire este înregistrată în audit/);
assert.match(panel, /data\.contact\?\.contact_phone/);
assert.match(panel, /Telefon solicitat separat/);
assert.doesNotMatch(panel, /contact_name|contact_email|contact_preference/);
assert.doesNotMatch(panel, /localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(panel, /original_message|detailed_message|access_token_hash|request_id|requester_user_id/);
assert.doesNotMatch(panel, /useEffect\([\s\S]{0,500}providerLeadContactAccessOps/);

assert.match(orchestrator, /provider_contact\.access_after_consent/);
assert.match(orchestrator, /provider_chat\.access/);
assert.doesNotMatch(orchestrator, /contact_phone\s*:/);
assert.doesNotMatch(orchestrator, /original_message|access_token_hash/);

assert.match(detailPanel, /import ProviderLeadContactAccess from "\.\.\/ProviderLeadContactAccess"/);
assert.match(detailPanel, /import ProviderLeadChat from "\.\.\/ProviderLeadChat"/);
assert.match(detailPanel, /<ProviderLeadContactAccess/);
assert.match(detailPanel, /<ProviderLeadChat/);
assert.match(detailPanel, /leadId=\{lead\.id\}/);
assert.match(detailPanel, /locationId=\{locationId\}/);
assert.match(detailPanel, /phone_available_for_request/);
assert.match(detailPanel, /Telefonul rămâne separat/);
assert.match(detailPanel, /deschiderea explicită de către client/);
assert.doesNotMatch(detailPanel, /contact_phone\s*:/);
assert.doesNotMatch(detailPanel, /original_message|access_token_hash/);

assert.match(fullDetails, /Detalii Pro · Top 3/);

console.log('Provider phone access and controlled chat UI checks passed.');
