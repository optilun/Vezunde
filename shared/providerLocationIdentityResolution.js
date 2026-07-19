export const LOCATION_RESOLUTION_MODES = Object.freeze({
  CREATE_NEW: 'create_new',
  USE_EXISTING: 'use_existing',
  TRANSFER_EXISTING: 'transfer_existing',
});

export function normalizeIdentifier(value) {
  return String(value || '').trim();
}

export function candidateRelation(targetOrganizationId, submissionOrganizationId) {
  const target = normalizeIdentifier(targetOrganizationId);
  const destination = normalizeIdentifier(submissionOrganizationId);
  if (target && destination && target === destination) return 'same_organization';
  if (!target) return 'unassigned_directory';
  return 'other_organization';
}

export function isStrongDuplicateCandidate(candidate = {}) {
  const score = Number(candidate.score || 0);
  const reasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
  return candidate.confidence === 'high'
    || score >= 72
    || reasons.includes('telefon identic')
    || reasons.includes('aceeasi adresa')
    || reasons.includes('aceeași adresă');
}

export function hasStrongDuplicateCandidate(candidates = []) {
  return Array.isArray(candidates) && candidates.some(isStrongDuplicateCandidate);
}

export function validateLocationResolution({
  kind,
  resolutionMode,
  targetLocationId,
  candidates = [],
  targetOrganizationId,
  submissionOrganizationId,
  confirmCrossOrganizationTransfer = false,
  confirmSeparateLocation = false,
  note = '',
} = {}) {
  const normalizedKind = normalizeIdentifier(kind) || 'new_location_for_existing_organization';
  const mode = normalizeIdentifier(resolutionMode)
    || (normalizedKind === 'associate_existing_location'
      ? LOCATION_RESOLUTION_MODES.USE_EXISTING
      : LOCATION_RESOLUTION_MODES.CREATE_NEW);
  const targetId = normalizeIdentifier(targetLocationId);
  const normalizedNote = String(note || '').trim();
  const candidateIds = new Set((Array.isArray(candidates) ? candidates : [])
    .map((candidate) => normalizeIdentifier(candidate?.id || candidate?.location_id))
    .filter(Boolean));

  if (!Object.values(LOCATION_RESOLUTION_MODES).includes(mode)) {
    return { ok: false, error: 'Modul de rezolvare a identitatii este invalid' };
  }

  if (mode === LOCATION_RESOLUTION_MODES.CREATE_NEW) {
    if (normalizedKind === 'associate_existing_location') {
      return { ok: false, error: 'Solicitarea pentru un profil existent nu poate crea automat o locatie noua' };
    }
    if (hasStrongDuplicateCandidate(candidates)) {
      if (!confirmSeparateLocation) {
        return { ok: false, error: 'Confirma explicit ca este o locatie fizica diferita' };
      }
      if (normalizedNote.length < 20) {
        return { ok: false, error: 'Explica diferenta fata de potrivirea existenta in cel putin 20 de caractere' };
      }
    }
    return { ok: true, mode, relation: 'new_location', targetLocationId: '' };
  }

  if (!targetId) return { ok: false, error: 'Selecteaza profilul existent' };
  if (candidateIds.size > 0 && !candidateIds.has(targetId)) {
    return { ok: false, error: 'Profilul selectat nu face parte din potrivirile verificate' };
  }

  const relation = candidateRelation(targetOrganizationId, submissionOrganizationId);
  if (relation === 'other_organization') {
    if (mode !== LOCATION_RESOLUTION_MODES.TRANSFER_EXISTING) {
      return { ok: false, error: 'Profilul apartine altei organizatii si necesita transfer explicit' };
    }
    if (!confirmCrossOrganizationTransfer) {
      return { ok: false, error: 'Confirma transferul dintre organizatii' };
    }
    if (normalizedNote.length < 20) {
      return { ok: false, error: 'Transferul dintre organizatii necesita o nota de verificare de cel putin 20 de caractere' };
    }
  } else if (mode === LOCATION_RESOLUTION_MODES.TRANSFER_EXISTING) {
    return { ok: false, error: 'Transferul este disponibil numai pentru un profil asociat altei organizatii' };
  }

  return { ok: true, mode, relation, targetLocationId: targetId };
}
