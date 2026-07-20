export const PROVIDER_DECISION_CONFIDENCE_CONTRACT_VERSION = 'provider-decision-confidence-v1';

function clean(value) {
  return String(value || '').trim();
}

function uniqueEvidence(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const code = clean(item?.code);
    const label = clean(item?.label);
    if (!code || !label || seen.has(code)) continue;
    seen.add(code);
    result.push({ code, label });
  }
  return result;
}

export function buildProviderDecisionConfidence({
  matchedServiceKeys = [],
  profileControlStatus = 'directory',
  availability = null,
  expansionTier = 'oras',
  professionalCount = 0,
  needLevel = 'general',
} = {}) {
  const serviceCount = [...new Set((matchedServiceKeys || []).map(clean).filter(Boolean))].length;
  const evidence = [];
  const limitations = [];

  if (serviceCount > 0) {
    evidence.push({
      code: 'eligible_service_match',
      label: serviceCount > 1
        ? `${serviceCount} servicii relevante sunt confirmate pentru aceasta cerere`
        : 'Serviciul relevant este confirmat pentru aceasta cerere',
    });
  }

  if (profileControlStatus === 'verified') {
    evidence.push({ code: 'verified_profile', label: 'Profilul locatiei este verificat de VIASEE' });
  } else if (profileControlStatus === 'claimed') {
    evidence.push({ code: 'claimed_profile', label: 'Profilul este administrat de furnizor' });
    limitations.push('Profilul nu are inca nivelul complet de verificare VIASEE.');
  } else {
    limitations.push('Profilul provine din director si nu este confirmat integral de furnizor.');
  }

  if (availability?.label) {
    evidence.push({ code: 'fresh_availability', label: `Disponibilitate actualizata: ${availability.label}` });
  } else {
    limitations.push('Disponibilitatea curenta nu este confirmata.');
  }

  if (Number(professionalCount) > 0) {
    evidence.push({
      code: 'professional_present',
      label: Number(professionalCount) === 1
        ? 'Exista un specialist asociat locatiei'
        : `Exista ${Number(professionalCount)} specialisti asociati locatiei`,
    });
  } else if (needLevel === 'specialized_medical') {
    limitations.push('Specialistul disponibil nu este afisat ca informatie publica separata.');
  }

  if (expansionTier === 'judet') {
    evidence.push({ code: 'county_scope', label: 'Locatia este in acelasi judet, dupa extinderea solicitata de tine' });
  } else {
    evidence.push({ code: 'local_scope', label: 'Locatia este in localitatea selectata' });
  }

  const evidenceCount = uniqueEvidence(evidence).length;
  let level = 'limited';
  if (profileControlStatus === 'verified' && serviceCount > 0 && evidenceCount >= 4) level = 'high';
  else if (['verified', 'claimed'].includes(profileControlStatus) && serviceCount > 0 && evidenceCount >= 3) level = 'good';

  const labels = {
    high: 'Potrivire foarte bine sustinuta',
    good: 'Potrivire bine sustinuta',
    limited: 'Potrivire cu informatii limitate',
  };
  const summaries = {
    high: 'Mai multe informatii confirmate sustin aceasta optiune.',
    good: 'Exista suficiente informatii confirmate pentru a lua in calcul aceasta optiune.',
    limited: 'Optiunea este relevanta, dar unele informatii importante nu sunt confirmate.',
  };
  const filledSegments = level === 'high' ? 3 : level === 'good' ? 2 : 1;

  return {
    contract_version: PROVIDER_DECISION_CONFIDENCE_CONTRACT_VERSION,
    level,
    label: labels[level],
    summary: summaries[level],
    filled_segments: filledSegments,
    total_segments: 3,
    evidence: uniqueEvidence(evidence).slice(0, 5),
    limitations: [...new Set(limitations.map(clean).filter(Boolean))].slice(0, 3),
    commercial_influence: false,
  };
}
