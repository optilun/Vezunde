export const DIRECTORY_MAPPING_CONTRACT_VERSION = 'directory-mapping-v1';

export const DIRECTORY_LINK_STATUSES = Object.freeze([
  'confirmed',
  'probable',
  'conflict',
  'rejected',
  'unassigned',
]);

export const DIRECTORY_LINK_CONFIDENCE = Object.freeze(['low', 'medium', 'high']);

export const DIRECTORY_IDENTITY_RELATIONSHIPS = Object.freeze([
  'duplicate_same_entity',
  'same_address_distinct_unit',
  'rebrand_successor',
  'unrelated',
]);

export const DIRECTORY_IDENTITY_RELATIONSHIP_LABELS = Object.freeze({
  duplicate_same_entity: 'Dublura a aceleiasi entitati',
  same_address_distinct_unit: 'Unitati distincte la aceeasi adresa',
  rebrand_successor: 'Aceeasi entitate dupa rebranding',
  unrelated: 'Fara relatie de identitate',
});

export const CANONICAL_LOCATION_TYPE_OPTIONS = Object.freeze([
  {
    provider_type: 'optica_medicala',
    provider_profile_type: 'independent_optical_store',
    label: 'Optica medicala independenta',
  },
  {
    provider_type: 'optica_medicala',
    provider_profile_type: 'optical_chain',
    label: 'Locatie a unui lant de optica',
  },
  {
    provider_type: 'optica_medicala',
    provider_profile_type: 'independent_optician',
    label: 'Optician independent cu locatie',
  },
  {
    provider_type: 'clinica_oftalmologica',
    provider_profile_type: 'ophthalmology_clinic',
    label: 'Clinica de oftalmologie',
  },
  {
    provider_type: 'cabinet_oftalmologic',
    provider_profile_type: 'ophthalmology_office',
    label: 'Cabinet de oftalmologie',
  },
  {
    provider_type: 'cabinet_optometric',
    provider_profile_type: 'independent_optometrist',
    label: 'Cabinet optometric independent',
  },
  {
    provider_type: 'optometrist_independent',
    provider_profile_type: 'independent_optometrist',
    label: 'Optometrist independent',
  },
  {
    provider_type: 'medic_oftalmolog_independent',
    provider_profile_type: 'independent_ophthalmologist',
    label: 'Medic oftalmolog independent',
  },
  {
    provider_type: 'laborator_optic',
    provider_profile_type: 'optical_laboratory_b2c',
    label: 'Laborator optic cu servicii pentru public',
  },
  {
    provider_type: 'laborator_optic',
    provider_profile_type: 'optical_laboratory_b2b',
    label: 'Laborator optic B2B',
  },
]);

function clean(value) {
  return String(value ?? '').trim();
}

function ascii(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeIdentityText(value) {
  return ascii(value)
    .replace(/\b(srl|sa|sc|cmi|pfa|ii|if)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAddressBase(value) {
  return ascii(value)
    .replace(/\b(strada|str|bulevardul|bulevard|bd|calea|piata|sos|soseaua|nr|numarul)\b/g, ' ')
    .replace(/\b(bloc|bl|scara|sc|etaj|et|apartament|ap|camera|cabinet|corp|pavilion|spatiu|unitatea|unitate|sectia|sectie|ambulatoriu)\b\s*[a-z0-9-]*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractUnitDiscriminator(value) {
  const source = ascii(value);
  const matches = source.match(/\b(bloc|bl|scara|sc|etaj|et|apartament|ap|camera|cabinet|corp|pavilion|spatiu|unitatea|unitate|sectia|sectie|ambulatoriu)\b\s*[a-z0-9-]*/g) || [];
  return matches
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' | ');
}

export function canonicalLocationTypeKey(providerType, providerProfileType) {
  return `${clean(providerType)}::${clean(providerProfileType)}`;
}

const CANONICAL_TYPE_KEYS = new Set(
  CANONICAL_LOCATION_TYPE_OPTIONS.map((option) => canonicalLocationTypeKey(
    option.provider_type,
    option.provider_profile_type,
  )),
);

export function isCanonicalLocationTypePair(providerType, providerProfileType) {
  return CANONICAL_TYPE_KEYS.has(canonicalLocationTypeKey(providerType, providerProfileType));
}

export function stableLocationPairKey(leftId, rightId) {
  const ids = [clean(leftId), clean(rightId)].filter(Boolean).sort();
  return ids.length === 2 && ids[0] !== ids[1] ? `${ids[0]}::${ids[1]}` : '';
}

export function validateIdentityRelationship(input = {}) {
  const primaryLocationId = clean(input.primary_location_id);
  const relatedLocationId = clean(input.related_location_id);
  const relationshipType = clean(input.relationship_type);
  const canonicalLocationId = clean(input.canonical_location_id);
  const pairKey = stableLocationPairKey(primaryLocationId, relatedLocationId);

  if (!pairKey) return { ok: false, error: 'Selecteaza doua locatii distincte.' };
  if (!DIRECTORY_IDENTITY_RELATIONSHIPS.includes(relationshipType)) {
    return { ok: false, error: 'Relatia de identitate nu este valida.' };
  }
  if (['duplicate_same_entity', 'rebrand_successor'].includes(relationshipType)
    && ![primaryLocationId, relatedLocationId].includes(canonicalLocationId)) {
    return { ok: false, error: 'Selecteaza profilul canonic care trebuie pastrat.' };
  }

  return {
    ok: true,
    pair_key: pairKey,
    primary_location_id: primaryLocationId,
    related_location_id: relatedLocationId,
    relationship_type: relationshipType,
    canonical_location_id: canonicalLocationId || null,
  };
}

export function mappingConfirmationToken(parts = []) {
  return ['directory-mapping-v1', ...parts.map(clean)].join(':');
}
