import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
  buildPatientConversationAgentPrompt,
  getPatientConversationAgentResponseSchema,
} from '../base44/shared/patientConversationAgent.js';
import {
  validatePatientConversationModelResponse,
} from '../base44/shared/patientConversationGuardrails.js';
import {
  PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_MAX_CHARACTERS,
  PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_PROFILE,
  parsePatientConversationAutomaticOutput,
} from '../base44/functions/matchProvidersSemantic/patientConversationAutomaticOutputParser.js';

const sample = {
  primary_intent: 'control_vedere',
  need_summary: 'Control de vedere',
};

assert.equal(
  PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_PROFILE,
  'base44-automatic-controlled-text-json-v1',
);
assert.deepEqual(parsePatientConversationAutomaticOutput(sample), {
  ok: true,
  value: sample,
  reason: null,
  transport: 'object',
});
assert.deepEqual(
  parsePatientConversationAutomaticOutput(JSON.stringify(sample)).value,
  sample,
);
assert.deepEqual(
  parsePatientConversationAutomaticOutput(
    `\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``,
  ).value,
  sample,
);
assert.deepEqual(
  parsePatientConversationAutomaticOutput(
    `Rezultatul cerut este:\n${JSON.stringify(sample)}\nFinal.`,
  ).value,
  sample,
);
assert.deepEqual(
  parsePatientConversationAutomaticOutput(
    '{"need_summary":"Text cu {acolade}, ghilimele \\"si escape\\\\uri\\"."}',
  ).value,
  {
    need_summary: 'Text cu {acolade}, ghilimele "si escape\\uri".',
  },
);

for (const [value, reason] of [
  ['', 'empty_output'],
  ['{"primary_intent":"control_vedere"', 'incomplete_json'],
  ['{"a":1}\n{"b":2}', 'ambiguous_json_objects'],
  ['[{"a":1}]', 'top_level_object_required'],
  ['nu exista json', 'json_object_not_found'],
  ['text {nu este json} final', 'malformed_json'],
]) {
  const result = parsePatientConversationAutomaticOutput(value);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.value, null);
}

const secret = 'NU_TREBUIE_SA_APARA_IN_DIAGNOSTICE';
const invalid = parsePatientConversationAutomaticOutput(
  `${secret} ${'x'.repeat(PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_MAX_CHARACTERS)}`,
);
assert.equal(invalid.reason, 'output_too_large');
assert(!JSON.stringify(invalid).includes(secret));

const schema = getPatientConversationAgentResponseSchema();
const automaticPrompt = buildPatientConversationAgentPrompt({
  conversation: [{ role: 'user', content: 'Vreau un control de vedere in Timisoara.' }],
});
const outputTemplateMarker = 'VIASEE_SEMANTIC_OUTPUT_TEMPLATE_JSON=';
const outputTemplateLine = automaticPrompt
  .split('\n')
  .find((line) => line.startsWith(outputTemplateMarker));
assert(outputTemplateLine, 'Automatic prompt must contain the exact semantic output template.');
const outputTemplate = JSON.parse(outputTemplateLine.slice(outputTemplateMarker.length));
assert.equal(
  outputTemplate.contract_version,
  PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
);
assert.deepEqual(
  Object.keys(outputTemplate).sort(),
  Object.keys(schema.properties).sort(),
);
assert.deepEqual(validatePatientConversationModelResponse(outputTemplate, schema), []);
for (const forbiddenField of [
  'semantic_intent',
  'user_provided_facts',
  'care_path_candidates',
  'provider_type_candidates',
]) {
  assert.equal(
    Object.hasOwn(outputTemplate, forbiddenField),
    false,
    `${forbiddenField} must not be present in the Automatic output template`,
  );
}
assert(automaticPrompt.includes(
  'Return one top-level JSON object matching the supplied output template exactly.',
));
assert(automaticPrompt.includes(
  'Do not wrap the output under another key and do not add fields not present in the template.',
));
const schemaInvalid = parsePatientConversationAutomaticOutput('{"unexpected":true}');
assert.equal(schemaInvalid.ok, true);
assert(validatePatientConversationModelResponse(schemaInvalid.value, schema).length > 0);

const coreSource = fs.readFileSync(
  new URL(
    '../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
    import.meta.url,
  ),
  'utf8',
);
const wrapperSource = fs.readFileSync(
  new URL(
    '../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
    import.meta.url,
  ),
  'utf8',
);

assert(coreSource.includes('parsePatientConversationAutomaticOutput(modelOutput)'));
assert(coreSource.includes('const raw = parsedAutomaticOutput.value;'));
assert(coreSource.includes("invalidModelOutputEnvelope('invalid_model_output_shape'"));
assert(coreSource.includes('validatePatientConversationModelResponse(raw, responseSchema)'));
assert(coreSource.includes("invalidModelOutputEnvelope('prohibited_model_output'"));
assert(coreSource.includes("invalidModelOutputEnvelope('noncanonical_model_output'"));
assert(!coreSource.includes('response_json_schema:'));
assert(wrapperSource.includes('delete automaticArgs.model;'));
assert(wrapperSource.includes('delete automaticArgs.response_json_schema;'));
assert(wrapperSource.includes('automatic_retry_enabled: false'));
assert(wrapperSource.includes('automatic_output_profile: PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_PROFILE'));
assert(!wrapperSource.includes('buildBase44AutomaticInvokeSchema'));
assert(!wrapperSource.includes("model: 'gpt_5_4'"));

console.log('Controlled Base44 Automatic output transport verified.');
