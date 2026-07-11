import {
  getCanonicalServiceGroupIds,
  normalizeServiceKey,
} from './canonicalServiceRegistry.js';
import {
  CAPABILITY_KEYS,
  CARE_SETTING_KEYS,
  FUNCTIONAL_UNIT_KEYS,
  isCapabilityParentAllowed,
} from './locationOperationalRegistry.js';
import { getServiceOperationalContext } from './serviceOperationalTaxonomy.js';

const SERVICE_IDS = getCanonicalServiceGroupIds();
const MAX_UNITS = 30;
const MAX_CAPABILITIES = 30;
const MAX_RESOURCE_LINKS = 500;
const MAX_SUGGESTIONS = 50;

function clean(value) {
  return String(value || '').trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function resultError(error, fields = []) {
  return { valid: false, error, fields };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

export function validateServiceGroupObject(value, fieldName, allowedGroups = null) {
  if (value === undefined) return { valid: true, clean: {} };
  if (!isPlainObject(value)) return resultError(`${fieldName} trebuie să fie obiect`);
  const allowed = allowedGroups || Object.keys(SERVICE_IDS);
  const unknownGroups = Object.keys(value).filter((group) => !allowed.includes(group));
  if (unknownGroups.length > 0) return resultError('Grup de servicii nepermis', unknownGroups);
  const cleanValue = {};
  for (const [group, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) return resultError(`${fieldName}.${group} trebuie să fie listă`);
    const unique = uniqueStrings(ids);
    const invalid = unique.filter((id) => !SERVICE_IDS[group]?.includes(id));
    if (invalid.length > 0) return resultError('ID canonic invalid', invalid);
    if (unique.length > 0) cleanValue[group] = unique;
  }
  return { valid: true, clean: cleanValue };
}

export function validateRawRemovalKeys(value, allowRawRemovals = true) {
  if (value === undefined) return { valid: true, clean: [] };
  if (!allowRawRemovals) return resultError('Eliminarea cheilor legacy nu este permisă în acest flux');
  if (!Array.isArray(value)) return resultError('raw_removal_keys trebuie să fie listă');
  const cleanValue = uniqueStrings(value);
  if (cleanValue.some((key) => key.length > 160)) return resultError('Cheie legacy invalidă');
  const canonical = cleanValue.filter((key) => normalizeServiceKey(key).status === 'canonical');
  if (canonical.length > 0) return resultError('Cheile canonice trebuie eliminate prin removal_ids', canonical);
  return { valid: true, clean: cleanValue };
}

export function validateSuggestions(payload, allowSuggestions = true) {
  const raw = Array.isArray(payload?.suggestions)
    ? payload.suggestions
    : Array.isArray(payload?.custom_requests)
      ? payload.custom_requests
      : [];
  if (raw.length > MAX_SUGGESTIONS) return resultError('Prea multe sugestii într-un singur draft');
  if (raw.length > 0 && !allowSuggestions) return resultError('Sugestiile nu sunt permise în acest flux');
  const suggestions = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isPlainObject(item)) return resultError('Sugestie invalidă');
    const group = clean(item.group || 'optical_retail');
    const label = clean(item.label);
    const note = clean(item.note);
    const unitKey = clean(item.functional_unit_key || item.unit_key);
    const capabilityKey = clean(item.capability_key);
    if (!SERVICE_IDS[group]) return resultError('Grup de sugestie invalid', [group]);
    if (!label || label.length > 120) return resultError('Sugestia trebuie să aibă un nume scurt');
    if (note.length > 500) return resultError('Nota sugestiei este prea lungă');
    if (unitKey && !FUNCTIONAL_UNIT_KEYS.includes(unitKey)) return resultError('Unitate invalidă pentru sugestie', [unitKey]);
    if (capabilityKey && !CAPABILITY_KEYS.includes(capabilityKey)) return resultError('Capabilitate invalidă pentru sugestie', [capabilityKey]);
    const duplicateKey = `${group}:${label.toLowerCase()}:${unitKey}:${capabilityKey}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    suggestions.push({
      group,
      label,
      note,
      functional_unit_key: unitKey,
      capability_key: capabilityKey,
    });
  }
  return { valid: true, clean: suggestions };
}

export function validateFunctionalUnits(value, allowOperationalContext = true) {
  if (value === undefined) return { valid: true, clean: [] };
  if (!allowOperationalContext) return resultError('Unitățile funcționale nu sunt permise în acest flux');
  if (!Array.isArray(value) || value.length > MAX_UNITS) return resultError('functional_units trebuie să fie o listă validă');
  const seen = new Set();
  const cleanValue = [];
  for (const raw of value) {
    const row = typeof raw === 'string' ? { unit_key: raw } : raw;
    if (!isPlainObject(row)) return resultError('Unitate funcțională invalidă');
    const unitKey = clean(row.unit_key || row.key);
    const careSetting = clean(row.care_setting || 'not_applicable');
    const note = clean(row.note);
    if (!FUNCTIONAL_UNIT_KEYS.includes(unitKey)) return resultError('Cheie de unitate funcțională invalidă', [unitKey]);
    if (!CARE_SETTING_KEYS.includes(careSetting)) return resultError('Cadru de îngrijire invalid', [careSetting]);
    if (note.length > 500) return resultError('Nota unității este prea lungă');
    if (seen.has(unitKey)) continue;
    seen.add(unitKey);
    cleanValue.push({ unit_key: unitKey, care_setting: careSetting, note });
  }
  return { valid: true, clean: cleanValue };
}

export function validateCapabilities(value, functionalUnits, allowOperationalContext = true) {
  if (value === undefined) return { valid: true, clean: [] };
  if (!allowOperationalContext) return resultError('Capabilitățile nu sunt permise în acest flux');
  if (!Array.isArray(value) || value.length > MAX_CAPABILITIES) return resultError('capabilities trebuie să fie o listă validă');
  const unitKeys = new Set((functionalUnits || []).map((item) => item.unit_key));
  const seen = new Set();
  const cleanValue = [];
  for (const raw of value) {
    const row = typeof raw === 'string' ? { capability_key: raw } : raw;
    if (!isPlainObject(row)) return resultError('Capabilitate invalidă');
    const capabilityKey = clean(row.capability_key || row.key);
    const parentUnitKey = clean(row.parent_unit_key);
    const note = clean(row.note);
    if (!CAPABILITY_KEYS.includes(capabilityKey)) return resultError('Cheie de capabilitate invalidă', [capabilityKey]);
    if (!parentUnitKey || !unitKeys.has(parentUnitKey)) return resultError('Capabilitatea trebuie asociată unei unități selectate', [capabilityKey]);
    if (!isCapabilityParentAllowed(capabilityKey, parentUnitKey)) return resultError('Capabilitate incompatibilă cu unitatea părinte', [capabilityKey, parentUnitKey]);
    if (note.length > 500) return resultError('Nota capabilității este prea lungă');
    const duplicateKey = `${capabilityKey}:${parentUnitKey}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    cleanValue.push({ capability_key: capabilityKey, parent_unit_key: parentUnitKey, note });
  }
  return { valid: true, clean: cleanValue };
}

