function uniqueBy(candidates, keyFor) {
  const rows = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  const unique = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (key && !unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}

function locationTargets(states, locationsById) {
  const targets = [];
  for (const state of uniqueBy(states, (row) => row.location_id || row.id)) {
    const location = locationsById.get(state.location_id);
    if (location) targets.push(location);
  }
  return uniqueBy(targets, (row) => row.id);
}

export function resolveDirectoryOrganizationMatch({
  externalCandidates = [],
  nameCandidates = [],
} = {}) {
  const external = uniqueBy(externalCandidates, (row) => row.id);
  if (external.length > 1) {
    return {
      target: null,
      strategy: 'organization_external_key',
      confidence: 'none',
      error_code: 'multiple_organizations_for_external_key',
      candidate_ids: external.map((row) => row.id),
    };
  }
  if (external.length === 1) {
    return {
      target: external[0],
      strategy: 'organization_external_key',
      confidence: 'high',
      error_code: '',
      candidate_ids: [external[0].id],
    };
  }

  const byName = uniqueBy(nameCandidates, (row) => row.id);
  if (byName.length > 1) {
    return {
      target: null,
      strategy: 'organization_exact_name',
      confidence: 'none',
      error_code: 'multiple_organizations_for_exact_name',
      candidate_ids: byName.map((row) => row.id),
    };
  }
  if (byName.length === 1) {
    return {
      target: byName[0],
      strategy: 'organization_exact_name',
      confidence: 'high',
      error_code: '',
      candidate_ids: [byName[0].id],
    };
  }
  return {
    target: null,
    strategy: 'none',
    confidence: 'none',
    error_code: '',
    candidate_ids: [],
  };
}

export function resolveDirectoryLocationMatch({
  externalStates = [],
  exactFallbackCandidates = [],
  addressStates = [],
  locationsById = new Map(),
} = {}) {
  const uniqueExternalStates = uniqueBy(
    externalStates,
    (row) => row.location_id || row.id,
  );
  const externalTargets = locationTargets(externalStates, locationsById);
  if (externalTargets.length > 1) {
    return {
      target: null,
      strategy: 'location_external_key',
      confidence: 'none',
      error_code: 'multiple_locations_for_external_key',
      candidate_ids: externalTargets.map((row) => row.id),
    };
  }
  if (externalTargets.length === 1) {
    return {
      target: externalTargets[0],
      strategy: 'location_external_key',
      confidence: 'high',
      error_code: '',
      candidate_ids: [externalTargets[0].id],
    };
  }
  if (uniqueExternalStates.length > 0) {
    return {
      target: null,
      strategy: 'location_external_key',
      confidence: 'none',
      error_code: 'location_external_state_target_missing',
      candidate_ids: [],
    };
  }

  const exactFallback = uniqueBy(exactFallbackCandidates, (row) => row.id);
  if (exactFallback.length > 1) {
    return {
      target: null,
      strategy: 'exact_name_locality_address',
      confidence: 'none',
      error_code: 'multiple_locations_for_exact_identity',
      candidate_ids: exactFallback.map((row) => row.id),
    };
  }
  if (exactFallback.length === 1) {
    return {
      target: exactFallback[0],
      strategy: 'exact_name_locality_address',
      confidence: 'high',
      error_code: '',
      candidate_ids: [exactFallback[0].id],
    };
  }

  const uniqueAddressStates = uniqueBy(
    addressStates,
    (row) => row.location_id || row.id,
  );
  const addressTargets = locationTargets(addressStates, locationsById);
  if (addressTargets.length > 0) {
    return {
      target: null,
      strategy: 'address_fingerprint',
      confidence: 'none',
      error_code: 'address_match_requires_manual_identity_review',
      candidate_ids: addressTargets.map((row) => row.id),
    };
  }
  if (uniqueAddressStates.length > 0) {
    return {
      target: null,
      strategy: 'address_fingerprint',
      confidence: 'none',
      error_code: 'address_state_target_missing',
      candidate_ids: [],
    };
  }
  return {
    target: null,
    strategy: 'none',
    confidence: 'none',
    error_code: '',
    candidate_ids: [],
  };
}
