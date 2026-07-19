export const CONTACT_SHARE_APPROVAL_LOCK_TTL_MS = 2 * 60 * 1000;

const RETRY_DELAYS_MS = [0, 50, 90, 140, 220, 340, 520];

function createToken() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquireContactShareApprovalLock(svc, leadId) {
  if (!leadId) return null;
  const token = createToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const staleBefore = new Date(Date.now() - CONTACT_SHARE_APPROVAL_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.ProviderLead.updateMany({
      id: leadId,
      $or: [
        { contact_approval_lock_token: { $exists: false } },
        { contact_approval_lock_token: '' },
        { contact_approval_lock_at: { $exists: false } },
        { contact_approval_lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        contact_approval_lock_token: token,
        contact_approval_lock_at: new Date().toISOString(),
      },
    });
    if (Number(result?.updated || 0) === 1) return { leadId, token };
  }
  return null;
}

export async function releaseContactShareApprovalLock(svc, lock) {
  if (!lock?.leadId || !lock?.token) return false;
  try {
    const result = await svc.entities.ProviderLead.updateMany({
      id: lock.leadId,
      contact_approval_lock_token: lock.token,
    }, {
      $unset: {
        contact_approval_lock_token: '',
        contact_approval_lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