export function validateServiceUnitMap(value, functionalUnits, capabilities, allowOperationalContext = true) {
  if (value === undefined) return { valid: true, clean: {} };
  if (!allowOperationalContext) return resultError('Maparea serviciilor pe unități nu este permisă în acest flux');
  if (!isPlainObject(value)) return resultError('service_unit_map trebuie să fie obiect');
  const unitKeys = new Set((functionalUnits || []).map((item) => item.unit_key));
  const capabilityPairs = new Set((capabilities || []).map((item) => `${item.capability_key}:${item.parent_unit_key}`));
  const cleanValue = {};
  for (const [rawServiceKey, rawUnitKey] of Object.entries(value)) {
    const normalized = normalizeServiceKey(rawServiceKey);
    const serviceKey = normalized.canonicalKey;
    const unitKey = clean(rawUnitKey);
    if (!serviceKey) return resultError('Cheie de serviciu invalidă în service_unit_map', [rawServiceKey]);
    if (!unitKeys.has(unitKey)) return resultError('Serviciul trebuie asociat unei unități selectate', [serviceKey, unitKey]);
    const context = getServiceOperationalContext(serviceKey);
    const allowedUnits = new Set([context?.unitKey, ...(context?.fallbackUnitKeys || [])].filter(Boolean));
    if (allowedUnits.size > 0 && !allowedUnits.has(unitKey)) return resultError('Serviciu incompatibil cu unitatea selectată', [serviceKey, unitKey]);
    if (context?.capabilityKey && !capabilityPairs.has(`${context.capabilityKey}:${unitKey}`)) {
      return resultError('Serviciul necesită o capabilitate activă în unitatea selectată', [serviceKey, context.capabilityKey, unitKey]);
    }
    cleanValue[serviceKey] = unitKey;
  }
  return { valid: true, clean: cleanValue };
}

