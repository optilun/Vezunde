import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(new URL('../src/components/workspace/provider/ProviderLeadContactAccess.jsx', import.meta.url), 'utf8');
const inbox = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');

assert.match(component, /providerLeadContactAccessOps/);
assert.match(component, /action: "status"/);
assert.match(component, /action: "read"/);
assert.match(component, /Vezi contactul aprobat/);
assert.match(component, /Ascunde contactul/);
assert.match(component, /fiecare citire este înregistrată/);
assert.match(component, /mailto:\$\{contact\.contact_email\}/);
assert.match(component, /tel:\$\{contact\.contact_phone\}/);
assert.doesNotMatch(component, /PatientRequestContact|ContactShareApproval|ProviderSubscription/);
assert.doesNotMatch(component, /original_message|request_access_token|access_token_hash/);
assert.doesNotMatch(component, /action: "read"[\s\S]{0,200}useEffect/);

assert.match(inbox, /ProviderLeadContactAccess/);
assert.match(inbox, /provider_contact\.access_after_consent/);
assert.match(inbox, /canAccessContact=\{canAccessContact\}/);
assert.match(inbox, /locationId=\{locationId\}/);
assert.match(inbox, /response\.response_type !== "cannot_help"/);
assert.doesNotMatch(inbox, /contact_email|contact_phone|PatientRequestContact/);
assert.doesNotMatch(inbox, /input\.plan_code|plan_code:/);

console.log('Provider contact access UI checks passed.');
