import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { adminNotificationDetails, notifyAdmins } from '../../shared/adminNotifications.js';

// 2026-10-10. Anunturile pentru admin (clopotelul din panoul de admin).
// - list / mark_read / mark_all_read: doar admin.
// - report_submission: orice utilizator logat, DOAR pentru tichetul sau feedback-ul creat chiar de el
//   in ultimele 30 de minute (acestea se creeaza din browser, deci anuntul pleaca de aici).

const LIST_LIMIT = 60;
const MARK_LIMIT = 200;
const REPORT_WINDOW_MS = 30 * 60 * 1000;

const TICKET_CATEGORY_LABELS = {
  account: 'Cont',
  organization: 'Organizație',
  professional: 'Specialist',
  patient_request: 'Cerere de pacient',
  technical: 'Problemă tehnică',
  other: 'Altceva',
};
const TICKET_PRIORITY_LABELS = { low: 'prioritate mică', normal: '', high: 'prioritate mare', urgent: 'urgent' };
const ACCOUNT_MODE_LABELS = { personal: 'cont personal', provider: 'cont de furnizor', professional: 'cont de specialist', applicant: 'cont în curs de revendicare' };

const nowIso = () => new Date().toISOString();
const recent = (row) => {
  const created = Date.parse(row?.created_date || '');
  return Number.isFinite(created) && Date.now() - created <= REPORT_WINDOW_MS;
};

function publicRow(row) {
  return {
    id: row.id,
    event_type: row.event_type || '',
    category: row.category || 'system',
    title: row.title || '',
    details: row.details || '',
    admin_section: row.admin_section || '',
    admin_tab: row.admin_tab || '',
    source_entity_type: row.source_entity_type || '',
    source_entity_id: row.source_entity_id || '',
    read_at: row.read_at || null,
    email_status: row.email_status || '',
    email_skip_reason: row.email_skip_reason || '',
    created_date: row.created_date || null,
  };
}

async function reportSubmission(base44, user, payload) {
  const svc = base44.asServiceRole;
  const id = String(payload.id || '').trim();
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });

  if (payload.entity_type === 'SupportTicket') {
    const ticket = await svc.entities.SupportTicket.get(id).catch(() => null);
    if (!ticket || ticket.requester_user_id !== user.id || !recent(ticket)) return Response.json({ error: 'Tichetul nu a fost găsit' }, { status: 404 });
    const deletion = ticket.source === 'account_deletion_request';
    const result = await notifyAdmins(base44, {
      event: deletion ? 'account_deletion_requested' : 'support_ticket_created',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      details: adminNotificationDetails(TICKET_CATEGORY_LABELS[ticket.category] || 'Tichet', TICKET_PRIORITY_LABELS[ticket.priority] || ''),
    });
    return Response.json({ ok: true, status: result.status });
  }

  if (payload.entity_type === 'UserFeedback') {
    const feedback = await svc.entities.UserFeedback.get(id).catch(() => null);
    if (!feedback || feedback.user_id !== user.id || !recent(feedback)) return Response.json({ error: 'Feedback-ul nu a fost găsit' }, { status: 404 });
    const rating = Number(feedback.rating);
    const result = await notifyAdmins(base44, {
      event: 'user_feedback_created',
      entityType: 'UserFeedback',
      entityId: feedback.id,
      details: adminNotificationDetails(Number.isFinite(rating) && rating > 0 ? `Notă ${rating}/5` : '', ACCOUNT_MODE_LABELS[feedback.account_mode] || ''),
    });
    return Response.json({ ok: true, status: result.status });
  }

  return Response.json({ error: 'Tip necunoscut' }, { status: 400 });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || '');

    if (action === 'report_submission') return await reportSubmission(base44, user, payload || {});

    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori' }, { status: 403 });
    const entity = base44.asServiceRole.entities.AdminNotification;

    if (action === 'list') {
      const rows = await entity.list('-created_date', LIST_LIMIT).catch(() => []);
      const notifications = (rows || []).map(publicRow);
      return Response.json({
        notifications,
        unread_count: notifications.filter((row) => !row.read_at).length,
        limit: LIST_LIMIT,
      });
    }

    if (action === 'mark_read') {
      const ids = (Array.isArray(payload.ids) ? payload.ids : []).map((value) => String(value || '').trim()).filter(Boolean).slice(0, MARK_LIMIT);
      const readAt = nowIso();
      let updated = 0;
      for (const id of ids) {
        const ok = await entity.update(id, { read_at: readAt, read_by_user_id: user.id }).then(() => true).catch(() => false);
        if (ok) updated += 1;
      }
      return Response.json({ ok: true, updated });
    }

    if (action === 'mark_all_read') {
      const rows = await entity.list('-created_date', MARK_LIMIT).catch(() => []);
      const readAt = nowIso();
      let updated = 0;
      for (const row of rows || []) {
        if (row.read_at) continue;
        const ok = await entity.update(row.id, { read_at: readAt, read_by_user_id: user.id }).then(() => true).catch(() => false);
        if (ok) updated += 1;
      }
      return Response.json({ ok: true, updated });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || 'Eroare la anunturile pentru admin' }, { status: 500 });
  }
}