function validateResourceLinkRows(value, type, functionalUnits) {
  if (value === undefined) return { valid: true, clean: [] };
  if (!Array.isArray(value) || value.length > MAX_RESOURCE_LINKS) return resultError(`resource_links.${type} trebuie să fie listă validă`);
  const unitKeys = new Set((functionalUnits || []).map((item) => item.unit_key));
  const idField = type === 'professionals' ? 'assignment_id' : type === 'equipment' ? 'equipment_id' : 'facility_id';
  const seen = new Set();
  const cleanValue = [];
  for (const row of value) {
    if (!isPlainObject(row)) return resultError(`Legătură ${type} invalidă`);
    const id = clean(row[idField] || row.id);
    const units = type === 'professionals'
      ? uniqueStrings(row.unit_keys || row.functional_unit_keys)
      : [clean(row.unit_key || row.functional_unit_key)].filter(Boolean);
    if (!id || !/^[a-zA-Z0-9:_-]{1,160}$/.test(id)) return resultError(`Identificator invalid pentru ${type}`);
    if (units.length === 0 || units.some((unitKey) => !unitKeys.has(unitKey))) return resultError(`Legătura ${type} conține unități invalide`, units);
    const duplicateKey = `${id}:${units.sort().join(',')}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    cleanValue.push(type === 'professionals'
      ? { assignment_id: id, unit_keys: units }
      : { [idField]: id, unit_key: units[0] });
  }
  return { valid: true, clean: cleanValue };
}

export function validateResourceLinks(value, functionalUnits, allowOperationalContext = true) {
  if (value === undefined) return { valid: true, clean: { professionals: [], equipment: [], facilities: [] } };
  if (!allowOperationalContext) return resultError('Legăturile de resurse nu sunt permise în acest flux');
  if (!isPlainObject(value)) return resultError('resource_links trebuie să fie obiect');
  const unknown = Object.keys(value).filter((key) => !['professionals', 'equipment', 'facilities'].includes(key));
  if (unknown.length > 0) return resultError('Câmp necunoscut în resource_links', unknown);
  const professionals = validateResourceLinkRows(value.professionals, 'professionals', functionalUnits);
  if (!professionals.valid) return professionals;
  const equipment = validateResourceLinkRows(value.equipment, 'equipment', functionalUnits);
  if (!equipment.valid) return equipment;
  const facilities = validateResourceLinkRows(value.facilities, 'facilities', functionalUnits);
  if (!facilities.valid) return facilities;
  return { valid: true, clean: { professionals: professionals.clean, equipment: equipment.clean, facilities: facilities.clean } };
}

export function validateServiceConfigurationPayload(payload, options = {}) {
  if (!isPlainObject(payload)) return resultError('Payload invalid');
  const allowedFields = new Set([
    'selected_ids', 'removal_ids', 'raw_removal_keys', 'suggestions', 'custom_requests',
    'functional_units', 'capabilities', 'service_unit_map', 'resource_links', 'care_setting',
  ]);
  const unknown = Object.keys(payload).filter((key) => !allowedFields.has(key));
  if (unknown.length > 0) return resultError('Câmp nepermis', unknown);

  const selected = validateServiceGroupObject(payload.selected_ids, 'selected_ids', options.allowedGroups || null);
  if (!selected.valid) return selected;
  const removals = validateServiceGroupObject(payload.removal_ids, 'removal_ids', options.allowedGroups || null);
  if (!removals.valid) return removals;
  const rawRemovals = validateRawRemovalKeys(payload.raw_removal_keys, options.allowRawRemovals !== false);
  if (!rawRemovals.valid) return rawRemovals;
  const suggestions = validateSuggestions(payload, options.allowSuggestions !== false);
  if (!suggestions.valid) return suggestions;
  const functionalUnits = validateFunctionalUnits(payload.functional_units, options.allowOperationalContext !== false);
  if (!functionalUnits.valid) return functionalUnits;
  const capabilities = validateCapabilities(payload.capabilities, functionalUnits.clean, options.allowOperationalContext !== false);
  if (!capabilities.valid) return capabilities;
  const serviceUnitMap = validateServiceUnitMap(payload.service_unit_map, functionalUnits.clean, capabilities.clean, options.allowOperationalContext !== false);
  if (!serviceUnitMap.valid) return serviceUnitMap;
  const resourceLinks = validateResourceLinks(payload.resource_links, functionalUnits.clean, options.allowOperationalContext !== false);
  if (!resourceLinks.valid) return resourceLinks;
  const careSetting = clean(payload.care_setting || 'not_applicable');
  if (!CARE_SETTING_KEYS.includes(careSetting)) return resultError('care_setting invalid', [careSetting]);

  const hasSelected = Object.values(selected.clean).some((items) => items.length > 0);
  const hasRemoved = Object.values(removals.clean).some((items) => items.length > 0);
  const hasOperationalChanges = functionalUnits.clean.length > 0 || capabilities.clean.length > 0
    || Object.keys(serviceUnitMap.clean).length > 0
    || Object.values(resourceLinks.clean).some((items) => items.length > 0)
    || payload.care_setting !== undefined;
  if (!hasSelected && !hasRemoved && rawRemovals.clean.length === 0 && suggestions.clean.length === 0 && !hasOperationalChanges) {
    return resultError('Payload gol');
  }

  return {
    valid: true,
    clean: {
      selected_ids: selected.clean,
      removal_ids: removals.clean,
      raw_removal_keys: rawRemovals.clean,
      suggestions: suggestions.clean,
      functional_units: functionalUnits.clean,
      capabilities: capabilities.clean,
      service_unit_map: serviceUnitMap.clean,
      resource_links: resourceLinks.clean,
      care_setting: careSetting,
    },
  };
}
