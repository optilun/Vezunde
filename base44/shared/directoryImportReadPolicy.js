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
