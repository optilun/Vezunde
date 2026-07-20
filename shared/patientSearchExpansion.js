export const PATIENT_COUNTY_EXPANSION_VERSION = 'patient-county-expansion-v1';

function clean(value, maxLength = 800) {
  return String(value || '').trim().slice(0, maxLength);
}

export function patientSearchTextFromDraft(draft = {}) {
  const safeDraft = /** @type {any} */ (draft || {});
  const descriptions = (Array.isArray(safeDraft.answers) ? safeDraft.answers : [])
    .filter((answer) => answer?.question_key === 'descriere')
    .map((answer) => clean(answer?.answer_value, 800))
    .filter(Boolean);
  return [...new Set([clean(safeDraft.original_message, 800), ...descriptions].filter(Boolean))].join('. ');
}

export function countyExpansionDraft(draft = {}, data = {}) {
  const safeDraft = /** @type {any} */ (draft || {});
  const safeData = /** @type {any} */ (data || {});
  return {
    ...safeDraft,
    location_scope: 'county',
    county: clean(safeData.selected_county_name || safeDraft.county, 120),
    county_code: clean(safeData.selected_county_code || safeDraft.county_code, 10),
  };
}
