import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { filterByIdList, getManyByIds } from '../../shared/providerWorkspaceBatchQueries.js';

const PROVIDER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'staff') return 'location_staff';
  return PROVIDER_ROLES.includes(value) ? value : '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

// 2026-10-01. Cererea de stergere a contului nu mai pleaca pe email (mailto), unde se putea pierde:
// devine un SupportTicket cu sursa de mai jos, vizibil in Admin -> Suport, cu termenul legal de
// raspuns (GDPR: o luna; folosim 30 de zile). O singura cerere deschisa per cont. Nimic nu se
// sterge automat: ticketul este lista de lucru pentru admin.
export const ACCOUNT_DELETION_REQUEST_SOURCE = 'account_deletion_request';
export const ACCOUNT_DELETION_RESPONSE_DAYS = 30;
const OPEN_TICKET_STATUSES = ['open', 'in_progress', 'waiting_user'];

function deletionDueAt(createdAt) {
  const created = new Date(createdAt || Date.now());
  const base = Number.isNaN(created.getTime()) ? new Date() : created;
  return new Date(base.getTime() + ACCOUNT_DELETION_RESPONSE_DAYS * 86400000).toISOString();
}

function deletionRequestView(ticket) {
  if (!ticket) return null;
  return {
    id: ticket.id,
    status: ticket.status || 'open',
    requested_at: ticket.created_date || null,
    due_at: deletionDueAt(ticket.created_date),
  };
}

function deletionRequestDescription({ user, blockers, summary, dueAt }) {
  return [
    'Utilizatorul a cerut stergerea contului din Setarile contului.',
    `Termen de raspuns: ${dueAt.slice(0, 10)} (${ACCOUNT_DELETION_RESPONSE_DAYS} de zile de la cerere).`,
    '',
    `Cont: ${user.id}`,
    `Membership-uri active la furnizori: ${summary.active_provider_membership_count}`,
    `Organizatii: ${summary.provider_organization_count} · Locatii: ${summary.provider_location_count}`,
    `Profil profesional: ${summary.has_professional_profile ? 'da' : 'nu'}`,
    '',
    blockers.length
      ? `Blocaje: ${blockers.map((blocker) => blocker.message).join(' ')}`
      : 'Blocaje: niciunul detectat automat (ultimul owner).',
    '',
    'Pasi: transfer sau inchidere acces la organizatii, arhivarea profilului profesional, apoi stergerea contului de login din Base44. Raspunde utilizatorului inainte de termen.',
  ].join('\n');
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || '').trim();

    const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    const activeMemberships = memberships.filter((membership) => normalizeRole(membership.role) && membership.location_id);
    const ownerOrganizationIds = new Set();
    const assignedLocationIds = unique(activeMemberships.map((membership) => membership.location_id));

    const ownerMemberships = activeMemberships.filter((item) => normalizeRole(item.role) === 'organization_owner');
    const locationsWithoutOrganization = await getManyByIds(
      svc.entities.ProviderLocation,
      ownerMemberships.filter((membership) => !membership.organization_id).map((membership) => membership.location_id),
    );
    for (const membership of ownerMemberships) {
      if (membership.organization_id) {
        ownerOrganizationIds.add(membership.organization_id);
        continue;
      }
      const location = locationsWithoutOrganization.get(membership.location_id);
      if (location?.organization_id) ownerOrganizationIds.add(location.organization_id);
    }

    const blockers = [];
    for (const organizationId of ownerOrganizationIds) {
      const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      const activeOwnerUserIds = new Set();

      // 2026-10-03. O citire grupata pentru toate locatiile organizatiei, nu una per locatie.
      const rows = await filterByIdList(svc.entities.ProviderMembership, 'location_id', locations.map((location) => location.id), { status: 'active' }, { sort: '-created_date' });
      for (const row of rows) {
        if (normalizeRole(row.role) === 'organization_owner' && row.user_id) activeOwnerUserIds.add(row.user_id);
      }

      if (activeOwnerUserIds.size === 1 && activeOwnerUserIds.has(user.id)) {
        const organizationName = organization?.public_display_name || organization?.name || 'organizatia administrata';
        blockers.push({
          code: 'LAST_ORGANIZATION_OWNER',
          organization_id: organizationId,
          organization_name: organizationName,
          message: `Esti ultimul owner activ pentru ${organizationName}. Rolul trebuie transferat inainte de stergerea contului.`,
        });
      }
    }

    const professionalProfiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 10).catch(() => []);
    const organizationIds = unique(activeMemberships.map((membership) => membership.organization_id));
    const accountSummary = {
      active_provider_membership_count: activeMemberships.length,
      provider_organization_count: organizationIds.length,
      provider_location_count: assignedLocationIds.length,
      has_professional_profile: professionalProfiles.length > 0,
    };

    const openRequests = await svc.entities.SupportTicket.filter({
      requester_user_id: user.id,
      source: ACCOUNT_DELETION_REQUEST_SOURCE,
      status: { $in: OPEN_TICKET_STATUSES },
    }, '-created_date', 5).catch(() => []);
    let openRequest = openRequests[0] || null;

    if (action === 'request') {
      // Cererea se inregistreaza si cand exista blocaje (dreptul la stergere nu depinde de ele);
      // blocajele intra in descriere, iar adminul le rezolva impreuna cu utilizatorul.
      if (!openRequest) {
        const dueAt = deletionDueAt(new Date().toISOString());
        openRequest = await svc.entities.SupportTicket.create({
          requester_user_id: user.id,
          requester_email: user.email || '',
          requester_name: user.full_name || user.name || '',
          category: 'account',
          subject: 'Cerere de stergere a contului',
          description: deletionRequestDescription({ user, blockers, summary: accountSummary, dueAt }),
          status: 'open',
          priority: 'high',
          source: ACCOUNT_DELETION_REQUEST_SOURCE,
          page_path: '/contul-meu',
          ...(professionalProfiles[0]?.id ? { professional_profile_id: professionalProfiles[0].id } : {}),
          ...(organizationIds[0] ? { organization_id: organizationIds[0] } : {}),
        });
      }
    } else if (action && action !== 'status') {
      return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    }

    return Response.json({
      can_request_deletion: blockers.length === 0,
      blockers,
      account_summary: accountSummary,
      deletion_request: deletionRequestView(openRequest),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

