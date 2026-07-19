import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(new URL('../src/components/workspace/provider/ProviderLeadContactAccess.jsx', import.meta.url), 'utf8');
const inbox = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');

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

assert.match(inbox, /import ProviderLeadContactAccess from "\.\/ProviderLeadContactAccess"/);
assert.match(inbox, /provider_contact\.access_after_consent/);
assert.match(inbox, /<ProviderLeadContactAccess/);
assert.match(inbox, /leadId=\{lead\.id\}/);
assert.match(inbox, /locationId=\{locationId\}/);
assert.match(inbox, /phone_available_for_request/);
assert.match(inbox, /Detalii Pro · Top 3/);
assert.match(inbox, /Telefonul rămâne ascuns/);
assert.match(inbox, /Chatul urmează într-o etapă distinctă/);
assert.doesNotMatch(inbox, /contact_phone\s*:/);
assert.doesNotMatch(inbox, /original_message|access_token_hash/);

console.log('Provider phone access UI checks passed.');
