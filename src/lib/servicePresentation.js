import { getCanonicalServiceDefinition } from "../../shared/canonicalServiceRegistry.js";
import {
  getProviderServiceSections,
  getPublicNeedSections,
} from "../../shared/serviceOperationalTaxonomy.js";

const providerSections = getProviderServiceSections();
const publicDefinitions = getPublicNeedSections();

function uniqueItems(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = `${item.group}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...item });
  }
  return result;
}

export const CLIENT_NEED_SECTIONS = publicDefinitions.map((definition) => {
  const matching = providerSections.filter((section) => section.publicNeedKey === definition.key);
  const items = uniqueItems(matching.flatMap((section) => section.items)
    .filter((item) => getCanonicalServiceDefinition(item.id)?.patient_facing !== false));
  return {
    key: definition.key,
    title: definition.label,
    publicLabel: definition.label,
    description: matching.map((section) => section.description).filter(Boolean)[0] || "",
    note: matching.map((section) => section.note).filter(Boolean)[0] || "",
    items,
  };
}).filter((section) => section.items.length > 0);

export const PRIMARY_CLIENT_NEED_KEYS = CLIENT_NEED_SECTIONS.map((section) => section.key);
export const ADVANCED_CLIENT_NEED_KEYS = [
  "neuro_inflammation",
  "oculoplastics_lacrimal",
  "low_vision",
  "ocular_oncology",
  "procedures_treatments",
  "ophthalmology_surgery",
].filter((key) => PRIMARY_CLIENT_NEED_KEYS.includes(key));

export const CLIENT_NEED_BY_KEY = CLIENT_NEED_SECTIONS.reduce((acc, section) => {
  acc[section.key] = section;
  return acc;
}, {});

export const ITEM_TO_PUBLIC_SECTION = CLIENT_NEED_SECTIONS.reduce((acc, section) => {
  for (const item of section.items) {
    const key = `${item.group}:${item.id}`;
    if (!acc[key]) acc[key] = section;
  }
  return acc;
}, {});

export function getSectionSelectedCount(selected = {}, section) {
  return (section?.items || []).reduce(
    (sum, item) => sum + ((selected[item.group] || []).includes(item.id) ? 1 : 0),
    0,
  );
}

export function getSelectedNeedSections(selected = {}) {
  return CLIENT_NEED_SECTIONS.filter((section) => getSectionSelectedCount(selected, section) > 0);
}

export function summarizePublicServiceKeys(keys = []) {
  const set = new Set(keys.filter(Boolean));
  const results = [];
  const known = new Set();
  for (const section of CLIENT_NEED_SECTIONS) {
    const matchedIds = section.items
      .map((item) => item.id)
      .filter((id) => set.has(id));
    matchedIds.forEach((id) => known.add(id));
    if (matchedIds.length > 0) {
      results.push({
        key: section.key,
        label: section.publicLabel,
        count: matchedIds.length,
        matchedIds,
      });
    }
  }
  const unknownCount = [...set].filter((id) => !known.has(id)).length;
  if (unknownCount > 0) {
    results.push({ key: "other", label: "Alte servicii", count: unknownCount, matchedIds: [] });
  }
  return results;
}

export function summarizePublicServices(services = []) {
  return summarizePublicServiceKeys(
    services.map((service) => service?.key || service?.service_key || service).filter(Boolean),
  );
}
