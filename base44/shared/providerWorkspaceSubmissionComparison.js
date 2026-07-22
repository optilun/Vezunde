const LOCATION_DETAIL_FIELDS = [
  'public_display_name',
  'address',
  'public_phone',
  'public_email',
  'lat',
  'lng',
  'place_id',
];

const PUBLIC_PROFILE_FIELDS = [
  'public_display_name',
  'public_description',
  'public_phone',
  'public_email',
  'website_url',
  'facebook_url',
  'instagram_url',
  'linkedin_url',
];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value) {
  return normalizeText(value).replace(/[\s().-]+/g, '');
}

function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return raw;
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';
    if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
    if (parsed.pathname === '/') parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_error) {
    return raw.replace(/\/$/, '');
  }
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) ? number : normalizeText(value);
}

function canonicalizeGeneric(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeGeneric)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeGeneric(value[key])]),
    );
  }
  if (typeof value === 'string') return normalizeText(value);
  return value;
}

function normalizeField(section, key, value) {
  if (section === 'location_details') {
    if (key === 'lat' || key === 'lng') return normalizeCoordinate(value);
    if (key === 'public_phone') return normalizePhone(value);
    if (key === 'public_email') return normalizeEmail(value);
    return normalizeText(value);
  }
  if (section === 'public_profile') {
    if (key === 'public_phone') return normalizePhone(value);
    if (key === 'public_email') return normalizeEmail(value);
    if (['website_url', 'facebook_url', 'instagram_url', 'linkedin_url'].includes(key)) return normalizeUrl(value);
    return normalizeText(value);
  }
  return canonicalizeGeneric(value);
}

export function getCurrentSectionValues(section, entity = {}) {
  if (section === 'location_details') {
    return {
      public_display_name: entity.public_display_name || entity.name || '',
      address: entity.address || '',
      public_phone: entity.public_phone || entity.phone_public || '',
      public_email: entity.public_email || '',
      lat: entity.lat ?? null,
      lng: entity.lng ?? null,
      place_id: entity.place_id || '',
    };
  }
  if (section === 'public_profile') {
    return {
      public_display_name: entity.public_display_name || '',
      public_description: entity.public_description || '',
      public_phone: entity.public_phone || '',
      public_email: entity.public_email || '',
      website_url: entity.website_url || '',
      facebook_url: entity.facebook_url || '',
      instagram_url: entity.instagram_url || '',
      linkedin_url: entity.linkedin_url || '',
    };
  }
  return entity || {};
}

export function normalizeSubmissionPayload(section, payload = {}, options = {}) {
  if (section !== 'location_details' && section !== 'public_profile') return canonicalizeGeneric(payload || {});
  const fields = section === 'location_details' ? LOCATION_DETAIL_FIELDS : PUBLIC_PROFILE_FIELDS;
  const includeAll = options.includeAll === true;
  const result = {};
  for (const key of fields) {
    if (!includeAll && !hasOwn(payload, key)) continue;
    result[key] = normalizeField(section, key, payload?.[key]);
  }
  return result;
}

export function sameSubmissionPayload(section, left = {}, right = {}) {
  if (section === 'location_details' || section === 'public_profile') {
    const leftCanonical = normalizeSubmissionPayload(section, left, { includeAll: true });
    const rightCanonical = normalizeSubmissionPayload(section, right, { includeAll: true });
    return JSON.stringify(leftCanonical) === JSON.stringify(rightCanonical);
  }
  return JSON.stringify(canonicalizeGeneric(left || {})) === JSON.stringify(canonicalizeGeneric(right || {}));
}

export function changedSubmissionFields(section, payload = {}, currentEntity = {}) {
  const current = getCurrentSectionValues(section, currentEntity);
  const normalizedPayload = normalizeSubmissionPayload(section, payload);
  return Object.keys(normalizedPayload).filter(
    (key) => normalizeField(section, key, normalizedPayload[key]) !== normalizeField(section, key, current[key]),
  );
}

export function hasPublishedSectionChanges(section, payload = {}, currentEntity = {}) {
  return changedSubmissionFields(section, payload, currentEntity).length > 0;
}

export { LOCATION_DETAIL_FIELDS, PUBLIC_PROFILE_FIELDS };