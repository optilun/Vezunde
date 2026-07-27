import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BASE44_AUTOMATIC_INVOKE_SCHEMA_PROFILE,
  buildBase44AutomaticInvokeSchema,
  findBase44AutomaticUnsupportedSchemaKeywords,
} from '../base44/functions/matchProvidersSemantic/patientConversationInvokeSchemaPolicy.js';

const strictSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: {
      type: 'string',
      enum: ['unknown', 'control_vedere'],
      maxLength: 80,
      pattern: '^[a-z_]+$',
    },
    facts: {
      type: 'object',
      additionalProperties: false,
      properties: {
        city: { type: 'string', maxLength: 120 },
        services: {
          type: 'array',
          maxItems: 12,
          items: { type: 'string' },
        },
      },
      required: ['city', 'services'],
    },
  },
  required: ['intent', 'facts'],
};

const compatible = buildBase44AutomaticInvokeSchema(strictSchema);

assert.equal(
  BASE44_AUTOMATIC_INVOKE_SCHEMA_PROFILE,
  'base44-automatic-supported-json-schema-subset-v1',
);
assert.deepEqual(findBase44AutomaticUnsupportedSchemaKeywords(strictSchema), [
  'additionalProperties',
  'maxItems',
  'maxLength',
  'pattern',
]);
assert.deepEqual(findBase44AutomaticUnsupportedSchemaKeywords(compatible), []);
assert.deepEqual(compatible.required, ['intent', 'facts']);
assert.deepEqual(compatible.properties.intent.enum, ['unknown', 'control_vedere']);
assert.equal(compatible.properties.facts.properties.services.items.type, 'string');
assert.equal(strictSchema.additionalProperties, false);
assert.equal(strictSchema.properties.intent.maxLength, 80);

const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
assert(wrapperSource.includes("from './patientConversationInvokeSchemaPolicy.js';"));
assert(wrapperSource.includes('buildBase44AutomaticInvokeSchema('));
assert(wrapperSource.includes('automaticArgs.response_json_schema = buildBase44AutomaticInvokeSchema('));
assert(wrapperSource.includes('response_schema_profile: BASE44_AUTOMATIC_INVOKE_SCHEMA_PROFILE'));
assert(wrapperSource.includes('delete automaticArgs.model;'));
assert(!wrapperSource.includes("model: 'gpt_5_4'"));

console.log('Base44 Automatic-compatible response schema policy verified.');
