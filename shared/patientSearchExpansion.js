export const PATIENT_COUNTY_EXPANSION_VERSION = 'patient-county-expansion-v1';

function clean(value, maxLength = 800) {
  return String(value || '').trim().slice(0, maxLength);
}

export function patientSearchTextFromDraft(draft = {}) {
  const descriptions = (Array.isArray(draft.answers) ? draft.answers : [])
    .filter((answer) => answer?.question_key === 'descriere')
    .map((answer) => clean(answer?.answer_value, 800))
    .filter(Boolean);
  return [...new Set([clean(draft.original_message, 800), ...descriptions].filter(Boolean))].join('. ');
}

export function countyExpansionDraft(draft = {}, data = {}) {
  return {
    ...draft,
    location_scope: 'county',
    county: clean(data.selected_county_name || draft.county, 120),
    county_code: clean(data.selected_county_code || draft.county_code, 10),
  };
}
