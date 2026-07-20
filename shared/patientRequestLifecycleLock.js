export const PATIENT_REQUEST_LIFECYCLE_LOCK_TTL_MS = 2 * 60 * 1000;

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

export async function acquirePatientRequestLifecycleLock(svc, requestId) {
  if (!requestId) return null;
  const token = createToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const staleBefore = new Date(Date.now() - PATIENT_REQUEST_LIFECYCLE_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.PatientRequest.updateMany({
      id: requestId,
      $or: [
        { lifecycle_lock_token: { $exists: false } },
        { lifecycle_lock_token: '' },
        { lifecycle_lock_at: { $exists: false } },
        { lifecycle_lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        lifecycle_lock_token: token,
        lifecycle_lock_at: new Date().toISOString(),
      },
    });
    if (Number(result?.updated || 0) === 1) return { requestId, token };
  }
  return null;
}

export async function releasePatientRequestLifecycleLock(svc, lock) {
  if (!lock?.requestId || !lock?.token) return false;
  try {
    const result = await svc.entities.PatientRequest.updateMany({
      id: lock.requestId,
      lifecycle_lock_token: lock.token,
    }, {
      $unset: {
        lifecycle_lock_token: '',
        lifecycle_lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
