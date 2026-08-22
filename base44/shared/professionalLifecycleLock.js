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

async function ensureLockRecord(svc, email) {
  const existing = await svc.entities.ProfessionalLifecycleLock.filter({ email }, '-created_date', 1);
  if (existing[0]) return existing[0];
  try {
    return await svc.entities.ProfessionalLifecycleLock.create({ email, lock_token: '', lock_at: null });
  } catch (_error) {
    // Race with another concurrent caller creating the same record - re-read instead of failing.
    const retried = await svc.entities.ProfessionalLifecycleLock.filter({ email }, '-created_date', 1);
    return retried[0] || null;
  }
}

// NOTE: Base44 does not allow bulk updates on the built-in User entity ("Bulk user update not
// allowed"), so this lock cannot live on the User record itself. Instead it uses a dedicated
// ProfessionalLifecycleLock record per email, following the same updateMany-by-id optimistic
// lock pattern used by the other lifecycle locks in this codebase (see patientRequestLifecycleLock.js,
// controlledChatLock.js, etc.), which all target custom entities rather than User.
export async function acquireProfessionalLifecycleLock(svc, user) {
  const email = normalizeEmail(user?.email);
  if (!email) return null;

  const lockRecord = await ensureLockRecord(svc, email);
  if (!lockRecord) return null;

  const token = createLockToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const now = Date.now();
    const staleBefore = new Date(now - PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.ProfessionalLifecycleLock.updateMany({
      id: lockRecord.id,
      $or: [
        { lock_token: { $exists: false } },
        { lock_token: '' },
        { lock_at: { $exists: false } },
        { lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        lock_token: token,
        lock_at: new Date(now).toISOString(),
      },
    });

    if (Number(result?.updated || 0) === 1) return { id: lockRecord.id, email, token };
  }

  return null;
}

export async function releaseProfessionalLifecycleLock(svc, lock) {
  if (!lock?.id || !lock?.token) return false;
  try {
    const result = await svc.entities.ProfessionalLifecycleLock.updateMany({
      id: lock.id,
      lock_token: lock.token,
    }, {
      $unset: {
        lock_token: '',
        lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
