export class PatientOperationTimeoutError extends Error {
  constructor(operation, timeoutMs, requestId = null) {
    super(`${operation || "patient_operation"} timed out after ${timeoutMs}ms`);
    this.name = "PatientOperationTimeoutError";
    this.code = "PATIENT_OPERATION_TIMEOUT";
    this.operation = operation || "patient_operation";
    this.timeoutMs = timeoutMs;
    this.requestId = requestId;
  }
}

export function isPatientOperationTimeout(error) {
  return error?.code === "PATIENT_OPERATION_TIMEOUT"
    || error instanceof PatientOperationTimeoutError;
}

/**
 * @param {() => any | Promise<any>} execute
 * @param {{ timeoutMs?: number, operation?: string, requestId?: any, onTimeout?: (requestId: any) => void }} options
 * @returns {Promise<any>}
 */
export function withPatientOperationTimeout(execute, {
  timeoutMs,
  operation = "patient_operation",
  requestId = null,
  onTimeout,
} = {}) {
  const safeTimeout = Math.max(1, Number(timeoutMs) || 1);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout?.(requestId);
      reject(new PatientOperationTimeoutError(operation, safeTimeout, requestId));
    }, safeTimeout);

    Promise.resolve()
      .then(() => execute())
      .then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
  });
}

export function createPatientOperationGuard() {
  let generation = 0;
  let active = true;

  return {
    activate() {
      active = true;
    },
    begin() {
      generation += 1;
      return generation;
    },
    isCurrent(requestId) {
      return active && requestId === generation;
    },
    invalidate(requestId = null) {
      if (requestId === null || requestId === generation) generation += 1;
    },
    dispose() {
      active = false;
      generation += 1;
    },
  };
}
