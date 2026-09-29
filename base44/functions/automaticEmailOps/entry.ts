import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  AUTOMATIC_EMAIL_CATALOG,
  AUTOMATIC_EMAIL_BY_KEY,
  EXTERNAL_EMAIL_CATALOG,
  renderAutomaticEmailText,
  sampleAutomaticEmailVariables,
  validateAutomaticEmailTemplate,
} from '../../shared/automaticEmailCatalog.js';

function response(body, status = 200) {
  return Response.json(body, { status });
}

function safeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    subject_template: row.subject_template,
    body_template: row.body_template,
    revision: row.revision || 1,
    updated_at: row.updated_at || row.updated_date || null,
    updated_by_email: row.updated_by_email || '',
  };
}

function view(definition, row) {
  const override = row?.is_active === true ? safeRow(row) : null;
  const subject = override?.subject_template || definition.subject;
  const body = override?.body_template || definition.body;
  const variables = sampleAutomaticEmailVariables();
  return {
    ...definition,
    override,
    effective_subject: subject,
    effective_body: body,
    preview_subject: renderAutomaticEmailText(subject, variables),
    preview_body: renderAutomaticEmailText(body, variables),
  };
}

async function audit(svc, user, key, action, previous, next) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'AutomaticEmailTemplate',
    entity_id: key,
    action_type: action,
    changed_fields: ['subject_template', 'body_template', 'is_active'],
    previous_values: JSON.stringify(previous || {}),
    new_values: JSON.stringify(next || {}),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: 'Schimbare sablon email automat din Administrare > Comunicare.',
    performed_at: new Date().toISOString(),
  }).catch(() => null);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return response({ error: 'Metoda nepermisa' }, 405);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return response({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return response({ error: 'Acces permis doar administratorilor VIASEE' }, 403);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = String(input.action || 'list');
    if (action === 'list') {
      const rows = await svc.entities.AutomaticEmailTemplate.list('-updated_date', 200).catch(() => []);
      const byKey = new Map();
      for (const row of rows) if (!byKey.has(row.template_key)) byKey.set(row.template_key, row);
      return response({
        templates: AUTOMATIC_EMAIL_CATALOG.map((definition) => view(definition, byKey.get(definition.key))),
        external: EXTERNAL_EMAIL_CATALOG,
        sample_variables: sampleAutomaticEmailVariables(),
      });
    }
    const key = String(input.key || '').trim();
    const definition = AUTOMATIC_EMAIL_BY_KEY[key];
    if (!definition) return response({ error: 'Sablonul nu exista in catalog.' }, 404);
    if (action === 'preview') {
      const subject = input.subject_template === undefined ? definition.subject : String(input.subject_template);
      const body = input.body_template === undefined ? definition.body : String(input.body_template);
      const error = validateAutomaticEmailTemplate(definition, subject, body);
      if (error) return response({ error }, 400);
      const variables = sampleAutomaticEmailVariables();
      return response({
        subject: renderAutomaticEmailText(subject, variables),
        body: renderAutomaticEmailText(body, variables),
        sample_variables: variables,
      });
    }
    if (!['save', 'reset'].includes(action)) return response({ error: 'Actiune invalida' }, 400);
    const existing = (await svc.entities.AutomaticEmailTemplate.filter({ template_key: key }, '-updated_date', 5))[0] || null;
    if (action === 'reset') {
      if (existing) {
        await svc.entities.AutomaticEmailTemplate.update(existing.id, {
          is_active: false,
          revision: Number(existing.revision || 0) + 1,
          updated_by_user_id: user.id,
          updated_by_email: user.email || '',
          updated_at: new Date().toISOString(),
        });
        await audit(svc, user, key, 'reset_automatic_email_template', safeRow(existing), { is_active: false });
      }
      return response({ success: true, template: view(definition, null) });
    }
    const subject = String(input.subject_template || '').trim();
    const body = String(input.body_template || '').trim();
    const error = validateAutomaticEmailTemplate(definition, subject, body);
    if (error) return response({ error }, 400);
    const values = {
      template_key: key,
      subject_template: subject,
      body_template: body,
      is_active: true,
      revision: Number(existing?.revision || 0) + 1,
      updated_by_user_id: user.id,
      updated_by_email: user.email || '',
      updated_at: new Date().toISOString(),
    };
    const saved = existing
      ? await svc.entities.AutomaticEmailTemplate.update(existing.id, values)
      : await svc.entities.AutomaticEmailTemplate.create(values);
    await audit(svc, user, key, 'save_automatic_email_template', safeRow(existing), safeRow(saved));
    return response({ success: true, template: view(definition, saved) });
  } catch (error) {
    return response({ error: error?.message || 'Emailurile automate nu au putut fi incarcate.' }, 500);
  }
});
