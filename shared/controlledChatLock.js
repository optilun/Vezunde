export const CONTROLLED_CHAT_LOCK_TTL_MS = 2 * 60 * 1000;

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

async function acquireEntityLock(entity, id, tokenField, atField) {
  if (!id) return null;
  const token = createToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const staleBefore = new Date(Date.now() - CONTROLLED_CHAT_LOCK_TTL_MS).toISOString();
    const result = await entity.updateMany({
      id,
      $or: [
        { [tokenField]: { $exists: false } },
        { [tokenField]: '' },
        { [atField]: { $exists: false } },
        { [atField]: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        [tokenField]: token,
        [atField]: new Date().toISOString(),
      },
    });
    if (Number(result?.updated || 0) === 1) return { id, token, tokenField, atField };
  }
  return null;
}

async function releaseEntityLock(entity, lock) {
  if (!lock?.id || !lock?.token) return false;
  try {
    const result = await entity.updateMany({
      id: lock.id,
      [lock.tokenField]: lock.token,
    }, {
      $unset: {
        [lock.tokenField]: '',
        [lock.atField]: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}

export function acquireControlledChatOpenLock(svc, leadId) {
  return acquireEntityLock(svc.entities.ProviderLead, leadId, 'conversation_lock_token', 'conversation_lock_at');
}

export function releaseControlledChatOpenLock(svc, lock) {
  return releaseEntityLock(svc.entities.ProviderLead, lock);
}

export function acquireControlledChatMessageLock(svc, conversationId) {
  return acquireEntityLock(svc.entities.PatientRequestConversation, conversationId, 'message_lock_token', 'message_lock_at');
}

export function releaseControlledChatMessageLock(svc, lock) {
  return releaseEntityLock(svc.entities.PatientRequestConversation, lock);
}