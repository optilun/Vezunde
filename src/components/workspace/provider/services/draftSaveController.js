// Serializes draft saves. Only confirmed responses advance the saved signature.
export function createDraftSaveController({ delay = 1000, timers = globalThis } = {}) {
  let snapshot, confirmed, timer, flight, failedSignature, disposed = false;
  const cancel = () => { if (timer != null) timers.clearTimeout(timer); timer = null; };
  const update = next => {
    snapshot = next;
    if (next.baseline != null && (confirmed === undefined || (!flight && !next.dirty))) confirmed = next.baseline;
    if (!next.enabled) cancel();
  };
  const flush = () => {
    cancel();
    if (flight) return flight;
    if (disposed || !snapshot?.enabled) return Promise.resolve(!snapshot?.dirty);
    flight = (async () => {
      while (!disposed && snapshot?.enabled && snapshot.signature !== confirmed) {
        const record = snapshot;
        let saved = false;
        try { saved = await record.persist() === true; } catch { /* The form retains its selections. */ }
        if (!saved) { failedSignature = record.signature; return false; }
        confirmed = record.signature;
        failedSignature = undefined;
      }
      return !disposed && snapshot?.signature === confirmed;
    })().finally(() => { flight = undefined; });
    return flight;
  };
  const schedule = () => {
    cancel();
    if (disposed || !snapshot?.enabled || snapshot.signature === confirmed || snapshot.signature === failedSignature) return;
    timer = timers.setTimeout(() => { timer = null; void flush(); }, delay);
  };
  return { update, flush, schedule, cancel, dispose: () => { disposed = true; cancel(); } };
}
