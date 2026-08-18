// Faza 1 din docs/plan-refactor-servicii-2026-08-18.md: functiile pure ale
// configurarii de servicii, mutate 1:1 din ProviderServicesWorkspaceOperational.jsx.
// Nu au stare, nu ating reteaua si nu randeaza nimic - de aceea pot fi folosite
// atat de hook (useProviderServicesConfig), cat si de componentele de prezentare.
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { PROVIDER_SERVICE_SECTIONS } from "@/lib/providerServiceWorkspaceSections";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import { getServiceOperationalContext } from "@/lib/serviceOperationalTaxonomy";

export const PROFILE_LABELS = {
  independent_optical_store: "optică medicală",
  optical_chain: "locație dintr-un lanț de optică",
  ophthalmology_clinic: "clinică de oftalmologie",
  ophthalmology_office: "cabinet de oftalmologie",
  independent_ophthalmologist: "medic oftalmolog",
  independent_optometrist: "cabinet de optometrie",
  independent_optician: "optician independent",
  optical_laboratory_b2c: "laborator optic",
  optical_laboratory_b2b: "laborator optic B2B",
  future_b2b_distributor: "furnizor B2B",
};

export const LEGACY_PROFILE_LABELS = {
  optica_medicala: "optică medicală",
  clinica_oftalmologica: "clinică de oftalmologie",
  cabinet_oftalmologic: "cabinet de oftalmologie",
  cabinet_optometric: "cabinet de optometrie",
  laborator_optic: "laborator optic",
  optometrist_independent: "optometrist independent",
  medic_oftalmolog_independent: "medic oftalmolog",
};

export const SERVICE_GROUP_BY_KEY = Object.fromEntries(
  Object.entries(SERVICE_GROUPS).flatMap(([group, config]) => (
    Object.keys(config.ids || {}).map((serviceKey) => [serviceKey, group])
  )),
);

