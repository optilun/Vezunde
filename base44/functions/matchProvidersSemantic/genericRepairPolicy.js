const GENERIC_REPAIR_SERVICE_KEYS = new Set(['eyeglasses_repair', 'frame_repair']);
const ACCEPTED_CONFIRMATION_LEVELS = new Set(['provider_confirmed', 'vezunde_verified']);

export function getGenericRepairEligibility({
  canonicalKey,
  confirmationLevel,
  exposeFullDetails,
} = {}) {
  if (!GENERIC_REPAIR_SERVICE_KEYS.has(String(canonicalKey || '').trim())) return null;
  return exposeFullDetails === true
    && ACCEPTED_CONFIRMATION_LEVELS.has(String(confirmationLevel || '').trim());
}

export const GENERIC_REPAIR_MATCHING_POLICY = Object.freeze({
  service_keys: Object.freeze([...GENERIC_REPAIR_SERVICE_KEYS]),
  confirmation_levels: Object.freeze([...ACCEPTED_CONFIRMATION_LEVELS]),
});
