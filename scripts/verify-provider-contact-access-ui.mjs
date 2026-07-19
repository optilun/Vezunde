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
assert.match(panel, /Afișează datele aprobate/);
assert.match(panel, /Fiecare citire aprobată este înregistrată în audit/);
assert.match(panel, /contact\.contact_name/);
assert.match(panel, /contact\.contact_email/);
assert.match(panel, /contact\.contact_phone/);
assert.match(panel, /contact\.contact_preference/);
assert.match(panel, /Conversația VIASEE rămâne dezactivată/);
assert.doesNotMatch(panel, /localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(panel, /original_message|access_token_hash|request_id|requester_user_id/);
assert.doesNotMatch(panel, /useEffect\([\s\S]{0,500}providerLeadContactAccessOps/);

assert.match(inbox, /import ProviderLeadContactAccess from "\.\/ProviderLeadContactAccess"/);
assert.match(inbox, /provider_contact\.access_after_consent/);
assert.match(inbox, /<ProviderLeadContactAccess/);
assert.match(inbox, /leadId=\{lead\.id\}/);
assert.match(inbox, /locationId=\{locationId\}/);
assert.match(inbox, /enabled=\{canAccessContact\}/);
assert.match(inbox, /responseType=\{response\?\.response_type \|\| ""\}/);
assert.match(inbox, /Contactul nu este încărcat automat/);
assert.match(inbox, /Chatul și mesajele libere rămân dezactivate/);
assert.doesNotMatch(inbox, /contact_name|contact_email|contact_phone|original_message|access_token_hash/);

console.log('Provider contact access UI checks passed.');
