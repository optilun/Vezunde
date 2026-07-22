export const PATIENT_REQUEST_DISTRIBUTION_LOCK_TTL_MS = 2 * 60 * 1000;

const RETRY_DELAYS_MS = [0, 40, 80, 140, 220, 320];

function createLockToken() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquirePatientRequestDistributionLock(svc, requestId) {
  if (!requestId) return null;
  const token = createLockToken();

  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const now = Date.now();
    const staleBefore = new Date(now - PATIENT_REQUEST_DISTRIBUTION_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.PatientRequest.updateMany({
      id: requestId,
      $or: [
        { distribution_lock_token: { $exists: false } },
        { distribution_lock_token: '' },
        { distribution_lock_at: { $exists: false } },
        { distribution_lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        distribution_lock_token: token,
        distribution_lock_at: new Date(now).toISOString(),
      },
    });

    if (Number(result?.updated || 0) === 1) return { requestId, token };
  }

  return null;
}

export async function releasePatientRequestDistributionLock(svc, lock) {
  if (!lock?.requestId || !lock?.token) return false;
  try {
    const result = await svc.entities.PatientRequest.updateMany({
      id: lock.requestId,
      distribution_lock_token: lock.token,
    }, {
      $unset: {
        distribution_lock_token: '',
        distribution_lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
