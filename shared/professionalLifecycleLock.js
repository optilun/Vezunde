export const PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS = 5 * 60 * 1000;

const RETRY_DELAYS_MS = [0, 60, 100, 160, 240, 360, 520, 760];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function createLockToken() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquireProfessionalLifecycleLock(svc, user) {
  const email = normalizeEmail(user?.email);
  if (!email) return null;

  const token = createLockToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const now = Date.now();
    const staleBefore = new Date(now - PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.User.updateMany({
      email,
      $or: [
        { professional_lifecycle_lock_token: { $exists: false } },
        { professional_lifecycle_lock_token: '' },
        { professional_lifecycle_lock_at: { $exists: false } },
        { professional_lifecycle_lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        professional_lifecycle_lock_token: token,
        professional_lifecycle_lock_at: new Date(now).toISOString(),
      },
    });

    if (Number(result?.updated || 0) === 1) return { email, token };
  }

  return null;
}

export async function releaseProfessionalLifecycleLock(svc, lock) {
  if (!lock?.email || !lock?.token) return false;
  try {
    const result = await svc.entities.User.updateMany({
      email: lock.email,
      professional_lifecycle_lock_token: lock.token,
    }, {
      $unset: {
        professional_lifecycle_lock_token: '',
        professional_lifecycle_lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
