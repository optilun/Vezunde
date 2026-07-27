export const BASE44_AUTOMATIC_INVOKE_SCHEMA_PROFILE =
  'base44-automatic-supported-json-schema-subset-v1';

const OMITTED_SCHEMA_KEY_SET = new Set([
  'additionalProperties',
  'maxItems',
  'minItems',
  'maxLength',
  'minLength',
  'pattern',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneSupportedSchemaValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSupportedSchemaValue(item));
  }
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !OMITTED_SCHEMA_KEY_SET.has(key))
      .map(([key, item]) => [key, cloneSupportedSchemaValue(item)]),
  );
}

export function buildBase44AutomaticInvokeSchema(schema) {
  return cloneSupportedSchemaValue(isPlainObject(schema) ? schema : {});
}

export function findBase44AutomaticUnsupportedSchemaKeywords(schema) {
  const found = new Set();

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isPlainObject(value)) return;

    for (const [key, item] of Object.entries(value)) {
      if (OMITTED_SCHEMA_KEY_SET.has(key)) found.add(key);
      visit(item);
    }
  }

  visit(schema);
  return [...found].sort();
}
