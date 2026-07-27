export const PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_PROFILE =
  'base44-automatic-controlled-text-json-v1';

export const PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_MAX_CHARACTERS = 65536;

const MAX_JSON_NESTING_DEPTH = 64;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function failure(reason) {
  return {
    ok: false,
    value: null,
    reason,
  };
}

function success(value, transport) {
  return {
    ok: true,
    value,
    reason: null,
    transport,
  };
}

function parseObjectCandidate(candidate, transport) {
  try {
    const parsed = JSON.parse(candidate);
    return isPlainObject(parsed)
      ? success(parsed, transport)
      : failure('top_level_object_required');
  } catch {
    return failure('malformed_json');
  }
}

function findSingleObjectCandidate(source) {
  const candidates = [];
  let start = -1;
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (stack.length === 0) {
      if (character === '}') return failure('malformed_json');
      if (character !== '{') continue;
      start = index;
      stack.push('{');
      inString = false;
      escaped = false;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{' || character === '[') {
      stack.push(character);
      if (stack.length > MAX_JSON_NESTING_DEPTH) {
        return failure('nesting_limit_exceeded');
      }
      continue;
    }
    if (character !== '}' && character !== ']') continue;

    const expectedOpening = character === '}' ? '{' : '[';
    if (stack.at(-1) !== expectedOpening) return failure('malformed_json');
    stack.pop();
    if (stack.length !== 0) continue;

    candidates.push(source.slice(start, index + 1));
    if (candidates.length > 1) return failure('ambiguous_json_objects');
    start = -1;
  }

  if (stack.length !== 0 || inString || escaped) return failure('incomplete_json');
  if (candidates.length === 0) return failure('json_object_not_found');
  return {
    ok: true,
    candidate: candidates[0],
  };
}

export function parsePatientConversationAutomaticOutput(value) {
  if (isPlainObject(value)) return success(value, 'object');
  if (typeof value !== 'string') return failure('top_level_object_required');
  if (value.length > PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_MAX_CHARACTERS) {
    return failure('output_too_large');
  }

  const normalized = value.replace(/^\uFEFF/, '').trim();
  if (!normalized) return failure('empty_output');

  try {
    const parsed = JSON.parse(normalized);
    return isPlainObject(parsed)
      ? success(parsed, 'json_string')
      : failure('top_level_object_required');
  } catch {
    // Base44 Automatic may wrap the single JSON object in Markdown or short prose.
  }

  if (normalized.startsWith('[') || normalized.endsWith(']')) {
    return failure('top_level_object_required');
  }

  const candidate = findSingleObjectCandidate(normalized);
  if (!candidate.ok) return candidate;
  return parseObjectCandidate(candidate.candidate, 'embedded_json_object');
}
