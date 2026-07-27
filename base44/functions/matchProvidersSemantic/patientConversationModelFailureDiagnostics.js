export const PATIENT_CONVERSATION_MODEL_FAILURE_CLASSIFIER_VERSION =
  'viasee-patient-conversation-model-failure-classifier-v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clean(value, maxLength = 240) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizedHttpStatus(error) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode,
    error?.cause?.status,
    error?.cause?.statusCode,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value >= 100 && value <= 599) return value;
  }
  return null;
}

function diagnosticText(error) {
  const responseData = isPlainObject(error?.response?.data) ? error.response.data : {};
  const cause = isPlainObject(error?.cause) ? error.cause : {};
  return [
    error?.name,
    error?.code,
    error?.message,
    responseData?.code,
    responseData?.error,
    responseData?.message,
    cause?.name,
    cause?.code,
    cause?.message,
  ].map((value) => clean(value).toLowerCase()).filter(Boolean).join(' ');
}

function result(category, httpStatus, retryable, signalSource) {
  return {
    classifier_version: PATIENT_CONVERSATION_MODEL_FAILURE_CLASSIFIER_VERSION,
    category,
    http_status: httpStatus,
    retryable,
    signal_source: signalSource,
  };
}

export function classifyPatientConversationModelFailure(error) {
  const httpStatus = normalizedHttpStatus(error);
  const text = diagnosticText(error);

  if (text.includes('patient_conversation_model_invoker_unavailable')) {
    return result('invoker_unavailable', httpStatus, false, 'error_code');
  }
  if (
    text.includes('timeout')
    || text.includes('timed out')
    || text.includes('etimedout')
    || text.includes('econnaborted')
    || text.includes('aborterror')
    || text.includes('abort_err')
  ) {
    return result('timeout', httpStatus, true, 'error_signal');
  }
  if (
    text.includes('credit')
    || text.includes('quota')
    || text.includes('billing')
    || text.includes('payment')
    || text.includes('insufficient balance')
  ) {
    return result('credits_exhausted', httpStatus, false, 'error_signal');
  }
  if (httpStatus === 429 || text.includes('rate limit') || text.includes('too many requests')) {
    return result('rate_limited', httpStatus, true, httpStatus === 429 ? 'http_status' : 'error_signal');
  }
  if (httpStatus === 401 || text.includes('unauthorized') || text.includes('authentication')) {
    return result('authentication_failed', httpStatus, false, httpStatus === 401 ? 'http_status' : 'error_signal');
  }
  if (httpStatus === 403 || text.includes('forbidden') || text.includes('permission denied')) {
    return result('permission_denied', httpStatus, false, httpStatus === 403 ? 'http_status' : 'error_signal');
  }
  if (
    httpStatus === 400
    || httpStatus === 422
    || text.includes('response_json_schema')
    || text.includes('json schema')
    || text.includes('invalid request')
    || text.includes('validation')
    || text.includes('unsupported parameter')
  ) {
    return result('invalid_request', httpStatus, false, httpStatus ? 'http_status' : 'error_signal');
  }
  if (httpStatus === 404 || text.includes('model not found') || text.includes('unknown model')) {
    return result('model_not_found', httpStatus, false, httpStatus === 404 ? 'http_status' : 'error_signal');
  }
  if (
    text.includes('enotfound')
    || text.includes('eai_again')
    || text.includes('econnreset')
    || text.includes('network error')
    || text.includes('fetch failed')
  ) {
    return result('network_failure', httpStatus, true, 'error_signal');
  }
  if (
    (httpStatus !== null && httpStatus >= 500)
    || text.includes('service unavailable')
    || text.includes('temporarily unavailable')
    || text.includes('provider unavailable')
  ) {
    return result('provider_unavailable', httpStatus, true, httpStatus ? 'http_status' : 'error_signal');
  }

  return result('unknown', httpStatus, false, httpStatus ? 'http_status' : 'fallback');
}
