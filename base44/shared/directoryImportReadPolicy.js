function clean(value, maxLength = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function errorStatus(error) {
  for (const value of [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode,
  ]) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function directoryReadFailure(resourceName, error) {
  const resource = clean(resourceName, 160) || 'resursa directorului';
  const detail = clean(error?.message, 300);
  const failure = new Error(
    `Citirea ${resource} a esuat. Importul a fost oprit${detail ? `: ${detail}` : '.'}`,
  );
  failure.code = 'directory_read_failed';
  failure.resource = resource;
  failure.status = errorStatus(error);
  failure.cause = error;
  return failure;
}

export async function requireDirectoryRows(readPromise, resourceName = '') {
  try {
    const rows = await readPromise;
    if (!Array.isArray(rows)) {
      throw new TypeError('Raspunsul nu este o lista de inregistrari.');
    }
    return rows;
  } catch (error) {
    if (error?.code === 'directory_read_failed') throw error;
    throw directoryReadFailure(resourceName, error);
  }
}

export async function getDirectoryEntityOrNull(readPromise, resourceName = '') {
  try {
    return await readPromise;
  } catch (error) {
    if (errorStatus(error) === 404) return null;
    throw directoryReadFailure(resourceName, error);
  }
}

export function isDirectoryReadFailure(error) {
  return error?.code === 'directory_read_failed';
}

function transientStatus(error) {
  for (const candidate of [
    error,
    error?.cause,
    error?.response,
    error?.response?.data,
  ]) {
    const status = errorStatus(candidate);
    if ([408, 425, 429, 502, 503, 504].includes(status)) return status;
  }
  return null;
}

function transientMessage(error) {
  const parts = [];
  const seen = new Set();
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    parts.push(clean(current?.message, 500));
    parts.push(clean(current?.response?.data?.error, 500));
    current = current?.cause;
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function isTransientDirectoryExecutionFailure(error) {
  if (transientStatus(error)) return true;
  return /(rate\s*limit|too\s*many\s*requests|throttl|temporar(?:y|ily)?\s+unavailable|service\s+unavailable|gateway\s+timeout|timed?\s*out)/i.test(
    transientMessage(error),
  );
}