export function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizedSearch(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function safeParse(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

export function backendFunctionMissing(error) {
  const message = String(error?.message || error?.error || error || "").toLowerCase();
  const status = Number(error?.status || error?.response?.status || 0);
  return status === 404 || /not found|not deployed|backend function|404/.test(message);
}

export function legacyServiceRows(serviceKeys = []) {
  return [...new Set(serviceKeys || [])]
    .filter((serviceKey) => !SERVICE_GROUP_BY_KEY[serviceKey])
    .map((serviceKey) => ({
      id: `legacy:${serviceKey}`,
      raw_key: serviceKey,
      label: serviceKey,
      catalog_status: "legacy_or_unknown",
      is_active: true,
    }));
}

export function serviceLabel(item) {
  return SERVICE_GROUPS[item.group]?.ids?.[item.id] || item.id;
}

export function normalizeSelected(selected = {}) {
  const result = {};
  Object.keys(selected).sort().forEach((group) => {
    if (!SERVICE_GROUPS[group]) return;
    const allowed = new Set(Object.keys(SERVICE_GROUPS[group].ids || {}));
    const ids = [...new Set((selected[group] || []).filter((id) => allowed.has(id)))].sort();
    if (ids.length > 0) result[group] = ids;
  });
  return result;
}

export function groupServiceKeys(serviceKeys = []) {
  const grouped = {};
  for (const serviceKey of serviceKeys) {
    const group = SERVICE_GROUP_BY_KEY[serviceKey];
    if (!group) continue;
    grouped[group] = grouped[group] || [];
    if (!grouped[group].includes(serviceKey)) grouped[group].push(serviceKey);
  }
  return normalizeSelected(grouped);
}

export function applyDraft(approved, payload = {}) {
  const result = Object.fromEntries(Object.entries(normalizeSelected(approved)).map(([group, ids]) => [group, [...ids]]));
  for (const [group, ids] of Object.entries(normalizeSelected(payload.selected_ids || {}))) {
    result[group] = [...new Set([...(result[group] || []), ...ids])];
  }
  for (const [group, ids] of Object.entries(normalizeSelected(payload.removal_ids || {}))) {
    const removed = new Set(ids);
    result[group] = (result[group] || []).filter((id) => !removed.has(id));
  }
  return normalizeSelected(result);
}

export function removalPayload(approved, desired) {
  const removals = {};
  const normalizedApproved = normalizeSelected(approved);
  const normalizedDesired = normalizeSelected(desired);
  for (const [group, ids] of Object.entries(normalizedApproved)) {
    const desiredIds = new Set(normalizedDesired[group] || []);
    const removed = ids.filter((id) => !desiredIds.has(id));
    if (removed.length > 0) removals[group] = removed;
  }
  return removals;
}

export function countSelected(selected) {
  return Object.values(selected || {}).reduce((sum, ids) => sum + (ids?.length || 0), 0);
}

export function configurationSignature(payload = {}) {
  const sortRows = (rows, keys) => [...(rows || [])]
    .map((row) => ({ ...row }))
    .sort((a, b) => keys.map((key) => String(a?.[key] || "")).join(":").localeCompare(keys.map((key) => String(b?.[key] || "")).join(":")));
  const serviceMap = Object.fromEntries(Object.entries(payload.service_unit_map || {}).sort(([a], [b]) => a.localeCompare(b)));
  const links = payload.resource_links || {};
  return JSON.stringify({
    selected_ids: normalizeSelected(payload.selected_ids || {}),
    raw_removal_keys: [...new Set(payload.raw_removal_keys || [])].sort(),
    suggestions: sortRows(payload.suggestions || [], ["group", "label", "functional_unit_key", "capability_key"]),
    functional_units: sortRows(payload.functional_units || [], ["unit_key", "care_setting"]),
    removal_unit_keys: [...new Set(payload.removal_unit_keys || [])].sort(),
    capabilities: sortRows(payload.capabilities || [], ["capability_key", "parent_unit_key"]),
    removal_capabilities: sortRows(payload.removal_capabilities || [], ["capability_key", "parent_unit_key"]),
    service_unit_map: serviceMap,
    cas_service_keys: [...new Set(payload.cas_service_keys || [])].sort(),
    resource_links: {
      professionals: sortRows((links.professionals || []).map((item) => ({ ...item, unit_keys: [...(item.unit_keys || [])].sort() })), ["assignment_id"]),
      equipment: sortRows(links.equipment || [], ["equipment_id", "unit_key"]),
      facilities: sortRows(links.facilities || [], ["facility_id", "unit_key"]),
    },
    resource_removals: {
      professionals: sortRows(payload.resource_removals?.professionals || [], ["assignment_id"]),
      equipment: sortRows(payload.resource_removals?.equipment || [], ["equipment_id"]),
      facilities: sortRows(payload.resource_removals?.facilities || [], ["facility_id"]),
    },
    care_setting: payload.care_setting || "",
  });
}

export function selectedServiceKeys(selected) {
  return [...new Set(Object.values(selected || {}).flat())];
}

export function isSelected(selected, item) {
  return (selected[item.group] || []).includes(item.id);
}

export function profileLabel(location) {
  return PROFILE_LABELS[location?.provider_profile_type]
    || LEGACY_PROFILE_LABELS[location?.provider_type]
    || "profilul acestei locații";
}

export function isB2B(location) {
  return ["optical_laboratory_b2b", "future_b2b_distributor"].includes(location?.provider_profile_type);
}

export function possibleUnits(section) {
  return [...new Set([section.unitKey, ...(section.fallbackUnitKeys || [])].filter(Boolean))];
}

export function defaultUnitForSection(section, activeUnits) {
  return possibleUnits(section).find((unitKey) => activeUnits.includes(unitKey)) || section.unitKey;
}

export function resolveSectionUnit(section, selected, serviceUnitMap, activeUnits) {
  const mapped = section.items
    .filter((item) => isSelected(selected, item))
    .map((item) => serviceUnitMap[item.id])
    .find((unitKey) => activeUnits.includes(unitKey) && possibleUnits(section).includes(unitKey));
  return mapped || defaultUnitForSection(section, activeUnits);
}

export function sectionsForProfile(layout, selected, sourceSections = PROVIDER_SERVICE_SECTIONS) {
  const allowed = new Set([...(layout.primary || []), ...(layout.secondary || [])]);
  const hidden = new Set(layout.hidden || []);
  return sourceSections.map((section) => {
    const items = section.items.filter((item) => allowed.has(item.group) || (hidden.has(item.group) && isSelected(selected, item)));
    return {
      ...section,
      // Sectiunea sursa (PROVIDER_SERVICE_SECTIONS) nu are camp "group" propriu.
      // Il calculam aici, o singura data, din primul serviciu al sectiunii - altfel
      // bulina de culoare din titlul sectiunii nu ar aparea niciodata.
      group: items[0]?.group || section.items[0]?.group || "",
      items,
    };
  }).filter((section) => section.items.length > 0);
}

export function unitRow(unitKey, careSetting) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const medical = definition?.kind?.startsWith("medical");
  return {
    unit_key: unitKey,
    care_setting: medical ? careSetting : (definition?.defaultCareSetting || "not_applicable"),
    note: "",
  };
}

export function inferCapabilities(selected, serviceUnitMap, activeUnits) {
  const map = new Map();
  for (const serviceKey of selectedServiceKeys(selected)) {
    const context = getServiceOperationalContext(serviceKey);
    if (!context?.capabilityKey) continue;
    const parent = serviceUnitMap[serviceKey]
      || [context.unitKey, ...(context.fallbackUnitKeys || [])].find((unitKey) => activeUnits.includes(unitKey));
    if (parent) map.set(`${context.capabilityKey}:${parent}`, { capability_key: context.capabilityKey, parent_unit_key: parent, note: "" });
  }
  return [...map.values()];
}

export function buildResourceLinks(config) {
  return {
    professionals: (config.assignments || [])
      .filter((item) => (item.functional_unit_keys || []).length > 0)
      .map((item) => ({ assignment_id: item.id, unit_keys: [...item.functional_unit_keys] })),
    equipment: (config.equipment || [])
      .filter((item) => item.functional_unit_key)
      .map((item) => ({ equipment_id: item.id, unit_key: item.functional_unit_key })),
    facilities: (config.facilities || [])
      .filter((item) => item.functional_unit_key)
      .map((item) => ({ facility_id: item.id, unit_key: item.functional_unit_key })),
  };
}

export function capabilityIdentity(item) {
  return `${item?.capability_key || ""}:${item?.parent_unit_key || ""}`;
}

export function resourceRemovalPayload(approved, desired) {
  const current = desired || { professionals: [], equipment: [], facilities: [] };
  const removals = { professionals: [], equipment: [], facilities: [] };

  const currentProfessionals = new Map((current.professionals || []).map((item) => [item.assignment_id, new Set(item.unit_keys || [])]));
  for (const item of approved.professionals || []) {
    const desiredUnits = currentProfessionals.get(item.assignment_id) || new Set();
    const removedUnits = (item.unit_keys || []).filter((unitKey) => !desiredUnits.has(unitKey));
    if (removedUnits.length > 0) removals.professionals.push({ assignment_id: item.assignment_id, unit_keys: removedUnits });
  }

  const currentEquipment = new Map((current.equipment || []).map((item) => [item.equipment_id, item.unit_key]));
  for (const item of approved.equipment || []) {
    if (currentEquipment.get(item.equipment_id) !== item.unit_key) removals.equipment.push({ equipment_id: item.equipment_id });
  }

  const currentFacilities = new Map((current.facilities || []).map((item) => [item.facility_id, item.unit_key]));
  for (const item of approved.facilities || []) {
    if (currentFacilities.get(item.facility_id) !== item.unit_key) removals.facilities.push({ facility_id: item.facility_id });
  }

  return removals;
}

export function normalizeSuggestions(payload = {}) {
  return Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.custom_requests)
      ? payload.custom_requests
      : [];
}

export function selectedCountForSection(selected, section) {
  return section.items.reduce((sum, item) => sum + (isSelected(selected, item) ? 1 : 0), 0);
}