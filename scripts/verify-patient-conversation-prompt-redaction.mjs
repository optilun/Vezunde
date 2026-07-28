import assert from 'node:assert/strict';
import {
  buildPatientConversationAgentPrompt,
} from '../shared/patientConversationAgent.js';
import {
  buildPatientConversationAgentPrompt as buildBase44PatientConversationAgentPrompt,
} from '../base44/shared/patientConversationAgent.js';

function promptJson(prompt, key) {
  const prefix = `${key}=`;
  const line = String(prompt).split('\n').find((item) => item.startsWith(prefix));
  assert(line, `Prompt field ${key} is missing.`);
  return JSON.parse(line.slice(prefix.length));
}

const rawContactText = [
  'Scrie-mi la model@example.com.',
  'Telefonul meu este +40 (722) 123 456.',
  'Identificator 1234567890123.',
  'Vreau un control in Timisoara.',
].join(' ');
const conversationInput = {
  conversation: [
    { role: 'assistant', content: 'Poti lasa datele de contact?' },
    { role: 'user', content: rawContactText },
  ],
};
const conversationPrompt = buildPatientConversationAgentPrompt(conversationInput);
const base44ConversationPrompt = buildBase44PatientConversationAgentPrompt(conversationInput);
assert.equal(base44ConversationPrompt, conversationPrompt);

const promptConversation = promptJson(conversationPrompt, 'CONVERSATION_JSON');
const serializedConversation = JSON.stringify(promptConversation);
for (const forbidden of [
  'model@example.com',
  '+40 (722) 123 456',
  '1234567890123',
]) {
  assert(!serializedConversation.includes(forbidden), `Prompt conversation leaked: ${forbidden}`);
}
assert(serializedConversation.includes('[email eliminat]'));
assert(serializedConversation.includes('[telefon eliminat]'));
assert(serializedConversation.includes('[identificator eliminat]'));
assert(serializedConversation.includes('Vreau un control in Timisoara.'));

const fallbackPrompt = buildPatientConversationAgentPrompt({
  text: 'Telefon 0722 123 456, vreau un control in Arad.',
});
const fallbackConversation = promptJson(fallbackPrompt, 'CONVERSATION_JSON');
assert.equal(fallbackConversation.length, 1);
assert.equal(fallbackConversation[0].role, 'user');
assert(!fallbackConversation[0].content.includes('0722 123 456'));
assert(fallbackConversation[0].content.includes('[telefon eliminat]'));
assert(fallbackConversation[0].content.includes('vreau un control in Arad'));

console.log('Patient conversation prompt contact redaction verified.');
