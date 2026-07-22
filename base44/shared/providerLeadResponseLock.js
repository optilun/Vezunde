export const PROVIDER_LEAD_RESPONSE_LOCK_TTL_MS = 2 * 60 * 1000;

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

export async function acquireProviderLeadResponseLock(svc, leadId) {
  if (!leadId) return null;
  const token = createToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const staleBefore = new Date(Date.now() - PROVIDER_LEAD_RESPONSE_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.ProviderLead.updateMany({
      id: leadId,
      $or: [
        { response_lock_token: { $exists: false } },
        { response_lock_token: '' },
        { response_lock_at: { $exists: false } },
        { response_lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        response_lock_token: token,
        response_lock_at: new Date().toISOString(),
      },
    });
    if (Number(result?.updated || 0) === 1) return { leadId, token };
  }
  return null;
}

export async function releaseProviderLeadResponseLock(svc, lock) {
  if (!lock?.leadId || !lock?.token) return false;
  try {
    const result = await svc.entities.ProviderLead.updateMany({
      id: lock.leadId,
      response_lock_token: lock.token,
    }, {
      $unset: {
        response_lock_token: '',
        response_lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
