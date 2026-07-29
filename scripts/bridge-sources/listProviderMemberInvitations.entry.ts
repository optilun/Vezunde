import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { handle as directoryImportOpsHandle } from '../../base44/functions/directoryOps/directoryImportOpsLatest.ts';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const DIRECTORY_IMPORT_LOGICAL_NAME = 'directoryImportOps';
const FUNCTION_DEPLOY_REVISION = 'viasee-directory-import-single-file-10';
console.info(`[VIASEE] listProviderMemberInvitations ${FUNCTION_DEPLOY_REVISION}`);

function res(body, status = 200) {
  return Response.json(body, { status });
}

function role(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'staff') return 'location_staff';
  return ROLES.includes(value) ? value : '';
}

function locIds(invitation) {
  return Array.isArray(invitation.invited_location_ids)
    ? invitation.invited_location_ids.filter(Boolean)
    : [];
}

function mask(email) {
  const [user, domain] = String(email || '').toLowerCase().split('@');
  return user && domain ? `${user.slice(0, 2)}***@${domain}` : '';
}

function safe(invitation) {
  return {
    id: invitation.id,
    organization_id: invitation.organization_id || null,
    invited_location_ids: locIds(invitation),
    invited_email_masked: mask(invitation.invited_email_normalized),
    proposed_role: invitation.proposed_role,
    invited_by_user_id: invitation.invited_by_user_id || '',
    status: invitation.status,
    expires_at: invitation.expires_at || null,
    accepted_by_user_id: invitation.accepted_by_user_id || '',
    accepted_at: invitation.accepted_at || null,
    revoked_by_user_id: invitation.revoked_by_user_id || '',
    revoked_at: invitation.revoked_at || null,
    created_date: invitation.created_date || null,
    updated_date: invitation.updated_date || null,
  };
}

async function access(svc, userId) {
  const memberships = await svc.entities.ProviderMembership.filter(
    { user_id: userId, status: 'active' },
    '-created_date',
    200,
  );
  const managerLocationIds = new Set();
  for (const membership of memberships) {
    if (
      ['organization_owner', 'location_manager'].includes(role(membership.role))
      && membership.location_id
    ) {
      managerLocationIds.add(membership.location_id);
    }
  }
  return managerLocationIds;
}

function routedRequest(req, payload) {
  const headers = new Headers(req.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(payload ?? {}),
  });
}

async function handleInvitationList(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const allowedLocationIds = await access(svc, user.id);
    if (allowedLocationIds.size === 0) {
      return res({ error: 'Nu ai dreptul sa vezi invitatii' }, 403);
    }
    const validStatuses = ['draft', 'pending', 'accepted', 'expired', 'revoked'];
    const statuses = Array.isArray(payload.statuses)
      ? payload.statuses.filter((status) => validStatuses.includes(status))
      : (validStatuses.includes(payload.status) ? [payload.status] : ['draft', 'pending']);
    const invitations = [];
    for (const status of statuses) {
      const rows = await svc.entities.ProviderMemberInvitation.filter(
        { status },
        '-created_date',
        200,
      );
      invitations.push(
        ...rows
          .filter((invitation) => locIds(invitation).some((id) => allowedLocationIds.has(id)))
          .map(safe),
      );
    }
    return res({ invitations });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
}

Deno.serve(async (req) => {
  const body = await req.clone().json().catch(() => null);
  if (body?.__function === DIRECTORY_IMPORT_LOGICAL_NAME) {
    return directoryImportOpsHandle(routedRequest(req, body.payload));
  }
  return handleInvitationList(req);
});
