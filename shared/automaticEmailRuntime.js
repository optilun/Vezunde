import {
  AUTOMATIC_EMAIL_BY_KEY,
  renderAutomaticEmailText,
  validateAutomaticEmailTemplate,
} from './automaticEmailCatalog.js';

function safeFallback(fallback) {
  return {
    subject: String(fallback?.subject || '').replace(/[\r\n]+/g, ' ').slice(0, 180),
    body: String(fallback?.body || '').slice(0, 6000),
    template_source: 'default',
  };
}

// Overrides are optional: delivery must continue with the existing copy if the
// template entity is unavailable or a historical override is invalid.
export async function renderAutomaticEmail({ svc, key, fallback, variables = {} }) {
  const result = safeFallback(fallback);
  const definition = AUTOMATIC_EMAIL_BY_KEY[key];
  if (!definition || !svc?.entities?.AutomaticEmailTemplate) return result;
  let rows;
  try {
    rows = await svc.entities.AutomaticEmailTemplate.filter({ template_key: key, is_active: true }, '-updated_date', 5);
  } catch (_error) {
    return result;
  }
  const row = rows?.[0];
  if (!row || validateAutomaticEmailTemplate(definition, row.subject_template, row.body_template)) return result;
  const subject = renderAutomaticEmailText(row.subject_template, variables).replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
  const body = renderAutomaticEmailText(row.body_template, variables).trim().slice(0, 6000);
  if (!subject || !body) return result;
  return { subject, body, template_source: 'override', template_revision: row.revision || 1 };
}